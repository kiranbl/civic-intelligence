-- Nullable provenance preserves existing demo and non-JJM metrics.
ALTER TABLE `InfrastructureMetric`
    ADD COLUMN `sourceDate` DATETIME(3) NULL,
    ADD COLUMN `sourceUrl` VARCHAR(191) NULL;
