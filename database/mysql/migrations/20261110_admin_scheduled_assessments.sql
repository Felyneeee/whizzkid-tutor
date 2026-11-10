ALTER TABLE assessments
  MODIFY assessment_date DATE NULL,
  MODIFY assessment_time VARCHAR(5) NULL,
  MODIFY status ENUM('pending_admin_scheduling','booked','completed','cancelled') NOT NULL;
