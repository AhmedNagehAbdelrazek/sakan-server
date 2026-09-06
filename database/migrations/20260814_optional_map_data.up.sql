-- Make map/geo data optional across the schema.
-- flatmate_requests currently requires radius_km, location_lat and location_long.
BEGIN;

ALTER TABLE flatmate_requests
  ALTER COLUMN radius_km DROP NOT NULL,
  ALTER COLUMN location_lat DROP NOT NULL,
  ALTER COLUMN location_long DROP NOT NULL;

COMMIT;
