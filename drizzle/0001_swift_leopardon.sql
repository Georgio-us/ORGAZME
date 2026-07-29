ALTER TYPE "public"."event_kind" ADD VALUE 'client_update';--> statement-breakpoint
CREATE TABLE "recordings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"client_id" uuid,
	"intent" text,
	"transcript" text NOT NULL,
	"mime_type" text,
	"duration_seconds" integer,
	"status" text DEFAULT 'processed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "category" text DEFAULT 'potential' NOT NULL;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "next_action" text DEFAULT 'Определить следующее действие' NOT NULL;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "last_contact_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "amount" text DEFAULT 'Не указано' NOT NULL;--> statement-breakpoint
ALTER TABLE "recordings" ADD CONSTRAINT "recordings_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recordings" ADD CONSTRAINT "recordings_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recordings_owner_idx" ON "recordings" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "recordings_client_idx" ON "recordings" USING btree ("client_id");