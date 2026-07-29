import { and, eq, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { aiProposals, clients, events } from "@/db/schema";
import { getWorkspaceSnapshot, OWNER_ID } from "@/lib/orgazme";

type ProposalPayload = {
  kind: "event" | "task" | "meeting" | "contact" | "note" | "client_update";
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

    await getDb().transaction(async (tx) => {
      for (const proposal of proposalRows) {
        const decision = decisions.find((item) => item.id === proposal.id);
        if (!decision) continue;
        const payload = proposal.payload as ProposalPayload;
        const clientId = decision.clientId || payload.clientId;
        const reviewedAt = new Date();

        if (decision.status === "rejected") {
          await tx
            .update(aiProposals)
            .set({ status: "rejected", reviewedAt })
            .where(eq(aiProposals.id, proposal.id));
          continue;
        }

        if (!clientId) {
          throw new Error("Для предложения необходимо выбрать клиента.");
        }

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
            occurredAt: new Date(),
            source: "ai",
          });
        }

        await tx
          .update(aiProposals)
          .set({ status: "accepted", reviewedAt })
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
