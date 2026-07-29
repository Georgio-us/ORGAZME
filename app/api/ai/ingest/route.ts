import OpenAI, { toFile } from "openai";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { aiProposals, recordings } from "@/db/schema";
import {
  ensureWorkspace,
  getAIWorkspaceContext,
  OWNER_ID,
} from "@/lib/orgazme";

export const runtime = "nodejs";
export const maxDuration = 120;

const actionKinds = [
  "event",
  "task",
  "meeting",
  "contact",
  "note",
  "client_update",
  "client_create",
] as const;

type ActionKind = (typeof actionKinds)[number];

type ParsedProposal = {
  kind: ActionKind;
  title: string;
  details: string | null;
  clientId: string | null;
  clientRef: string | null;
  dueAt: string | null;
  dueDate: string | null;
  clientDraft: {
    name: string;
    category: "active" | "potential";
    status: string | null;
    attention: "calm" | "active" | "attention" | "overdue" | null;
    nextAction: string | null;
    amount: string | null;
  } | null;
  clientPatch: {
    status: string | null;
    attention: "calm" | "active" | "attention" | "overdue" | null;
    nextAction: string | null;
    amount: string | null;
  } | null;
  requiresClarification: boolean;
};

const responseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "proposals"],
  properties: {
    summary: { type: "string" },
    proposals: {
      type: "array",
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "kind",
          "title",
          "details",
          "clientId",
          "clientRef",
          "dueAt",
          "dueDate",
          "clientDraft",
          "clientPatch",
          "requiresClarification",
        ],
        properties: {
          kind: { type: "string", enum: actionKinds },
          title: { type: "string" },
          details: { type: ["string", "null"] },
          clientId: { type: ["string", "null"] },
          clientRef: {
            type: ["string", "null"],
            description:
              "Temporary stable reference such as new_client_1, shared by client_create and its dependent actions.",
          },
          dueAt: {
            type: ["string", "null"],
            description: "ISO 8601 date with Europe/Madrid offset when known.",
          },
          dueDate: {
            type: ["string", "null"],
            description:
              "Calendar date YYYY-MM-DD when a day is known but no exact time is given.",
          },
          clientDraft: {
            anyOf: [
              { type: "null" },
              {
                type: "object",
                additionalProperties: false,
                required: [
                  "name",
                  "category",
                  "status",
                  "attention",
                  "nextAction",
                  "amount",
                ],
                properties: {
                  name: { type: "string" },
                  category: {
                    type: "string",
                    enum: ["active", "potential"],
                  },
                  status: { type: ["string", "null"] },
                  attention: {
                    type: ["string", "null"],
                    enum: ["calm", "active", "attention", "overdue", null],
                  },
                  nextAction: { type: ["string", "null"] },
                  amount: { type: ["string", "null"] },
                },
              },
            ],
          },
          clientPatch: {
            anyOf: [
              { type: "null" },
              {
                type: "object",
                additionalProperties: false,
                required: ["status", "attention", "nextAction", "amount"],
                properties: {
                  status: { type: ["string", "null"] },
                  attention: {
                    type: ["string", "null"],
                    enum: ["calm", "active", "attention", "overdue", null],
                  },
                  nextAction: { type: ["string", "null"] },
                  amount: { type: ["string", "null"] },
                },
              },
            ],
          },
          requiresClarification: { type: "boolean" },
        },
      },
    },
  },
} as const;

