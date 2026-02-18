# Database Migration Scripts

Run these scripts in order in your Supabase SQL Editor (Dashboard → SQL Editor → New Query).

---

## Migration 1: Organization Pricing Columns

Adds usage-based pricing settings to organizations for per-partner pricing rates.

```sql
-- Migration: Add pricing columns to organizations
-- Run this in Supabase SQL Editor

ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS pricing_model TEXT DEFAULT 'subscription',
ADD COLUMN IF NOT EXISTS price_per_interview_cents INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS price_per_invitation_cents INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS price_per_completed_cents INTEGER DEFAULT 500,
ADD COLUMN IF NOT EXISTS pricing_notes TEXT;

-- Add comments for documentation
COMMENT ON COLUMN public.organizations.pricing_model IS 'Pricing model: subscription, usage_based, or hybrid';
COMMENT ON COLUMN public.organizations.price_per_interview_cents IS 'Price per interview created in cents';
COMMENT ON COLUMN public.organizations.price_per_invitation_cents IS 'Price per invitation sent in cents';
COMMENT ON COLUMN public.organizations.price_per_completed_cents IS 'Price per completed interview in cents';
COMMENT ON COLUMN public.organizations.pricing_notes IS 'Internal notes about pricing arrangement';
```

---

## Migration 2: Invoices Table (if not exists)

Creates the invoices table for billing management.

```sql
-- Migration: Create invoices table
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    invoice_number TEXT NOT NULL UNIQUE,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'paid', 'overdue', 'cancelled')),
    subtotal_cents INTEGER NOT NULL DEFAULT 0,
    tax_cents INTEGER NOT NULL DEFAULT 0,
    total_cents INTEGER NOT NULL DEFAULT 0,
    currency TEXT DEFAULT 'USD',
    usage_details JSONB DEFAULT '{}',
    notes TEXT,
    due_date TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- RLS Policies for invoices
CREATE POLICY "Platform admins can manage all invoices"
ON public.invoices
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'platform_admin'))
WITH CHECK (public.has_role(auth.uid(), 'platform_admin'));

CREATE POLICY "Org admins can view their invoices"
ON public.invoices
FOR SELECT
TO authenticated
USING (
    organization_id IN (
        SELECT organization_id FROM public.organization_members 
        WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_invoices_organization_id ON public.invoices(organization_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_period ON public.invoices(period_start, period_end);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_invoices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_invoices_updated_at ON public.invoices;
CREATE TRIGGER update_invoices_updated_at
    BEFORE UPDATE ON public.invoices
    FOR EACH ROW
    EXECUTE FUNCTION public.update_invoices_updated_at();
```

---

## Migration 3: Usage Tracking Table

Creates table to track interview usage for billing.

```sql
-- Migration: Create usage_tracking table
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.usage_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
    usage_type TEXT NOT NULL CHECK (usage_type IN ('interview_created', 'invitation_sent', 'interview_completed')),
    reference_id UUID,
    quantity INTEGER DEFAULT 1,
    unit_price_cents INTEGER DEFAULT 0,
    recorded_at TIMESTAMPTZ DEFAULT now(),
    billing_period_start TIMESTAMPTZ,
    billing_period_end TIMESTAMPTZ,
    invoice_id UUID REFERENCES public.invoices(id),
    metadata JSONB DEFAULT '{}'
);

-- Enable RLS
ALTER TABLE public.usage_tracking ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Platform admins can manage usage tracking"
ON public.usage_tracking
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'platform_admin'))
WITH CHECK (public.has_role(auth.uid(), 'platform_admin'));

CREATE POLICY "Org admins can view their usage"
ON public.usage_tracking
FOR SELECT
TO authenticated
USING (
    organization_id IN (
        SELECT organization_id FROM public.organization_members 
        WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_usage_tracking_org ON public.usage_tracking(organization_id);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_period ON public.usage_tracking(billing_period_start, billing_period_end);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_invoice ON public.usage_tracking(invoice_id);
```

---

## Migration 4: Partner Pricing Tiers (Optional)

Creates predefined pricing tiers for quick partner onboarding.

```sql
-- Migration: Create pricing_tiers table
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.pricing_tiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    pricing_model TEXT DEFAULT 'usage_based',
    price_per_interview_cents INTEGER DEFAULT 0,
    price_per_invitation_cents INTEGER DEFAULT 0,
    price_per_completed_cents INTEGER DEFAULT 500,
    monthly_minimum_cents INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pricing_tiers ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Platform admins can manage pricing tiers"
ON public.pricing_tiers
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'platform_admin'))
WITH CHECK (public.has_role(auth.uid(), 'platform_admin'));

CREATE POLICY "Authenticated users can view active tiers"
ON public.pricing_tiers
FOR SELECT
TO authenticated
USING (is_active = true);

-- Insert default tiers
INSERT INTO public.pricing_tiers (name, description, price_per_interview_cents, price_per_invitation_cents, price_per_completed_cents, monthly_minimum_cents)
VALUES 
    ('Starter', 'Basic usage-based pricing for small partners', 100, 25, 500, 5000),
    ('Growth', 'Reduced rates for growing partners', 75, 20, 400, 10000),
    ('Enterprise', 'Custom enterprise pricing', 50, 15, 300, 25000)
ON CONFLICT (name) DO NOTHING;
```

---

## Migration 5: Add Pricing Tier Reference to Organizations

Links organizations to pricing tiers.

```sql
-- Migration: Add pricing tier reference to organizations
-- Run this in Supabase SQL Editor

ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS pricing_tier_id UUID REFERENCES public.pricing_tiers(id);

-- Add index
CREATE INDEX IF NOT EXISTS idx_organizations_pricing_tier ON public.organizations(pricing_tier_id);
```

---

## Verification Queries

Run these to verify migrations completed successfully:

```sql
-- Check organizations pricing columns
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'organizations' 
AND column_name LIKE 'price%' OR column_name = 'pricing_model';

-- Check invoices table exists
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'invoices'
);

-- Check usage_tracking table exists
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'usage_tracking'
);

-- Check pricing_tiers and data
SELECT * FROM public.pricing_tiers;

-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('invoices', 'usage_tracking', 'pricing_tiers');
```

---

## Rollback Scripts (If Needed)

```sql
-- Rollback Migration 1: Remove pricing columns from organizations
ALTER TABLE public.organizations 
DROP COLUMN IF EXISTS pricing_model,
DROP COLUMN IF EXISTS price_per_interview_cents,
DROP COLUMN IF EXISTS price_per_invitation_cents,
DROP COLUMN IF EXISTS price_per_completed_cents,
DROP COLUMN IF EXISTS pricing_notes,
DROP COLUMN IF EXISTS pricing_tier_id;

-- Rollback Migration 2-5: Drop new tables
DROP TABLE IF EXISTS public.usage_tracking;
DROP TABLE IF EXISTS public.invoices;
DROP TABLE IF EXISTS public.pricing_tiers;
```

---

## Execution Steps

1. **Go to Supabase Dashboard** → SQL Editor
2. **Run Migration 1** first (organization pricing columns)
3. **Run Migration 2** (invoices table)
4. **Run Migration 3** (usage tracking)
5. **Run Migration 4** (pricing tiers - optional)
6. **Run Migration 5** (tier reference - only if you ran #4)
7. **Run Verification Queries** to confirm success

**Note:** Each migration is idempotent (safe to run multiple times) due to `IF NOT EXISTS` and `IF EXISTS` clauses.
