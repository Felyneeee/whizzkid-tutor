ALTER TABLE cohorts
  ADD COLUMN assignment_mode ENUM('automatic','fixed','manual') NOT NULL DEFAULT 'automatic';

ALTER TABLE bookings
  MODIFY COLUMN status ENUM('pending','approved','declined','pending_assessment','assessment_scheduled','ready_for_matching','awaiting_admin','confirmed','rejected','terminated','completed','expired','cancelled') NOT NULL,
  ADD COLUMN booking_status VARCHAR(20) NULL,
  ADD COLUMN tutor_assignment_status VARCHAR(30) NULL,
  ADD COLUMN assignment_mode VARCHAR(20) NULL;

ALTER TABLE cohorts ADD COLUMN rotation_order JSON NULL;

