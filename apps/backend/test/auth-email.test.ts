import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { createAuth } from "../src/auth/create-auth.js";
import {
  createAuthEmailService,
  type AuthEmailMessage,
} from "../src/auth/auth-email-service.js";
import { createCloudflareEmailSender } from "../src/email/cloudflare-email-sender.js";
import type {
  TransactionalEmail,
  TransactionalEmailSender,
} from "../src/email/transactional-email.js";

const baseURL = "https://api.example.test";
const trustedOrigin = "https://app.example.test";
const testSecret = "test-only-better-auth-secret-32-chars";

describe("Better Auth認証メール", () => {
  it("登録時にメール確認を要求し、確認後だけログインできる", async () => {
    const messages: AuthEmailMessage[] = [];
    const backgroundTasks: Promise<unknown>[] = [];
    const auth = createEmailEnabledAuth(messages, backgroundTasks);
    const email = "verify-auth@example.com";

    const registration = await auth.handler(
      authRequest("/api/auth/sign-up/email", {
        name: "Verify Auth User",
        email,
        password: "a-secure-test-password",
        callbackURL: `${trustedOrigin}/auth/verified`,
      }),
    );

    expect(registration.status).toBe(200);
    expect(registration.headers.get("set-cookie")).toBeNull();
    expect(messages).toEqual([
      expect.objectContaining({
        type: "email-verification",
        to: email,
        userName: "Verify Auth User",
      }),
    ]);
    expect(backgroundTasks.length).toBeGreaterThanOrEqual(1);
    await Promise.all(backgroundTasks);

    const signInBeforeVerification = await auth.handler(
      authRequest("/api/auth/sign-in/email", {
        email,
        password: "a-secure-test-password",
      }),
    );
    expect(signInBeforeVerification.status).toBe(403);

    const verificationMessage = messages[0];
    if (verificationMessage?.type !== "email-verification") {
      throw new Error("メール確認メッセージが生成されませんでした。");
    }
    const verification = await auth.handler(
      new Request(verificationMessage.actionURL, {
        headers: { "cf-connecting-ip": "203.0.113.30" },
      }),
    );
    expect(verification.status).toBe(302);

    const signInAfterVerification = await auth.handler(
      authRequest("/api/auth/sign-in/email", {
        email,
        password: "a-secure-test-password",
      }),
    );
    expect(signInAfterVerification.status).toBe(200);
    expect(signInAfterVerification.headers.get("set-cookie")).toContain(
      "better-auth.session_token=",
    );
  });

  it("パスワード再設定メールを列挙耐性のある標準APIから予約する", async () => {
    const messages: AuthEmailMessage[] = [];
    const backgroundTasks: Promise<unknown>[] = [];
    const auth = createEmailEnabledAuth(messages, backgroundTasks);
    const email = "reset-auth@example.com";

    await auth.handler(
      authRequest("/api/auth/sign-up/email", {
        name: "Reset Auth User",
        email,
        password: "a-secure-test-password",
      }),
    );
    await Promise.all(backgroundTasks);
    const verificationMessage = messages[0];
    if (verificationMessage?.type !== "email-verification") {
      throw new Error("メール確認メッセージが生成されませんでした。");
    }
    await auth.handler(
      new Request(verificationMessage.actionURL, {
        headers: { "cf-connecting-ip": "203.0.113.30" },
      }),
    );
    const signIn = await auth.handler(
      authRequest("/api/auth/sign-in/email", {
        email,
        password: "a-secure-test-password",
      }),
    );
    const sessionCookie = getSessionCookie(signIn);

    messages.length = 0;
    backgroundTasks.length = 0;

    const response = await auth.handler(
      authRequest("/api/auth/request-password-reset", {
        email,
        redirectTo: `${trustedOrigin}/auth/reset-password`,
      }),
    );

    expect(response.status).toBe(200);
    expect(messages).toEqual([
      expect.objectContaining({
        type: "password-reset",
        to: email,
        userName: "Reset Auth User",
      }),
    ]);
    expect(backgroundTasks.length).toBeGreaterThanOrEqual(1);
    await Promise.all(backgroundTasks);

    const resetMessage = messages[0];
    if (resetMessage?.type !== "password-reset") {
      throw new Error("パスワード再設定メッセージが生成されませんでした。");
    }
    const resetRedirect = await auth.handler(
      new Request(resetMessage.actionURL, {
        headers: { "cf-connecting-ip": "203.0.113.30" },
      }),
    );
    expect(resetRedirect.status).toBe(302);
    const location = resetRedirect.headers.get("location");
    if (location === null) {
      throw new Error("パスワード再設定URLからリダイレクトされませんでした。");
    }
    const token = new URL(location).searchParams.get("token");
    if (token === null) {
      throw new Error("パスワード再設定URLにトークンがありません。");
    }

    const reset = await auth.handler(
      authRequest("/api/auth/reset-password", {
        token,
        newPassword: "a-new-secure-test-password",
      }),
    );
    expect(reset.status).toBe(200);

    const revokedSession = await auth.handler(
      new Request(`${baseURL}/api/auth/get-session`, {
        headers: { cookie: sessionCookie },
      }),
    );
    await expect(revokedSession.json()).resolves.toBeNull();

    const signInWithNewPassword = await auth.handler(
      authRequest("/api/auth/sign-in/email", {
        email,
        password: "a-new-secure-test-password",
      }),
    );
    expect(signInWithNewPassword.status).toBe(200);
  });
});

