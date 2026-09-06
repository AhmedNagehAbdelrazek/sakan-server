-- Reverts optional map data on flatmate_requests.
BEGIN;

ALTER TABLE flatmate_requests
  ALTER COLUMN radius_km SET NOT NULL,
  ALTER COLUMN location_lat SET NOT NULL,
  ALTER COLUMN location_long SET NOT NULL;

COMMIT;
