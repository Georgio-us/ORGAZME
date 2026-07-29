import { and, eq, ilike } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { clients, events } from "@/db/schema";
import { ensureWorkspace, OWNER_ID, serializeClient } from "@/lib/orgazme";

const eventKinds = ["event", "task", "meeting", "contact", "note"] as const;
type ImportEventKind = (typeof eventKinds)[number];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function POST(request: NextRequest) {
  try {
    await ensureWorkspace();
    const body = (await request.json()) as Record<string, unknown>;
    const name = String(body.name ?? "").trim();
    if (!name) {
      return NextResponse.json(
        { error: "Укажите имя клиента." },
        { status: 400 },
      );
    }

    const category: typeof clients.$inferInsert.category =
      body.category === "Активный" || body.category === "active"
        ? "active"
        : "potential";
    const attention: typeof clients.$inferInsert.attention =
      body.attention === "active" ||
      body.attention === "attention" ||
      body.attention === "overdue"
        ? body.attention
        : "calm";
    const suppliedContext = isRecord(body.context) ? body.context : {};
    const importId = String(body.importId ?? "").trim() || null;
    const importEvents = Array.isArray(body.events)
      ? body.events
          .filter(isRecord)
          .slice(0, 50)
          .map((item) => {
            const kind = eventKinds.includes(item.kind as ImportEventKind)
              ? (item.kind as ImportEventKind)
              : "note";
            const title = String(item.title ?? "").trim();
            return {
              kind,
              title,
              details: String(item.details ?? "").trim() || null,
              dueAt: parseDate(item.dueAt),
              dueDate:
                typeof item.dueDate === "string" &&
                /^\d{4}-\d{2}-\d{2}$/.test(item.dueDate)
                  ? item.dueDate
                  : null,
              occurredAt: parseDate(item.occurredAt),
              completedAt: parseDate(item.completedAt),
            };
          })
          .filter((item) => item.title)
      : [];
    const db = getDb();
    const [existing] =
      body.upsert === true
        ? await db
            .select()
            .from(clients)
            .where(and(eq(clients.ownerId, OWNER_ID), ilike(clients.name, name)))
            .limit(1)
        : [];

    const result = await db.transaction(async (tx) => {
      const clientValues = {
        category,
        status:
          String(body.status ?? "").trim() ||
          (category === "active" ? "В работе" : "Первичный контакт"),
        attention,
        nextAction:
          String(body.nextAction ?? "").trim() ||
          "Определить следующее действие",
        amount: String(body.amount ?? "").trim() || "Не указано",
        lastContactAt: parseDate(body.lastContactAt),
        context: {
          ...(isRecord(existing?.context) ? existing.context : {}),
          ...suppliedContext,
          source: {
            type: importId ? "structured_import" : "interface",
            importId,
            savedAt: new Date().toISOString(),
          },
        },
        archived: false,
        updatedAt: new Date(),
      };
      const [savedClient] = existing
        ? await tx
            .update(clients)
            .set(clientValues)
            .where(
              and(
                eq(clients.id, existing.id),
                eq(clients.ownerId, OWNER_ID),
              ),
            )
            .returning()
        : await tx
            .insert(clients)
            .values({
              ownerId: OWNER_ID,
              name,
              ...clientValues,
            })
            .returning();

      let shouldInsertEvents = importEvents.length > 0;
      const eventSource = importId ? `import:${importId}` : "interface";
      if (importId && shouldInsertEvents) {
        const [alreadyImported] = await tx
          .select({ id: events.id })
          .from(events)
          .where(
            and(
              eq(events.ownerId, OWNER_ID),
              eq(events.clientId, savedClient.id),
              eq(events.source, eventSource),
            ),
          )
          .limit(1);
        shouldInsertEvents = !alreadyImported;
      }
      if (shouldInsertEvents) {
        await tx.insert(events).values(
          importEvents.map((event) => ({
            ownerId: OWNER_ID,
            clientId: savedClient.id,
            kind: event.kind,
            title: event.title,
            details: event.details,
            dueAt: event.dueAt,
            dueDate: event.dueDate,
            occurredAt: event.occurredAt ?? new Date(),
            completedAt: event.completedAt,
            source: eventSource,
          })),
        );
      }

      return savedClient;
    });

    return NextResponse.json(
      { client: serializeClient(result) },
      { status: existing ? 200 : 201 },
    );
  } catch (error) {
    console.error("client_create_failed", error);
    return NextResponse.json(
      { error: "Не удалось создать клиента." },
      { status: 500 },
    );
  }
}
