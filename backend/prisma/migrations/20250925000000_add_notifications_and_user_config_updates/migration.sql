-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB,
    "scheduledFor" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "user_configs" ADD COLUMN     "pushToken" TEXT,
ADD COLUMN     "smsNumber" TEXT;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "summaries" (
    "id" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'pl',
    "content" TEXT NOT NULL,
    "htmlContent" TEXT NOT NULL,
    "timeline" JSONB NOT NULL,
    "weatherSummary" TEXT,
    "warnings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,

    CONSTRAINT "summaries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "summaries_scheduleId_key" ON "summaries"("scheduleId");

-- CreateIndex
CREATE INDEX "notifications_userId_idx" ON "notifications"("userId");
CREATE INDEX "notifications_status_idx" ON "notifications"("status");
CREATE INDEX "notifications_scheduledFor_idx" ON "notifications"("scheduledFor");
CREATE INDEX "notifications_channel_idx" ON "notifications"("channel");
CREATE INDEX "notifications_template_idx" ON "notifications"("template");

-- CreateIndex
CREATE INDEX "summaries_userId_idx" ON "summaries"("userId");
CREATE INDEX "summaries_language_idx" ON "summaries"("language");

-- AddForeignKey
ALTER TABLE "summaries" ADD CONSTRAINT "summaries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "summaries" ADD CONSTRAINT "summaries_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "schedule_data"("id") ON DELETE CASCADE ON UPDATE CASCADE;