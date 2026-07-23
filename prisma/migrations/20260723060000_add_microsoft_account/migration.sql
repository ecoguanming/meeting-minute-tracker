-- CreateTable
CREATE TABLE "MicrosoftAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" INTEGER NOT NULL,
    "msUserId" TEXT NOT NULL DEFAULT '',
    "msEmail" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MicrosoftAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MicrosoftAccount_userId_key" ON "MicrosoftAccount"("userId");

-- AddForeignKey
ALTER TABLE "MicrosoftAccount" ADD CONSTRAINT "MicrosoftAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
