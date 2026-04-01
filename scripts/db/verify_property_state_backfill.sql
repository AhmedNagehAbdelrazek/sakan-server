-- Verify no property rows are missing state after migration/backfill
SELECT COUNT(*) AS null_state_rows
FROM properties
WHERE state IS NULL;

-- Verify distribution after backfill
SELECT state, COUNT(*) AS total
FROM properties
GROUP BY state
ORDER BY state;

-- Verify default for future inserts
SELECT column_default
FROM information_schema.columns
WHERE table_name = 'properties'
  AND column_name = 'state';
