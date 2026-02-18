-- Drop NOT NULL constraints that blocked Cloud data import
-- These columns exist only in the local schema or have NULL values in Cloud data

-- password_setup_invitations
ALTER TABLE public.password_setup_invitations ALTER COLUMN email DROP NOT NULL;

-- learning_plans
ALTER TABLE public.learning_plans ALTER COLUMN user_id DROP NOT NULL;

-- platform_documentation
ALTER TABLE public.platform_documentation ALTER COLUMN slug DROP NOT NULL;

-- test_suites
ALTER TABLE public.test_suites ALTER COLUMN test_type DROP NOT NULL;

-- usage_tracking
ALTER TABLE public.usage_tracking ALTER COLUMN action_type DROP NOT NULL;
ALTER TABLE public.usage_tracking ALTER COLUMN resource_type DROP NOT NULL;

-- interview_operation_logs
ALTER TABLE public.interview_operation_logs ALTER COLUMN interview_id DROP NOT NULL;
ALTER TABLE public.interview_operation_logs ALTER COLUMN operation DROP NOT NULL;
ALTER TABLE public.interview_operation_logs ALTER COLUMN status DROP NOT NULL;

-- interviews (46 of 56 Cloud rows have NULL creator_id)
ALTER TABLE public.interviews ALTER COLUMN creator_id DROP NOT NULL;
ALTER TABLE public.interviews ALTER COLUMN job_description DROP NOT NULL;
ALTER TABLE public.interviews ALTER COLUMN title DROP NOT NULL;
