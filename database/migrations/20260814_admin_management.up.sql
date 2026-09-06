BEGIN;

-- Add 'refunded' to the application status enum (idempotent, mirrors property_state migration)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'application_status_enum') THEN
    CREATE TYPE application_status_enum AS ENUM ('pending', 'approved', 'paid', 'checked_in', 'rejected', 'refunded', 'completed');
  END IF;
END
$$;

-- 'refunded' already exists if the enum was created from the model definition; ensure the value exists for existing enums
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'application_status_enum') THEN
    ALTER TYPE application_status_enum ADD VALUE IF NOT EXISTS 'refunded';
  END IF;
END
$$;

-- users.active (soft deactivation)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;

-- payments refund metadata
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refunded_by UUID,
  ADD COLUMN IF NOT EXISTS refund_reason TEXT;

-- applications structured rejection reason
ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS rejection_reason VARCHAR(255);

COMMIT;
