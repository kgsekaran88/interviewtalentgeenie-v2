-- Add new columns to interview_invitations for enhanced candidate data
-- first_name, last_name are separate fields for proper name handling
-- candidate_phone for contact number (optional)
-- resume_url for uploaded resume file path (optional)

ALTER TABLE public.interview_invitations
ADD COLUMN IF NOT EXISTS first_name text,
ADD COLUMN IF NOT EXISTS last_name text,
ADD COLUMN IF NOT EXISTS candidate_phone text,
ADD COLUMN IF NOT EXISTS resume_url text;

-- Create storage bucket for candidate resumes if not exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'candidate-resumes', 
  'candidate-resumes', 
  false, 
  10485760, -- 10MB limit
  ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for candidate-resumes bucket
-- Allow authenticated users to upload resumes (for HR/recruiters)
CREATE POLICY "Authenticated users can upload resumes"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'candidate-resumes' 
  AND auth.role() = 'authenticated'
);

-- Allow users with appropriate roles to view resumes
CREATE POLICY "Staff can view candidate resumes"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'candidate-resumes' 
  AND EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('platform_admin', 'partner_admin', 'hr_recruiter')
  )
);

-- Allow users with appropriate roles to delete resumes
CREATE POLICY "Staff can delete candidate resumes"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'candidate-resumes' 
  AND EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('platform_admin', 'partner_admin', 'hr_recruiter')
  )
);

-- Create a composite index for efficient queries by interview and candidate
CREATE INDEX IF NOT EXISTS idx_interview_invitations_interview_candidate 
ON public.interview_invitations(interview_id, candidate_email);

-- Add comment explaining name handling
COMMENT ON COLUMN public.interview_invitations.first_name IS 'Candidate first name (new invitations)';
COMMENT ON COLUMN public.interview_invitations.last_name IS 'Candidate last name (new invitations)';
COMMENT ON COLUMN public.interview_invitations.candidate_phone IS 'Candidate contact phone number (optional)';
COMMENT ON COLUMN public.interview_invitations.resume_url IS 'Path to candidate resume in storage (optional)';