import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { clients, events } from "@/db/schema";
import { OWNER_ID, serializeEvent } from "@/lib/orgazme";

const eventKinds = ["event", "task", "meeting", "contact", "note"] as const;

function parseDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const clientId = String(body.clientId ?? "").trim();
    const title = String(body.title ?? "").trim();
    if (!clientId || !title) {
      return NextResponse.json(
        { error: "Укажите клиента и название." },
        { status: 400 },
      );
    }

    const db = getDb();
    const [ownedClient] = await db
      .select({ id: clients.id })
      .from(clients)
      .where(and(eq(clients.id, clientId), eq(clients.ownerId, OWNER_ID)))
      .limit(1);
    if (!ownedClient) {
      return NextResponse.json({ error: "Клиент не найден." }, { status: 404 });
    }

    const kind = eventKinds.includes(
      body.kind as (typeof eventKinds)[number],
    )
      ? (body.kind as (typeof eventKinds)[number])
      : "event";
    const dueAt = parseDate(body.dueAt);
    const dueDate =
      typeof body.dueDate === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(body.dueDate)
        ? body.dueDate
        : null;
    const occurredAt = parseDate(body.occurredAt) ?? new Date();
    const completedAt =
      body.completed === true ? parseDate(body.completedAt) ?? new Date() : null;

    const created = await db.transaction(async (tx) => {
      const [savedEvent] = await tx
        .insert(events)
        .values({
          ownerId: OWNER_ID,
          clientId,
          kind,
          title,
          details: String(body.details ?? "").trim() || null,
          dueAt,
          dueDate: dueAt ? null : dueDate,
          occurredAt,
          completedAt,
          source: "interface",
        })
        .returning();
      if (kind === "contact") {
        await tx
          .update(clients)
          .set({ lastContactAt: occurredAt, updatedAt: new Date() })
          .where(and(eq(clients.id, clientId), eq(clients.ownerId, OWNER_ID)));
      }
      return savedEvent;
    });

    return NextResponse.json(
      { event: serializeEvent(created) },
      { status: 201 },
    );
  } catch (error) {
    console.error("event_create_failed", error);
    return NextResponse.json(
      { error: "Не удалось создать событие." },
      { status: 500 },
    );
  }
}
