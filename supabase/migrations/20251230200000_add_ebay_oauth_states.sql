-- Temporary storage for OAuth code verifiers (works across domains)
create table if not exists public.ebay_oauth_states (
  state text primary key,
  code_verifier text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_ebay_oauth_states_expires on public.ebay_oauth_states(expires_at);

-- Grant permissions
grant select, insert, delete on public.ebay_oauth_states to authenticated;
grant select, insert, delete on public.ebay_oauth_states to service_role;

-- Clean up expired states periodically (can be run via cron)
create or replace function public.cleanup_expired_oauth_states()
returns void
language plpgsql
as $$
begin
  delete from public.ebay_oauth_states
  where expires_at < now();
end $$;

