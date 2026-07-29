DELETE FROM "ai_proposals"
WHERE "owner_id" = '00000000-0000-4000-8000-000000000001';
--> statement-breakpoint
DELETE FROM "recordings"
WHERE "owner_id" = '00000000-0000-4000-8000-000000000001';
--> statement-breakpoint
DELETE FROM "events"
WHERE "owner_id" = '00000000-0000-4000-8000-000000000001';
--> statement-breakpoint
DELETE FROM "clients"
WHERE "owner_id" = '00000000-0000-4000-8000-000000000001';
