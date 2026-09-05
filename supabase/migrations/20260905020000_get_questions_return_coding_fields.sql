-- Return coding_schema + allowed_languages to the candidate take-interview UI.
-- Without these columns, CodeEditor falls back to all ~19 languages and never shows SQL schema.

DROP FUNCTION IF EXISTS public.get_questions_for_attempt(uuid);

CREATE OR REPLACE FUNCTION public.get_questions_for_attempt(p_attempt_id uuid)
 RETURNS TABLE(
   id uuid,
   interview_id uuid,
   question_text text,
   topic text,
   difficulty text,
   question_type text,
   options jsonb,
   order_index integer,
   created_at timestamp with time zone,
   coding_schema jsonb,
   allowed_languages text[]
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_interview_id uuid;
  v_interview_status text;
  v_question_count integer;
  v_attempt_status text;
BEGIN
  SELECT
    ia.interview_id,
    ia.status
  INTO
    v_interview_id,
    v_attempt_status
  FROM public.interview_attempts ia
  WHERE ia.id = p_attempt_id;

  IF v_interview_id IS NULL THEN
    RAISE EXCEPTION 'Attempt not found';
  END IF;

  -- Allow in-progress take flow and post-submit review reads
  IF v_attempt_status NOT IN ('in_progress', 'completed', 'submitted', 'evaluated', 'pending_upload') THEN
    RAISE EXCEPTION 'Invalid attempt status';
  END IF;

  SELECT
    i.status,
    i.question_count
  INTO
    v_interview_status,
    v_question_count
  FROM public.interviews i
  WHERE i.id = v_interview_id;

  IF v_interview_status IS NULL THEN
    RAISE EXCEPTION 'Interview not found';
  END IF;

  IF v_interview_status != 'active' THEN
    RAISE EXCEPTION 'Interview is not active';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.attempt_questions
    WHERE attempt_id = p_attempt_id
  ) THEN
    RETURN QUERY
    SELECT
      q.id,
      q.interview_id,
      q.question_text,
      q.topic,
      q.difficulty,
      q.question_type,
      q.options,
      aq.display_order as order_index,
      q.created_at,
      q.coding_schema,
      q.allowed_languages
    FROM public.questions q
    INNER JOIN public.attempt_questions aq ON q.id = aq.question_id
    WHERE aq.attempt_id = p_attempt_id
    ORDER BY
      CASE q.question_type
        WHEN 'mcq' THEN 1
        WHEN 'descriptive' THEN 2
        WHEN 'scenario' THEN 3
        WHEN 'coding' THEN 4
        ELSE 5
      END,
      aq.display_order;
  ELSE
    WITH selected_questions AS (
      SELECT
        q.id,
        q.question_type,
        ROW_NUMBER() OVER (
          ORDER BY
            CASE q.question_type
              WHEN 'mcq' THEN 1
              WHEN 'descriptive' THEN 2
              WHEN 'scenario' THEN 3
              WHEN 'coding' THEN 4
              ELSE 5
            END,
            RANDOM()
        ) as display_order
      FROM public.questions q
      WHERE q.interview_id = v_interview_id
        AND q.deleted_at IS NULL
      ORDER BY RANDOM()
      LIMIT v_question_count
    ),
    ordered_questions AS (
      SELECT
        sq.id,
        ROW_NUMBER() OVER (
          ORDER BY
            CASE sq.question_type
              WHEN 'mcq' THEN 1
              WHEN 'descriptive' THEN 2
              WHEN 'scenario' THEN 3
              WHEN 'coding' THEN 4
              ELSE 5
            END
        ) as display_order
      FROM selected_questions sq
    )
    INSERT INTO public.attempt_questions (attempt_id, question_id, display_order)
    SELECT
      p_attempt_id,
      oq.id,
      oq.display_order
    FROM ordered_questions oq;

    RETURN QUERY
    SELECT
      q.id,
      q.interview_id,
      q.question_text,
      q.topic,
      q.difficulty,
      q.question_type,
      q.options,
      aq.display_order as order_index,
      q.created_at,
      q.coding_schema,
      q.allowed_languages
    FROM public.questions q
    INNER JOIN public.attempt_questions aq ON q.id = aq.question_id
    WHERE aq.attempt_id = p_attempt_id
    ORDER BY
      CASE q.question_type
        WHEN 'mcq' THEN 1
        WHEN 'descriptive' THEN 2
        WHEN 'scenario' THEN 3
        WHEN 'coding' THEN 4
        ELSE 5
      END,
      aq.display_order;
  END IF;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_questions_for_attempt(uuid) TO anon, authenticated, service_role;
