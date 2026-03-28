-- Create the question_repository table
CREATE TABLE IF NOT EXISTS public.question_repository (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    question_text text NOT NULL,
    question_type text DEFAULT 'mcq'::text,
    topic text NOT NULL,
    difficulty text NOT NULL DEFAULT 'medium'::text,
    options jsonb,
    correct_answer text,
    explanation text,
    tags text[],
    created_by uuid NOT NULL,
    organization_id uuid,
    is_approved boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT question_repository_pkey PRIMARY KEY (id),
    CONSTRAINT question_repository_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id),
    CONSTRAINT question_repository_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
);

-- Enable RLS
ALTER TABLE public.question_repository ENABLE ROW LEVEL SECURITY;

-- Platform admins can do everything
CREATE POLICY "question_repo_admin_all" ON public.question_repository
    USING (has_any_role_with_hierarchy(uid(), ARRAY['platform_admin'::app_role]));

-- Org members can view questions in their org
CREATE POLICY "question_repo_org_view" ON public.question_repository
    FOR SELECT TO authenticated
    USING (
        organization_id IS NULL
        OR user_is_org_member(uid(), organization_id)
        OR has_any_role_with_hierarchy(uid(), ARRAY['platform_admin'::app_role])
    );

-- Tech SPOCs and above can create questions
CREATE POLICY "question_repo_create" ON public.question_repository
    FOR INSERT TO authenticated
    WITH CHECK (
        has_any_role_with_hierarchy(uid(), ARRAY['tech_spoc'::app_role, 'hr_recruiter'::app_role, 'partner_admin'::app_role, 'platform_admin'::app_role])
    );

-- Creators or admins can update questions
CREATE POLICY "question_repo_update" ON public.question_repository
    FOR UPDATE TO authenticated
    USING (
        created_by = uid()
        OR has_any_role_with_hierarchy(uid(), ARRAY['platform_admin'::app_role])
    );

-- Creators or admins can delete questions
CREATE POLICY "question_repo_delete" ON public.question_repository
    FOR DELETE TO authenticated
    USING (
        created_by = uid()
        OR has_any_role_with_hierarchy(uid(), ARRAY['platform_admin'::app_role])
    );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_question_repo_topic ON public.question_repository(topic);
CREATE INDEX IF NOT EXISTS idx_question_repo_difficulty ON public.question_repository(difficulty);
CREATE INDEX IF NOT EXISTS idx_question_repo_org ON public.question_repository(organization_id);
CREATE INDEX IF NOT EXISTS idx_question_repo_created_by ON public.question_repository(created_by);

-- Grant permissions
GRANT ALL ON public.question_repository TO authenticated;
GRANT SELECT ON public.question_repository TO anon;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
