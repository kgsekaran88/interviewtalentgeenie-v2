-- Table for WebRTC signaling between candidates and proctors
CREATE TABLE public.live_stream_signals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proctoring_session_id UUID NOT NULL REFERENCES public.proctoring_sessions(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('candidate', 'proctor')),
  sender_id TEXT NOT NULL,
  signal_type TEXT NOT NULL CHECK (signal_type IN ('offer', 'answer', 'ice-candidate', 'disconnect', 'request-stream')),
  signal_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE
);

-- Index for fast lookups by session
CREATE INDEX idx_live_stream_signals_session ON public.live_stream_signals(proctoring_session_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.live_stream_signals ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to insert/select signals
CREATE POLICY "Anyone can insert signals"
ON public.live_stream_signals
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can view signals"
ON public.live_stream_signals
FOR SELECT
USING (true);

-- Allow cleanup of old signals
CREATE POLICY "Anyone can delete old signals"
ON public.live_stream_signals
FOR DELETE
USING (created_at < now() - interval '1 hour');

-- Add live_stream_active flag to proctoring_sessions if not exists
ALTER TABLE public.proctoring_sessions 
ADD COLUMN IF NOT EXISTS live_stream_active BOOLEAN DEFAULT false;

-- Enable realtime for signaling
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_stream_signals;