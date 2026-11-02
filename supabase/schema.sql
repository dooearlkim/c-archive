-- =====================================================================
-- C ARCHIVE — Supabase 설정 스크립트
-- Supabase 대시보드 → SQL Editor → New query → 이 파일 전체를 붙여넣고 Run
-- 여러 번 실행해도 안전합니다(이미 있는 것은 건너뜀/갱신).
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------- 회원 프로필 ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  student_id text not null unique,
  role text check (role in ('member','exec','admin')),
  status text not null default 'pending' check (status in ('pending','active','rejected','disabled')),
  created_at timestamptz not null default now(),
  approved_by text,
  approved_at timestamptz,
  last_login timestamptz
);

-- 권한 등급: 일반 1, 집행부 2, 운영자 3 (승인 전·중지 0)
create or replace function public.vis_rank(v text) returns int language sql immutable as $$
  select case v when 'member' then 1 when 'exec' then 2 when 'admin' then 3 else 99 end $$;

create or replace function public.my_rank() returns int
language sql stable security definer set search_path = public as $$
  select coalesce((select vis_rank(role) from profiles where id = auth.uid() and status = 'active' and role is not null), 0) $$;

create or replace function public.my_label() returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select name || '(' || student_id || ')' from profiles where id = auth.uid()), '-') $$;

-- 가입 시 프로필 자동 생성. 학번은 로그인 아이디(학생회메일+s학번@...)에서 가져오므로 위조할 수 없습니다.
-- 활성 운영자가 한 명도 없으면 첫 가입자를 운영자로 지정합니다.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare sid text; nm text; first_admin boolean;
begin
  sid := substring(new.email from '(?:^|\+)s([0-9]{8,10})@');
  if sid is null then raise exception '학번 형식이 올바르지 않습니다.'; end if;
  nm := left(trim(coalesce(new.raw_user_meta_data->>'name', '')), 20);
  if nm = '' then raise exception '이름을 입력해 주세요.'; end if;
  perform pg_advisory_xact_lock(4242);
  first_admin := not exists (select 1 from profiles where role = 'admin' and status = 'active');
  insert into profiles(id, name, student_id, role, status, approved_by, approved_at)
  values (new.id, nm, sid,
          case when first_admin then 'admin' end,
          case when first_admin then 'active' else 'pending' end,
          case when first_admin then '최초 운영자 자동 지정' end,
          case when first_admin then now() end);
  insert into audit(user_label, action) values (nm || '(' || sid || ')', case when first_admin then '최초 운영자 가입' else '가입 신청' end);
  return new;
end $$;

-- ---------- 콘텐츠 ----------
create table if not exists public.items (
  kind text not null check (kind in ('notice','task','recurring','document','handover')),
  id text not null,
  vis text not null check (vis in ('member','exec','admin')),
  sort double precision not null default 0,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by text,
  primary key (kind, id)
);
create table if not exists public.settings (key text primary key, value jsonb not null);
create table if not exists public.files (
  id uuid primary key default gen_random_uuid(),
  doc_id text not null,
  name text not null,
  path text not null unique,
  size bigint not null default 0,
  uploaded_by text,
  uploaded_at timestamptz not null default now()
);
create table if not exists public.audit (
  id bigserial primary key,
  at timestamptz not null default now(),
  user_label text,
  action text not null,
  detail text
);

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- 수정자 자동 기록
create or replace function public.stamp_item() returns trigger language plpgsql security definer set search_path = public as $$
begin new.updated_at := now(); new.updated_by := (select name from profiles where id = auth.uid()); return new; end $$;
drop trigger if exists items_stamp on public.items;
create trigger items_stamp before insert or update on public.items for each row execute function public.stamp_item();

-- ---------- 접근 규칙 (RLS) ----------
alter table public.profiles enable row level security;
alter table public.items    enable row level security;
alter table public.settings enable row level security;
alter table public.files    enable row level security;
alter table public.audit    enable row level security;

