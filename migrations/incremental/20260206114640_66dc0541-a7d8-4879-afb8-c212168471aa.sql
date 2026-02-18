-- Add DELETE audit trigger for interviews table
CREATE OR REPLACE FUNCTION public.log_interview_delete()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.audit_logs (
    action,
    table_name,
    record_id,
    user_id,
    metadata
  ) VALUES (
    'DELETE',
    'interviews',
    OLD.id::text,
    auth.uid(),
    jsonb_build_object(
      'old_data', row_to_json(OLD)::jsonb,
      'deleted_at', now()
    )
  );
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Add DELETE audit trigger for questions table
CREATE OR REPLACE FUNCTION public.log_question_delete()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.audit_logs (
    action,
    table_name,
    record_id,
    user_id,
    metadata
  ) VALUES (
    'DELETE',
    'questions',
    OLD.id::text,
    auth.uid(),
    jsonb_build_object(
      'old_data', row_to_json(OLD)::jsonb,
      'deleted_at', now()
    )
  );
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create triggers
DROP TRIGGER IF EXISTS audit_interviews_delete ON public.interviews;
CREATE TRIGGER audit_interviews_delete
  BEFORE DELETE ON public.interviews
  FOR EACH ROW
  EXECUTE FUNCTION public.log_interview_delete();

DROP TRIGGER IF EXISTS audit_questions_delete ON public.questions;
CREATE TRIGGER audit_questions_delete
  BEFORE DELETE ON public.questions
  FOR EACH ROW
  EXECUTE FUNCTION public.log_question_delete();

-- Also add DELETE trigger for interview_invitations since it was also missing
CREATE OR REPLACE FUNCTION public.log_invitation_delete()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.audit_logs (
    action,
    table_name,
    record_id,
    user_id,
    metadata
  ) VALUES (
    'DELETE',
    'interview_invitations',
    OLD.id::text,
    auth.uid(),
    jsonb_build_object(
      'old_data', row_to_json(OLD)::jsonb,
      'deleted_at', now()
    )
  );
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS audit_invitations_delete ON public.interview_invitations;
CREATE TRIGGER audit_invitations_delete
  BEFORE DELETE ON public.interview_invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.log_invitation_delete();