-- AddForeignKey: ReportEntity → Report (cascade delete)
CREATE TABLE "new_ReportEntity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "context" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReportEntity_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ReportEntity" SELECT "id","reportId","type","name","context","createdAt" FROM "ReportEntity";
DROP TABLE "ReportEntity";
ALTER TABLE "new_ReportEntity" RENAME TO "ReportEntity";
CREATE INDEX "ReportEntity_reportId_idx" ON "ReportEntity"("reportId");
CREATE INDEX "ReportEntity_name_idx" ON "ReportEntity"("name");
CREATE INDEX "ReportEntity_type_idx" ON "ReportEntity"("type");

-- AddForeignKey: TimelineEvent → Report (cascade delete)
CREATE TABLE "new_TimelineEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportId" TEXT NOT NULL,
    "dateText" TEXT NOT NULL,
    "dateSortKey" TEXT,
    "event" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TimelineEvent_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TimelineEvent" SELECT "id","reportId","dateText","dateSortKey","event","createdAt" FROM "TimelineEvent";
DROP TABLE "TimelineEvent";
ALTER TABLE "new_TimelineEvent" RENAME TO "TimelineEvent";
CREATE INDEX "TimelineEvent_reportId_idx" ON "TimelineEvent"("reportId");
CREATE INDEX "TimelineEvent_dateSortKey_idx" ON "TimelineEvent"("dateSortKey");

-- AddForeignKey: ReportJournalism → Report (cascade delete)
CREATE TABLE "new_ReportJournalism" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportId" TEXT NOT NULL,
    "redactions" TEXT,
    "journalismComparison" TEXT,
    "verificationChecklist" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReportJournalism_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ReportJournalism" SELECT "id","reportId","redactions","journalismComparison","verificationChecklist","createdAt" FROM "ReportJournalism";
DROP TABLE "ReportJournalism";
ALTER TABLE "new_ReportJournalism" RENAME TO "ReportJournalism";
CREATE UNIQUE INDEX "ReportJournalism_reportId_key" ON "ReportJournalism"("reportId");

-- Indexes on Report for common query patterns
CREATE INDEX "Report_area_idx" ON "Report"("area");
CREATE INDEX "Report_directReportId_idx" ON "Report"("directReportId");
CREATE INDEX "Report_createdAt_idx" ON "Report"("createdAt");
CREATE INDEX "Report_area_directReportId_idx" ON "Report"("area", "directReportId");
