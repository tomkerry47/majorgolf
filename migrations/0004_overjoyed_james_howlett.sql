ALTER TABLE "users" ADD COLUMN "waiverChipUsedCompetitionId" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "waiverChipOriginalGolferId" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "waiverChipReplacementGolferId" integer;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_waiverChipUsedCompetitionId_competitions_id_fk" FOREIGN KEY ("waiverChipUsedCompetitionId") REFERENCES "public"."competitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_waiverChipOriginalGolferId_golfers_id_fk" FOREIGN KEY ("waiverChipOriginalGolferId") REFERENCES "public"."golfers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_waiverChipReplacementGolferId_golfers_id_fk" FOREIGN KEY ("waiverChipReplacementGolferId") REFERENCES "public"."golfers"("id") ON DELETE no action ON UPDATE no action;