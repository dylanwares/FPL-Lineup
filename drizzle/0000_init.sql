CREATE TABLE "plans" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"entry_id" integer NOT NULL,
	"name" text NOT NULL,
	"base_gw" smallint NOT NULL,
	"base_snapshot" jsonb NOT NULL,
	"moves" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "plans_name_length" CHECK (char_length("plans"."name") between 1 and 40),
	CONSTRAINT "plans_version_positive" CHECK ("plans"."version" >= 1)
);
--> statement-breakpoint
CREATE TABLE "saved_teams" (
	"user_id" text NOT NULL,
	"entry_id" integer NOT NULL,
	"label" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "saved_teams_user_id_entry_id_pk" PRIMARY KEY("user_id","entry_id"),
	CONSTRAINT "saved_teams_label_length" CHECK (char_length("saved_teams"."label") between 1 and 60)
);
--> statement-breakpoint
CREATE INDEX "plans_user_entry_idx" ON "plans" USING btree ("user_id","entry_id");--> statement-breakpoint
CREATE INDEX "plans_user_updated_idx" ON "plans" USING btree ("user_id","updated_at");