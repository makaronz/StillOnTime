-- AlterTable
ALTER TABLE "user_configs" ADD COLUMN     "smsVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "smsVerificationCode" TEXT,
ADD COLUMN     "smsVerificationExpiry" TIMESTAMP(3),
ADD COLUMN     "pushTokenVerified" BOOLEAN NOT NULL DEFAULT false;