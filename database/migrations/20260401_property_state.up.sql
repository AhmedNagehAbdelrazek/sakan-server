BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'property_state_enum') THEN
    CREATE TYPE property_state_enum AS ENUM ('drafted', 'sent', 'approved', 'declined');
  END IF;
END
$$;

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS state property_state_enum;

UPDATE properties
SET state = 'approved'
WHERE state IS NULL;

ALTER TABLE properties
  ALTER COLUMN state SET DEFAULT 'sent',
  ALTER COLUMN state SET NOT NULL;

COMMIT;
