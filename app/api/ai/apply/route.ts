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
  contextChange: {
    field:
      | "summary"
      | "business_type"
      | "industry"
      | "country"
      | "region"
      | "base_location"
      | "relationship_started"
      | "relationship_quality"
      | "primary_contact"
      | "stakeholder"
      | "project"
      | "service"
      | "blocker"
      | "priority"
      | "plan"
      | "market"
      | "consultation"
      | "general_fact";
    title: string;
    value: string;
    date: string | null;
    approximate: boolean;
  } | null;
  financeChange: {
    type:
      | "contract_value"
      | "payment_received"
      | "receivable"
      | "expected_revenue"
      | "opportunity"
      | "recurring_fee"
      | "reimbursement";
    title: string;
    amount: number | null;
    currency: string | null;
    valueMode: "increment" | "set_total" | "record";
    amountQualifier: "exact" | "from" | "up_to" | "unknown";
    status: string | null;
    occurredDate: string | null;
    dueDate: string | null;
    periodStart: string | null;
    periodEnd: string | null;
    billing: "one_time" | "monthly" | null;
    notes: string | null;
  } | null;
  requiresClarification: boolean;
};

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function records(value: unknown): JsonRecord[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is JsonRecord =>
          Boolean(item) && typeof item === "object" && !Array.isArray(item),
      )
    : [];
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function appendUnique<T extends JsonRecord>(
  list: T[],
  item: T,
  signature: (entry: T) => string,
) {
  const key = signature(item).trim().toLocaleLowerCase("ru");
  return list.some(
    (entry) => signature(entry).trim().toLocaleLowerCase("ru") === key,
  )
    ? list
    : [...list, item];
}

function applyContextChange(
  rawContext: unknown,
  change: NonNullable<ProposalPayload["contextChange"]>,
  proposalId: string,
) {
  const context = { ...record(rawContext) };
  const fact = {
    id: proposalId,
    field: change.field,
    title: change.title,
    value: change.value,
    date: change.date,
    approximate: change.approximate,
    source: "ai",
  };
  context.facts = appendUnique(records(context.facts), fact, (entry) =>
    `${String(entry.field ?? "")}:${String(entry.title ?? "")}:${String(entry.value ?? "")}`,
  );

  switch (change.field) {
    case "summary":
      context.summary = change.value;
      break;
    case "business_type":
    case "industry": {
      const business = { ...record(context.business) };
      business[change.field === "business_type" ? "type" : "industry"] =
        change.value;
      context.business = business;
      break;
    }
    case "country":
    case "region":
    case "base_location": {
      const location = { ...record(context.location) };
      location[
        change.field === "base_location" ? "baseLocation" : change.field
      ] = change.value;
      context.location = location;
      if (change.field === "base_location") {
        context.business = {
          ...record(context.business),
          baseLocation: change.value,
        };
      }
      break;
    }
    case "relationship_started":
    case "relationship_quality": {
      const relationship = { ...record(context.relationship) };
      if (change.field === "relationship_started") {
        relationship.startedAt = change.date ?? change.value;
        relationship.startedAtApproximate = change.approximate;
      } else {
        relationship.quality = change.value;
      }
      context.relationship = relationship;
      break;
    }
    case "primary_contact": {
      const relationship = { ...record(context.relationship) };
      relationship.primaryContact = {
        name: change.title,
        role: change.value,
      };
      context.relationship = relationship;
      break;
    }
    case "stakeholder":
      context.stakeholders = appendUnique(
        records(context.stakeholders),
        { name: change.title, details: change.value },
        (entry) => String(entry.name ?? ""),
      );
      break;
    case "project":
      if (Object.keys(record(context.project)).length === 0) {
        context.project = {
          title: change.title,
          goal: change.value,
          startedAt: change.date,
          startedAtApproximate: change.approximate,
          status: "active",
        };
      } else {
        context.projects = appendUnique(
          records(context.projects),
          {
            title: change.title,
            goal: change.value,
            startedAt: change.date,
            startedAtApproximate: change.approximate,
            status: "active",
          },
          (entry) => String(entry.title ?? ""),
        );
      }
      break;
    case "service":
      context.engagements = appendUnique(
        records(context.engagements),
        {
          title: change.title,
          details: change.value,
          startedAt: change.date,
          startedAtApproximate: change.approximate,
          status: "active",
        },
        (entry) => String(entry.title ?? ""),
      );
      break;
    case "blocker":
      context.workingDynamics = {
        ...record(context.workingDynamics),
        primaryBlocker: change.value,
      };
      break;
    case "priority":
      context.priorities = Array.from(
        new Set([...strings(context.priorities), change.value]),
      );
      break;
    case "plan":
      context.tentativePlans = appendUnique(
        records(context.tentativePlans),
        {
          title: change.title,
          details: change.value,
          targetDate: change.date,
          approximate: change.approximate,
        },
        (entry) => `${String(entry.title ?? "")}:${String(entry.details ?? "")}`,
      );
      break;
    case "market": {
      const newBusiness = { ...record(context.newBusinessContext) };
      newBusiness.markets = Array.from(
        new Set([...strings(newBusiness.markets), change.value]),
      );
      context.newBusinessContext = newBusiness;
      break;
    }
    case "consultation":
      context.nonBillableConsulting = Array.from(
        new Set([...strings(context.nonBillableConsulting), change.value]),
      );
      break;
    case "general_fact":
      break;
  }
  return context;
}

