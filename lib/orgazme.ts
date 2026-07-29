import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { clients, events, users } from "@/db/schema";

export const OWNER_ID = "00000000-0000-4000-8000-000000000001";

export async function ensureWorkspace() {
  const db = getDb();
  await db
    .insert(users)
    .values({
      id: OWNER_ID,
      email: "owner@orgazme.local",
      displayName: "Владелец ORGAZME",
    })
    .onConflictDoNothing();
}

export function formatRelativeContact(value: Date | null) {
  if (!value) return { label: "не было", days: 999 };
  const now = new Date();
  const days = Math.max(
    0,
    Math.floor((now.getTime() - value.getTime()) / 86_400_000),
  );
  if (days === 0) return { label: "сегодня", days };
  if (days === 1) return { label: "вчера", days };
  return { label: `${days} дня назад`, days };
}

const kindLabels = {
  event: "Событие",
  task: "Задача",
  meeting: "Встреча",
  contact: "Контакт",
  note: "Заметка",
  client_update: "Обновление клиента",
  client_create: "Новый клиент",
};

export function serializeClient(client: typeof clients.$inferSelect) {
  const contact = formatRelativeContact(client.lastContactAt);
  return {
    id: client.id,
    name: client.name,
    category: client.category === "active" ? "Активный" : "Потенциальный",
    attention: client.attention,
    status: client.status,
    nextAction: client.nextAction,
    lastContact: contact.label,
    lastContactDays: contact.days,
    amount: client.amount,
  };
}

export function serializeEvent(event: typeof events.$inferSelect) {
  const moment = event.dueAt ?? event.occurredAt;
  return {
    id: event.id,
    kind: kindLabels[event.kind],
    title: event.title,
    detail: event.details ?? "",
    date: new Intl.DateTimeFormat("ru-RU", {
      timeZone: "Europe/Madrid",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    }).format(moment),
    dueAt: event.dueAt?.toISOString() ?? null,
    occurredAt: event.occurredAt.toISOString(),
    completed: Boolean(event.completedAt),
    tone: event.completedAt
      ? "green"
      : event.dueAt && event.dueAt.getTime() < Date.now()
        ? "red"
        : event.kind === "contact"
          ? "blue"
          : "gray",
  };
}

export async function getWorkspaceSnapshot() {
  await ensureWorkspace();
  const db = getDb();
  const clientRows = await db
    .select()
    .from(clients)
    .where(and(eq(clients.ownerId, OWNER_ID), eq(clients.archived, false)))
    .orderBy(asc(clients.createdAt));
  const eventRows = await db
    .select()
    .from(events)
    .where(eq(events.ownerId, OWNER_ID))
    .orderBy(asc(events.occurredAt));

  const timelines = Object.fromEntries(
    clientRows.map((client) => [
      client.id,
      eventRows
        .filter((event) => event.clientId === client.id)
        .reverse()
        .map(serializeEvent),
    ]),
  );

  return {
    clients: clientRows.map(serializeClient),
    timelines,
  };
}
