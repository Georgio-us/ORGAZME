import OpenAI, { toFile } from "openai";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { aiProposals, recordings } from "@/db/schema";
import { ensureWorkspace, getWorkspaceSnapshot, OWNER_ID } from "@/lib/orgazme";

export const runtime = "nodejs";
export const maxDuration = 120;

const actionKinds = [
  "event",
  "task",
  "meeting",
  "contact",
  "note",
  "client_update",
] as const;

type ActionKind = (typeof actionKinds)[number];

type ParsedProposal = {
  kind: ActionKind;
  title: string;
  details: string | null;
  clientId: string | null;
  dueAt: string | null;
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
          "dueAt",
          "clientPatch",
          "requiresClarification",
        ],
        properties: {
          kind: { type: "string", enum: actionKinds },
          title: { type: "string" },
          details: { type: ["string", "null"] },
          clientId: { type: ["string", "null"] },
          dueAt: {
            type: ["string", "null"],
            description: "ISO 8601 date with Europe/Madrid offset when known.",
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

    const snapshot = await getWorkspaceSnapshot();
    const clientsContext = snapshot.clients.map((client) => ({
      id: client.id,
      name: client.name,
      status: client.status,
      attention: client.attention,
      nextAction: client.nextAction,
    }));
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
            "Ты — слой интерпретации PBOS ORGAZME. Преобразуй русскую деловую речь в минимальный набор конкретных изменений. Ничего не применяй сам. Используй только clientId из списка. Если клиент не определён уверенно, верни clientId=null и requiresClarification=true. Не выдумывай даты, суммы и факты. Относительные даты считай от переданного now в часовом поясе Europe/Madrid. client_update используй только для изменения карточки клиента; для задач, встреч, контактов, событий и заметок используй соответствующие kind.",
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
    const normalizedProposals = parsed.proposals.map((proposal) => {
      const contextualClientId = selectedClient?.id ?? null;
      const proposedClientId =
        proposal.clientId && knownClientIds.has(proposal.clientId)
          ? proposal.clientId
          : contextualClientId;
      const missingClient = !proposedClientId;
      const incompletePatch =
        proposal.kind === "client_update" && !proposal.clientPatch;
      return {
        ...proposal,
        clientId: proposedClientId,
        requiresClarification:
          proposal.requiresClarification || missingClient || incompletePatch,
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
