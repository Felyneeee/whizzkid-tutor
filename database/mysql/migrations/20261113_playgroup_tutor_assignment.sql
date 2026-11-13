-- Safe to import more than once. Existing columns are left in place.
SET @ddl = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cohorts' AND COLUMN_NAME = 'assignment_mode') = 0, 'ALTER TABLE cohorts ADD COLUMN assignment_mode ENUM(''automatic'',''fixed'',''manual'') NOT NULL DEFAULT ''automatic''', 'SELECT 1');
PREPARE playgroup_stmt FROM @ddl; EXECUTE playgroup_stmt; DEALLOCATE PREPARE playgroup_stmt;

SET @ddl = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cohorts' AND COLUMN_NAME = 'rotation_order') = 0, 'ALTER TABLE cohorts ADD COLUMN rotation_order JSON NULL', 'SELECT 1');
PREPARE playgroup_stmt FROM @ddl; EXECUTE playgroup_stmt; DEALLOCATE PREPARE playgroup_stmt;

SET @ddl = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cohorts' AND COLUMN_NAME = 'weekday_tutor_ids') = 0, 'ALTER TABLE cohorts ADD COLUMN weekday_tutor_ids JSON NULL', 'SELECT 1');
PREPARE playgroup_stmt FROM @ddl; EXECUTE playgroup_stmt; DEALLOCATE PREPARE playgroup_stmt;

ALTER TABLE bookings
  MODIFY COLUMN status ENUM('pending','approved','declined','pending_assessment','assessment_scheduled','ready_for_matching','awaiting_admin','confirmed','rejected','terminated','completed','expired','cancelled') NOT NULL;

SET @ddl = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings' AND COLUMN_NAME = 'booking_status') = 0, 'ALTER TABLE bookings ADD COLUMN booking_status VARCHAR(20) NULL', 'SELECT 1');
PREPARE playgroup_stmt FROM @ddl; EXECUTE playgroup_stmt; DEALLOCATE PREPARE playgroup_stmt;

SET @ddl = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings' AND COLUMN_NAME = 'tutor_assignment_status') = 0, 'ALTER TABLE bookings ADD COLUMN tutor_assignment_status VARCHAR(30) NULL', 'SELECT 1');
PREPARE playgroup_stmt FROM @ddl; EXECUTE playgroup_stmt; DEALLOCATE PREPARE playgroup_stmt;

SET @ddl = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings' AND COLUMN_NAME = 'assignment_mode') = 0, 'ALTER TABLE bookings ADD COLUMN assignment_mode VARCHAR(20) NULL', 'SELECT 1');
PREPARE playgroup_stmt FROM @ddl; EXECUTE playgroup_stmt; DEALLOCATE PREPARE playgroup_stmt;

SET @ddl = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings' AND COLUMN_NAME = 'tutor_assignments') = 0, 'ALTER TABLE bookings ADD COLUMN tutor_assignments JSON NULL', 'SELECT 1');
PREPARE playgroup_stmt FROM @ddl; EXECUTE playgroup_stmt; DEALLOCATE PREPARE playgroup_stmt;
