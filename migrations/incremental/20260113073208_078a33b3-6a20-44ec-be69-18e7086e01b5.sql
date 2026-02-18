-- Remove overly permissive policies that bypass organization isolation
-- These policies allow partner_admin, hr_recruiter, interviewer to see ALL sessions across ALL orgs

DROP POLICY IF EXISTS "Admins and recruiters can view all proctoring sessions" ON proctoring_sessions;
DROP POLICY IF EXISTS "Staff can view all proctoring sessions" ON proctoring_sessions;