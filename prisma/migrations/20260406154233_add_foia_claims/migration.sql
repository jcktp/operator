-- CreateTable
CREATE TABLE "FoiaRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agency" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "filedAt" DATETIME,
    "dueAt" DATETIME,
    "receivedAt" DATETIME,
    "trackingNum" TEXT,
    "notes" TEXT,
    "projectId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FoiaRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Claim" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "text" TEXT NOT NULL,
    "source" TEXT,
    "sourceType" TEXT NOT NULL DEFAULT 'document',
    "status" TEXT NOT NULL DEFAULT 'unverified',
    "notes" TEXT,
    "reportId" TEXT,
    "projectId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Claim_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Claim_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "FoiaRequest_status_idx" ON "FoiaRequest"("status");

-- CreateIndex
CREATE INDEX "FoiaRequest_projectId_idx" ON "FoiaRequest"("projectId");

-- CreateIndex
CREATE INDEX "FoiaRequest_createdAt_idx" ON "FoiaRequest"("createdAt");

-- CreateIndex
CREATE INDEX "Claim_status_idx" ON "Claim"("status");

-- CreateIndex
CREATE INDEX "Claim_reportId_idx" ON "Claim"("reportId");

-- CreateIndex
CREATE INDEX "Claim_projectId_idx" ON "Claim"("projectId");

-- CreateIndex
CREATE INDEX "Claim_createdAt_idx" ON "Claim"("createdAt");
