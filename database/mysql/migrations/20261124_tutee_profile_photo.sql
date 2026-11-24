-- Add persistent profile photo storage for tutee profiles.
SET @ddl = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tutee_profiles' AND COLUMN_NAME = 'photo') = 0, 'ALTER TABLE tutee_profiles ADD COLUMN photo LONGTEXT NULL', 'SELECT 1');
PREPARE tutee_profile_photo_stmt FROM @ddl; EXECUTE tutee_profile_photo_stmt; DEALLOCATE PREPARE tutee_profile_photo_stmt;
