-- Add step column to UploadJobItem for live progress feedback during background analysis
ALTER TABLE "UploadJobItem" ADD COLUMN "step" TEXT;
