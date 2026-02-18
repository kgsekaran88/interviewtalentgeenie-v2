-- Update calculate_cpi_score to use Simple Average formula
-- CPI = (Total Correct / Total Questions) × 100
-- This function is kept for backward compatibility but now just returns a simple average

CREATE OR REPLACE FUNCTION public.calculate_cpi_score(
  p_technical_score NUMERIC,
  p_problem_solving_score NUMERIC,
  p_integrity_score NUMERIC DEFAULT NULL
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Simple Average: Both scores are already percentages of their respective categories
  -- We average them equally regardless of question counts
  -- Note: This is a simplified approximation. The edge function calculates the true simple average.
  RETURN ROUND(COALESCE(p_technical_score, 0) + COALESCE(p_problem_solving_score, 0)) / 
         CASE WHEN p_technical_score IS NOT NULL AND p_problem_solving_score IS NOT NULL THEN 2
              WHEN p_technical_score IS NOT NULL OR p_problem_solving_score IS NOT NULL THEN 1
              ELSE 1 END;
END;
$$;

-- Recalculate all CPI records with the new simple average formula
-- This updates existing records to use the new calculation
UPDATE candidate_performance_index cpi
SET 
  overall_cpi = ROUND(
    ((COALESCE(easy_correct, 0) + COALESCE(medium_correct, 0) + COALESCE(hard_correct, 0))::NUMERIC / 
     NULLIF(COALESCE(easy_total, 0) + COALESCE(medium_total, 0) + COALESCE(hard_total, 0), 0)) * 100,
    2
  ),
  updated_at = now()
WHERE (COALESCE(easy_total, 0) + COALESCE(medium_total, 0) + COALESCE(hard_total, 0)) > 0;

-- Update hiring recommendations based on new CPI values
UPDATE candidate_performance_index cpi
SET 
  hiring_recommendation = CASE
    WHEN overall_cpi >= 85 AND integrity_score >= 90 THEN 'strongly_recommend'
    WHEN overall_cpi >= 70 AND integrity_score >= 80 THEN 'recommend'
    WHEN overall_cpi >= 50 AND integrity_score >= 70 THEN 'consider'
    ELSE 'not_recommended'
  END,
  updated_at = now();