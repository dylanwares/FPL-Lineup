CREATE TABLE "content_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"kind" text NOT NULL,
	"url" text NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"image_url" text,
	"published_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_items_url_unique" UNIQUE("url"),
	CONSTRAINT "content_items_kind" CHECK ("content_items"."kind" in ('article', 'video'))
);
--> statement-breakpoint
CREATE INDEX "content_items_published_idx" ON "content_items" USING btree ("published_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "content_items_kind_published_idx" ON "content_items" USING btree ("kind","published_at" DESC NULLS LAST,"id" DESC NULLS LAST);