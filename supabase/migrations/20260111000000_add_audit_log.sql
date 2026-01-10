-- =========================
-- Audit Trail System
-- =========================

-- Create audit_log table to track all important actions
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id text,                    -- Supabase auth user ID
  user_email text,                 -- User email for readability
  action_type text not null,       -- e.g., 'create_sale', 'update_price', 'change_status'
  entity_type text not null,       -- e.g., 'sales_order', 'inventory_lot'
  entity_id uuid not null,         -- ID of the affected entity
  old_values jsonb,                -- Previous state (for undo)
  new_values jsonb,                -- New state
  description text,                -- Human-readable description
  ip_address text,                 -- Client IP (if available)
  user_agent text,                 -- User agent (if available)
  created_at timestamptz not null default now()
);

-- Indexes for fast queries
create index if not exists idx_audit_log_user_id on public.audit_log(user_id);
create index if not exists idx_audit_log_entity on public.audit_log(entity_type, entity_id);
create index if not exists idx_audit_log_action on public.audit_log(action_type);
create index if not exists idx_audit_log_created_at on public.audit_log(created_at desc);
create index if not exists idx_audit_log_entity_id on public.audit_log(entity_id);

-- Enable RLS (Row Level Security) on audit_log
alter table public.audit_log enable row level security;

-- Policy: Users can read their own audit logs
-- For now, allow all authenticated users to read all audit logs
-- You can restrict this later based on user roles
create policy "Users can read audit logs"
  on public.audit_log
  for select
  using (true); -- Allow all authenticated users to read (RLS will check auth)

-- Policy: Only system can insert audit logs (via service role)
-- In practice, this is handled by server-side code using service role key
-- We'll allow inserts from authenticated users for now (tracked by server code)
create policy "System can insert audit logs"
  on public.audit_log
  for insert
  with check (true); -- Server-side code handles authorization

-- Policy: Audit logs are immutable (no updates/deletes)
-- No policy needed - we don't allow updates or deletes

-- Function to get audit logs for an entity (helper view)
create or replace function public.get_entity_audit_log(
  p_entity_type text,
  p_entity_id uuid,
  p_limit int default 100
)
returns table (
  id uuid,
  user_id text,
  user_email text,
  action_type text,
  entity_type text,
  entity_id uuid,
  old_values jsonb,
  new_values jsonb,
  description text,
  created_at timestamptz
)
language plpgsql
security definer
as $$
begin
  return query
  select 
    al.id,
    al.user_id,
    al.user_email,
    al.action_type,
    al.entity_type,
    al.entity_id,
    al.old_values,
    al.new_values,
    al.description,
    al.created_at
  from public.audit_log al
  where al.entity_type = p_entity_type
    and al.entity_id = p_entity_id
  order by al.created_at desc
  limit p_limit;
end;
$$;

