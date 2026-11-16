-- Add the payment states written by the booking workflow.
-- Empty enum values from earlier writes are restored from the saved payment metadata.
ALTER TABLE bookings
  MODIFY COLUMN status ENUM(
    'pending',
    'approved',
    'declined',
    'pending_assessment',
    'assessment_scheduled',
    'ready_for_matching',
    'awaiting_admin',
    'confirmed',
    'to_pay',
    'awaiting_payment_approval',
    'rejected',
    'terminated',
    'completed',
    'expired',
    'cancelled'
  ) NOT NULL;

UPDATE bookings
SET status = CASE JSON_UNQUOTE(JSON_EXTRACT(schedule_proposal, '$.__payment.paymentStatus'))
  WHEN 'to_pay' THEN 'to_pay'
  WHEN 'awaiting_approval' THEN 'awaiting_payment_approval'
  WHEN 'proof_rejected' THEN 'to_pay'
  ELSE status
END
WHERE status = ''
  AND JSON_UNQUOTE(JSON_EXTRACT(schedule_proposal, '$.__payment.paymentStatus')) IN ('to_pay', 'awaiting_approval', 'proof_rejected');
