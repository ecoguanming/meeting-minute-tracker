-- AlterTable
ALTER TABLE "Meeting" ADD COLUMN     "reviewedMinutesFile" BYTEA,
ADD COLUMN     "reviewedMinutesFilename" TEXT;
