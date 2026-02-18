-- Drop any existing policies
DROP POLICY IF EXISTS "Anyone can insert signals" ON public.live_stream_signals;
DROP POLICY IF EXISTS "Anyone can view signals" ON public.live_stream_signals;
DROP POLICY IF EXISTS "Anyone can delete old signals" ON public.live_stream_signals;
DROP POLICY IF EXISTS "Insert signals for active sessions" ON public.live_stream_signals;
DROP POLICY IF EXISTS "Staff can view all signals" ON public.live_stream_signals;
DROP POLICY IF EXISTS "View signals for active sessions" ON public.live_stream_signals;
DROP POLICY IF EXISTS "Candidates can view own session signals" ON public.live_stream_signals;
DROP POLICY IF EXISTS "Update signals for active sessions" ON public.live_stream_signals;
DROP POLICY IF EXISTS "Platform admins can delete signals" ON public.live_stream_signals;

-- Allow INSERT only for valid active proctoring sessions
CREATE POLICY "Insert signals for active sessions"
ON public.live_stream_signals
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.proctoring_sessions ps
    WHERE ps.id = proctoring_session_id
    AND ps.ended_at IS NULL
  )
);

-- Allow SELECT for authenticated staff via user_roles table
CREATE POLICY "Staff can view all signals"
ON public.live_stream_signals
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('platform_admin', 'partner_admin', 'hr_recruiter', 'interviewer', 'tech_spoc')
  )
);

-- Candidates can view signals for active sessions (for WebRTC signaling)
CREATE POLICY "View signals for active sessions"
ON public.live_stream_signals
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.proctoring_sessions ps
    WHERE ps.id = proctoring_session_id
    AND ps.ended_at IS NULL
  )
);

-- Allow UPDATE (mark as processed) for active sessions
CREATE POLICY "Update signals for active sessions"
ON public.live_stream_signals
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.proctoring_sessions ps
    WHERE ps.id = proctoring_session_id
    AND ps.ended_at IS NULL
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.proctoring_sessions ps
    WHERE ps.id = proctoring_session_id
    AND ps.ended_at IS NULL
  )
);

-- Only platform admins can delete signals
CREATE POLICY "Platform admins can delete signals"
ON public.live_stream_signals
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'platform_admin'
  )
);