-- CreateTable
CREATE TABLE "MatrixRoom" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roomId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDirect" BOOLEAN NOT NULL DEFAULT false,
    "lastMessageAt" DATETIME,
    "projectId" TEXT,
    CONSTRAINT "MatrixRoom_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MatrixMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "msgtype" TEXT NOT NULL DEFAULT 'm.text',
    "isOwn" BOOLEAN NOT NULL DEFAULT false,
    "readAt" DATETIME,
    "sentAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MatrixMessage_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "MatrixRoom" ("roomId") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_JournalEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL DEFAULT 'Untitled',
    "folder" TEXT NOT NULL DEFAULT 'General',
    "content" TEXT NOT NULL DEFAULT '',
    "mode" TEXT NOT NULL DEFAULT '',
    "weekStart" DATETIME,
    "projectId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "JournalEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_JournalEntry" ("content", "createdAt", "folder", "id", "projectId", "title", "updatedAt", "weekStart") SELECT "content", "createdAt", "folder", "id", "projectId", "title", "updatedAt", "weekStart" FROM "JournalEntry";
DROP TABLE "JournalEntry";
ALTER TABLE "new_JournalEntry" RENAME TO "JournalEntry";
CREATE INDEX "JournalEntry_projectId_idx" ON "JournalEntry"("projectId");
CREATE TABLE "new_Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "area" TEXT NOT NULL DEFAULT '',
    "mode" TEXT NOT NULL DEFAULT '',
    "startDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "description" TEXT DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Project" ("area", "createdAt", "description", "id", "name", "startDate", "status", "updatedAt") SELECT "area", "createdAt", "description", "id", "name", "startDate", "status", "updatedAt" FROM "Project";
DROP TABLE "Project";
ALTER TABLE "new_Project" RENAME TO "Project";
CREATE INDEX "Project_status_idx" ON "Project"("status");
CREATE INDEX "Project_createdAt_idx" ON "Project"("createdAt");
CREATE TABLE "new_Report" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "rawContent" TEXT NOT NULL,
    "summary" TEXT,
    "metrics" TEXT,
    "insights" TEXT,
    "questions" TEXT,
    "comparison" TEXT,
    "displayContent" TEXT,
    "area" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT '',
    "reportDate" DATETIME,
    "resolvedFlags" TEXT,
    "imagePath" TEXT,
    "filePath" TEXT,
    "storyName" TEXT,
    "userNotes" TEXT,
    "projectId" TEXT,
    "isLongitudinal" BOOLEAN NOT NULL DEFAULT false,
    "seriesId" TEXT,
    "directReportId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Report_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Report_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "ReportSeries" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Report_directReportId_fkey" FOREIGN KEY ("directReportId") REFERENCES "DirectReport" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Report" ("area", "comparison", "createdAt", "directReportId", "displayContent", "fileName", "filePath", "fileSize", "fileType", "id", "imagePath", "insights", "isLongitudinal", "metrics", "projectId", "questions", "rawContent", "reportDate", "resolvedFlags", "seriesId", "storyName", "summary", "title", "updatedAt", "userNotes") SELECT "area", "comparison", "createdAt", "directReportId", "displayContent", "fileName", "filePath", "fileSize", "fileType", "id", "imagePath", "insights", "isLongitudinal", "metrics", "projectId", "questions", "rawContent", "reportDate", "resolvedFlags", "seriesId", "storyName", "summary", "title", "updatedAt", "userNotes" FROM "Report";
DROP TABLE "Report";
ALTER TABLE "new_Report" RENAME TO "Report";
CREATE INDEX "Report_area_idx" ON "Report"("area");
CREATE INDEX "Report_projectId_idx" ON "Report"("projectId");
CREATE INDEX "Report_directReportId_idx" ON "Report"("directReportId");
CREATE INDEX "Report_createdAt_idx" ON "Report"("createdAt");
CREATE INDEX "Report_area_directReportId_idx" ON "Report"("area", "directReportId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "MatrixRoom_roomId_key" ON "MatrixRoom"("roomId");

-- CreateIndex
CREATE INDEX "MatrixRoom_lastMessageAt_idx" ON "MatrixRoom"("lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "MatrixMessage_eventId_key" ON "MatrixMessage"("eventId");

-- CreateIndex
CREATE INDEX "MatrixMessage_roomId_idx" ON "MatrixMessage"("roomId");

-- CreateIndex
CREATE INDEX "MatrixMessage_sentAt_idx" ON "MatrixMessage"("sentAt");
