-- ====================================================================
-- SRU CONFESSIONS - LIVE CONFESSION QUERIES FOR MYSQL WORKBENCH
-- ====================================================================
-- Use this script in MySQL Workbench to view any newly submitted
-- confessions with clean, formatted Date, Time, and timestamps.
-- ====================================================================

USE `sru_confessions`;

-- ====================================================================
-- QUERY 1: MAIN LIVE FEED (RUN THIS TO SEE ALL SUBMISSIONS)
-- Shows: Confession ID, Confession Text, Date (DD-MM-YYYY),
-- Time (12-hr with AM/PM), Full Date & Time, and Time Elapsed.
-- ====================================================================
SELECT 
    id AS `Confession ID`,
    confession AS `Confession Text`,
    DATE_FORMAT(created_at, '%d-%m-%Y') AS `Date`,
    DATE_FORMAT(created_at, '%h:%i:%s %p') AS `Time`,
    DATE_FORMAT(created_at, '%W, %M %d, %Y at %r') AS `Full Date & Time`,
    CASE 
        WHEN TIMESTAMPDIFF(SECOND, created_at, NOW()) < 60 
            THEN CONCAT(TIMESTAMPDIFF(SECOND, created_at, NOW()), ' seconds ago')
        WHEN TIMESTAMPDIFF(MINUTE, created_at, NOW()) < 60 
            THEN CONCAT(TIMESTAMPDIFF(MINUTE, created_at, NOW()), ' minutes ago')
        WHEN TIMESTAMPDIFF(HOUR, created_at, NOW()) < 24 
            THEN CONCAT(TIMESTAMPDIFF(HOUR, created_at, NOW()), ' hours ago')
        ELSE CONCAT(TIMESTAMPDIFF(DAY, created_at, NOW()), ' days ago')
    END AS `Submitted Ago`,
    status AS `Status`
FROM confessions
ORDER BY created_at DESC;


-- ====================================================================
-- QUERY 2: TODAY'S SUBMISSIONS ONLY
-- Filters confessions submitted today, ordered from newest to oldest.
-- ====================================================================
SELECT 
    id AS `ID`,
    confession AS `Confession`,
    DATE_FORMAT(created_at, '%h:%i:%s %p') AS `Time Today`
FROM confessions
WHERE DATE(created_at) = CURDATE()
ORDER BY id DESC;


-- ====================================================================
-- QUERY 3: CREATE A REUSABLE LIVE VIEW IN MYSQL WORKBENCH
-- Once created, you can simply click it in the Schemas sidebar in Workbench!
-- ====================================================================
CREATE OR REPLACE VIEW `view_live_confessions` AS
SELECT 
    id,
    confession,
    DATE_FORMAT(created_at, '%Y-%m-%d') AS `submission_date`,
    DATE_FORMAT(created_at, '%h:%i:%s %p') AS `submission_time`,
    DATE_FORMAT(created_at, '%W, %d %M %Y %r') AS `formatted_timestamp`,
    status,
    created_at AS `raw_timestamp`
FROM confessions
ORDER BY id DESC;

-- To query the view anytime:
-- SELECT * FROM view_live_confessions;
