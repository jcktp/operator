-- CreateTable
CREATE TABLE "ReportSeries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "action" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PulseFeed" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastFetched" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PulseItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "feedId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT,
    "summary" TEXT,
    "publishedAt" DATETIME,
    "savedToJournal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PulseItem_feedId_fkey" FOREIGN KEY ("feedId") REFERENCES "PulseFeed" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    "reportDate" DATETIME,
    "resolvedFlags" TEXT,
    "imagePath" TEXT,
    "isLongitudinal" BOOLEAN NOT NULL DEFAULT false,
    "seriesId" TEXT,
    "directReportId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Report_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "ReportSeries" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Report_directReportId_fkey" FOREIGN KEY ("directReportId") REFERENCES "DirectReport" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Report" ("area", "comparison", "createdAt", "directReportId", "displayContent", "fileName", "fileSize", "fileType", "id", "imagePath", "insights", "metrics", "questions", "rawContent", "reportDate", "resolvedFlags", "summary", "title", "updatedAt") SELECT "area", "comparison", "createdAt", "directReportId", "displayContent", "fileName", "fileSize", "fileType", "id", "imagePath", "insights", "metrics", "questions", "rawContent", "reportDate", "resolvedFlags", "summary", "title", "updatedAt" FROM "Report";
DROP TABLE "Report";
ALTER TABLE "new_Report" RENAME TO "Report";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
