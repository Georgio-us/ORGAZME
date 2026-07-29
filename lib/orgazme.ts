import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { clients, events, users } from "@/db/schema";

export const OWNER_ID = "00000000-0000-4000-8000-000000000001";

const demoClients = [
  {
    id: "10000000-0000-4000-8000-000000000001",
    name: "Shaped House",
    category: "active",
    status: "Требует внимания",
    attention: "overdue" as const,
    nextAction: "Отправить обновлённый отчёт",
    lastContactAt: new Date("2026-07-25T12:00:00+02:00"),
    amount: "€4 800",
  },
  {
    id: "10000000-0000-4000-8000-000000000002",
    name: "DomStar",
    category: "active",
    status: "Ожидается ответ",
    attention: "attention" as const,
    nextAction: "Согласовать структуру лендинга",
    lastContactAt: new Date("2026-07-27T12:00:00+02:00"),
    amount: "$2 200",
  },
  {
    id: "10000000-0000-4000-8000-000000000003",
    name: "Ирина",
    category: "active",
    status: "В работе",
    attention: "active" as const,
    nextAction: "Zoom завтра в 19:00",
    lastContactAt: new Date("2026-07-29T10:40:00+02:00"),
    amount: "€1 600",
  },
  {
    id: "10000000-0000-4000-8000-000000000004",
    name: "CRETALINA",
    category: "potential",
    status: "Первичный контакт",
    attention: "calm" as const,
    nextAction: "Подготовить предложение",
    lastContactAt: new Date("2026-07-28T12:00:00+02:00"),
    amount: "€1 000–1 500",
  },
  {
    id: "10000000-0000-4000-8000-000000000005",
    name: "Море",
    category: "active",
    status: "Поддержка",
    attention: "active" as const,
    nextAction: "Проверить рекламные группы",
    lastContactAt: new Date("2026-07-26T12:00:00+02:00"),
    amount: "₴32 000",
  },
];

const demoEvents = [
  {
    id: "20000000-0000-4000-8000-000000000001",
    clientId: demoClients[0].id,
    kind: "task" as const,
    title: "Отправить обновлённый отчёт",
    details: "Просрочено на 2 дня",
    occurredAt: new Date("2026-07-26T12:00:00+02:00"),
    dueAt: new Date("2026-07-26T12:00:00+02:00"),
  },
  {
    id: "20000000-0000-4000-8000-000000000002",
    clientId: demoClients[0].id,
    kind: "contact" as const,
    title: "Созвон по вопросам хостинга",
    details: "Обсудили перенос сайта и обновление DNS",
    occurredAt: new Date("2026-07-24T16:30:00+02:00"),
    dueAt: null,
  },
  {
    id: "20000000-0000-4000-8000-000000000003",
    clientId: demoClients[1].id,
    kind: "task" as const,
    title: "Согласовать структуру лендинга",
    details: "Ожидается ответ клиента",
    occurredAt: new Date("2026-07-27T15:20:00+02:00"),
    dueAt: new Date("2026-07-30T17:00:00+02:00"),
  },
  {
    id: "20000000-0000-4000-8000-000000000004",
    clientId: demoClients[2].id,
    kind: "meeting" as const,
    title: "Zoom по следующей итерации",
    details: "Обсудить структуру и приоритеты",
    occurredAt: new Date("2026-07-30T19:00:00+02:00"),
    dueAt: new Date("2026-07-30T19:00:00+02:00"),
  },
  {
    id: "20000000-0000-4000-8000-000000000005",
    clientId: demoClients[2].id,
    kind: "contact" as const,
    title: "Подтвердили время встречи",
    details: "Клиент на связи, дополнительных вопросов нет",
    occurredAt: new Date("2026-07-29T10:40:00+02:00"),
    dueAt: null,
  },
  {
    id: "20000000-0000-4000-8000-000000000006",
    clientId: demoClients[3].id,
    kind: "task" as const,
    title: "Подготовить предложение",
    details: "Первичная оценка проекта",
    occurredAt: new Date("2026-07-29T09:00:00+02:00"),
    dueAt: new Date("2026-07-30T17:00:00+02:00"),
  },
  {
    id: "20000000-0000-4000-8000-000000000007",
    clientId: demoClients[4].id,
    kind: "task" as const,
    title: "Проверить рекламные группы",
    details: "Еженедельный аудит",
    occurredAt: new Date("2026-07-29T14:00:00+02:00"),
    dueAt: new Date("2026-07-29T14:00:00+02:00"),
  },
];

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

  const existingClients = await db
    .select({ id: clients.id })
    .from(clients)
    .where(eq(clients.ownerId, OWNER_ID))
    .limit(1);

  if (existingClients.length === 0) {
    await db.insert(clients).values(
      demoClients.map((client) => ({
        ...client,
        ownerId: OWNER_ID,
        context: { seededDemo: true },
      })),
    );
    await db.insert(events).values(
      demoEvents.map((event) => ({
        ...event,
        ownerId: OWNER_ID,
        source: "demo",
      })),
    );
  }
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
