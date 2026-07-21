import type { TransactionalEmailSender } from "../email/transactional-email.js";

export type AuthEmailMessage = {
  type: "email-verification" | "password-reset";
  to: string;
  userName: string;
  actionURL: string;
};

export interface AuthEmailService {
  send(message: AuthEmailMessage): Promise<void>;
}

export function createAuthEmailService(
  sender: TransactionalEmailSender,
): AuthEmailService {
  return {
    async send(message): Promise<void> {
      await sender.send(createEmail(message));
    },
  };
}

function createEmail(message: AuthEmailMessage) {
  const userName = escapeHTML(message.userName);
  const actionURL = escapeHTML(message.actionURL);

  if (message.type === "email-verification") {
    return {
      to: message.to,
      subject: "メールアドレスを確認してください",
      text: `${message.userName}さん\n\n次のURLからメールアドレスを確認してください。\n${message.actionURL}\n\nこの操作に心当たりがない場合は、このメールを破棄してください。`,
      html: `<p>${userName}さん</p><p>次のリンクからメールアドレスを確認してください。</p><p><a href="${actionURL}">メールアドレスを確認する</a></p><p>この操作に心当たりがない場合は、このメールを破棄してください。</p>`,
    };
  }

  return {
    to: message.to,
    subject: "パスワード再設定のご案内",
    text: `${message.userName}さん\n\n次のURLからパスワードを再設定してください。\n${message.actionURL}\n\nこの操作に心当たりがない場合は、パスワードを変更する必要はありません。`,
    html: `<p>${userName}さん</p><p>次のリンクからパスワードを再設定してください。</p><p><a href="${actionURL}">パスワードを再設定する</a></p><p>この操作に心当たりがない場合は、パスワードを変更する必要はありません。</p>`,
  };
}

function escapeHTML(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character] ?? character,
  );
}
