-- Member app UI: class photos, member notifications (the bell) + web push.

-- Class photos: set on a recurring class (series) or a one-off class. Sessions
-- of a series show the series photo.
alter table public.class_series add column if not exists image_url text;
alter table public.classes add column if not exists image_url text;

-- Members' in-app notifications — written by the edge function. `ref` makes
-- scheduled reminders idempotent (null refs never collide).
create table if not exists public.client_notifications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  url text,
  ref text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists client_notifications_client_idx on public.client_notifications(client_id, created_at desc);
create index if not exists client_notifications_org_idx on public.client_notifications(org_id);
create unique index if not exists client_notifications_dedupe on public.client_notifications(client_id, type, ref);
alter table public.client_notifications enable row level security;
create policy "client reads own notifications" on public.client_notifications for select to authenticated
  using (client_id in (select id from public.clients where auth_user_id = (select auth.uid())));

-- Members' web-push devices (same shape as staff push_subscriptions).
create table if not exists public.client_push_subscriptions (
  id text primary key,
  org_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, endpoint)
);
create index if not exists client_push_subscriptions_org_idx on public.client_push_subscriptions(org_id);
alter table public.client_push_subscriptions enable row level security;
create policy "client reads own push devices" on public.client_push_subscriptions for select to authenticated
  using (client_id in (select id from public.clients where auth_user_id = (select auth.uid())));

-- Class photo storage: public read by URL; a dept head writes into their own
-- folder (<their uid>/...).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('class-images', 'class-images', true, 3145728, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create or replace function public.is_dept_head() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'dept_head');
$$;
revoke all on function public.is_dept_head() from public, anon;
grant execute on function public.is_dept_head() to authenticated;

create policy "class images dept head insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'class-images' and (storage.foldername(name))[1] = (select auth.uid())::text and public.is_dept_head());
create policy "class images dept head update" on storage.objects for update to authenticated
  using (bucket_id = 'class-images' and (storage.foldername(name))[1] = (select auth.uid())::text and public.is_dept_head());
create policy "class images dept head delete" on storage.objects for delete to authenticated
  using (bucket_id = 'class-images' and (storage.foldername(name))[1] = (select auth.uid())::text and public.is_dept_head());
create policy "class images dept head select" on storage.objects for select to authenticated
  using (bucket_id = 'class-images' and (storage.foldername(name))[1] = (select auth.uid())::text and public.is_dept_head());

-- Member reminders (class starting soon, plan ending/ended), every 15 minutes.
select cron.schedule('bizqwik-client-reminders', '*/15 * * * *', $$
  select net.http_post(
    url := 'https://aylhnxniqrihpvrllpgz.supabase.co/functions/v1/make-server-980e1cbf/push/client-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'supabase_anon_key'),
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
$$);
