-- Migration: fix schema drift from unreleased schema changes
--
-- Covers two sets of schema changes that were never given corresponding migrations:
--   add3b68: removed mode field from Project, JournalEntry, and AreaBriefing
--   dec5c93: added story fields to Project, added shared to JournalEntry,
--            added EntryStructure table

-- ── 1. Project: remove mode column, add story fields ─────────────────────────
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "area" TEXT NOT NULL DEFAULT '',
    "startDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "description" TEXT DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "narrative" TEXT NOT NULL DEFAULT '',
    "storyStatus" TEXT NOT NULL DEFAULT 'draft',
    "storyDescription" TEXT,
    "storyReportIds" TEXT NOT NULL DEFAULT '[]',
    "storyEvents" TEXT NOT NULL DEFAULT '[]',
    "storyClaimStatuses" TEXT NOT NULL DEFAULT '[]',
    "storyShared" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_Project" ("id", "name", "area", "startDate", "status", "description", "createdAt", "updatedAt", "narrative", "storyStatus", "storyDescription", "storyReportIds", "storyEvents", "storyClaimStatuses", "storyShared")
SELECT "id", "name", "area", "startDate", "status", "description", "createdAt", "updatedAt", '', 'draft', NULL, '[]', '[]', '[]', false FROM "Project";
DROP TABLE "Project";
ALTER TABLE "new_Project" RENAME TO "Project";
CREATE INDEX "Project_status_idx" ON "Project"("status");
CREATE INDEX "Project_createdAt_idx" ON "Project"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- ── 2. JournalEntry: remove mode column, add shared field ─────────────────────
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_JournalEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL DEFAULT 'Untitled',
    "folder" TEXT NOT NULL DEFAULT 'General',
    "content" TEXT NOT NULL DEFAULT '',
    "weekStart" DATETIME,
    "projectId" TEXT,
    "shared" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "JournalEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_JournalEntry" ("id", "title", "folder", "content", "weekStart", "projectId", "shared", "createdAt", "updatedAt")
SELECT "id", "title", "folder", "content", "weekStart", "projectId", false, "createdAt", "updatedAt" FROM "JournalEntry";
DROP TABLE "JournalEntry";
ALTER TABLE "new_JournalEntry" RENAME TO "JournalEntry";
CREATE INDEX "JournalEntry_projectId_idx" ON "JournalEntry"("projectId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- ── 3. AreaBriefing: remove mode column, fix unique from (area,mode) to area ──
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AreaBriefing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "area" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "userNotes" TEXT,
    "reportCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_AreaBriefing" ("id", "area", "content", "userNotes", "reportCount", "updatedAt")
SELECT "id", "area", "content", "userNotes", "reportCount", "updatedAt"
FROM (
    SELECT *, ROW_NUMBER() OVER (PARTITION BY "area" ORDER BY "updatedAt" DESC) AS rn
    FROM "AreaBriefing"
) AS sub WHERE rn = 1;
DROP TABLE "AreaBriefing";
ALTER TABLE "new_AreaBriefing" RENAME TO "AreaBriefing";
CREATE UNIQUE INDEX "AreaBriefing_area_key" ON "AreaBriefing"("area");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- ── 4. EntryStructure: new table added in dec5c93 ─────────────────────────────
CREATE TABLE "EntryStructure" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entryId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "description" TEXT,
    "reportIds" TEXT NOT NULL DEFAULT '[]',
    "events" TEXT NOT NULL DEFAULT '[]',
    "claimStatuses" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EntryStructure_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "JournalEntry" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "EntryStructure_entryId_key" ON "EntryStructure"("entryId");
