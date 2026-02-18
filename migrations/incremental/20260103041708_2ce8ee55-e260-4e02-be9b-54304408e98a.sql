-- Add business verification fields to organizations table
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS legal_business_name text,
ADD COLUMN IF NOT EXISTS business_registration_number text,
ADD COLUMN IF NOT EXISTS tax_id text,
ADD COLUMN IF NOT EXISTS business_address text,
ADD COLUMN IF NOT EXISTS business_phone text,
ADD COLUMN IF NOT EXISTS year_established integer;

-- Add a comment explaining the verification logic
COMMENT ON COLUMN public.organizations.verification_status IS 'Auto-set to "verified" when all required business fields are filled: legal_business_name, business_registration_number, tax_id, business_address, business_phone';