-- CreateTable
CREATE TABLE "UploadJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "total" INTEGER NOT NULL,
    "processed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "UploadJobItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "reportId" TEXT,
    "error" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UploadJobItem_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "UploadJob" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "UploadJob_status_idx" ON "UploadJob"("status");

-- CreateIndex
CREATE INDEX "UploadJob_createdAt_idx" ON "UploadJob"("createdAt");

-- CreateIndex
CREATE INDEX "UploadJobItem_jobId_idx" ON "UploadJobItem"("jobId");

-- CreateIndex
CREATE INDEX "UploadJobItem_status_idx" ON "UploadJobItem"("status");
