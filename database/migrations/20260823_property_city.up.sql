-- Add city to properties (required at creation; legacy rows are backfilled).
BEGIN;

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS city VARCHAR(255);

UPDATE properties
  SET city = ''
  WHERE city IS NULL;

ALTER TABLE properties
  ALTER COLUMN city SET NOT NULL;

COMMIT;
