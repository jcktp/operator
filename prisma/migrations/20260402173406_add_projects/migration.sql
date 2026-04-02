-- AlterTable
ALTER TABLE "UploadJobItem" ADD COLUMN "projectId" TEXT;

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "area" TEXT NOT NULL DEFAULT '',
    "startDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "description" TEXT DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
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
INSERT INTO "new_Report" ("area", "comparison", "createdAt", "directReportId", "displayContent", "fileName", "filePath", "fileSize", "fileType", "id", "imagePath", "insights", "isLongitudinal", "metrics", "questions", "rawContent", "reportDate", "resolvedFlags", "seriesId", "storyName", "summary", "title", "updatedAt", "userNotes") SELECT "area", "comparison", "createdAt", "directReportId", "displayContent", "fileName", "filePath", "fileSize", "fileType", "id", "imagePath", "insights", "isLongitudinal", "metrics", "questions", "rawContent", "reportDate", "resolvedFlags", "seriesId", "storyName", "summary", "title", "updatedAt", "userNotes" FROM "Report";
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
CREATE INDEX "Project_status_idx" ON "Project"("status");

-- CreateIndex
CREATE INDEX "Project_createdAt_idx" ON "Project"("createdAt");
