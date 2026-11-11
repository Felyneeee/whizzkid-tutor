ALTER TABLE bookings
  ADD COLUMN session_slots JSON NULL AFTER session_subjects;
