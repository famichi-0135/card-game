import type {
  TransactionalEmail,
  TransactionalEmailSender,
} from "./transactional-email.js";

type CreateCloudflareEmailSenderInput = {
  binding: SendEmail;
  from: EmailAddress;
};

export function createCloudflareEmailSender({
  binding,
  from,
}: CreateCloudflareEmailSenderInput): TransactionalEmailSender {
  return {
    async send(email: TransactionalEmail): Promise<void> {
      await binding.send({
        to: email.to,
        from,
        subject: email.subject,
        text: email.text,
        html: email.html,
      });
    },
  };
}
