import { NextRequest, NextResponse } from "next/server";
import { requireOrg } from "@/lib/org";
import {
  createWebhookEndpoint,
  listWebhookEndpoints,
  deleteWebhookEndpoint,
} from "@/lib/webhooks/subscriber-webhook";

export async function GET() {
  try {
    const { org } = await requireOrg();
    const endpoints = await listWebhookEndpoints(org.id);

    return NextResponse.json({
      endpoints: endpoints.map((e) => ({
        id: e.id,
        url: e.url,
        events: e.events,
        isActive: e.isActive,
        createdAt: e.createdAt,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { org } = await requireOrg();
    const body = await req.json();
    const { url, events } = body;

    if (!url || !url.startsWith("https://")) {
      return NextResponse.json(
        { error: "Webhook URL must start with https://" },
        { status: 400 }
      );
    }

    const endpoint = await createWebhookEndpoint(org.id, url, events);

    return NextResponse.json({
      id: endpoint.id,
      url: endpoint.url,
      events: endpoint.events,
      secret: endpoint.secret,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { org } = await requireOrg();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    await deleteWebhookEndpoint(id, org.id);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
