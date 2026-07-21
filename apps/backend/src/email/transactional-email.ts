export type TransactionalEmail = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export interface TransactionalEmailSender {
  send(email: TransactionalEmail): Promise<void>;
}
