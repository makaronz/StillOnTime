-- DropIndex
DROP INDEX "notifications_channel_idx";

-- DropIndex
DROP INDEX "notifications_scheduledFor_idx";

-- DropIndex
DROP INDEX "notifications_status_idx";

-- DropIndex
DROP INDEX "notifications_template_idx";

-- DropIndex
DROP INDEX "notifications_userId_idx";

-- DropIndex
DROP INDEX "summaries_language_idx";

-- DropIndex
DROP INDEX "summaries_userId_idx";

-- AlterTable
ALTER TABLE "summaries" ALTER COLUMN "language" SET DEFAULT 'en';
