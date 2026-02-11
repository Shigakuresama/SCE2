CREATE TABLE "ExtractionSession" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "label" TEXT NOT NULL,
    "encryptedStateJson" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE "ExtractionRun" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "totalCount" INTEGER NOT NULL DEFAULT 0,
    "processedCount" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    "errorSummary" TEXT,
    "sessionId" INTEGER NOT NULL,
    CONSTRAINT "ExtractionRun_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ExtractionSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ExtractionRunItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "runId" INTEGER NOT NULL,
    "propertyId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "error" TEXT,
    CONSTRAINT "ExtractionRunItem_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ExtractionRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ExtractionSession_isActive_idx" ON "ExtractionSession"("isActive");
CREATE INDEX "ExtractionSession_expiresAt_idx" ON "ExtractionSession"("expiresAt");
CREATE INDEX "ExtractionRun_status_idx" ON "ExtractionRun"("status");
CREATE INDEX "ExtractionRun_sessionId_idx" ON "ExtractionRun"("sessionId");
CREATE INDEX "ExtractionRunItem_runId_idx" ON "ExtractionRunItem"("runId");
CREATE INDEX "ExtractionRunItem_propertyId_idx" ON "ExtractionRunItem"("propertyId");
CREATE INDEX "ExtractionRunItem_status_idx" ON "ExtractionRunItem"("status");
