import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { getAIWorkspaceContext } from "@/lib/orgazme";

export const runtime = "nodejs";
export const maxDuration = 90;

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export async function POST(request: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY не настроен на сервере." },
        { status: 503 },
      );
    }

    const body = (await request.json()) as {
      clientId?: string | null;
      messages?: ChatMessage[];
    };
    const messages = (body.messages ?? [])
      .filter(
        (message): message is ChatMessage =>
          (message.role === "user" || message.role === "assistant") &&
          typeof message.content === "string" &&
          Boolean(message.content.trim()),
      )
      .slice(-12)
      .map((message) => ({
        role: message.role,
        content: message.content.trim().slice(0, 8_000),
      }));
    if (messages.length === 0 || messages.at(-1)?.role !== "user") {
      return NextResponse.json(
        { error: "Сообщение не получено." },
        { status: 400 },
      );
    }

    const clients = await getAIWorkspaceContext();
    const selectedClient =
      clients.find((client) => client.id === body.clientId) ?? null;
    const workspace = selectedClient
      ? {
          selectedClient,
          clientIndex: clients.map((client) => ({
            id: client.id,
            name: client.name,
            status: client.status,
            attention: client.attention,
            nextAction: client.nextAction,
            amount: client.amount,
          })),
        }
      : { clients };
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.responses.create({
      model:
        process.env.OPENAI_CHAT_MODEL ??
        process.env.OPENAI_FAST_MODEL ??
        "gpt-5.6-terra",
      reasoning: { effort: "low" },
      input: [
        {
          role: "system",
          content: `Ты — встроенный бизнес-ассистент ORGAZME. Отвечай на русском языке, опираясь только на переданный workspace.

Твоя задача — помогать владельцу понимать состояние клиентов, задач, событий, финансов, рисков и возможностей.

Правила:
- Сначала дай прямой ответ на вопрос.
- Чётко отделяй подтверждённые факты от своих рекомендаций и выводов.
- Не утверждай, что действие выполнено или данные изменены: этот режим только отвечает и анализирует.
- Если пользователь хочет изменить данные, коротко предложи переключиться в режим "Команда".
- Учитывай просроченные и будущие события, задолженности, ожидаемые платежи, контекст и последние контакты.
- Не выдумывай отсутствующие суммы, даты и договорённости.
- Пиши компактно, но сохраняй важные детали.`,
        },
        {
          role: "user",
          content: `WORKSPACE:\n${JSON.stringify(workspace)}`,
        },
        ...messages,
      ],
      text: { verbosity: "medium" },
    });

    return NextResponse.json({
      reply: response.output_text.trim(),
      model: response.model,
    });
  } catch (error) {
    console.error("ai_chat_failed", error);
    return NextResponse.json(
      { error: "Не удалось получить ответ AI." },
      { status: 500 },
    );
  }
}
