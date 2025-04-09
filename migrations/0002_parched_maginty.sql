CREATE TABLE "selection_ranks" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"competitionId" integer NOT NULL,
	"golferId" integer NOT NULL,
	"rankAtDeadline" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "golfers" ADD COLUMN "shortName" text;--> statement-breakpoint
ALTER TABLE "selection_ranks" ADD CONSTRAINT "selection_ranks_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "selection_ranks" ADD CONSTRAINT "selection_ranks_competitionId_competitions_id_fk" FOREIGN KEY ("competitionId") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "selection_ranks" ADD CONSTRAINT "selection_ranks_golferId_golfers_id_fk" FOREIGN KEY ("golferId") REFERENCES "public"."golfers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_competition_golfer_rank_idx" ON "selection_ranks" USING btree ("userId","competitionId","golferId");