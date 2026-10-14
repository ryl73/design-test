-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AssetKind" AS ENUM ('BASELINE', 'SCREENSHOT');

-- CreateEnum
CREATE TYPE "BaselineSource" AS ENUM ('UPLOAD');

-- CreateEnum
CREATE TYPE "CaptureJobState" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "IssueState" AS ENUM ('OPEN', 'READY_FOR_REVIEW', 'RESOLVED');

-- CreateEnum
CREATE TYPE "IssuePlacement" AS ENUM ('CONFIRMED', 'NEEDS_REANCHOR');

-- CreateEnum
CREATE TYPE "IssueEventType" AS ENUM ('CREATED', 'CARRIED', 'STATUS_CHANGED', 'REANCHORED');

-- CreateTable
CREATE TABLE "Participant" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "displayName" VARCHAR(120) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Participant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "archivedAt" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "authorId" UUID NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Page" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "projectId" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "url" VARCHAR(2048) NOT NULL,
    "archivedAt" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Page_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Variant" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pageId" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "viewportWidth" INTEGER NOT NULL,
    "viewportHeight" INTEGER NOT NULL,
    "urlOverride" VARCHAR(2048),
    "readySelector" VARCHAR(300),
    "settleDelayMs" INTEGER NOT NULL DEFAULT 300,
    "authProfileRef" JSONB,
    "authReadySelector" VARCHAR(300),
    "currentBaselineId" UUID,
    "archivedAt" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "nextBaselineNumber" INTEGER NOT NULL DEFAULT 1,
    "nextJobNumber" INTEGER NOT NULL DEFAULT 1,
    "nextRevisionNumber" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Variant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kind" "AssetKind" NOT NULL,
    "objectKey" TEXT NOT NULL,
    "previewKey" TEXT,
    "sha256" CHAR(64) NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "bytes" BIGINT NOT NULL,
    "mime" TEXT NOT NULL DEFAULT 'image/png',

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BaselineVersion" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "variantId" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "assetId" UUID NOT NULL,
    "source" "BaselineSource" NOT NULL DEFAULT 'UPLOAD',
    "sourceMetadata" JSONB NOT NULL,
    "authorId" UUID NOT NULL,
    "authorNameSnapshot" VARCHAR(120) NOT NULL,

    CONSTRAINT "BaselineVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaptureJob" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "variantId" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "state" "CaptureJobState" NOT NULL DEFAULT 'QUEUED',
    "inputSnapshot" JSONB NOT NULL,
    "sourceRevisionId" UUID,
    "carriedIssuesSnapshot" JSONB NOT NULL DEFAULT '[]',
    "requesterId" UUID NOT NULL,
    "requesterNameSnapshot" VARCHAR(120) NOT NULL,
    "idempotencyKey" UUID NOT NULL,
    "requestHash" TEXT NOT NULL,
    "attemptToken" UUID,
    "leaseUntil" TIMESTAMPTZ(3),
    "phase" TEXT,
    "revisionId" UUID,
    "errorCode" TEXT,
    "safeErrorMessage" TEXT,
    "warnings" JSONB NOT NULL DEFAULT '[]',
    "startedAt" TIMESTAMPTZ(3),
    "finishedAt" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "CaptureJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewRevision" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "variantId" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "baselineId" UUID NOT NULL,
    "screenshotAssetId" UUID NOT NULL,
    "captureJobId" UUID NOT NULL,
    "captureSnapshot" JSONB NOT NULL,
    "warnings" JSONB NOT NULL DEFAULT '[]',
    "finalUrl" VARCHAR(2048) NOT NULL,
    "browserVersion" TEXT NOT NULL,
    "captureEngineVersion" TEXT NOT NULL,
    "capturedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ReviewRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Issue" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "variantId" UUID NOT NULL,
    "originRevisionId" UUID NOT NULL,
    "originalX" DOUBLE PRECISION NOT NULL,
    "originalY" DOUBLE PRECISION NOT NULL,
    "originalWidth" DOUBLE PRECISION NOT NULL,
    "originalHeight" DOUBLE PRECISION NOT NULL,
    "authorId" UUID NOT NULL,
    "authorNameSnapshot" VARCHAR(120) NOT NULL,

    CONSTRAINT "Issue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IssueReview" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "variantId" UUID NOT NULL,
    "issueId" UUID NOT NULL,
    "revisionId" UUID NOT NULL,
    "state" "IssueState" NOT NULL DEFAULT 'OPEN',
    "placement" "IssuePlacement" NOT NULL DEFAULT 'CONFIRMED',
    "x" DOUBLE PRECISION,
    "y" DOUBLE PRECISION,
    "width" DOUBLE PRECISION,
    "height" DOUBLE PRECISION,
    "sourceIssueReviewId" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "IssueReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issueId" UUID NOT NULL,
    "revisionId" UUID NOT NULL,
    "participantId" UUID NOT NULL,
    "authorNameSnapshot" VARCHAR(120) NOT NULL,
    "body" VARCHAR(5000) NOT NULL,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IssueEvent" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issueId" UUID NOT NULL,
    "revisionId" UUID NOT NULL,
    "type" "IssueEventType" NOT NULL,
    "fromState" "IssueState",
    "toState" "IssueState",
    "previousRect" JSONB,
    "newRect" JSONB,
    "participantId" UUID NOT NULL,
    "authorNameSnapshot" VARCHAR(120) NOT NULL,
    "commentId" UUID,

    CONSTRAINT "IssueEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StorageReservation" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bytes" BIGINT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "StorageReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerHeartbeat" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMPTZ(3) NOT NULL,
    "captureReady" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "WorkerHeartbeat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Page_projectId_idx" ON "Page"("projectId");

