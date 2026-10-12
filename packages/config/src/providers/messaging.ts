import nodemailer, { type Transporter } from "nodemailer";
import type { Env } from "../env";
import { isSmsEffectivelyAvailable } from "../env";

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SmsMessage {
  to: string;
  body: string;
}

export interface MessagingProviders {
  /** Always available — the safety channel (messaging-domain.md). */
  sendMail(msg: MailMessage): Promise<void>;
  /** Null when SMS_GATEWAY=false or no provider configured. Callers must
   * check `smsAvailable` before calling — this is enforced again inside
   * the notification service, never left to route handlers. */
  smsAvailable: boolean;
  sendSms(msg: SmsMessage): Promise<void>;
}

let mailTransport: Transporter | null = null;

/** Resolved once at boot from env — see devops.md. */
export function createMessagingProviders(env: Env): MessagingProviders {
  if (!mailTransport) {
    mailTransport = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    });
  }

  const smsAvailable = isSmsEffectivelyAvailable(env);

  return {
    smsAvailable,
    async sendMail(msg) {
      await mailTransport!.sendMail({
        from: env.SMTP_FROM,
        to: msg.to,
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
      });
    },
    async sendSms(msg) {
      if (!smsAvailable) {
        // Hard-disabled at the provider layer too, not just the toggle
        // check upstream (devops.md: SMS_GATEWAY=false must hard-disable).
        throw new Error("SMS is not available: SMS_GATEWAY is false or unconfigured.");
      }
      // Wire up the concrete SMS gateway SDK here using env.SMS_*.
      throw new Error("SMS provider not yet wired — add gateway call here.");
    },
  };
}
