ALTER TABLE bookings
  ADD COLUMN cancelled_at DATETIME NULL AFTER created_at;
