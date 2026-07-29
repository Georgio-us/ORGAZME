import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { clients } from "@/db/schema";
import { OWNER_ID, serializeClient } from "@/lib/orgazme";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;
    const attention =
      body.attention === "calm" ||
      body.attention === "active" ||
      body.attention === "attention" ||
      body.attention === "overdue"
        ? body.attention
        : undefined;

    const [updated] = await getDb()
      .update(clients)
      .set({
        ...(typeof body.name === "string" && body.name.trim()
          ? { name: body.name.trim() }
          : {}),
        ...(body.category === "Активный" || body.category === "active"
          ? { category: "active" }
          : body.category === "Потенциальный" ||
              body.category === "potential"
            ? { category: "potential" }
            : {}),
        ...(typeof body.status === "string" && body.status.trim()
          ? { status: body.status.trim() }
          : {}),
        ...(attention ? { attention } : {}),
        ...(typeof body.nextAction === "string" && body.nextAction.trim()
          ? { nextAction: body.nextAction.trim() }
          : {}),
        ...(typeof body.amount === "string" && body.amount.trim()
          ? { amount: body.amount.trim() }
          : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(clients.id, id), eq(clients.ownerId, OWNER_ID)))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Клиент не найден." }, { status: 404 });
    }
    return NextResponse.json({ client: serializeClient(updated) });
  } catch (error) {
    console.error("client_update_failed", error);
    return NextResponse.json(
      { error: "Не удалось обновить клиента." },
      { status: 500 },
    );
  }
}
