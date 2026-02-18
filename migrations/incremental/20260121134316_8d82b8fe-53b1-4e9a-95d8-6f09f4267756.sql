
-- Update calculate_cpi_score function to focus ONLY on technical scores
-- Remove integrity from CPI calculation - it will be used separately for hiring decision
CREATE OR REPLACE FUNCTION public.calculate_cpi_score(
  p_technical_score NUMERIC,
  p_problem_solving_score NUMERIC,
  p_integrity_score NUMERIC DEFAULT NULL -- Keep parameter for backward compatibility but ignore it
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_technical_weight NUMERIC;
  v_problem_solving_weight NUMERIC;
  v_cpi NUMERIC;
BEGIN
  -- New weights: 60% technical, 40% problem solving (no integrity in CPI)
  SELECT 
    COALESCE((SELECT value::NUMERIC FROM public.platform_configurations WHERE key = 'cpi_technical_weight'), 60),
    COALESCE((SELECT value::NUMERIC FROM public.platform_configurations WHERE key = 'cpi_problem_solving_weight'), 40)
  INTO v_technical_weight, v_problem_solving_weight;

  -- CPI is now purely technical competency
  v_cpi := (
    (p_technical_score * v_technical_weight / 100) +
    (p_problem_solving_score * v_problem_solving_weight / 100)
  );
  
  RETURN ROUND(v_cpi, 2);
END;
$$;

-- Update platform_configurations with new default weights (include category)
INSERT INTO public.platform_configurations (key, value, category, description)
VALUES 
  ('cpi_technical_weight', '60', 'cpi', 'Weight for technical score in CPI calculation (percentage)'),
  ('cpi_problem_solving_weight', '40', 'cpi', 'Weight for problem solving score in CPI calculation (percentage)')
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  updated_at = now();

-- Remove the old integrity weight config if exists
DELETE FROM public.platform_configurations WHERE key = 'cpi_integrity_weight';
