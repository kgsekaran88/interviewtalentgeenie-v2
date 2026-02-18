-- Fix column name and add missing column
ALTER TABLE public.interview_invitations 
RENAME COLUMN last_reminder_sent_at TO last_reminder_at;

ALTER TABLE public.interview_invitations 
ADD COLUMN IF NOT EXISTS max_reminders_reached boolean DEFAULT false;