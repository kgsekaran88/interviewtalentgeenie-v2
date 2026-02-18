-- Add coding topic distribution field to interviews table
ALTER TABLE public.interviews 
ADD COLUMN IF NOT EXISTS coding_topic_distribution JSONB DEFAULT NULL;

-- Add comment explaining the field
COMMENT ON COLUMN public.interviews.coding_topic_distribution IS 'Specifies per-topic question counts for coding questions. Example: {"Python": {"medium": 1, "hard": 1}, "SQL": {"medium": 1, "hard": 1}}';