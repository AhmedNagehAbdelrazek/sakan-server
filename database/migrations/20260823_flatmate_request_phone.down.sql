-- Reverts the phone_number column on flatmate_requests.
BEGIN;

ALTER TABLE flatmate_requests
  DROP COLUMN IF EXISTS phone_number;

COMMIT;
