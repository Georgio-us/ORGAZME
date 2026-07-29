import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { events } from "@/db/schema";
import { OWNER_ID, serializeEvent } from "@/lib/orgazme";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;
    const dueAt =
      typeof body.dueAt === "string" && body.dueAt
        ? new Date(body.dueAt)
        : undefined;

    const [updated] = await getDb()
      .update(events)
      .set({
        ...(typeof body.title === "string" && body.title.trim()
          ? { title: body.title.trim() }
          : {}),
        ...(typeof body.details === "string"
          ? { details: body.details.trim() }
          : {}),
        ...(dueAt && !Number.isNaN(dueAt.getTime()) ? { dueAt } : {}),
        ...(body.completed === true ? { completedAt: new Date() } : {}),
        ...(body.completed === false ? { completedAt: null } : {}),
      })
      .where(and(eq(events.id, id), eq(events.ownerId, OWNER_ID)))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Событие не найдено." }, { status: 404 });
    }
    return NextResponse.json({ event: serializeEvent(updated) });
  } catch (error) {
    console.error("event_update_failed", error);
    return NextResponse.json(
      { error: "Не удалось обновить событие." },
      { status: 500 },
    );
  }
}
