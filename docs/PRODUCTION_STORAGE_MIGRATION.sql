-- ============================================================================
-- PRODUCTION STORAGE MIGRATION
-- Complete storage buckets and policies from dev environment
-- Generated: 2024-12-27
-- Total Buckets: 4
-- Total Policies: 15
-- ============================================================================

-- ============================================================================
-- SECTION 1: STORAGE BUCKETS
-- ============================================================================

-- Certificates Bucket (Public)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types, avif_autodetection)
VALUES (
  'certificates',
  'certificates',
  true,
  10485760, -- 10MB
  ARRAY['application/pdf', 'image/png', 'image/jpeg'],
  false
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Consent Documents Bucket (Private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types, avif_autodetection)
VALUES (
  'consent-documents',
  'consent-documents',
  false,
  10485760, -- 10MB
  ARRAY['application/pdf', 'image/png', 'image/jpeg'],
  false
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Documentation Bucket (Private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types, avif_autodetection)
VALUES (
  'documentation',
  'documentation',
  false,
  10485760, -- 10MB
  ARRAY['application/pdf'],
  false
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Proctoring Recordings Bucket (Private, no size/type limit)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types, avif_autodetection)
VALUES (
  'proctoring-recordings',
  'proctoring-recordings',
  false,
  NULL, -- No limit for video recordings
  NULL, -- Accept any mime type
  false
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ============================================================================
-- SECTION 2: CERTIFICATES BUCKET POLICIES
-- ============================================================================

-- Public read access for certificates
DROP POLICY IF EXISTS "certificates_public_read" ON storage.objects;
CREATE POLICY "certificates_public_read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'certificates');

-- Admin write access for certificates
DROP POLICY IF EXISTS "certificates_admin_write" ON storage.objects;
CREATE POLICY "certificates_admin_write"
ON storage.objects FOR INSERT
TO public
WITH CHECK (
  bucket_id = 'certificates'
  AND EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'platform_admin'
  )
);

-- ============================================================================
-- SECTION 3: CONSENT DOCUMENTS BUCKET POLICIES
-- ============================================================================

-- Admin/HR read access for consent documents
DROP POLICY IF EXISTS "consent_documents_admin_read" ON storage.objects;
CREATE POLICY "consent_documents_admin_read"
ON storage.objects FOR SELECT
TO public
USING (
  bucket_id = 'consent-documents'
  AND EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = ANY(ARRAY['platform_admin', 'partner_admin', 'hr_recruiter']::app_role[])
  )
);

-- Admin/HR write access for consent documents
DROP POLICY IF EXISTS "consent_documents_admin_write" ON storage.objects;
CREATE POLICY "consent_documents_admin_write"
ON storage.objects FOR INSERT
TO public
WITH CHECK (
  bucket_id = 'consent-documents'
  AND EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = ANY(ARRAY['platform_admin', 'partner_admin', 'hr_recruiter']::app_role[])
  )
);

-- ============================================================================
-- SECTION 4: DOCUMENTATION BUCKET POLICIES
-- ============================================================================