export async function POST(request: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY не настроен на сервере." },
        { status: 503 },
      );
    }

    if (
      !request.headers.get("content-type")?.toLowerCase().includes("multipart/form-data")
    ) {
      return NextResponse.json(
        { error: "Ожидается голосовая запись в формате multipart/form-data." },
        { status: 400 },
      );
    }

    await ensureWorkspace();
    const formData = await request.formData();
    const audio = formData.get("audio");
    const intent = String(formData.get("intent") ?? "") || null;
    const requestedClientId =
      String(formData.get("clientId") ?? "").trim() || null;
    const durationSeconds = Number(formData.get("durationSeconds") ?? 0);

    if (!(audio instanceof File) || audio.size === 0) {
      return NextResponse.json(
        { error: "Аудиозапись не получена." },
        { status: 400 },
      );
    }
    if (audio.size > 12 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Запись слишком большая. Максимум — 12 МБ." },
        { status: 413 },
      );
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const extension = audio.type.includes("mp4")
      ? "m4a"
      : audio.type.includes("ogg")
        ? "ogg"
        : "webm";
    const transcriptResult = await openai.audio.transcriptions.create({
      file: await toFile(Buffer.from(await audio.arrayBuffer()), `voice.${extension}`, {
        type: audio.type || "audio/webm",
      }),
      model: process.env.OPENAI_TRANSCRIBE_MODEL ?? "gpt-4o-transcribe",
      language: "ru",
    });
    const transcript = transcriptResult.text.trim();
    if (!transcript) {
      return NextResponse.json(
        { error: "Не удалось распознать речь в записи." },
        { status: 422 },
      );
    }

    const clientsContext = await getAIWorkspaceContext();
    const selectedClient =
      clientsContext.find((client) => client.id === requestedClientId) ?? null;
    const now = new Date().toISOString();

    const response = await openai.responses.create({
      model: process.env.OPENAI_MODEL ?? "gpt-5.6-terra",
      reasoning: { effort: "low" },
      input: [
        {
          role: "system",
          content:
            `Ты — транзакционный планировщик PBOS ORGAZME. Преобразуй русскую деловую речь в минимальный упорядоченный план изменений, но ничего не применяй сам.

Правила клиентов:
- Если пользователь явно просит создать нового клиента, создай предложение kind=client_create. title и clientDraft.name — точное имя клиента. Дай ему уникальный clientRef вида new_client_1. clientId=null.
- Все действия для этого нового клиента (встреча, задача, контакт, событие, заметка, обновление) должны иметь тот же clientRef и clientId=null.
- Для существующего клиента используй только точный id из knownClients, clientRef=null. Не создавай дубль, если имя уверенно совпадает.
- client_create: clientDraft обязателен, clientPatch=null, dueAt=null. По умолчанию category=active, status="active", attention="calm"; неизвестные поля оставляй null.
- client_update используй только для изменения карточки существующего или создаваемого клиента; clientPatch обязателен, clientDraft=null.
- Для остальных видов clientDraft=null и clientPatch=null.
- knownClients содержит подтверждённый структурированный context и recentEvents. Используй их как фактическую память системы: не противоречь им и не дублируй уже существующие открытые действия.

Правила времени:
- Относительные даты считай от now в Europe/Madrid.
- Если названа только встреча/задача и время без даты, выбери ближайшее будущее наступление этого времени: сегодня, если оно ещё не прошло, иначе завтра. Это безопасное рабочее предположение, requiresClarification=false.
- Если известен день, но точное время не названо, заполни dueDate в формате YYYY-MM-DD, а dueAt оставь null. Никогда не подставляй фиктивное время.
- Если известно точное время, заполни dueAt, а dueDate оставь null.
- Не выдумывай время, сумму или деловой факт, которых нет в речи.

requiresClarification=true только когда без уточнения нельзя построить применимое изменение. Каждый зависимый шаг должен ссылаться либо на clientId, либо на валидный clientRef. Верни все явно запрошенные действия отдельными предложениями.`,
        },
        {
          role: "user",
          content: JSON.stringify({
            now,
            timeZone: "Europe/Madrid",
            intent: intent || "general",
            selectedClient,
            knownClients: clientsContext,
            transcript,
          }),
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "orgazme_voice_ingestion",
          strict: true,
          schema: responseSchema,
        },
      },
    });

    const parsed = JSON.parse(response.output_text) as {
      summary: string;
      proposals: ParsedProposal[];
    };
    const knownClientIds = new Set(clientsContext.map((client) => client.id));
    const proposedClientRefs = new Set(
      parsed.proposals
        .filter(
          (proposal) =>
            proposal.kind === "client_create" &&
            proposal.clientRef &&
            proposal.clientDraft?.name.trim(),
        )
        .map((proposal) => proposal.clientRef as string),
    );
    const normalizedProposals = parsed.proposals.map((proposal) => {
      const contextualClientId = selectedClient?.id ?? null;
      const proposedClientId =
        proposal.kind === "client_create"
          ? null
          : proposal.clientId && knownClientIds.has(proposal.clientId)
            ? proposal.clientId
            : contextualClientId;
      const proposedClientRef =
        proposal.clientRef && proposedClientRefs.has(proposal.clientRef)
          ? proposal.clientRef
          : null;
      const incompleteDraft =
        proposal.kind === "client_create" &&
        (!proposal.clientDraft?.name.trim() || !proposedClientRef);
      const missingClient =
        proposal.kind !== "client_create" &&
        !proposedClientId &&
        !proposedClientRef;
      const incompletePatch =
        proposal.kind === "client_update" && !proposal.clientPatch;
      return {
        ...proposal,
        clientId: proposedClientId,
        clientRef: proposedClientRef,
        dueDate:
          proposal.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(proposal.dueDate)
            ? proposal.dueDate
            : null,
        requiresClarification:
          proposal.requiresClarification ||
          missingClient ||
          incompletePatch ||
          incompleteDraft,
      };
    });
    const db = getDb();
    const [recording] = await db
      .insert(recordings)
      .values({
        ownerId: OWNER_ID,
        clientId: selectedClient?.id ?? null,
        intent,
        transcript,
        mimeType: audio.type || null,
        durationSeconds: Number.isFinite(durationSeconds)
          ? Math.round(durationSeconds)
          : null,
      })
      .returning();

    const saved =
      normalizedProposals.length === 0
        ? []
        : await db
            .insert(aiProposals)
            .values(
              normalizedProposals.map((proposal) => ({
                ownerId: OWNER_ID,
                clientId: proposal.clientId,
                recordingId: recording.id,
                kind: proposal.kind,
                payload: proposal,
              })),
            )
            .returning();

    return NextResponse.json({
      recordingId: recording.id,
      transcript,
      summary: parsed.summary,
      proposals: saved.map((proposal) => ({
        id: proposal.id,
        ...(proposal.payload as ParsedProposal),
      })),
    });
  } catch (error) {
    console.error("ai_ingest_failed", error);
    const message =
      error instanceof Error && error.message.includes("401")
        ? "OpenAI API отклонил ключ."
        : "Не удалось обработать запись с помощью AI.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
