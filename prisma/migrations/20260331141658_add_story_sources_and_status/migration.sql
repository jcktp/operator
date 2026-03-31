-- CreateTable
CREATE TABLE "StorySource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storyId" TEXT NOT NULL,
    "directReportId" TEXT NOT NULL,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StorySource_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StorySource_directReportId_fkey" FOREIGN KEY ("directReportId") REFERENCES "DirectReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Story" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'researching',
    "reportIds" TEXT NOT NULL,
    "narrative" TEXT,
    "events" TEXT,
    "claimStatuses" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Story" ("claimStatuses", "createdAt", "events", "id", "narrative", "reportIds", "title", "updatedAt") SELECT "claimStatuses", "createdAt", "events", "id", "narrative", "reportIds", "title", "updatedAt" FROM "Story";
DROP TABLE "Story";
ALTER TABLE "new_Story" RENAME TO "Story";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "StorySource_storyId_idx" ON "StorySource"("storyId");

-- CreateIndex
CREATE UNIQUE INDEX "StorySource_storyId_directReportId_key" ON "StorySource"("storyId", "directReportId");
