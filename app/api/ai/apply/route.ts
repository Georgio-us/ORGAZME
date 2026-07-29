import { and, eq, ilike, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { aiProposals, clients, events } from "@/db/schema";
import { getWorkspaceSnapshot, OWNER_ID } from "@/lib/orgazme";

type ProposalPayload = {
  kind:
    | "event"
    | "task"
    | "meeting"
    | "contact"
    | "note"
    | "client_update"
    | "client_create";
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

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      decisions?: Array<{
        id: string;
        status: "accepted" | "rejected";
        title?: string;
        clientId?: string | null;
      }>;
    };
    const decisions = body.decisions ?? [];
    if (decisions.length === 0) {
      return NextResponse.json(
        { error: "Нет решений для применения." },
        { status: 400 },
      );
    }

    const ids = decisions.map((decision) => decision.id);
    const proposalRows = await getDb()
      .select()
      .from(aiProposals)
      .where(
        and(
          eq(aiProposals.ownerId, OWNER_ID),
          eq(aiProposals.status, "pending"),
          inArray(aiProposals.id, ids),
        ),
      );

    if (proposalRows.length !== decisions.length) {
      return NextResponse.json(
        { error: "Часть предложений уже обработана или не найдена." },
        { status: 409 },
      );
    }

    await getDb().transaction(async (tx) => {
      const reviewedAt = new Date();
      const createdClientIds = new Map<string, string>();

      for (const proposal of proposalRows) {
        const decision = decisions.find((item) => item.id === proposal.id);
        if (!decision) continue;
        if (decision.status === "rejected") {
          await tx
            .update(aiProposals)
            .set({ status: "rejected", reviewedAt })
            .where(eq(aiProposals.id, proposal.id));
        }
      }

      const acceptedCreateRows = proposalRows.filter((proposal) => {
        const decision = decisions.find((item) => item.id === proposal.id);
        return (
          decision?.status === "accepted" &&
          (proposal.payload as ProposalPayload).kind === "client_create"
        );
      });

      for (const proposal of acceptedCreateRows) {
        const decision = decisions.find((item) => item.id === proposal.id)!;
        const payload = proposal.payload as ProposalPayload;
        const draft = payload.clientDraft;
        const clientRef = payload.clientRef;
        const name = decision.title?.trim() || draft?.name.trim();
        if (!draft || !name || !clientRef) {
          throw new Error("Не хватает данных для создания клиента.");
        }
        const linkedNextAction = proposalRows
          .map((row) => {
            const rowDecision = decisions.find((item) => item.id === row.id);
            const rowPayload = row.payload as ProposalPayload;
            return { decision: rowDecision, payload: rowPayload };
          })
          .filter(
            ({ decision: rowDecision, payload: rowPayload }) =>
              rowDecision?.status === "accepted" &&
              rowPayload.clientRef === clientRef &&
              (rowPayload.kind === "task" ||
                rowPayload.kind === "meeting" ||
                rowPayload.kind === "event"),
          )
          .sort((left, right) => {
            const leftTime = left.payload.dueAt
              ? new Date(left.payload.dueAt).getTime()
              : Number.POSITIVE_INFINITY;
            const rightTime = right.payload.dueAt
              ? new Date(right.payload.dueAt).getTime()
              : Number.POSITIVE_INFINITY;
            return leftTime - rightTime;
          })[0];

        const [existing] = await tx
          .select({ id: clients.id })
          .from(clients)
          .where(
            and(
              eq(clients.ownerId, OWNER_ID),
              ilike(clients.name, name),
            ),
          )
          .limit(1);
        const clientId =
          existing?.id ??
          (
            await tx
              .insert(clients)
              .values({
                ownerId: OWNER_ID,
                name,
                category: draft.category,
                status: draft.status?.trim() || "active",
                attention: draft.attention || "calm",
                nextAction:
                  draft.nextAction?.trim() ||
                  linkedNextAction?.decision?.title?.trim() ||
                  linkedNextAction?.payload.title ||
                  "Определить следующее действие",
                amount: draft.amount?.trim() || "Не указано",
              })
              .returning({ id: clients.id })
          )[0].id;
        createdClientIds.set(clientRef, clientId);
        await tx
          .update(aiProposals)
          .set({
            clientId,
            status: "accepted",
            reviewedAt,
          })
          .where(eq(aiProposals.id, proposal.id));
      }

      for (const proposal of proposalRows) {
        const decision = decisions.find((item) => item.id === proposal.id);
        if (!decision || decision.status !== "accepted") continue;
        const payload = proposal.payload as ProposalPayload;
        if (payload.kind === "client_create") continue;
        const clientId =
          decision.clientId ||
          payload.clientId ||
          (payload.clientRef
            ? createdClientIds.get(payload.clientRef)
            : undefined);
        if (!clientId) {
          throw new Error(
            "Для действия не выбран клиент или отклонено создание связанного клиента.",
          );
        }

        const [ownedClient] = await tx
          .select({ id: clients.id })
          .from(clients)
          .where(
            and(eq(clients.id, clientId), eq(clients.ownerId, OWNER_ID)),
          )
          .limit(1);
        if (!ownedClient) throw new Error("Выбранный клиент не найден.");

        if (payload.kind === "client_update") {
          const patch = payload.clientPatch;
          if (!patch) throw new Error("Пустое изменение карточки клиента.");
          await tx
            .update(clients)
            .set({
              ...(patch.status ? { status: patch.status } : {}),
              ...(patch.attention ? { attention: patch.attention } : {}),
              ...(patch.nextAction ? { nextAction: patch.nextAction } : {}),
              ...(patch.amount ? { amount: patch.amount } : {}),
              updatedAt: reviewedAt,
            })
            .where(
              and(
                eq(clients.id, clientId),
                eq(clients.ownerId, OWNER_ID),
              ),
            );
        } else {
          const dueAt = payload.dueAt ? new Date(payload.dueAt) : null;
          await tx.insert(events).values({
            ownerId: OWNER_ID,
            clientId,
            kind: payload.kind,
            title: decision.title?.trim() || payload.title,
            details: payload.details,
            dueAt:
              dueAt && !Number.isNaN(dueAt.getTime()) ? dueAt : undefined,
            dueDate:
              payload.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(payload.dueDate)
                ? payload.dueDate
                : undefined,
            occurredAt: new Date(),
            source: "ai",
          });
        }

        await tx
          .update(aiProposals)
          .set({ clientId, status: "accepted", reviewedAt })
          .where(eq(aiProposals.id, proposal.id));
      }
    });

    return NextResponse.json(await getWorkspaceSnapshot());
  } catch (error) {
    console.error("ai_apply_failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Не удалось применить предложения.",
      },
      { status: 500 },
    );
  }
}