drop policy if exists p_profiles_read on public.profiles;
create policy p_profiles_read on public.profiles for select using (id = auth.uid() or my_rank() = 3);

drop policy if exists p_items_read on public.items;
create policy p_items_read on public.items for select using (vis_rank(vis) <= my_rank());
drop policy if exists p_items_write on public.items;
create policy p_items_write on public.items for all using (my_rank() = 3) with check (my_rank() = 3);

drop policy if exists p_settings_read on public.settings;
create policy p_settings_read on public.settings for select using (my_rank() >= 1);
drop policy if exists p_settings_write on public.settings;
create policy p_settings_write on public.settings for all using (my_rank() = 3) with check (my_rank() = 3);

drop policy if exists p_files_read on public.files;
create policy p_files_read on public.files for select using (
  exists (select 1 from items i where i.kind = 'document' and i.id = files.doc_id and vis_rank(i.vis) <= my_rank()));
drop policy if exists p_files_write on public.files;
create policy p_files_write on public.files for all using (my_rank() = 3) with check (my_rank() = 3);

drop policy if exists p_audit_read on public.audit;
create policy p_audit_read on public.audit for select using (my_rank() = 3);
drop policy if exists p_audit_write on public.audit;
create policy p_audit_write on public.audit for insert with check (my_rank() = 3);

-- ---------- 화면용 함수 ----------
-- 내 상태 (승인 대기 등 확인) + 최근 접속 기록
create or replace function public.whoami() returns json
language plpgsql security definer set search_path = public as $$
declare p profiles;
begin
  select * into p from profiles where id = auth.uid();
  if not found then return null; end if;
  if p.status = 'active' then update profiles set last_login = now() where id = p.id; end if;
  return json_build_object('id', p.id, 'name', p.name, 'studentId', p.student_id, 'role', p.role, 'status', p.status);
end $$;

-- 권한 때문에 안 보이는 항목 수 (잠금 안내용)
create or replace function public.hidden_counts() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'tasks', coalesce((select json_object_agg(m, c) from (select (data->>'month') m, count(*) c from items where kind = 'task' and vis_rank(vis) > my_rank() group by 1) t), '{}'::json),
    'docs', (select count(*) from items where kind = 'document' and vis_rank(vis) > my_rank()),
    'handover', (select count(*) from items where kind = 'handover' and vis_rank(vis) > my_rank()),
    'pending', case when my_rank() = 3 then (select count(*) from profiles where status = 'pending') else 0 end) $$;

