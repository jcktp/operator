CREATE TABLE "BrowserBookmark" (
    "id"        TEXT NOT NULL PRIMARY KEY,
    "url"       TEXT NOT NULL,
    "title"     TEXT NOT NULL,
    "favicon"   TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "BrowserBookmark_createdAt_idx" ON "BrowserBookmark"("createdAt");
