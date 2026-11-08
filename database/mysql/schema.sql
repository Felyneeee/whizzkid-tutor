-- Whizzkids starter schema for XAMPP MySQL/MariaDB (InnoDB, utf8mb4).
-- Import using phpMyAdmin. Passwords must be bcrypt/argon2 hashes.
CREATE DATABASE IF NOT EXISTS whizzkids CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE whizzkids;

-- Initialization marker and transaction lock for application data. The legacy
-- JSON payload is cleared after its one-time import; business records live below.
CREATE TABLE IF NOT EXISTS application_state (
  id TINYINT UNSIGNED PRIMARY KEY,
  state_json LONGTEXT NOT NULL,
  revision BIGINT UNSIGNED NOT NULL DEFAULT 1,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CHECK (id = 1)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  role ENUM('admin','tutor','tutee') NOT NULL,
  email VARCHAR(254) NOT NULL UNIQUE,
  username VARCHAR(64) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash CHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_auth_sessions_expiry (expires_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS tutee_profiles (
  user_id VARCHAR(64) PRIMARY KEY,
  full_name VARCHAR(200) NOT NULL DEFAULT '', age SMALLINT UNSIGNED NULL,
  birthday DATE NULL, grade_level VARCHAR(80) NOT NULL DEFAULT '',
  contact VARCHAR(40) NOT NULL DEFAULT '', guardian_name VARCHAR(200) NOT NULL DEFAULT '',
  complete BOOLEAN NOT NULL DEFAULT FALSE, last_greeting_year SMALLINT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS tutor_profiles (
  user_id VARCHAR(64) PRIMARY KEY,
  applicant_type ENUM('new','existing') NOT NULL,
  status ENUM('pending_review','interview','pending_verification','active','rejected') NOT NULL,
  full_name VARCHAR(200) NOT NULL DEFAULT '', photo LONGTEXT NOT NULL,
  age SMALLINT UNSIGNED NULL, contact VARCHAR(40) NOT NULL DEFAULT '',
  resume_name VARCHAR(255) NOT NULL DEFAULT '', resume_data LONGTEXT NOT NULL,
  bio TEXT NOT NULL, subjects JSON NOT NULL, grade_bands JSON NOT NULL,
  hourly_rate DECIMAL(10,2) NOT NULL DEFAULT 0, fixed_salary DECIMAL(10,2) NOT NULL DEFAULT 0,
  interview_at DATETIME NULL, interview_notes TEXT NULL, rejection_reason TEXT NULL,
  birthday DATE NULL, last_greeting_year SMALLINT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS tutor_schedules (
  tutor_id VARCHAR(64) PRIMARY KEY,
  days JSON NOT NULL,
  modalities JSON NOT NULL,
  updated_at DATETIME NOT NULL,
  FOREIGN KEY (tutor_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS availability (
  id VARCHAR(64) PRIMARY KEY, batch_id VARCHAR(64) NOT NULL, tutor_id VARCHAR(64) NOT NULL,
  slot_date DATE NOT NULL, slots JSON NOT NULL, modalities JSON NOT NULL,
  status ENUM('pending','approved','rejected') NOT NULL, submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  note TEXT NULL, INDEX idx_availability_tutor_date (tutor_id,slot_date),
  FOREIGN KEY (tutor_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS cohorts (
  id VARCHAR(64) PRIMARY KEY, label VARCHAR(200) NOT NULL, start_date DATE NOT NULL,
  weekdays JSON NOT NULL, class_time VARCHAR(5) NOT NULL, modality ENUM('online','face-to-face') NULL,
  capacity SMALLINT UNSIGNED NOT NULL, enrolled JSON NOT NULL, tutor_id VARCHAR(64) NULL,
  sessions_count SMALLINT UNSIGNED NOT NULL,
  FOREIGN KEY (tutor_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS assessments (
  id VARCHAR(64) PRIMARY KEY, tutee_id VARCHAR(64) NOT NULL, modality ENUM('online','face-to-face') NOT NULL,
  assessment_date DATE NOT NULL, assessment_time VARCHAR(5) NOT NULL,
  status ENUM('booked','completed','cancelled') NOT NULL,
  results TEXT NULL, learning_needs TEXT NULL, reading_level VARCHAR(100) NULL,
  FOREIGN KEY (tutee_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS bookings (
  id VARCHAR(64) PRIMARY KEY, tutee_id VARCHAR(64) NOT NULL,
  program ENUM('reading','academic','playgroup') NOT NULL, subject VARCHAR(120) NOT NULL DEFAULT '',
  grade_level VARCHAR(80) NOT NULL DEFAULT '', modality ENUM('online','face-to-face') NOT NULL,
  learning_needs TEXT NOT NULL, booking_type ENUM('one-time','recurring') NOT NULL,
  session_type ENUM('one-on-one','group') NOT NULL DEFAULT 'one-on-one',
  cycle_type ENUM('2-week','3-week','1-month') NULL, cycle_start DATE NULL, cycle_end DATE NULL,
  cycle_session_allowance SMALLINT UNSIGNED NULL, expires_at DATETIME NULL, expiration_warning_at DATETIME NULL,
  dates JSON NOT NULL, class_time VARCHAR(5) NOT NULL, session_times JSON NULL,
  schedule_proposal JSON NULL, recurrence JSON NULL,
  rate_per_hour DECIMAL(10,2) NOT NULL DEFAULT 0, total_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
  status ENUM('awaiting_admin','confirmed','rejected','terminated','completed','expired','cancelled') NOT NULL,
  tutor_id VARCHAR(64) NULL, recommendations JSON NOT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  terminated_at DATETIME NULL, termination_reason TEXT NULL, cohort_id VARCHAR(64) NULL, assessment_id VARCHAR(64) NULL,
  INDEX idx_bookings_tutee_status (tutee_id,status),
  FOREIGN KEY (tutee_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (tutor_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (cohort_id) REFERENCES cohorts(id) ON DELETE SET NULL,
  FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sessions (
  id VARCHAR(64) PRIMARY KEY, assignment_id VARCHAR(64) NOT NULL, booking_id VARCHAR(64) NOT NULL, tutor_id VARCHAR(64) NOT NULL, tutee_id VARCHAR(64) NOT NULL,
  session_date DATE NOT NULL, session_time VARCHAR(5) NOT NULL,
  modality ENUM('online','face-to-face') NOT NULL,
  status ENUM('scheduled','completed','cancelled','needs_reassignment') NOT NULL,
  tutee_checked_in_at DATETIME NULL, tutor_checked_in_at DATETIME NULL,
  attended BOOLEAN NULL, rating TINYINT NULL, feedback TEXT NULL,
  INDEX idx_sessions_tutor_date (tutor_id,session_date), INDEX idx_sessions_tutee_date (tutee_id,session_date),
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  FOREIGN KEY (tutor_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (tutee_id) REFERENCES users(id) ON DELETE CASCADE,
  CHECK (rating IS NULL OR rating BETWEEN 1 AND 5)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS progress_reports (
  id VARCHAR(64) PRIMARY KEY, session_id VARCHAR(64) NOT NULL, booking_id VARCHAR(64) NOT NULL,
  tutee_id VARCHAR(64) NOT NULL, tutor_id VARCHAR(64) NOT NULL, session_date DATE NOT NULL,
  subject VARCHAR(120) NOT NULL, skill VARCHAR(200) NOT NULL, learning_goal TEXT NOT NULL,
  progress_status ENUM('not_started','practicing','mastered') NOT NULL, evidence TEXT NOT NULL,
  score DECIMAL(5,2) NULL, next_step TEXT NOT NULL, submitted_at DATETIME NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS messages (
  id VARCHAR(64) PRIMARY KEY, thread_id VARCHAR(64) NOT NULL, from_id VARCHAR(64) NOT NULL,
  message_text TEXT NOT NULL, sent_at DATETIME NOT NULL, auto BOOLEAN NOT NULL DEFAULT FALSE,
  INDEX idx_messages_thread_at (thread_id,sent_at),
  FOREIGN KEY (thread_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (from_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(64) PRIMARY KEY, user_id VARCHAR(64) NOT NULL, thread_id VARCHAR(64) NULL,
  notification_text TEXT NOT NULL, created_at DATETIME NOT NULL, read_at DATETIME NULL, channels JSON NOT NULL,
  INDEX idx_notifications_user_read (user_id,read_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS purchases (
  id VARCHAR(64) PRIMARY KEY, tutee_id VARCHAR(64) NOT NULL, items JSON NOT NULL,
  total DECIMAL(10,2) NOT NULL DEFAULT 0, status ENUM('pending','paid','released') NOT NULL,
  purchased_at DATETIME NOT NULL, FOREIGN KEY (tutee_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS materials (
  id VARCHAR(64) PRIMARY KEY, title VARCHAR(255) NOT NULL,
  program ENUM('reading','academic','playgroup','all') NOT NULL,
  file_name VARCHAR(255) NOT NULL, mime VARCHAR(150) NOT NULL,
  size BIGINT UNSIGNED NOT NULL DEFAULT 0, data LONGTEXT NOT NULL, note TEXT NOT NULL,
  uploaded_at DATETIME NOT NULL, allow_tutors BOOLEAN NOT NULL DEFAULT FALSE,
  allow_tutees BOOLEAN NOT NULL DEFAULT FALSE, allowed_user_ids JSON NOT NULL,
  revoked BOOLEAN NOT NULL DEFAULT FALSE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS material_logs (
  id VARCHAR(64) PRIMARY KEY, material_id VARCHAR(64) NOT NULL, user_id VARCHAR(64) NOT NULL,
  accessed_at DATETIME NOT NULL,
  FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS leaves (
  id VARCHAR(64) PRIMARY KEY, tutor_id VARCHAR(64) NOT NULL, start_date DATE NOT NULL,
  end_date DATE NOT NULL, reason TEXT NOT NULL,
  status ENUM('pending','approved','rejected') NOT NULL, submitted_at DATETIME NOT NULL,
  affected_session_ids JSON NOT NULL,
  FOREIGN KEY (tutor_id) REFERENCES users(id) ON DELETE CASCADE,
  CHECK (end_date >= start_date)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS activities (
  id VARCHAR(64) PRIMARY KEY, user_id VARCHAR(64) NOT NULL,
  kind ENUM('rating','match','upload','termination','booking','attendance','availability','other') NOT NULL,
  activity_text TEXT NOT NULL, created_at DATETIME NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS hirings (
  id VARCHAR(64) PRIMARY KEY, title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL, open BOOLEAN NOT NULL DEFAULT TRUE
) ENGINE=InnoDB;
