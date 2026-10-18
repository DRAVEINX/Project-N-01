-- Project N-01 cloud services migration.
-- Run this only in the user's own Supabase project. Never expose service_role keys in the client.
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.user_profiles enable row level security;
drop policy if exists "profile owner reads own profile" on public.user_profiles;
create policy "profile owner reads own profile" on public.user_profiles for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "profile owner inserts own profile" on public.user_profiles;
create policy "profile owner inserts own profile" on public.user_profiles for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "profile owner updates own profile" on public.user_profiles;
create policy "profile owner updates own profile" on public.user_profiles for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create or replace function public.project_n01_handle_new_user()
returns trigger language plpgsql security definer set search_path = public, auth
as $$
begin
  insert into public.user_profiles(user_id,email,display_name)
  values(new.id, coalesce(new.email,''), coalesce(new.raw_user_meta_data->>'full_name',''))
  on conflict(user_id) do update set email=excluded.email, updated_at=now();
  return new;
end;
$$;
drop trigger if exists project_n01_new_user on auth.users;
create trigger project_n01_new_user after insert on auth.users
for each row execute procedure public.project_n01_handle_new_user();

-- Immutable encrypted snapshots are used for cross-device transfer and version history.
-- App-layer ciphertext is stored as JSON; no decrypted journal content is uploaded by this table.
create table if not exists public.app_sync_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  device_label text not null default 'Project N-01 device',
  snapshot_hash text not null check(snapshot_hash ~ '^[0-9a-f]{64}$'),
  encrypted_snapshot jsonb not null check(jsonb_typeof(encrypted_snapshot)='object')
);
create index if not exists app_sync_snapshots_owner_time on public.app_sync_snapshots(user_id, created_at desc);
alter table public.app_sync_snapshots enable row level security;
drop policy if exists "owner reads snapshots" on public.app_sync_snapshots;
create policy "owner reads snapshots" on public.app_sync_snapshots for select to authenticated using(user_id=(select auth.uid()));
drop policy if exists "owner creates snapshots" on public.app_sync_snapshots;
create policy "owner creates snapshots" on public.app_sync_snapshots for insert to authenticated with check(user_id=(select auth.uid()));
drop policy if exists "owner deletes snapshots" on public.app_sync_snapshots;
create policy "owner deletes snapshots" on public.app_sync_snapshots for delete to authenticated using(user_id=(select auth.uid()));

create table if not exists public.care_links (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  caregiver_id uuid not null references auth.users(id) on delete cascade,
  invite_email text not null,
  role text not null check(role in ('caregiver','parent','guardian')),
  read_scopes text[] not null default '{}',
  write_scopes text[] not null default '{}',
  status text not null default 'active' check(status in ('active','revoked')),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique(owner_id,caregiver_id)
);
create index if not exists care_links_caregiver on public.care_links(caregiver_id,status);
alter table public.care_links enable row level security;
drop policy if exists "participants can read their care links" on public.care_links;
create policy "participants can read their care links" on public.care_links for select to authenticated using(owner_id=(select auth.uid()) or caregiver_id=(select auth.uid()));
drop policy if exists "owner can revoke care links" on public.care_links;
create policy "owner can revoke care links" on public.care_links for update to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()) and status='revoked');
drop policy if exists "owner can delete care links" on public.care_links;
create policy "owner can delete care links" on public.care_links for delete to authenticated using(owner_id=(select auth.uid()));

create table if not exists public.care_invites (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  invite_email text not null,
  token_hash text not null unique,
  role text not null check(role in ('caregiver','parent','guardian')),
  read_scopes text[] not null default '{}',
  write_scopes text[] not null default '{}',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now()+interval '7 days',
  used_by uuid references auth.users(id) on delete set null,
  used_at timestamptz
);
alter table public.care_invites enable row level security;
drop policy if exists "owner can read own invites" on public.care_invites;
create policy "owner can read own invites" on public.care_invites for select to authenticated using(owner_id=(select auth.uid()));
drop policy if exists "owner can delete own invites" on public.care_invites;
create policy "owner can delete own invites" on public.care_invites for delete to authenticated using(owner_id=(select auth.uid()));

create or replace function public.create_care_invite(
  p_email text, p_role text, p_read_scopes text[], p_write_scopes text[]
) returns text
language plpgsql security definer set search_path=public,auth,extensions
as $$
declare v_token text; v_email text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  v_email:=lower(trim(coalesce(p_email,'')));
  if length(v_email)<5 or position('@' in v_email)<2 then raise exception 'Valid invite email required'; end if;
  if p_role not in ('caregiver','parent','guardian') then raise exception 'Invalid role'; end if;
  if coalesce(array_length(p_read_scopes,1),0)=0 then raise exception 'At least one read scope is required'; end if;
  if exists(select 1 from unnest(coalesce(p_write_scopes,'{}'::text[])) as w where not(w=any(coalesce(p_read_scopes,'{}'::text[])))) then
    raise exception 'Write scopes must also be read scopes';
  end if;
  v_token:=encode(extensions.gen_random_bytes(24),'hex');
  insert into public.care_invites(owner_id,invite_email,token_hash,role,read_scopes,write_scopes)
  values(auth.uid(),v_email,encode(extensions.digest(convert_to(v_token,'UTF8'),'sha256'),'hex'),p_role,
         coalesce(p_read_scopes,'{}'::text[]),coalesce(p_write_scopes,'{}'::text[]));
  return v_token;
end;
$$;

create or replace function public.redeem_care_invite(p_token text)
returns uuid language plpgsql security definer set search_path=public,auth,extensions
as $$
declare v_invite public.care_invites%rowtype; v_link uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into v_invite from public.care_invites
  where token_hash=encode(extensions.digest(convert_to(trim(coalesce(p_token,'')),'UTF8'),'sha256'),'hex')
    and used_at is null and expires_at>now()
  for update;
  if not found then raise exception 'Invitation is invalid, expired, or already used'; end if;
  if lower(coalesce(auth.email(),''))<>lower(v_invite.invite_email) then raise exception 'Sign in with the email address this invitation was issued to'; end if;
  insert into public.care_links(owner_id,caregiver_id,invite_email,role,read_scopes,write_scopes,status)
  values(v_invite.owner_id,auth.uid(),v_invite.invite_email,v_invite.role,v_invite.read_scopes,v_invite.write_scopes,'active')
  on conflict(owner_id,caregiver_id) do update set invite_email=excluded.invite_email,role=excluded.role,
    read_scopes=excluded.read_scopes,write_scopes=excluded.write_scopes,status='active',revoked_at=null
  returning id into v_link;
  update public.care_invites set used_by=auth.uid(),used_at=now() where id=v_invite.id;
  return v_link;
end;
$$;

revoke all on function public.create_care_invite(text,text,text[],text[]) from public;
revoke all on function public.redeem_care_invite(text) from public;
grant execute on function public.create_care_invite(text,text,text[],text[]) to authenticated;
grant execute on function public.redeem_care_invite(text) to authenticated;

-- The invite/link schema is intentionally not a license to expose the owner's encrypted vault.
-- Any future shared records need their own encryption/key-wrapping design plus scoped RLS policies.
