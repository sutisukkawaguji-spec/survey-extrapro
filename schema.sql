-- 1. สร้างตาราง Profiles สำหรับข้อมูลผู้ใช้และ Team ID
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  display_name text,
  user_code text unique not null,
  team_id uuid not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. สร้างตาราง Jobs สำหรับเก็บจุดสำรวจ
create table if not exists public.jobs (
  id text primary key,
  team_id uuid not null,
  lat double precision not null,
  lng double precision not null,
  geometry jsonb not null,
  status text not null,
  category text not null,
  properties jsonb not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. เปิดใช้งาน Row Level Security (RLS) เพื่อความปลอดภัย
alter table public.profiles enable row level security;
alter table public.jobs enable row level security;

-- 4. นโยบายความปลอดภัย (RLS Policies) สำหรับ Profiles
drop policy if exists select_profiles on public.profiles;
drop policy if exists update_profiles on public.profiles;
drop policy if exists insert_profiles on public.profiles;

create policy select_profiles on public.profiles for select using (true);
create policy update_profiles on public.profiles for update using (true);
create policy insert_profiles on public.profiles for insert with check (auth.uid() = id);

-- 5. นโยบายความปลอดภัย (RLS Policies) สำหรับ Jobs (จำกัดตาม team_id)
drop policy if exists select_jobs on public.jobs;
drop policy if exists insert_jobs on public.jobs;
drop policy if exists update_jobs on public.jobs;
drop policy if exists delete_jobs on public.jobs;

create policy select_jobs on public.jobs for select using (
  team_id = (select team_id from public.profiles where id = auth.uid())
);

create policy insert_jobs on public.jobs for insert with check (
  team_id = (select team_id from public.profiles where id = auth.uid())
);

create policy update_jobs on public.jobs for update using (
  team_id = (select team_id from public.profiles where id = auth.uid())
);

create policy delete_jobs on public.jobs for delete using (
  team_id = (select team_id from public.profiles where id = auth.uid())
);

-- 6. ทริกเกอร์สร้าง Profile อัตโนมัติเมื่อมีการสมัครสมาชิกผ่าน Supabase Auth
create or replace function public.handle_new_user()
returns trigger as $$
declare
  random_code text;
begin
  -- สร้างรหัสสุ่ม 6 หลักสำหรับ user_code
  random_code := substring(md5(random()::text) from 1 for 6);
  
  insert into public.profiles (id, email, display_name, user_code, team_id)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', 'ผู้ใช้งาน'),
    random_code,
    new.id -- เริ่มต้นให้ team_id เป็นไอดีของตัวเอง (สร้างพื้นที่งานส่วนตัว)
  );
  return new;
end;
$$ language plpgsql security definer;

-- ลบ trigger เดิมถ้ามี
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
