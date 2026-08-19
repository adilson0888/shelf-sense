-- specs/Price History.md's Data section: every batch row that already
-- exists gets this migration's run time as its created_at, not its real
-- purchase date (there's nothing else to backfill from — batches never
-- recorded a timestamp before now). Disclosed, accepted limitation: a
-- product's Price History chart will show every pre-existing batch
-- clustered at one identical point in time; accuracy starts going
-- forward from this migration.
ALTER TABLE "batches" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;