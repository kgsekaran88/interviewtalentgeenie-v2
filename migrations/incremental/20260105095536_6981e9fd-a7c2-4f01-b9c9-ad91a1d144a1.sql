-- Fix the overly permissive service role policy
-- First drop the problematic policy
DROP POLICY IF EXISTS "Service role can manage verification tokens" ON public.email_verification_tokens;

-- Create a restrictive policy to block anonymous/public access
CREATE POLICY "Block anonymous access to verification tokens"
ON public.email_verification_tokens
AS RESTRICTIVE
FOR ALL
TO public
USING (auth.uid() IS NOT NULL);

-- The existing "Users can read own verification tokens" policy is correct
-- It already restricts SELECT to (user_id = auth.uid())

-- Add proper INSERT policy for authenticated users creating their own tokens
CREATE POLICY "Users can create own verification tokens"
ON public.email_verification_tokens
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Add DELETE policy for users to delete their own tokens
CREATE POLICY "Users can delete own verification tokens"
ON public.email_verification_tokens
FOR DELETE
TO authenticated
USING (user_id = auth.uid());