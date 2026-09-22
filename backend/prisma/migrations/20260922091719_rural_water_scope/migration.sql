-- AlterTable
ALTER TABLE `CitizenRequest` ADD COLUMN `areaType` ENUM('RURAL', 'URBAN', 'UNKNOWN') NOT NULL DEFAULT 'UNKNOWN';

-- AlterTable
ALTER TABLE `District` ADD COLUMN `ruralPopulation` INTEGER NULL,
    ADD COLUMN `urbanPopulation` INTEGER NULL;
