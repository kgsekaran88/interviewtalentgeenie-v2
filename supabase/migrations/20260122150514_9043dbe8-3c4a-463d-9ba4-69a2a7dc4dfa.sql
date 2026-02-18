-- Add missing candidate_timezone column
ALTER TABLE public.interview_invitations 
ADD COLUMN IF NOT EXISTS candidate_timezone text DEFAULT 'Asia/Kolkata';