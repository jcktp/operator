/*
  Warnings:

  - Added the required column `rawContent` to the `UploadJobItem` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_UploadJobItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "rawContent" TEXT NOT NULL,
    "displayContent" TEXT,
    "directReportId" TEXT,
    "reportDate" TEXT,
    "savedFilePath" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "reportId" TEXT,
    "error" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UploadJobItem_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "UploadJob" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_UploadJobItem" ("area", "createdAt", "error", "fileName", "fileSizeBytes", "fileType", "id", "jobId", "reportId", "sortOrder", "status", "title") SELECT "area", "createdAt", "error", "fileName", "fileSizeBytes", "fileType", "id", "jobId", "reportId", "sortOrder", "status", "title" FROM "UploadJobItem";
DROP TABLE "UploadJobItem";
ALTER TABLE "new_UploadJobItem" RENAME TO "UploadJobItem";
CREATE INDEX "UploadJobItem_jobId_idx" ON "UploadJobItem"("jobId");
CREATE INDEX "UploadJobItem_status_idx" ON "UploadJobItem"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
