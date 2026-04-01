BEGIN;

ALTER TABLE properties
  DROP COLUMN IF EXISTS state;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'property_state_enum') THEN
    DROP TYPE property_state_enum;
  END IF;
END
$$;

COMMIT;
