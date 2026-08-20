-- CreateEnum
CREATE TYPE "ExtractionStatus" AS ENUM ('PENDING', 'EXTRACTED', 'FAILED');

-- CreateEnum
CREATE TYPE "ReadingSessionStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "ReadingEventType" AS ENUM ('PAGE_ENTER', 'PAGE_ACTIVE', 'PAGE_INACTIVE', 'PAGE_LEAVE', 'PAGE_HEARTBEAT');

-- CreateTable
CREATE TABLE "SiteConfig" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "articleUrlPatterns" JSONB NOT NULL,
    "titleSelectors" JSONB NOT NULL,
    "contentSelectors" JSONB NOT NULL,
    "removeSelectors" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SiteConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Article" (
    "id" TEXT NOT NULL,
    "canonicalUrl" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "wordCount" INTEGER NOT NULL,
    "summary" TEXT,
    "category" TEXT,
    "extractionStatus" "ExtractionStatus" NOT NULL DEFAULT 'PENDING',
    "firstCollectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastCollectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Article_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReadingSession" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "browserId" TEXT NOT NULL,
    "tabId" INTEGER NOT NULL,
    "articleId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "activeReadingMs" INTEGER NOT NULL DEFAULT 0,
    "status" "ReadingSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastEventAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ReadingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReadingEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "eventType" "ReadingEventType" NOT NULL,
    "sequenceNumber" INTEGER NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "url" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReadingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SiteConfig_domain_key" ON "SiteConfig"("domain");
CREATE INDEX "SiteConfig_enabled_idx" ON "SiteConfig"("enabled");
CREATE UNIQUE INDEX "Article_canonicalUrl_key" ON "Article"("canonicalUrl");
CREATE INDEX "Article_domain_idx" ON "Article"("domain");
CREATE INDEX "Article_lastCollectedAt_idx" ON "Article"("lastCollectedAt");
CREATE INDEX "Article_extractionStatus_idx" ON "Article"("extractionStatus");
CREATE UNIQUE INDEX "ReadingSession_sessionId_key" ON "ReadingSession"("sessionId");
CREATE INDEX "ReadingSession_articleId_idx" ON "ReadingSession"("articleId");
CREATE INDEX "ReadingSession_browserId_idx" ON "ReadingSession"("browserId");
CREATE INDEX "ReadingSession_startedAt_idx" ON "ReadingSession"("startedAt");
CREATE INDEX "ReadingSession_status_idx" ON "ReadingSession"("status");
CREATE UNIQUE INDEX "ReadingEvent_eventId_key" ON "ReadingEvent"("eventId");
CREATE UNIQUE INDEX "ReadingEvent_sessionId_sequenceNumber_key" ON "ReadingEvent"("sessionId", "sequenceNumber");
CREATE INDEX "ReadingEvent_sessionId_idx" ON "ReadingEvent"("sessionId");
CREATE INDEX "ReadingEvent_occurredAt_idx" ON "ReadingEvent"("occurredAt");
CREATE INDEX "ReadingEvent_domain_idx" ON "ReadingEvent"("domain");
CREATE INDEX "ReadingEvent_eventType_idx" ON "ReadingEvent"("eventType");

-- AddForeignKey
ALTER TABLE "ReadingSession" ADD CONSTRAINT "ReadingSession_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReadingEvent" ADD CONSTRAINT "ReadingEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ReadingSession"("sessionId") ON DELETE CASCADE ON UPDATE CASCADE;
