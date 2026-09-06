BEGIN;

ALTER TABLE applications
  DROP COLUMN IF EXISTS rejection_reason;

ALTER TABLE payments
  DROP COLUMN IF EXISTS refund_reason,
  DROP COLUMN IF EXISTS refunded_by,
  DROP COLUMN IF EXISTS refunded_at;

ALTER TABLE users
  DROP COLUMN IF EXISTS active;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'application_status_enum') THEN
    -- 'refunded' is restored on re-apply of the up migration (ADD VALUE IF NOT EXISTS);
    -- the enum itself is kept to avoid dropping a type other tables may reference.
    NULL;
  END IF;
END
$$;

COMMIT;
