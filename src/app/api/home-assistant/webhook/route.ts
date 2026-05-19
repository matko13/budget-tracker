import { NextResponse } from "next/server";

const CALLMEBOT_URL = "https://api.callmebot.com/whatsapp.php";

interface WebhookPayload {
  message: string;
  title?: string;
  priority?: "low" | "normal" | "high";
  device?: string;
}

function validateWebhookSecret(request: Request): boolean {
  const secret = process.env.HA_WEBHOOK_SECRET;
  if (!secret) return false;

  const authHeader = request.headers.get("authorization");
  if (authHeader) {
    return authHeader === `Bearer ${secret}`;
  }

  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret");
  return querySecret === secret;
}

async function sendWhatsApp(message: string): Promise<{ ok: boolean; status: number }> {
  const phone = process.env.WHATSAPP_PHONE;
  const apikey = process.env.WHATSAPP_APIKEY;

  if (!phone || !apikey) {
    throw new Error("Missing WHATSAPP_PHONE or WHATSAPP_APIKEY env vars");
  }

  const params = new URLSearchParams({
    phone,
    text: message,
    apikey,
  });

  const response = await fetch(`${CALLMEBOT_URL}?${params.toString()}`, {
    method: "GET",
  });

  return { ok: response.ok, status: response.status };
}

export async function POST(request: Request) {
  try {
    if (!validateWebhookSecret(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: WebhookPayload = await request.json();

    if (!body.message) {
      return NextResponse.json(
        { error: "Missing 'message' field" },
        { status: 400 }
      );
    }

    let fullMessage = "";
    if (body.title) {
      fullMessage += `*${body.title}*\n\n`;
    }
    fullMessage += body.message;
    if (body.device) {
      fullMessage += `\n\n📱 ${body.device}`;
    }

    const result = await sendWhatsApp(fullMessage);

    if (!result.ok) {
      console.error("CallMeBot error:", result.status);
      return NextResponse.json(
        { error: "Failed to send WhatsApp message", status: result.status },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  if (!validateWebhookSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    status: "ok",
    service: "home-assistant-whatsapp-webhook",
    configured: !!(process.env.WHATSAPP_PHONE && process.env.WHATSAPP_APIKEY),
  });
}