describe("Cloudflare Email Serviceアダプター", () => {
  it("テキストとHTMLの両方をSendEmail Bindingへ渡す", async () => {
    const sent: EmailMessageBuilder[] = [];
    const binding = {
      async send(message: EmailMessageBuilder) {
        sent.push(message);
        return { messageId: "test-message-id" };
      },
    } as unknown as SendEmail;
    const sender = createCloudflareEmailSender({
      binding,
      from: {
        email: "noreply@example.com",
        name: "Disastar Card Game",
      },
    });

    await sender.send({
      to: "player@example.com",
      subject: "認証メール",
      text: "確認してください。",
      html: "<p>確認してください。</p>",
    });

    expect(sent).toEqual([
      {
        to: "player@example.com",
        from: {
          email: "noreply@example.com",
          name: "Disastar Card Game",
        },
        subject: "認証メール",
        text: "確認してください。",
        html: "<p>確認してください。</p>",
      },
    ]);
  });

  it("メール本文へ埋め込む表示名をHTMLエスケープする", async () => {
    const emails: TransactionalEmail[] = [];
    const service = createAuthEmailService({
      async send(email) {
        emails.push(email);
      },
    });

    await service.send({
      type: "email-verification",
      to: "player@example.com",
      userName: '<img src=x onerror="alert(1)">',
      actionURL: `${baseURL}/api/auth/verify-email?token=test`,
    });

    expect(emails[0]?.html).not.toContain("<img");
    expect(emails[0]?.html).toContain(
      "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;",
    );
  });
});

function createEmailEnabledAuth(
  messages: AuthEmailMessage[],
  backgroundTasks: Promise<unknown>[],
) {
  const sender: TransactionalEmailSender = {
    async send() {},
  };
  const emailService = {
    async send(message: AuthEmailMessage) {
      messages.push(message);
      await sender.send({
        to: message.to,
        subject: "test",
        text: "test",
        html: "<p>test</p>",
      });
    },
  };

  return createAuth({
    database: env.DB,
    baseURL,
    secret: testSecret,
    trustedOrigins: [trustedOrigin],
    emailService,
    scheduleBackgroundTask(task) {
      backgroundTasks.push(task);
    },
  });
}

function authRequest(path: string, body: Record<string, unknown>): Request {
  return new Request(`${baseURL}${path}`, {
    method: "POST",
    headers: {
      "cf-connecting-ip": "203.0.113.30",
      "content-type": "application/json",
      origin: trustedOrigin,
    },
    body: JSON.stringify(body),
  });
}

function getSessionCookie(response: Response): string {
  const cookie = response.headers.get("set-cookie")?.split(";", 1)[0];
  if (cookie === undefined) {
    throw new Error("認証レスポンスにセッションCookieがありません。");
  }
  return cookie;
}