-- Admins can view documentation
DROP POLICY IF EXISTS "Admins can view documentation" ON storage.objects;
CREATE POLICY "Admins can view documentation"
ON storage.objects FOR SELECT
TO public
USING (
  bucket_id = 'documentation'
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- Admins can upload documentation
DROP POLICY IF EXISTS "Admins can upload documentation" ON storage.objects;
CREATE POLICY "Admins can upload documentation"
ON storage.objects FOR INSERT
TO public
WITH CHECK (
  bucket_id = 'documentation'
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- Admins can update documentation
DROP POLICY IF EXISTS "Admins can update documentation" ON storage.objects;
CREATE POLICY "Admins can update documentation"
ON storage.objects FOR UPDATE
TO public
USING (
  bucket_id = 'documentation'
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- Admins can delete documentation
DROP POLICY IF EXISTS "Admins can delete documentation" ON storage.objects;
CREATE POLICY "Admins can delete documentation"
ON storage.objects FOR DELETE
TO public
USING (
  bucket_id = 'documentation'
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- ============================================================================
-- SECTION 5: PROCTORING RECORDINGS BUCKET POLICIES
-- ============================================================================

-- Service role can upload proctoring recordings (for edge functions)
DROP POLICY IF EXISTS "Only service role can upload proctoring recordings" ON storage.objects;
CREATE POLICY "Only service role can upload proctoring recordings"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'proctoring-recordings');

-- Service role can upload proctoring recordings (public role check)
DROP POLICY IF EXISTS "Service role can upload proctoring recordings" ON storage.objects;
CREATE POLICY "Service role can upload proctoring recordings"
ON storage.objects FOR INSERT
TO public
WITH CHECK (
  bucket_id = 'proctoring-recordings'
  AND auth.role() = 'service_role'
);

-- Service role can update proctoring recordings
DROP POLICY IF EXISTS "Service role can update proctoring recordings" ON storage.objects;
CREATE POLICY "Service role can update proctoring recordings"
ON storage.objects FOR UPDATE
TO public
USING (
  bucket_id = 'proctoring-recordings'
  AND auth.role() = 'service_role'
);

-- Staff can view proctoring recordings
DROP POLICY IF EXISTS "Staff can view proctoring recordings" ON storage.objects;
CREATE POLICY "Staff can view proctoring recordings"
ON storage.objects FOR SELECT
TO public
USING (
  bucket_id = 'proctoring-recordings'
  AND (
    -- Platform/partner admins, HR, interviewers can view
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = ANY(ARRAY['platform_admin', 'partner_admin', 'hr_recruiter', 'interviewer']::app_role[])
    )
    OR
    -- Interview creators can view their own recordings
    EXISTS (
      SELECT 1
      FROM proctoring_sessions ps
      JOIN interview_attempts ia ON ps.interview_attempt_id = ia.id
      JOIN interviews i ON ia.interview_id = i.id
      WHERE (ps.id)::text = (storage.foldername(objects.name))[1]
      AND i.creator_id = auth.uid()
    )
  )
);

-- Interview creators can view proctoring recordings (by URL match)
DROP POLICY IF EXISTS "Interview creators can view proctoring recordings" ON storage.objects;
CREATE POLICY "Interview creators can view proctoring recordings"
ON storage.objects FOR SELECT
TO public
USING (
  bucket_id = 'proctoring-recordings'
  AND EXISTS (
    SELECT 1
    FROM proctoring_sessions ps
    JOIN interview_attempts ia ON ps.interview_attempt_id = ia.id
    JOIN interviews i ON ia.interview_id = i.id
    WHERE (ps.video_recording_url = objects.name OR ps.screen_recording_url = objects.name)
    AND i.creator_id = auth.uid()
  )
);

-- Interview creators can view their recordings (by folder name)
DROP POLICY IF EXISTS "Interview creators can view their recordings" ON storage.objects;
CREATE POLICY "Interview creators can view their recordings"
ON storage.objects FOR SELECT
TO public
USING (
  bucket_id = 'proctoring-recordings'
  AND EXISTS (
    SELECT 1
    FROM proctoring_sessions ps
    JOIN interview_attempts ia ON ps.interview_attempt_id = ia.id
    JOIN interviews i ON ia.interview_id = i.id
    WHERE i.creator_id = auth.uid()
    AND objects.name LIKE (ps.id || '%')
  )
);

-- Staff can delete proctoring recordings
DROP POLICY IF EXISTS "Staff can delete proctoring recordings" ON storage.objects;
CREATE POLICY "Staff can delete proctoring recordings"
ON storage.objects FOR DELETE
TO public
USING (
  bucket_id = 'proctoring-recordings'
  AND EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = ANY(ARRAY['platform_admin', 'partner_admin']::app_role[])
  )
);

-- ============================================================================
-- COMPLETE
-- ============================================================================
