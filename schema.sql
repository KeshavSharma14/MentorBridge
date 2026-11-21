create extension if not exists pgcrypto;

create type public.profile_role as enum ('student', 'mentor');
create type public.mentorship_request_status as enum ('pending', 'accepted', 'rejected');
create type public.session_status as enum ('proposed', 'confirmed', 'scheduled', 'completed', 'cancelled');
alter type public.session_status add value if not exists 'proposed';
alter type public.session_status add value if not exists 'confirmed';

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  user_id uuid primary key references public.users(id) on delete cascade,
  role public.profile_role not null,
  headline text,
  bio text,
  skills text[] not null default '{}',
  interests text[] not null default '{}',
  goals text[] not null default '{}',
  availability jsonb not null default '{}'::jsonb,
  contact_info jsonb not null default '{}'::jsonb,
  share_contact boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.mentorship_requests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.users(id) on delete cascade,
  mentor_id uuid not null references public.users(id) on delete cascade,
  status public.mentorship_request_status not null default 'pending',
  message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint mentorship_requests_distinct_users check (student_id <> mentor_id),
  constraint mentorship_requests_unique_pair unique (student_id, mentor_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  mentorship_request_id uuid not null references public.mentorship_requests(id) on delete cascade,
  sender_id uuid not null references public.users(id) on delete cascade,
  recipient_id uuid not null references public.users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  constraint messages_distinct_users check (sender_id <> recipient_id),
  constraint messages_content_not_blank check (btrim(content) <> '')
);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  mentorship_request_id uuid not null references public.mentorship_requests(id) on delete cascade,
  mentor_id uuid not null references public.users(id) on delete cascade,
  student_id uuid not null references public.users(id) on delete cascade,
  title text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  meeting_link text,
  notes text,
  status public.session_status not null default 'scheduled',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sessions_valid_time check (ends_at > starts_at)
);

alter table public.sessions
  add column if not exists proposed_by uuid references public.users(id) on delete set null;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger users_set_updated_at before update on public.users
for each row execute function public.set_updated_at();

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

create trigger mentorship_requests_set_updated_at before update on public.mentorship_requests
for each row execute function public.set_updated_at();

create trigger sessions_set_updated_at before update on public.sessions
for each row execute function public.set_updated_at();

create or replace function public.validate_message_pair()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  request_row public.mentorship_requests%rowtype;
begin
  select * into request_row
  from public.mentorship_requests
  where id = new.mentorship_request_id;

  if request_row.id is null then
    raise exception 'Mentorship request not found';
  end if;

  if request_row.status <> 'accepted' then
    raise exception 'Messages require an accepted mentorship request';
  end if;

  if not (
    (request_row.student_id = new.sender_id and request_row.mentor_id = new.recipient_id)
    or (request_row.mentor_id = new.sender_id and request_row.student_id = new.recipient_id)
  ) then
    raise exception 'Message participants must match the mentorship request';
  end if;

  return new;
end;
$$;

create trigger messages_validate_pair
before insert or update on public.messages
for each row execute function public.validate_message_pair();

create or replace function public.validate_session_pair()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  request_row public.mentorship_requests%rowtype;
begin
  select * into request_row
  from public.mentorship_requests
  where id = new.mentorship_request_id;

  if request_row.id is null then
    raise exception 'Mentorship request not found';
  end if;

  if request_row.status <> 'accepted' then
    raise exception 'Sessions require an accepted mentorship request';
  end if;

  if request_row.student_id <> new.student_id or request_row.mentor_id <> new.mentor_id then
    raise exception 'Session participants must match the mentorship request';
  end if;

  return new;
end;
$$;

create trigger sessions_validate_pair
before insert or update on public.sessions
for each row execute function public.validate_session_pair();

create or replace function public.is_mentorship_accepted(other_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.mentorship_requests mr
    where mr.status = 'accepted'
      and (
        (mr.student_id = auth.uid() and mr.mentor_id = other_user_id)
        or (mr.mentor_id = auth.uid() and mr.student_id = other_user_id)
      )
  );
$$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'full_name', null)
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.users.full_name),
    updated_at = now();
  return new;
end;
$$;

create trigger on_auth_user_created
after insert or update of email, raw_user_meta_data on auth.users
for each row execute function public.handle_new_auth_user();

