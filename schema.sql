-- ====================================================================
-- SRU CONFESSIONS - DATABASE SCHEMA FOR MYSQL WORKBENCH
-- ====================================================================
-- Instructions for MySQL Workbench:
-- 1. Open MySQL Workbench.
-- 2. Connect to your MySQL Server (e.g., Local instance MySQL80).
-- 3. Click "File" -> "Open SQL Script..." and select this file: schema.sql
-- 4. Click the Lightning Bolt (Execute) icon (or press Ctrl + Shift + Enter)
--    to run the entire script.
-- ====================================================================

-- 1. CREATE DATABASE
CREATE DATABASE IF NOT EXISTS `sru_confessions`
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE `sru_confessions`;

-- 2. CREATE CONFESSIONS TABLE
CREATE TABLE IF NOT EXISTS `confessions` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `confession` TEXT NOT NULL,
    `status` ENUM('approved', 'flagged', 'archived') NOT NULL DEFAULT 'approved',
    `ip_hash` VARCHAR(64) NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_created_at` (`created_at`),
    INDEX `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. CREATE ADMINS TABLE
CREATE TABLE IF NOT EXISTS `admins` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `username` VARCHAR(50) NOT NULL UNIQUE,
    `password_hash` VARCHAR(255) NOT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. SEED DEFAULT ADMIN ACCOUNT
-- Username: admin
-- Password: sru2024 (hashed with bcrypt)
INSERT INTO `admins` (`username`, `password_hash`)
VALUES ('admin', '$2b$10$s0hL5nZ1J/FDbZPqtVUznewGfZTnZ55lGQ29m0DOng3A6yavG7NU2')
ON DUPLICATE KEY UPDATE `id` = `id`;

-- 5. SEED SAMPLE CONFESSIONS FOR TESTING
INSERT INTO `confessions` (`confession`, `status`, `ip_hash`, `created_at`) VALUES
('Welcome to SRU Confessions! Share your thoughts freely and anonymously.', 'approved', 'system_init', NOW() - INTERVAL 2 HOUR),
('The sunset view from the main library terrace is genuinely unmatched on campus.', 'approved', 'system_init', NOW() - INTERVAL 1 HOUR),
('Shoutout to the canteen staff for always being kind during exam rush!', 'approved', 'system_init', NOW() - INTERVAL 30 MINUTE);

-- 6. CREATE REUSABLE LIVE VIEW FOR WORKBENCH
CREATE OR REPLACE VIEW `view_live_confessions` AS
SELECT 
    id AS `Confession ID`,
    confession AS `Confession Text`,
    DATE_FORMAT(created_at, '%d-%m-%Y') AS `Date`,
    DATE_FORMAT(created_at, '%h:%i:%s %p') AS `Time`,
    DATE_FORMAT(created_at, '%W, %M %d, %Y at %r') AS `Full Date & Time`,
    status AS `Status`,
    created_at AS `raw_timestamp`
FROM confessions
ORDER BY id DESC;

-- ====================================================================
-- LIVE QUERY: RUN THIS TO SEE NEW SUBMISSIONS WITH DATE & TIME
-- ====================================================================
-- SELECT * FROM view_live_confessions;
