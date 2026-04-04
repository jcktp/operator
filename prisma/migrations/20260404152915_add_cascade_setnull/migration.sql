-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_JournalEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL DEFAULT 'Untitled',
    "folder" TEXT NOT NULL DEFAULT 'General',
    "content" TEXT NOT NULL DEFAULT '',
    "weekStart" DATETIME,
    "projectId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "JournalEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_JournalEntry" ("content", "createdAt", "folder", "id", "title", "updatedAt", "weekStart") SELECT "content", "createdAt", "folder", "id", "title", "updatedAt", "weekStart" FROM "JournalEntry";
DROP TABLE "JournalEntry";
ALTER TABLE "new_JournalEntry" RENAME TO "JournalEntry";
CREATE INDEX "JournalEntry_projectId_idx" ON "JournalEntry"("projectId");
CREATE TABLE "new_ReportRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "message" TEXT,
    "directReportId" TEXT,
    "projectId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME,
    CONSTRAINT "ReportRequest_directReportId_fkey" FOREIGN KEY ("directReportId") REFERENCES "DirectReport" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ReportRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ReportRequest" ("area", "createdAt", "directReportId", "expiresAt", "id", "message", "status", "title", "token") SELECT "area", "createdAt", "directReportId", "expiresAt", "id", "message", "status", "title", "token" FROM "ReportRequest";
DROP TABLE "ReportRequest";
ALTER TABLE "new_ReportRequest" RENAME TO "ReportRequest";
CREATE UNIQUE INDEX "ReportRequest_token_key" ON "ReportRequest"("token");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
