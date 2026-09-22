-- Existing requests retain their classifications and receive null AI metadata.
ALTER TABLE `CitizenRequest`
    ADD COLUMN `summaryEnglish` TEXT NULL,
    ADD COLUMN `locationText` VARCHAR(191) NULL,
    ADD COLUMN `aiModel` VARCHAR(191) NULL,
    ADD COLUMN `aiConfidence` DOUBLE NULL,
    ADD COLUMN `aiProcessedAt` DATETIME(3) NULL;
