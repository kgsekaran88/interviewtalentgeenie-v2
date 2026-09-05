-- Schema drift fix: usage counters referenced by increment_interviews_used()
-- but missing from organization_subscriptions on some local/fresh deploys.

ALTER TABLE public.organization_subscriptions
  ADD COLUMN IF NOT EXISTS interviews_used integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_usage_used integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS seats_used integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS billing_cycle text DEFAULT 'monthly';
