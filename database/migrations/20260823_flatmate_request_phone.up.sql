-- Add contact phone number to flatmate requests (legacy rows are backfilled).
BEGIN;

ALTER TABLE flatmate_requests
  ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20);

UPDATE flatmate_requests
  SET phone_number = ''
  WHERE phone_number IS NULL;

ALTER TABLE flatmate_requests
  ALTER COLUMN phone_number SET NOT NULL;

COMMIT;
