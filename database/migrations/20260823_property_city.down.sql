-- Reverts the city column on properties.
BEGIN;

ALTER TABLE properties
  DROP COLUMN IF EXISTS city;

COMMIT;
