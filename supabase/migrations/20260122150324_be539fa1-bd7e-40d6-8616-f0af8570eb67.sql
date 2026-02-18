-- Add missing columns for reminder tracking
ALTER TABLE public.interview_invitations 
ADD COLUMN IF NOT EXISTS reminder_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_reminder_sent_at timestamptz;

-- Add index for efficient reminder queries
CREATE INDEX IF NOT EXISTS idx_interview_invitations_reminder_pending 
ON public.interview_invitations (status, email_sent, reminder_count, created_at) 
WHERE status = 'pending' AND deleted_at IS NULL;