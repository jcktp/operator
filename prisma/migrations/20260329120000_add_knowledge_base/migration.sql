-- CreateTable
CREATE TABLE "GlossaryTerm" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "term" TEXT NOT NULL,
    "definition" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AreaBriefing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "area" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "reportCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "GlossaryTerm_term_scope_key" ON "GlossaryTerm"("term", "scope");

-- CreateIndex
CREATE INDEX "GlossaryTerm_scope_idx" ON "GlossaryTerm"("scope");

-- CreateIndex
CREATE UNIQUE INDEX "AreaBriefing_area_mode_key" ON "AreaBriefing"("area", "mode");

-- CreateIndex
CREATE INDEX "AreaBriefing_area_idx" ON "AreaBriefing"("area");