-- CreateIndex
CREATE INDEX "Variant_pageId_idx" ON "Variant"("pageId");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_objectKey_key" ON "Asset"("objectKey");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_previewKey_key" ON "Asset"("previewKey");

-- CreateIndex
CREATE UNIQUE INDEX "BaselineVersion_variantId_number_key" ON "BaselineVersion"("variantId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "BaselineVersion_id_variantId_key" ON "BaselineVersion"("id", "variantId");

-- CreateIndex
CREATE UNIQUE INDEX "CaptureJob_revisionId_key" ON "CaptureJob"("revisionId");

-- CreateIndex
CREATE INDEX "CaptureJob_state_createdAt_idx" ON "CaptureJob"("state", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CaptureJob_variantId_number_key" ON "CaptureJob"("variantId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "CaptureJob_variantId_idempotencyKey_key" ON "CaptureJob"("variantId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "CaptureJob_id_variantId_key" ON "CaptureJob"("id", "variantId");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewRevision_captureJobId_key" ON "ReviewRevision"("captureJobId");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewRevision_variantId_number_key" ON "ReviewRevision"("variantId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewRevision_id_variantId_key" ON "ReviewRevision"("id", "variantId");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewRevision_id_captureJobId_variantId_key" ON "ReviewRevision"("id", "captureJobId", "variantId");

-- CreateIndex
CREATE UNIQUE INDEX "Issue_id_variantId_key" ON "Issue"("id", "variantId");

-- CreateIndex
CREATE INDEX "IssueReview_revisionId_state_idx" ON "IssueReview"("revisionId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "IssueReview_issueId_revisionId_key" ON "IssueReview"("issueId", "revisionId");

-- CreateIndex
CREATE UNIQUE INDEX "IssueReview_id_issueId_variantId_key" ON "IssueReview"("id", "issueId", "variantId");

-- CreateIndex
CREATE INDEX "Comment_issueId_createdAt_id_idx" ON "Comment"("issueId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Comment_id_issueId_revisionId_key" ON "Comment"("id", "issueId", "revisionId");

-- CreateIndex
CREATE INDEX "IssueEvent_issueId_createdAt_id_idx" ON "IssueEvent"("issueId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "StorageReservation_expiresAt_idx" ON "StorageReservation"("expiresAt");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Participant"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Page" ADD CONSTRAINT "Page_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Variant" ADD CONSTRAINT "Variant_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Variant" ADD CONSTRAINT "Variant_currentBaselineId_id_fkey" FOREIGN KEY ("currentBaselineId", "id") REFERENCES "BaselineVersion"("id", "variantId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "BaselineVersion" ADD CONSTRAINT "BaselineVersion_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "Variant"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "BaselineVersion" ADD CONSTRAINT "BaselineVersion_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "BaselineVersion" ADD CONSTRAINT "BaselineVersion_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Participant"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "CaptureJob" ADD CONSTRAINT "CaptureJob_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "Variant"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "CaptureJob" ADD CONSTRAINT "CaptureJob_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "Participant"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "CaptureJob" ADD CONSTRAINT "CaptureJob_sourceRevisionId_variantId_fkey" FOREIGN KEY ("sourceRevisionId", "variantId") REFERENCES "ReviewRevision"("id", "variantId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "CaptureJob" ADD CONSTRAINT "CaptureJob_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "ReviewRevision"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ReviewRevision" ADD CONSTRAINT "ReviewRevision_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "Variant"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ReviewRevision" ADD CONSTRAINT "ReviewRevision_baselineId_variantId_fkey" FOREIGN KEY ("baselineId", "variantId") REFERENCES "BaselineVersion"("id", "variantId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ReviewRevision" ADD CONSTRAINT "ReviewRevision_screenshotAssetId_fkey" FOREIGN KEY ("screenshotAssetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ReviewRevision" ADD CONSTRAINT "ReviewRevision_captureJobId_fkey" FOREIGN KEY ("captureJobId") REFERENCES "CaptureJob"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "Variant"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_originRevisionId_variantId_fkey" FOREIGN KEY ("originRevisionId", "variantId") REFERENCES "ReviewRevision"("id", "variantId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Participant"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "IssueReview" ADD CONSTRAINT "IssueReview_issueId_variantId_fkey" FOREIGN KEY ("issueId", "variantId") REFERENCES "Issue"("id", "variantId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "IssueReview" ADD CONSTRAINT "IssueReview_revisionId_variantId_fkey" FOREIGN KEY ("revisionId", "variantId") REFERENCES "ReviewRevision"("id", "variantId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "IssueReview" ADD CONSTRAINT "IssueReview_sourceIssueReviewId_issueId_variantId_fkey" FOREIGN KEY ("sourceIssueReviewId", "issueId", "variantId") REFERENCES "IssueReview"("id", "issueId", "variantId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_issueId_revisionId_fkey" FOREIGN KEY ("issueId", "revisionId") REFERENCES "IssueReview"("issueId", "revisionId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "IssueEvent" ADD CONSTRAINT "IssueEvent_issueId_revisionId_fkey" FOREIGN KEY ("issueId", "revisionId") REFERENCES "IssueReview"("issueId", "revisionId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "IssueEvent" ADD CONSTRAINT "IssueEvent_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "IssueEvent" ADD CONSTRAINT "IssueEvent_commentId_issueId_revisionId_fkey" FOREIGN KEY ("commentId", "issueId", "revisionId") REFERENCES "Comment"("id", "issueId", "revisionId") ON DELETE RESTRICT ON UPDATE RESTRICT;
