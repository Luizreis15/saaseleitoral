import { normalizePhoneDigits } from "@/lib/presence";

export type WhatsAppChannel = "evolution" | "meta" | "wa_me";

export type WhatsAppSendResult =
  | { ok: true; channel: WhatsAppChannel; to: string }
  | { ok: false; channel: WhatsAppChannel | null; to: string | null; error: string; shareUrl: string };

export function toWhatsAppE164(phone: string): string | null {
  const local = normalizePhoneDigits(phone);
  if (local.length < 10 || local.length > 11) return null;
  return `55${local}`;
}

export function buildPresenceWhatsAppMessage(params: {
  memberFirstName: string;
  locationName: string;
  url: string;
  otp: string;
  expiresAt: string;
}): string {
  const expires = new Date(params.expiresAt).toLocaleString("pt-BR");
  return [
    `Olá, ${params.memberFirstName}!`,
    `Digital Hera — confirmação de presença em ${params.locationName}.`,
    "",
    `Abra o link e mantenha a página aberta:`,
    params.url,
    "",
    `Código: ${params.otp}`,
    `Válido até: ${expires}`,
  ].join("\n");
}

export function buildWhatsAppShareUrl(phone: string, message: string): string {
  const e164 = toWhatsAppE164(phone);
  const text = encodeURIComponent(message);
  if (!e164) return `https://wa.me/?text=${text}`;
  return `https://wa.me/${e164}?text=${text}`;
}

function evolutionConfigured() {
  return Boolean(
    process.env.WHATSAPP_EVOLUTION_URL &&
      process.env.WHATSAPP_EVOLUTION_API_KEY &&
      process.env.WHATSAPP_EVOLUTION_INSTANCE
  );
}

function metaConfigured() {
  return Boolean(process.env.WHATSAPP_META_TOKEN && process.env.WHATSAPP_META_PHONE_NUMBER_ID);
}

export function getWhatsAppProvider(): WhatsAppChannel | null {
  if (evolutionConfigured()) return "evolution";
  if (metaConfigured()) return "meta";
  return null;
}

async function sendViaEvolution(toE164: string, text: string): Promise<void> {
  const base = process.env.WHATSAPP_EVOLUTION_URL!.replace(/\/$/, "");
  const instance = process.env.WHATSAPP_EVOLUTION_INSTANCE!;
  const apiKey = process.env.WHATSAPP_EVOLUTION_API_KEY!;

  const res = await fetch(`${base}/message/sendText/${instance}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: apiKey,
    },
    body: JSON.stringify({
      number: toE164,
      text,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Evolution API ${res.status}: ${body.slice(0, 180)}`);
  }
}

async function sendViaMeta(toE164: string, text: string): Promise<void> {
  const token = process.env.WHATSAPP_META_TOKEN!;
  const phoneNumberId = process.env.WHATSAPP_META_PHONE_NUMBER_ID!;
  const version = process.env.WHATSAPP_META_API_VERSION?.trim() || "v21.0";

  const res = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: toE164,
      type: "text",
      text: { preview_url: true, body: text },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Meta Cloud API ${res.status}: ${body.slice(0, 180)}`);
  }
}

/** Envia via API configurada; se não houver API, devolve link wa.me. */
export async function sendPresenceWhatsApp(params: {
  phone: string;
  message: string;
}): Promise<WhatsAppSendResult> {
  const to = toWhatsAppE164(params.phone);
  const shareUrl = buildWhatsAppShareUrl(params.phone, params.message);

  if (!to) {
    return {
      ok: false,
      channel: null,
      to: null,
      error: "Telefone inválido para WhatsApp.",
      shareUrl,
    };
  }

  const provider = getWhatsAppProvider();
  if (!provider) {
    return {
      ok: false,
      channel: "wa_me",
      to,
      error: "API WhatsApp não configurada. Use o atalho wa.me.",
      shareUrl,
    };
  }

  try {
    if (provider === "evolution") {
      await sendViaEvolution(to, params.message);
    } else {
      await sendViaMeta(to, params.message);
    }
    return { ok: true, channel: provider, to };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha no envio WhatsApp";
    return {
      ok: false,
      channel: provider,
      to,
      error: message,
      shareUrl,
    };
  }
}
