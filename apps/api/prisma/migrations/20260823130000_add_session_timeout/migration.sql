ALTER TYPE "ReadingSessionStatus" ADD VALUE 'TIMEOUT';

CREATE INDEX "ReadingSession_lastEventAt_idx" ON "ReadingSession"("lastEventAt");
