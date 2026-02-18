-- Add extracted_skills column to interviews table for skill retention
ALTER TABLE public.interviews 
ADD COLUMN IF NOT EXISTS extracted_skills TEXT[] DEFAULT NULL;