create index mentorship_requests_student_id_idx on public.mentorship_requests(student_id);
create index mentorship_requests_mentor_id_idx on public.mentorship_requests(mentor_id);
create index mentorship_requests_status_idx on public.mentorship_requests(status);
create index messages_request_created_idx on public.messages(mentorship_request_id, created_at);
create index messages_sender_id_idx on public.messages(sender_id);
create index messages_recipient_id_idx on public.messages(recipient_id);
create index sessions_request_id_idx on public.sessions(mentorship_request_id);
create index sessions_student_id_idx on public.sessions(student_id);
create index sessions_mentor_id_idx on public.sessions(mentor_id);
create index sessions_starts_at_idx on public.sessions(starts_at);
create index profiles_role_idx on public.profiles(role);

alter table public.users enable row level security;
alter table public.profiles enable row level security;
alter table public.mentorship_requests enable row level security;
alter table public.messages enable row level security;
alter table public.sessions enable row level security;

create policy "Users can view their own account"
on public.users for select
using (id = auth.uid());

create policy "Users can update their own account"
on public.users for update
using (id = auth.uid())
with check (id = auth.uid());

create policy "Profiles are visible to owner or accepted counterpart"
on public.profiles for select
using (user_id = auth.uid() or public.is_mentorship_accepted(user_id));

create policy "Users can insert their own profile"
on public.profiles for insert
with check (user_id = auth.uid());

create policy "Users can update their own profile"
on public.profiles for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Participants can view their mentorship requests"
on public.mentorship_requests for select
using (student_id = auth.uid() or mentor_id = auth.uid());

create policy "Students can create mentorship requests"
on public.mentorship_requests for insert
with check (student_id = auth.uid());

create policy "Participants can update mentorship requests"
on public.mentorship_requests for update
using (student_id = auth.uid() or mentor_id = auth.uid())
with check (student_id = auth.uid() or mentor_id = auth.uid());

create policy "Accepted participants can view messages"
on public.messages for select
using (
  public.is_mentorship_accepted(recipient_id)
  and (sender_id = auth.uid() or recipient_id = auth.uid())
);

create policy "Accepted participants can send messages"
on public.messages for insert
with check (
  sender_id = auth.uid()
  and public.is_mentorship_accepted(recipient_id)
  and exists (
    select 1
    from public.mentorship_requests mr
    where mr.id = mentorship_request_id
      and mr.status = 'accepted'
      and (
        (mr.student_id = sender_id and mr.mentor_id = recipient_id)
        or (mr.mentor_id = sender_id and mr.student_id = recipient_id)
      )
  )
);

create policy "Accepted participants can view sessions"
on public.sessions for select
using (
  (student_id = auth.uid() or mentor_id = auth.uid())
  and exists (
    select 1
    from public.mentorship_requests mr
    where mr.id = mentorship_request_id
      and mr.status = 'accepted'
  )
);

create policy "Mentors and students can create sessions"
on public.sessions for insert
with check (
  (student_id = auth.uid() or mentor_id = auth.uid())
  and exists (
    select 1
    from public.mentorship_requests mr
    where mr.id = mentorship_request_id
      and mr.status = 'accepted'
      and mr.student_id = student_id
      and mr.mentor_id = mentor_id
  )
);

create policy "Accepted participants can update sessions"
on public.sessions for update
using (student_id = auth.uid() or mentor_id = auth.uid())
with check (student_id = auth.uid() or mentor_id = auth.uid());

create or replace view public.profile_directory
with (security_invoker = true)
as
select
  p.user_id,
  p.role,
  p.headline,
  p.bio,
  p.skills,
  p.interests,
  p.goals,
  p.availability,
  case
    when p.share_contact and (p.user_id = auth.uid() or public.is_mentorship_accepted(p.user_id))
      then p.contact_info
    else '{}'::jsonb
  end as contact_info,
  p.share_contact,
  p.created_at,
  p.updated_at
from public.profiles p;

grant usage on schema public to anon, authenticated;
grant select on public.profile_directory to authenticated;
grant select, update on public.users to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.mentorship_requests to authenticated;
grant select, insert on public.messages to authenticated;
grant select, insert, update on public.sessions to authenticated;
