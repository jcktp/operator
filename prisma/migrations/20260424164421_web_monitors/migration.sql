-- AlterTable
ALTER TABLE "Report" ADD COLUMN "contentHash" TEXT;
ALTER TABLE "Report" ADD COLUMN "tags" TEXT;

-- CreateTable
CREATE TABLE "FaceEmbedding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "documentId" TEXT,
    "imageSource" TEXT NOT NULL,
    "bbox" TEXT NOT NULL,
    "embedding" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FaceEmbedding_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReportEmbedding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportId" TEXT NOT NULL,
    "chunk" INTEGER NOT NULL DEFAULT 0,
    "embedding" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReportEmbedding_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Digest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT,
    "content" TEXT NOT NULL,
    "reportIds" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Annotation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportId" TEXT NOT NULL,
    "startOffset" INTEGER NOT NULL,
    "endOffset" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "note" TEXT,
    "color" TEXT NOT NULL DEFAULT 'yellow',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Annotation_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WebMonitor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "selector" TEXT,
    "intervalMins" INTEGER NOT NULL DEFAULT 60,
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastContent" TEXT,
    "lastHash" TEXT,
    "lastCheckedAt" DATETIME,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "projectId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WebMonitor_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WebMonitorChange" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "monitorId" TEXT NOT NULL,
    "oldHash" TEXT,
    "newHash" TEXT NOT NULL,
    "diff" TEXT NOT NULL,
    "summary" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WebMonitorChange_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "WebMonitor" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ChatMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "threadId" TEXT,
    "content" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "references" TEXT,
    "editedAt" DATETIME,
    "deletedAt" DATETIME,
    "syncClock" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ChatMessage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ChatMessage" ("authorId", "authorName", "content", "createdAt", "deletedAt", "editedAt", "id", "projectId", "references", "syncClock", "threadId", "updatedAt") SELECT "authorId", "authorName", "content", "createdAt", "deletedAt", "editedAt", "id", "projectId", "references", "syncClock", "threadId", "updatedAt" FROM "ChatMessage";
DROP TABLE "ChatMessage";
ALTER TABLE "new_ChatMessage" RENAME TO "ChatMessage";
CREATE INDEX "ChatMessage_projectId_idx" ON "ChatMessage"("projectId");
CREATE INDEX "ChatMessage_threadId_idx" ON "ChatMessage"("threadId");
CREATE INDEX "ChatMessage_createdAt_idx" ON "ChatMessage"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "FaceEmbedding_projectId_idx" ON "FaceEmbedding"("projectId");

-- CreateIndex
CREATE INDEX "ReportEmbedding_reportId_idx" ON "ReportEmbedding"("reportId");

-- CreateIndex
CREATE INDEX "Digest_projectId_idx" ON "Digest"("projectId");

-- CreateIndex
CREATE INDEX "Digest_createdAt_idx" ON "Digest"("createdAt");

-- CreateIndex
CREATE INDEX "Annotation_reportId_idx" ON "Annotation"("reportId");

-- CreateIndex
CREATE INDEX "WebMonitor_status_idx" ON "WebMonitor"("status");

-- CreateIndex
CREATE INDEX "WebMonitor_projectId_idx" ON "WebMonitor"("projectId");

-- CreateIndex
CREATE INDEX "WebMonitorChange_monitorId_idx" ON "WebMonitorChange"("monitorId");

-- CreateIndex
CREATE INDEX "JournalEntry_mode_idx" ON "JournalEntry"("mode");

-- CreateIndex
CREATE INDEX "Report_reportDate_idx" ON "Report"("reportDate");
