-- GIVouch database schema (Neon Postgres).
-- Run once in the Neon SQL Editor. Safe to re-run: it only creates what is missing.

CREATE TABLE IF NOT EXISTS programs (
  id               SERIAL PRIMARY KEY,
  school           TEXT NOT NULL,
  school_type      TEXT NOT NULL CHECK (school_type IN ('college', 'trade', 'flight')),
  program_name     TEXT NOT NULL,
  field_of_study   TEXT,
  format           TEXT NOT NULL CHECK (format IN ('online', 'in_person', 'abroad')),
  city             TEXT,
  country          TEXT NOT NULL DEFAULT 'United States',
  gi_bill_approved BOOLEAN NOT NULL DEFAULT TRUE,
  va_listing_url   TEXT,
  -- 'pending' programs were added by a visitor and wait for review before showing.
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  -- Marks test rows so they are easy to delete before launch.
  is_sample        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reviews (
  id                 SERIAL PRIMARY KEY,
  program_id         INTEGER NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  -- Email is never shown publicly (see the Privacy Policy).
  reviewer_email     TEXT NOT NULL,
  display_name       TEXT,
  attested_at        TIMESTAMPTZ NOT NULL,
  start_year         INTEGER,
  reviewer_status    TEXT CHECK (reviewer_status IN ('veteran', 'service_member', 'spouse', 'child')),
  benefit            TEXT,
  overall_rating     SMALLINT NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),
  paperwork_rating   SMALLINT CHECK (paperwork_rating BETWEEN 1 AND 5),
  worth_months       SMALLINT CHECK (worth_months BETWEEN 1 AND 5),
  paid_on_time       TEXT CHECK (paid_on_time IN ('always', 'usually', 'rarely', 'not_applicable')),
  credits_transferred TEXT CHECK (credits_transferred IN ('yes', 'partly', 'no', 'not_applicable')),
  would_recommend    BOOLEAN,
  job_outcome        TEXT,
  comment            TEXT,
  -- New reviews wait in the moderation queue until approved.
  status             TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'rejected')),
  is_sample          BOOLEAN NOT NULL DEFAULT FALSE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS review_reports (
  id         SERIAL PRIMARY KEY,
  review_id  INTEGER NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  reason     TEXT NOT NULL,
  note       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS programs_status_idx ON programs (status);
CREATE INDEX IF NOT EXISTS reviews_program_status_idx ON reviews (program_id, status);
