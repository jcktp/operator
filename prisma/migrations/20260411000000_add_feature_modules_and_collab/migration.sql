-- AlterTable
ALTER TABLE "Report" ADD COLUMN "removedAt" DATETIME;
ALTER TABLE "Report" ADD COLUMN "removedBy" TEXT;

-- CreateTable
CREATE TABLE "Risk" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'operational',
    "probability" TEXT NOT NULL DEFAULT 'medium',
    "impact" TEXT NOT NULL DEFAULT 'medium',
    "owner" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "notes" TEXT,
    "dueAt" DATETIME,
    "resolvedAt" DATETIME,
    "projectId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Decision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "context" TEXT,
    "rationale" TEXT,
    "outcome" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "madeBy" TEXT,
    "madeAt" DATETIME,
    "notes" TEXT,
    "projectId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ActionItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'action',
    "assignee" TEXT,
    "dueAt" DATETIME,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'open',
    "source" TEXT,
    "notes" TEXT,
    "projectId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PolicyRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "owner" TEXT,
    "category" TEXT NOT NULL DEFAULT 'general',
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastReviewedAt" DATETIME,
    "nextReviewAt" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Deadline" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'other',
    "dueAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'upcoming',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "context" TEXT,
    "notes" TEXT,
    "projectId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "text" TEXT NOT NULL,
    "speaker" TEXT,
    "context" TEXT,
    "sourceType" TEXT NOT NULL DEFAULT 'interview',
    "tags" TEXT NOT NULL DEFAULT '[]',
    "reportId" TEXT,
    "projectId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Theme" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'candidate',
    "notes" TEXT,
    "projectId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "HeadcountEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "role" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "currentCount" INTEGER NOT NULL DEFAULT 0,
    "targetCount" INTEGER NOT NULL DEFAULT 0,
    "openPositions" INTEGER NOT NULL DEFAULT 0,
    "attritionRate" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'planning',
    "targetDate" DATETIME,
    "hiringManager" TEXT,
    "notes" TEXT,
    "projectId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "InstanceIdentity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicKey" TEXT NOT NULL,
    "privateKeyEncrypted" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Peer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "displayName" TEXT,
    "publicKey" TEXT NOT NULL,
    "lastSeen" DATETIME,
    "tunnelUrl" TEXT,
    "localUrl" TEXT,
    "discoveryMethod" TEXT,
    "trusted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ProjectShare" (
    "projectId" TEXT NOT NULL,
    "peerId" TEXT NOT NULL,
    "permission" TEXT NOT NULL DEFAULT 'read_write',
    "sharedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sharedBy" TEXT,

    PRIMARY KEY ("projectId", "peerId")
);

-- CreateTable
CREATE TABLE "SyncState" (
    "projectId" TEXT NOT NULL,
    "peerId" TEXT NOT NULL,
    "lastSync" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'idle',

    PRIMARY KEY ("projectId", "peerId")
);

-- CreateTable
CREATE TABLE "SyncConflict" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "tableName" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "localValue" TEXT,
    "remoteValue" TEXT,
    "localPeerId" TEXT,
    "remotePeerId" TEXT,
    "localTimestamp" DATETIME,
    "remoteTimestamp" DATETIME,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolution" TEXT,
    "resolvedAt" DATETIME,
    "resolvedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "threadId" TEXT,
    "content" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "references" TEXT,
    "editedAt" DATETIME,
    "deletedAt" DATETIME,
    "syncClock" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ChatMessage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChatReadState" (
    "projectId" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "lastReadAt" DATETIME NOT NULL,
    "lastReadMsgId" TEXT,

    PRIMARY KEY ("projectId", "instanceId")
);

-- CreateIndex
CREATE INDEX "Risk_status_idx" ON "Risk"("status");

-- CreateIndex
CREATE INDEX "Risk_projectId_idx" ON "Risk"("projectId");

-- CreateIndex
CREATE INDEX "Risk_createdAt_idx" ON "Risk"("createdAt");

-- CreateIndex
CREATE INDEX "Decision_status_idx" ON "Decision"("status");

-- CreateIndex
CREATE INDEX "Decision_projectId_idx" ON "Decision"("projectId");

-- CreateIndex
CREATE INDEX "Decision_createdAt_idx" ON "Decision"("createdAt");

-- CreateIndex
CREATE INDEX "ActionItem_status_idx" ON "ActionItem"("status");

-- CreateIndex
CREATE INDEX "ActionItem_kind_idx" ON "ActionItem"("kind");

-- CreateIndex
CREATE INDEX "ActionItem_projectId_idx" ON "ActionItem"("projectId");

-- CreateIndex
CREATE INDEX "ActionItem_createdAt_idx" ON "ActionItem"("createdAt");

-- CreateIndex
CREATE INDEX "PolicyRecord_status_idx" ON "PolicyRecord"("status");

-- CreateIndex
CREATE INDEX "PolicyRecord_category_idx" ON "PolicyRecord"("category");

-- CreateIndex
CREATE INDEX "PolicyRecord_nextReviewAt_idx" ON "PolicyRecord"("nextReviewAt");

-- CreateIndex
CREATE INDEX "Deadline_status_idx" ON "Deadline"("status");

-- CreateIndex
CREATE INDEX "Deadline_dueAt_idx" ON "Deadline"("dueAt");

-- CreateIndex
CREATE INDEX "Deadline_projectId_idx" ON "Deadline"("projectId");

-- CreateIndex
CREATE INDEX "Quote_projectId_idx" ON "Quote"("projectId");

-- CreateIndex
CREATE INDEX "Quote_reportId_idx" ON "Quote"("reportId");

-- CreateIndex
CREATE INDEX "Quote_createdAt_idx" ON "Quote"("createdAt");

-- CreateIndex
CREATE INDEX "Theme_status_idx" ON "Theme"("status");

-- CreateIndex
CREATE INDEX "Theme_projectId_idx" ON "Theme"("projectId");

-- CreateIndex
CREATE INDEX "HeadcountEntry_department_idx" ON "HeadcountEntry"("department");

-- CreateIndex
CREATE INDEX "HeadcountEntry_status_idx" ON "HeadcountEntry"("status");

-- CreateIndex
CREATE INDEX "HeadcountEntry_projectId_idx" ON "HeadcountEntry"("projectId");

-- CreateIndex
CREATE INDEX "ProjectShare_projectId_idx" ON "ProjectShare"("projectId");

-- CreateIndex
CREATE INDEX "ProjectShare_peerId_idx" ON "ProjectShare"("peerId");

-- CreateIndex
CREATE INDEX "SyncState_projectId_idx" ON "SyncState"("projectId");

-- CreateIndex
CREATE INDEX "SyncConflict_projectId_idx" ON "SyncConflict"("projectId");

-- CreateIndex
CREATE INDEX "SyncConflict_resolved_idx" ON "SyncConflict"("resolved");

-- CreateIndex
CREATE INDEX "SyncConflict_createdAt_idx" ON "SyncConflict"("createdAt");

-- CreateIndex
CREATE INDEX "ChatMessage_projectId_idx" ON "ChatMessage"("projectId");

-- CreateIndex
CREATE INDEX "ChatMessage_threadId_idx" ON "ChatMessage"("threadId");

-- CreateIndex
CREATE INDEX "ChatMessage_createdAt_idx" ON "ChatMessage"("createdAt");

-- CreateIndex
CREATE INDEX "ChatReadState_projectId_idx" ON "ChatReadState"("projectId");

