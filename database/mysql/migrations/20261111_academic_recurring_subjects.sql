ALTER TABLE bookings
  ADD COLUMN session_subjects JSON NULL AFTER session_times;
