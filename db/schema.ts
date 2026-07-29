import {
  boolean,
  date,
  integer,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const clientAttention = pgEnum("client_attention", [
  "calm",
  "active",
  "attention",
  "overdue",
]);

export const eventKind = pgEnum("event_kind", [
  "event",
  "task",
  "meeting",
  "contact",
  "note",
  "client_update",
  "client_create",
]);

export const proposalStatus = pgEnum("proposal_status", [
  "pending",
  "accepted",
  "rejected",
]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const clients = pgTable(
  "clients",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: uuid("owner_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    name: text("name").notNull(),
    category: text("category").notNull().default("potential"),
    status: text("status").notNull().default("active"),
    attention: clientAttention("attention").notNull().default("calm"),
    nextAction: text("next_action")
      .notNull()
      .default("Определить следующее действие"),
    lastContactAt: timestamp("last_contact_at", { withTimezone: true }),
    amount: text("amount").notNull().default("Не указано"),
    context: jsonb("context").$type<Record<string, unknown>>().default({}),
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("clients_owner_idx").on(table.ownerId)],
);

export const events = pgTable(
  "events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: uuid("owner_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    clientId: uuid("client_id").references(() => clients.id, {
      onDelete: "cascade",
    }),
    kind: eventKind("kind").notNull(),
    title: text("title").notNull(),
    details: text("details"),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    dueAt: timestamp("due_at", { withTimezone: true }),
    dueDate: date("due_date", { mode: "string" }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    source: text("source").notNull().default("manual"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("events_owner_idx").on(table.ownerId),
    index("events_client_idx").on(table.clientId),
    index("events_due_idx").on(table.dueAt),
  ],
);

export const aiProposals = pgTable(
  "ai_proposals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: uuid("owner_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    clientId: uuid("client_id").references(() => clients.id, {
      onDelete: "cascade",
    }),
    recordingId: text("recording_id"),
    kind: eventKind("kind").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    status: proposalStatus("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  },
  (table) => [
    index("ai_proposals_owner_idx").on(table.ownerId),
    index("ai_proposals_client_idx").on(table.clientId),
  ],
);

export const recordings = pgTable(
  "recordings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: uuid("owner_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    clientId: uuid("client_id").references(() => clients.id, {
      onDelete: "cascade",
    }),
    intent: text("intent"),
    transcript: text("transcript").notNull(),
    mimeType: text("mime_type"),
    durationSeconds: integer("duration_seconds"),
    status: text("status").notNull().default("processed"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("recordings_owner_idx").on(table.ownerId),
    index("recordings_client_idx").on(table.clientId),
  ],
);
