-- Add the Reading Program assessment and matching states to booking status.
-- Existing booking states and rows are preserved.
ALTER TABLE bookings
  MODIFY COLUMN status ENUM(
    'pending_assessment',
    'assessment_scheduled',
    'ready_for_matching',
    'awaiting_admin',
    'confirmed',
    'rejected',
    'terminated',
    'completed',
    'expired',
    'cancelled'
  ) NOT NULL;
