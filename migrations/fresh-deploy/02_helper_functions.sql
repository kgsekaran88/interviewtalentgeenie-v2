-- ============================================================================
-- FRESH DEPLOYMENT: 02 - HELPER FUNCTIONS
-- Must run BEFORE tables (some tables use these functions as defaults)
-- ============================================================================

-- Update timestamp function (used by triggers)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Generate slug function
CREATE OR REPLACE FUNCTION public.generate_slug(input_text TEXT)
RETURNS TEXT AS $$
DECLARE
  base_slug TEXT;
  random_suffix TEXT;
BEGIN
  base_slug := lower(regexp_replace(input_text, '[^a-zA-Z0-9]+', '-', 'g'));
  base_slug := trim(both '-' from base_slug);
  base_slug := left(base_slug, 50);
  random_suffix := lower(substring(md5(random()::text) from 1 for 4));
  RETURN base_slug || '-' || random_suffix;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Certificate number generator
CREATE OR REPLACE FUNCTION public.generate_certificate_number()
RETURNS TEXT AS $$
DECLARE
  cert_number TEXT;
  year_suffix TEXT;
BEGIN
  year_suffix := TO_CHAR(NOW(), 'YY');
  cert_number := 'CERT-' || year_suffix || '-' || LPAD(FLOOR(RANDOM() * 999999)::TEXT, 6, '0');
  RETURN cert_number;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Verification code generator
CREATE OR REPLACE FUNCTION public.generate_verification_code()
RETURNS TEXT AS $$
BEGIN
  RETURN UPPER(SUBSTRING(MD5(RANDOM()::TEXT || NOW()::TEXT) FROM 1 FOR 12));
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Invoice number generator (needs invoices table to exist but is idempotent)
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS TEXT AS $$
DECLARE
  next_number INTEGER;
  invoice_num TEXT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM 5) AS INTEGER)), 0) + 1
  INTO next_number
  FROM public.invoices
  WHERE invoice_number ~ '^INV-[0-9]+$';
  
  invoice_num := 'INV-' || LPAD(next_number::TEXT, 6, '0');
  RETURN invoice_num;
EXCEPTION WHEN undefined_table THEN
  RETURN 'INV-000001';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- CPI Score Calculator (drop first to handle parameter name changes)
DROP FUNCTION IF EXISTS public.calculate_cpi_score(NUMERIC, NUMERIC, NUMERIC);

CREATE OR REPLACE FUNCTION public.calculate_cpi_score(
  p_technical_score NUMERIC,
  p_problem_solving_score NUMERIC,
  p_integrity_score NUMERIC
)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_technical_weight NUMERIC;
  v_problem_solving_weight NUMERIC;
  v_integrity_weight NUMERIC;
  v_cpi NUMERIC;
BEGIN
  SELECT 
    COALESCE((SELECT value::NUMERIC FROM public.platform_configurations WHERE key = 'cpi_technical_weight'), 40),
    COALESCE((SELECT value::NUMERIC FROM public.platform_configurations WHERE key = 'cpi_problem_solving_weight'), 30),
    COALESCE((SELECT value::NUMERIC FROM public.platform_configurations WHERE key = 'cpi_integrity_weight'), 30)
  INTO v_technical_weight, v_problem_solving_weight, v_integrity_weight;

  v_cpi := (
    (p_technical_score * v_technical_weight / 100) +
    (p_problem_solving_score * v_problem_solving_weight / 100) +
    (p_integrity_score * v_integrity_weight / 100)
  );

  RETURN ROUND(v_cpi, 2);
END;
$$;

-- Check RLS enabled
CREATE OR REPLACE FUNCTION public.check_rls_enabled(table_name text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT relrowsecurity
  FROM pg_class
  WHERE relname = table_name
  AND relnamespace = 'public'::regnamespace;
$$;

-- ============================================================================
-- DONE - Run 03_tables.sql next
-- ============================================================================
