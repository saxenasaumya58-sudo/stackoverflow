import "server-only";
import crypto from "node:crypto";
import nodemailer from "nodemailer";
import twilio from "twilio";
import { addReputation } from "@/lib/reputation";

export function generateRandomPassword() {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  return Array.from(
    { length: 8 },
    () => alphabet[crypto.randomInt(alphabet.length)],
  ).join("");
}

function mockAllowed() {
  return process.env.ALLOW_MOCK_DELIVERY === "true" && process.env.NODE_ENV !== "production";
}
export async function sendEmail({
  to,
  subject,
  text,
  html,
  attachments,
  mockLabel,
  requireRealDelivery = false,
}) {
  const smtpPassword = process.env.SMTP_PASSWORD || process.env.SMTP_PASS;
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !smtpPassword) {
    if (requireRealDelivery || !mockAllowed()) throw new Error("SMTP is not configured.");
    console.info(`[mail mock]${mockLabel ? ` [${mockLabel}]` : ""} ${subject} -> ${to}\n${text || ""}`);
    return { mocked: true };
  }
  const transport = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: process.env.SMTP_SECURE === "true", auth: { user: process.env.SMTP_USER, pass: smtpPassword } });
  return transport.sendMail({ from: process.env.EMAIL_FROM || process.env.SMTP_USER, to, subject, text, html, attachments });
}
export async function sendSms({ to, body, mockLabel, requireRealDelivery = false }) {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_FROM_NUMBER) {
    if (requireRealDelivery || !mockAllowed()) throw new Error("SMS is not configured.");
    console.info(`[sms mock]${mockLabel ? ` ${mockLabel}` : ""} -> ${to}\n${body}`);
    return { mocked: true };
  }
  return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN).messages.create({ from: process.env.TWILIO_FROM_NUMBER, to, body });
}
export function normalizeIndianMobile(value) {
  const formatted = String(value || "").trim();
  if (!/^\+?[0-9\s().-]+$/.test(formatted))
    throw Object.assign(new Error("Enter a valid mobile number."), { status: 400 });

  let mobile = formatted.replace(/\D/g, "");
  if (mobile.startsWith("00")) mobile = mobile.slice(2);
  if (mobile.startsWith("91") && mobile.length === 12)
    mobile = mobile.slice(2);
  if (!/^[6-9]\d{9}$/.test(mobile))
    throw Object.assign(
      new Error("Enter a valid 10-digit Indian mobile number."),
      { status: 400 },
    );
  return mobile;
}
export const awardReputation = addReputation;
export async function sendLoginNotice(email, deviceLabel, location) {
  return sendEmail({ to: email, subject: "New sign-in to Commons", text: `A new sign-in was detected from ${deviceLabel}${location ? ` in ${location}` : ""}. If this wasn't you, revoke the session in Security > Devices.` });
}