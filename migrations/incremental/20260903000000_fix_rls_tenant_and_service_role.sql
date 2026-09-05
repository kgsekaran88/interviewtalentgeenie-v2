-- =============================================================================
-- Fix: interviews SELECT cross-tenant leak + open "Service role can manage"
-- policies that lacked TO service_role (applied to ALL roles via USING(true)).
-- =============================================================================

-- 1) Interviews: platform_admin sees all; others only creator / own org
DROP POLICY IF EXISTS "interviews_select_policy" ON public.interviews;
CREATE POLICY "interviews_select_policy" ON public.interviews
  FOR SELECT USING (
    creator_id = auth.uid()
    OR has_any_role_with_hierarchy(auth.uid(), ARRAY['platform_admin'::app_role])
    OR (organization_id IS NOT NULL AND can_access_org_data(auth.uid(), organization_id))
  );

-- 2) Retarget privileged manage-all policies to service_role only
DROP POLICY IF EXISTS "Service role can manage coach sessions" ON public.ai_coach_sessions;
CREATE POLICY "Service role can manage coach sessions" ON public.ai_coach_sessions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can manage analytics" ON public.analytics_snapshots;
CREATE POLICY "Service role can manage analytics" ON public.analytics_snapshots
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can manage ATS candidates" ON public.ats_candidates;
CREATE POLICY "Service role can manage ATS candidates" ON public.ats_candidates
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can manage CPI" ON public.candidate_performance_index;
CREATE POLICY "Service role can manage CPI" ON public.candidate_performance_index
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can manage certificates" ON public.certificates;
CREATE POLICY "Service role can manage certificates" ON public.certificates
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can manage attempts" ON public.certification_attempts;
CREATE POLICY "Service role can manage attempts" ON public.certification_attempts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can manage consent records" ON public.consent_records;
CREATE POLICY "Service role can manage consent records" ON public.consent_records
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can manage user badges" ON public.user_badges;
CREATE POLICY "Service role can manage user badges" ON public.user_badges
  FOR ALL TO service_role USING (true) WITH CHECK (true);
