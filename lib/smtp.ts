import nodemailer from "nodemailer";
import { z } from "zod";

export type SmtpConfig = {
  host: string;
  port: number;
  from: string;
  to: string;
  timeoutMs?: number;
};

export type SmtpDelivery =
  | { status: "sent"; provider: "smtp" }
  | { status: "unconfigured"; provider: "none" }
  | { status: "failed"; provider: "smtp"; code: "smtp_error" };

function validAddress(value: string) {
  return z.string().email().safeParse(value).success;
}

export function buildLeadNotification(args: {
  siteId: string;
  name: string;
  email: string;
  company?: string;
  message: string;
}) {
  return {
    subject: `SiteCraft 新询盘 · ${args.siteId.replace(/[\r\n]+/g, " ")}`,
    text: [
      `站点：${args.siteId}`,
      `姓名：${args.name}`,
      `邮箱：${args.email}`,
      `公司：${args.company || "待补充"}`,
      "",
      args.message,
    ].join("\n"),
  };
}

export async function sendSmtpMessage(config: SmtpConfig, subject: string, text: string): Promise<SmtpDelivery> {
  if (!config.host || !Number.isInteger(config.port) || config.port < 1 || config.port > 65535
    || !validAddress(config.from) || !validAddress(config.to)) {
    return { status: "unconfigured", provider: "none" };
  }
  const timeoutMs = config.timeoutMs ?? 5000;
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    connectionTimeout: timeoutMs,
    greetingTimeout: timeoutMs,
    socketTimeout: timeoutMs,
    dnsTimeout: timeoutMs,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
  try {
    const receipt = await transport.sendMail({ from: config.from, to: config.to, subject, text });
    return receipt.accepted.length === 1
      ? { status: "sent", provider: "smtp" }
      : { status: "failed", provider: "smtp", code: "smtp_error" };
  } catch {
    return { status: "failed", provider: "smtp", code: "smtp_error" };
  } finally {
    transport.close();
  }
}

export async function deliverLeadNotification(args: Parameters<typeof buildLeadNotification>[0]): Promise<SmtpDelivery> {
  // Delivery is opt-in to a server-configured recipient, never an AI-editable draft address.
  const host = process.env.SMTP_HOST?.trim() || "";
  const to = process.env.SMTP_TO?.trim() || "";
  if (!host || !validAddress(to)) return { status: "unconfigured", provider: "none" };
  const notification = buildLeadNotification(args);
  return sendSmtpMessage({
    host,
    port: Number(process.env.SMTP_PORT || 1025),
    from: process.env.SMTP_FROM?.trim() || "no-reply@sitecraft.local",
    to,
  }, notification.subject, notification.text);
}
