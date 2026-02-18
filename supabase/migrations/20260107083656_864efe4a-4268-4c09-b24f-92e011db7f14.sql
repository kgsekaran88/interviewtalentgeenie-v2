-- Add sent_by column to track who sent the invitation
ALTER TABLE public.interview_invitations 
ADD COLUMN sent_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add index for efficient lookups
CREATE INDEX idx_interview_invitations_sent_by ON public.interview_invitations(sent_by);

-- Add comment for documentation
COMMENT ON COLUMN public.interview_invitations.sent_by IS 'User ID of who sent this invitation';