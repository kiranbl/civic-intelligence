-- CreateTable
CREATE TABLE `District` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `state` VARCHAR(191) NOT NULL,
    `population` INTEGER NOT NULL,
    `latitude` DOUBLE NULL,
    `longitude` DOUBLE NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `District_name_state_key`(`name`, `state`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CitizenRequest` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `districtId` INTEGER NOT NULL,
    `originalText` TEXT NOT NULL,
    `language` VARCHAR(191) NOT NULL,
    `channel` ENUM('TEXT', 'VOICE', 'MESSAGING') NOT NULL,
    `category` ENUM('WATER', 'ROADS', 'HEALTHCARE', 'EDUCATION', 'SANITATION', 'TRANSPORT', 'ELECTRICITY', 'OTHER') NOT NULL,
    `subcategory` VARCHAR(191) NULL,
    `urgency` ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NULL,
    `latitude` DOUBLE NULL,
    `longitude` DOUBLE NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CitizenRequest_districtId_createdAt_idx`(`districtId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InfrastructureMetric` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `districtId` INTEGER NOT NULL,
    `metricType` VARCHAR(191) NOT NULL,
    `value` DOUBLE NOT NULL,
    `unit` VARCHAR(191) NOT NULL,
    `source` VARCHAR(191) NOT NULL,
    `sourceYear` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `InfrastructureMetric_districtId_metricType_idx`(`districtId`, `metricType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CitizenRequest` ADD CONSTRAINT `CitizenRequest_districtId_fkey` FOREIGN KEY (`districtId`) REFERENCES `District`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InfrastructureMetric` ADD CONSTRAINT `InfrastructureMetric_districtId_fkey` FOREIGN KEY (`districtId`) REFERENCES `District`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
