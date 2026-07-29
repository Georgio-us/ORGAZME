import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { clients } from "@/db/schema";
import { ensureWorkspace, OWNER_ID, serializeClient } from "@/lib/orgazme";

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

    const category =
      body.category === "Активный" || body.category === "active"
        ? "active"
        : "potential";
    const [created] = await getDb()
      .insert(clients)
      .values({
        ownerId: OWNER_ID,
        name,
        category,
        status:
          String(body.status ?? "").trim() ||
          (category === "active" ? "В работе" : "Первичный контакт"),
        attention:
          body.attention === "active" ||
          body.attention === "attention" ||
          body.attention === "overdue"
            ? body.attention
            : "calm",
        nextAction:
          String(body.nextAction ?? "").trim() ||
          "Определить следующее действие",
        amount: String(body.amount ?? "").trim() || "Не указано",
        lastContactAt: new Date(),
        context: { createdFrom: "interface" },
      })
      .returning();

    return NextResponse.json({ client: serializeClient(created) }, { status: 201 });
  } catch (error) {
    console.error("client_create_failed", error);
    return NextResponse.json(
      { error: "Не удалось создать клиента." },
      { status: 500 },
    );
  }
}