-- 운영자의 회원 관리
create or replace function public.admin_user_action(target uuid, act text, new_role text default null, new_password text default null) returns void
language plpgsql security definer set search_path = public, extensions, auth as $$
declare t profiles; admins int; last_admin boolean; who text;
begin
  if my_rank() <> 3 then raise exception '운영자만 할 수 있습니다.'; end if;
  select * into t from public.profiles where id = target;
  if not found then raise exception '회원을 찾을 수 없습니다.'; end if;
  select count(*) into admins from public.profiles where role = 'admin' and status = 'active';
  last_admin := t.role = 'admin' and t.status = 'active' and admins <= 1;
  who := t.name || '(' || t.student_id || ')';
  if act = 'approve' then
    if new_role not in ('member','exec','admin') or new_role is null then raise exception '승인할 권한(일반·집행부·운영자)을 반드시 선택해 주세요.'; end if;
    update public.profiles set status = 'active', role = new_role, approved_by = (select name from public.profiles where id = auth.uid()), approved_at = now() where id = target;
  elsif act = 'reject' then
    update public.profiles set status = 'rejected' where id = target;
  elsif act = 'role' then
    if new_role not in ('member','exec','admin') or new_role is null then raise exception '권한을 선택해 주세요.'; end if;
    if last_admin and new_role <> 'admin' then raise exception '마지막 운영자의 권한은 바꿀 수 없습니다. 다른 운영자를 먼저 지정하세요.'; end if;
    update public.profiles set role = new_role where id = target;
  elsif act = 'disable' then
    if last_admin or target = auth.uid() then raise exception '본인 또는 마지막 운영자는 중지할 수 없습니다.'; end if;
    update public.profiles set status = 'disabled' where id = target;
    delete from auth.sessions where user_id = target;
  elsif act = 'enable' then
    if t.role is null then raise exception '승인되지 않은 회원입니다.'; end if;
    update public.profiles set status = 'active' where id = target;
  elsif act = 'reset_pin' then
    if new_password is null or length(new_password) < 6 then raise exception '새 간편비밀번호가 올바르지 않습니다.'; end if;
    update auth.users set encrypted_password = crypt(new_password, gen_salt('bf')) where id = target;
    delete from auth.sessions where user_id = target;
  elsif act = 'delete' then
    if last_admin or target = auth.uid() then raise exception '본인 또는 마지막 운영자는 삭제할 수 없습니다.'; end if;
    delete from auth.users where id = target;
  else
    raise exception '알 수 없는 작업입니다.';
  end if;
  insert into public.audit(user_label, action, detail) values (my_label(),
    case act when 'approve' then '가입 승인' when 'reject' then '가입 거절' when 'role' then '권한 변경' when 'disable' then '이용 중지'
             when 'enable' then '이용 재개' when 'reset_pin' then '간편비밀번호 초기화' else '회원 삭제' end,
    who || coalesce(' → ' || new_role, ''));
end $$;

-- 운영자 기록 남기기
create or replace function public.log_action(act text, detail text default '') returns void
language sql security definer set search_path = public as $$
  insert into audit(user_label, action, detail) select my_label(), left(act, 100), left(detail, 500) where my_rank() = 3 $$;

-- 로그인 화면용 공개 정보 (사이트 이름, 운영자 존재 여부만)
create or replace function public.public_info() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'name', (select value->>'name' from settings where key = 'site'),
    'org', (select value->>'org' from settings where key = 'site'),
    'welcome', (select value->>'welcome' from settings where key = 'site'),
    'has_admin', exists (select 1 from profiles where role = 'admin' and status = 'active')) $$;

-- 장기간 미사용 일시정지 방지용 (GitHub Actions가 하루 한 번 호출, 아무 정보도 반환하지 않음)
create or replace function public.ping() returns int language sql stable as $$ select 1 $$;

revoke all on function public.admin_user_action(uuid, text, text, text) from public, anon;
grant execute on function public.admin_user_action(uuid, text, text, text) to authenticated;
grant execute on function public.whoami(), public.hidden_counts(), public.log_action(text, text) to authenticated;
grant execute on function public.ping(), public.public_info() to anon, authenticated;

-- ---------- 파일 저장소 ----------
insert into storage.buckets (id, name, public, file_size_limit)
values ('docs', 'docs', false, 26214400)
on conflict (id) do update set public = false, file_size_limit = 26214400;

drop policy if exists p_docs_read on storage.objects;
create policy p_docs_read on storage.objects for select using (
  bucket_id = 'docs' and exists (
    select 1 from public.items i where i.kind = 'document' and i.id = split_part(storage.objects.name, '/', 1) and public.vis_rank(i.vis) <= public.my_rank()));
drop policy if exists p_docs_insert on storage.objects;
create policy p_docs_insert on storage.objects for insert with check (
  bucket_id = 'docs' and public.my_rank() = 3
  and lower(storage.extension(name)) in ('pdf','hwp','hwpx','doc','docx','xls','xlsx','ppt','pptx','png','jpg','jpeg','txt','csv','zip'));
drop policy if exists p_docs_delete on storage.objects;
create policy p_docs_delete on storage.objects for delete using (bucket_id = 'docs' and public.my_rank() = 3);
