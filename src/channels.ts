// Delivery adapters. In SEND_MODE=dry_run nothing leaves the server.
import { EmailClient } from "@azure/communication-email";
import { config } from "./config.js";
import type { Channel } from "./flows.js";
import type { Rendered } from "./templates.js";

export interface Recipient {
  email: string | null;
  phone: string | null;
  telegram_chat_id: string | null;
}

export interface SendResult {
  status: "dry_run" | "sent";
  providerId?: string;
}

let emailClient: EmailClient | undefined;

async function sendEmail(to: string, m: NonNullable<Rendered["email"]>, unsubscribeUrl: string): Promise<string> {
  const c = config();
  if (!c.ACS_CONNECTION_STRING) throw new Error("ACS_CONNECTION_STRING is not set");
  emailClient ??= new EmailClient(c.ACS_CONNECTION_STRING);
  const poller = await emailClient.beginSend({
    senderAddress: c.EMAIL_FROM,
    recipients: { to: [{ address: to }] },
    content: { subject: m.subject, plainText: m.text, html: m.html },
    headers: { "List-Unsubscribe": `<${unsubscribeUrl}>` },
  });
  const res = await poller.pollUntilDone();
  if (res.status !== "Succeeded") throw new Error(`Azure email status ${res.status}: ${res.error?.message ?? ""}`);
  return res.id;
}

async function sendTelegram(chatId: string, m: NonNullable<Rendered["telegram"]>): Promise<string> {
  const token = config().TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set");
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: m.text }),
  });
  const j = (await r.json()) as { ok: boolean; result?: { message_id: number }; description?: string };
  if (!j.ok) throw new Error(`Telegram: ${j.description ?? r.status}`);
  return String(j.result?.message_id ?? "");
}

async function sendWhatsApp(phone: string, m: NonNullable<Rendered["whatsapp"]>): Promise<string> {
  const c = config();
  if (!c.WHATSAPP_TOKEN || !c.WHATSAPP_PHONE_NUMBER_ID) throw new Error("WhatsApp credentials are not set");
  const r = await fetch(`https://graph.facebook.com/${c.WHATSAPP_API_VERSION}/${c.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${c.WHATSAPP_TOKEN}` },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: phone.replace(/^\+/, ""),
      type: "template",
      template: {
        name: m.template,
        language: { code: "en" },
        components: [{ type: "body", parameters: m.params.map((text) => ({ type: "text", text })) }],
      },
    }),
  });
  const j = (await r.json()) as { messages?: { id: string }[]; error?: { message: string } };
  if (!r.ok || !j.messages?.[0]) throw new Error(`WhatsApp: ${j.error?.message ?? r.status}`);
  return j.messages[0].id;
}

export async function deliver(
  channel: Channel,
  to: Recipient,
  rendered: Rendered[Channel],
  unsubscribeUrl: string,
): Promise<SendResult> {
  if (config().SEND_MODE === "dry_run") return { status: "dry_run" };
  if (channel === "email") {
    return { status: "sent", providerId: await sendEmail(to.email!, rendered as NonNullable<Rendered["email"]>, unsubscribeUrl) };
  }
  if (channel === "telegram") {
    return { status: "sent", providerId: await sendTelegram(to.telegram_chat_id!, rendered as NonNullable<Rendered["telegram"]>) };
  }
  return { status: "sent", providerId: await sendWhatsApp(to.phone!, rendered as NonNullable<Rendered["whatsapp"]>) };
}
