-- Database invariants complement Prisma relations; API validation remains required.
CREATE UNIQUE INDEX "CaptureJob_one_active_per_variant" ON "CaptureJob" ("variantId") WHERE state IN ('QUEUED', 'RUNNING');
ALTER TABLE "Variant" ADD CONSTRAINT "Variant_dimensions_delay_counters_check" CHECK (
 "viewportWidth" BETWEEN 320 AND 2560 AND "viewportHeight" BETWEEN 320 AND 1600
 AND "settleDelayMs" BETWEEN 0 AND 3000
 AND "nextBaselineNumber">0 AND "nextJobNumber">0 AND "nextRevisionNumber">0);
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_png_check" CHECK (
 width BETWEEN 1 AND 2560 AND height BETWEEN 1 AND 10000
 AND width::bigint * height <= 25600000 AND bytes BETWEEN 1 AND 15728640
 AND mime = 'image/png' AND sha256 ~ '^[0-9a-f]{64}$');
ALTER TABLE "StorageReservation" ADD CONSTRAINT "StorageReservation_bytes_check" CHECK (bytes > 0);
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_version_positive" CHECK (version > 0);
ALTER TABLE "Project" ADD CONSTRAINT "Project_version_positive" CHECK (version > 0);
ALTER TABLE "Page" ADD CONSTRAINT "Page_version_positive" CHECK (version > 0);
ALTER TABLE "Variant" ADD CONSTRAINT "Variant_version_positive" CHECK (version > 0);
ALTER TABLE "CaptureJob" ADD CONSTRAINT "CaptureJob_version_positive" CHECK (version > 0);
ALTER TABLE "IssueReview" ADD CONSTRAINT "IssueReview_version_positive" CHECK (version > 0);
ALTER TABLE "StorageReservation" ADD CONSTRAINT "StorageReservation_version_positive" CHECK (version > 0);
ALTER TABLE "WorkerHeartbeat" ADD CONSTRAINT "WorkerHeartbeat_version_positive" CHECK (version > 0);
ALTER TABLE "BaselineVersion" ADD CONSTRAINT "BaselineVersion_number_positive" CHECK (number > 0);
ALTER TABLE "CaptureJob" ADD CONSTRAINT "CaptureJob_number_positive" CHECK (number > 0);
ALTER TABLE "ReviewRevision" ADD CONSTRAINT "ReviewRevision_number_positive" CHECK (number > 0);
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_original_rect_check" CHECK ("originalX" >= 0 AND "originalX" < 'Infinity'::double precision AND "originalY" >= 0 AND "originalY" < 'Infinity'::double precision AND "originalWidth" >= 1 AND "originalWidth" < 'Infinity'::double precision AND "originalHeight" >= 1 AND "originalHeight" < 'Infinity'::double precision);
ALTER TABLE "IssueReview" ADD CONSTRAINT "IssueReview_placement_rect_check" CHECK (
 (placement = 'NEEDS_REANCHOR' AND x IS NULL AND y IS NULL AND width IS NULL AND height IS NULL)
 OR (placement = 'CONFIRMED' AND x IS NOT NULL AND y IS NOT NULL AND width IS NOT NULL AND height IS NOT NULL
 AND x >= 0 AND x < 'Infinity'::double precision AND y >= 0 AND y < 'Infinity'::double precision
 AND width >= 1 AND width < 'Infinity'::double precision AND height >= 1 AND height < 'Infinity'::double precision));
-- NaN sorts above Infinity in PostgreSQL, so the strict upper bound rejects both.
CREATE FUNCTION reject_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'Published % history is immutable', TG_TABLE_NAME USING ERRCODE = '23514';
END;
$$;
CREATE TRIGGER "Asset_immutable" BEFORE UPDATE OR DELETE ON "Asset" FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
CREATE TRIGGER "BaselineVersion_immutable" BEFORE UPDATE OR DELETE ON "BaselineVersion" FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
CREATE TRIGGER "ReviewRevision_immutable" BEFORE UPDATE OR DELETE ON "ReviewRevision" FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
CREATE TRIGGER "Comment_immutable" BEFORE UPDATE OR DELETE ON "Comment" FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
CREATE TRIGGER "IssueEvent_immutable" BEFORE UPDATE OR DELETE ON "IssueEvent" FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
CREATE TRIGGER "Issue_immutable" BEFORE UPDATE OR DELETE ON "Issue" FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
-- Composite relations prevent results from belonging to a foreign variant/job.
ALTER TABLE "ReviewRevision" DROP CONSTRAINT "ReviewRevision_captureJobId_fkey";
ALTER TABLE "ReviewRevision" ADD CONSTRAINT "ReviewRevision_captureJob_variant_fkey"
 FOREIGN KEY ("captureJobId", "variantId") REFERENCES "CaptureJob" (id, "variantId") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "CaptureJob" DROP CONSTRAINT "CaptureJob_revisionId_fkey";
ALTER TABLE "CaptureJob" ADD CONSTRAINT "CaptureJob_revision_job_variant_fkey"
 FOREIGN KEY ("revisionId", id, "variantId") REFERENCES "ReviewRevision" (id, "captureJobId", "variantId") ON DELETE RESTRICT ON UPDATE RESTRICT;
-- Deferred checks allow Asset -> ReviewRevision -> SUCCEEDED job in one transaction.
-- Read final rows, rather than NEW, because a queued job can change repeatedly in a transaction.
CREATE FUNCTION check_revision_job_reciprocity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE job_id uuid;
BEGIN
 IF TG_TABLE_NAME = 'CaptureJob' THEN job_id := NEW.id; ELSE job_id := NEW."captureJobId"; END IF;
 IF EXISTS (
  SELECT 1 FROM "ReviewRevision" r JOIN "CaptureJob" j ON j.id=r."captureJobId"
  WHERE j.id=job_id AND (j."revisionId" IS DISTINCT FROM r.id OR j.state <> 'SUCCEEDED')
 ) OR EXISTS (
  SELECT 1 FROM "CaptureJob" j WHERE j.id=job_id
  AND ((j.state='SUCCEEDED' AND j."revisionId" IS NULL) OR (j.state<>'SUCCEEDED' AND j."revisionId" IS NOT NULL))
 ) THEN RAISE EXCEPTION 'Published revision and successful job must point to each other' USING ERRCODE='23514'; END IF;
 RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER "CaptureJob_reciprocal_result" AFTER INSERT OR UPDATE ON "CaptureJob"
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_revision_job_reciprocity();
CREATE CONSTRAINT TRIGGER "ReviewRevision_reciprocal_job" AFTER INSERT ON "ReviewRevision"
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_revision_job_reciprocity();

CREATE UNIQUE INDEX "CaptureJob_revisionId_id_variantId_key" ON "CaptureJob" ("revisionId",id,"variantId");
CREATE UNIQUE INDEX "ReviewRevision_captureJobId_variantId_key" ON "ReviewRevision" ("captureJobId","variantId");
