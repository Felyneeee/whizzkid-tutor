-- Safe to import more than once. Existing materials receive an empty subject.
SET @ddl = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'materials' AND COLUMN_NAME = 'subject') = 0, 'ALTER TABLE materials ADD COLUMN subject VARCHAR(120) NOT NULL DEFAULT '''' AFTER program', 'SELECT 1');
PREPARE material_subject_stmt FROM @ddl; EXECUTE material_subject_stmt; DEALLOCATE PREPARE material_subject_stmt;
