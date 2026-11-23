-- Remove retired objects only when they contain no user data.
-- Safe to run more than once. Populated objects are retained.

SET @cleanup_has_progress_reports = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'progress_reports');
SET @ddl = IF(@cleanup_has_progress_reports = 1, 'SELECT COUNT(*) INTO @cleanup_progress_report_rows FROM progress_reports', 'SELECT 0 INTO @cleanup_progress_report_rows');
PREPARE cleanup_stmt FROM @ddl; EXECUTE cleanup_stmt; DEALLOCATE PREPARE cleanup_stmt;
SET @ddl = IF(@cleanup_has_progress_reports = 1 AND @cleanup_progress_report_rows = 0, 'DROP TABLE progress_reports', 'SELECT ''Keeping progress_reports because it is populated or absent''');
PREPARE cleanup_stmt FROM @ddl; EXECUTE cleanup_stmt; DEALLOCATE PREPARE cleanup_stmt;

SET @cleanup_has_purchases = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'purchases');
SET @ddl = IF(@cleanup_has_purchases = 1, 'SELECT COUNT(*) INTO @cleanup_purchase_rows FROM purchases', 'SELECT 0 INTO @cleanup_purchase_rows');
PREPARE cleanup_stmt FROM @ddl; EXECUTE cleanup_stmt; DEALLOCATE PREPARE cleanup_stmt;
SET @ddl = IF(@cleanup_has_purchases = 1 AND @cleanup_purchase_rows = 0, 'DROP TABLE purchases', 'SELECT ''Keeping purchases because it is populated or absent''');
PREPARE cleanup_stmt FROM @ddl; EXECUTE cleanup_stmt; DEALLOCATE PREPARE cleanup_stmt;

SET @cleanup_has_learning_style = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings' AND COLUMN_NAME = 'learning_style');
SET @ddl = IF(@cleanup_has_learning_style = 1, 'SELECT COUNT(*) INTO @cleanup_learning_style_values FROM bookings WHERE learning_style IS NOT NULL AND TRIM(learning_style) <> ''''', 'SELECT 0 INTO @cleanup_learning_style_values');
PREPARE cleanup_stmt FROM @ddl; EXECUTE cleanup_stmt; DEALLOCATE PREPARE cleanup_stmt;
SET @ddl = IF(@cleanup_has_learning_style = 1 AND @cleanup_learning_style_values = 0, 'ALTER TABLE bookings DROP COLUMN learning_style', 'SELECT ''Keeping bookings.learning_style because it contains values or is absent''');
PREPARE cleanup_stmt FROM @ddl; EXECUTE cleanup_stmt; DEALLOCATE PREPARE cleanup_stmt;