function applyFinanceChange(
  rawContext: unknown,
  change: NonNullable<ProposalPayload["financeChange"]>,
  proposalId: string,
) {
  const context = { ...record(rawContext) };
  const financial = { ...record(context.financial) };
  const entry = {
    id: proposalId,
    ...change,
    source: "ai",
  };
  context.financeEntries = appendUnique(
    records(context.financeEntries),
    entry,
    (item) => String(item.id ?? ""),
  );
  if (change.currency) financial.currency = change.currency.toUpperCase();

  const amount = change.amount;
  const updateTotal = (key: string) => {
    if (amount === null) return;
    const current =
      typeof financial[key] === "number" ? (financial[key] as number) : 0;
    financial[key] =
      change.valueMode === "set_total" ? amount : current + amount;
  };

  switch (change.type) {
    case "contract_value":
      updateTotal("contractedOrEarned");
      break;
    case "payment_received":
      updateTotal("received");
      break;
    case "receivable":
      updateTotal("outstanding");
      financial.receivables = appendUnique(
        records(financial.receivables),
        {
          id: proposalId,
          title: change.title,
          amount,
          currency: change.currency,
          dueDate: change.dueDate,
          status: change.status ?? "outstanding",
          notes: change.notes,
        },
        (item) => String(item.id ?? ""),
      );
      break;
    case "expected_revenue":
      updateTotal("expectedRenewalRevenue");
      break;
    case "opportunity":
      updateTotal("potentialUpsellTotal");
      context.upsells = appendUnique(
        records(context.upsells),
        {
          id: proposalId,
          title: change.title,
          amount,
          currency: change.currency,
          amountQualifier: change.amountQualifier,
          status: change.status ?? "potential",
          notes: change.notes,
        },
        (item) => String(item.id ?? ""),
      );
      break;
    case "recurring_fee":
      context.engagements = appendUnique(
        records(context.engagements),
        {
          id: proposalId,
          title: change.title,
          amount,
          currency: change.currency,
          billing: change.billing ?? "monthly",
          periodStart: change.periodStart,
          periodEnd: change.periodEnd,
          status: change.status ?? "active",
          details: change.notes,
        },
        (item) =>
          String(item.id ?? `${String(item.title ?? "")}:${String(item.periodStart ?? "")}`),
      );
      break;
    case "reimbursement":
      updateTotal("outstanding");
      financial.reimbursements = appendUnique(
        records(financial.reimbursements),
        {
          id: proposalId,
          title: change.title,
          amount,
          currency: change.currency,
          dueDate: change.dueDate,
          status: change.status ?? "outstanding",
          notes: change.notes,
        },
        (item) => String(item.id ?? ""),
      );
      break;
  }
  context.financial = financial;
  return context;
}

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
          .select({ id: clients.id, context: clients.context })
          .from(clients)
          .where(
            and(eq(clients.id, clientId), eq(clients.ownerId, OWNER_ID)),
          )
          .limit(1);
        if (!ownedClient) throw new Error("Выбранный клиент не найден.");

        if (payload.kind === "client_update") {
          const patch = payload.clientPatch;
          const contextChange = payload.contextChange;
          const financeChange = payload.financeChange;
          const changeCount = [patch, contextChange, financeChange].filter(
            Boolean,
          ).length;
          if (changeCount !== 1) {
            throw new Error("Изменение клиента должно быть атомарным.");
          }
          if (patch) {
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
            const [freshClient] = await tx
              .select({ context: clients.context })
              .from(clients)
              .where(
                and(
                  eq(clients.id, clientId),
                  eq(clients.ownerId, OWNER_ID),
                ),
              )
              .limit(1);
            const context = contextChange
              ? applyContextChange(
                  freshClient?.context ?? ownedClient.context,
                  contextChange,
                  proposal.id,
                )
              : applyFinanceChange(
                  freshClient?.context ?? ownedClient.context,
                  financeChange!,
                  proposal.id,
                );
            await tx
              .update(clients)
              .set({ context, updatedAt: reviewedAt })
              .where(
                and(
                  eq(clients.id, clientId),
                  eq(clients.ownerId, OWNER_ID),
                ),
              );
          }
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
