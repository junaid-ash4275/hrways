-- Add user profile JSONB for HRW-SET-1
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS profile JSONB NOT NULL DEFAULT '{}'::jsonb;

