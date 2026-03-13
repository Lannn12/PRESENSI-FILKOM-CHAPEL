-- ================================================================
-- PRESENSI KULIAH UMUM FILKOM
-- Supabase SQL Schema
-- Run this in Supabase SQL Editor
-- ================================================================

-- Enable UUID extension
create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------
-- 1. SEMESTERS
-- ----------------------------------------------------------------
create table public.semesters (
  id uuid primary key default gen_random_uuid(),
  nama varchar not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

-- Only one semester can be active at a time
create unique index semesters_active_idx on public.semesters (is_active) where is_active = true;

-- ----------------------------------------------------------------
-- 2. STUDENTS
-- ----------------------------------------------------------------
create table public.students (
  id uuid primary key default gen_random_uuid(),
  no_regis varchar not null unique,
  first_name varchar not null,
  last_name varchar not null,
  major varchar not null,
  gender varchar not null check (gender in ('MALE', 'FEMALE')),
  created_at timestamptz not null default now()
);

create index students_no_regis_idx on public.students (no_regis);
create index students_name_idx on public.students (first_name, last_name);

-- ----------------------------------------------------------------
-- 3. ABSENTER GROUPS
-- ----------------------------------------------------------------
create table public.absenter_groups (
  id uuid primary key default gen_random_uuid(),
  semester_id uuid not null references public.semesters (id) on delete cascade,
  nama_group varchar not null,
  deskripsi text,
  created_at timestamptz not null default now()
);

create table public.absenter_group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.absenter_groups (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (group_id, student_id)
);

-- ----------------------------------------------------------------
-- 4. SECTIONS (SEATING)
-- ----------------------------------------------------------------
create table public.sections (
  id uuid primary key default gen_random_uuid(),
  semester_id uuid not null references public.semesters (id) on delete cascade,
  title varchar not null,
  gender varchar not null check (gender in ('MALE', 'FEMALE')),
  capacity integer not null default 0,
  "order" integer not null default 0,
  deskripsi text,
  created_at timestamptz not null default now()
);

create table public.student_sections (
  id uuid primary key default gen_random_uuid(),
  semester_id uuid not null references public.semesters (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  section_id uuid not null references public.sections (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (semester_id, student_id)
);

-- ----------------------------------------------------------------
-- 5. MEETINGS (EVENTS)
-- ----------------------------------------------------------------
create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  semester_id uuid not null references public.semesters (id) on delete cascade,
  nama_event varchar not null,
  event_type varchar not null check (event_type in ('CHAPEL', 'FACULTY_DAY', 'SABBATH')),
  absenter_group_id uuid references public.absenter_groups (id) on delete set null,
  tanggal date not null,
  start_time time not null,
  end_time time,           -- nullable: some events don't have a fixed end time
  deskripsi text,
  scanner_token varchar not null unique default gen_random_uuid()::text,
  scanner_pin varchar,     -- PIN for absenter authentication (6-digit or hashed)
  status varchar(10) not null default 'DRAFT' check (status in ('DRAFT', 'AKTIF', 'DITUTUP')),
  created_at timestamptz not null default now()
);

create index meetings_semester_idx on public.meetings (semester_id);
create index meetings_token_idx on public.meetings (scanner_token);

-- ----------------------------------------------------------------
-- 6. ATTENDANCES
-- ----------------------------------------------------------------
create table public.attendances (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  status varchar(12) not null check (status in ('HADIR', 'LATE', 'TIDAK_HADIR')),
  waktu_scan timestamptz,
  catatan text,
  created_at timestamptz not null default now(),
  unique (student_id, meeting_id)
);

create index attendances_meeting_idx on public.attendances (meeting_id);
create index attendances_student_idx on public.attendances (student_id);

-- ================================================================
-- ROW LEVEL SECURITY (RLS)
-- ================================================================

alter table public.semesters enable row level security;
alter table public.students enable row level security;
alter table public.absenter_groups enable row level security;
alter table public.absenter_group_members enable row level security;
alter table public.sections enable row level security;
alter table public.student_sections enable row level security;
alter table public.meetings enable row level security;
alter table public.attendances enable row level security;

-- Admin (authenticated) can do everything
create policy "Admin full access: semesters" on public.semesters for all using (auth.role() = 'authenticated');
create policy "Admin full access: students" on public.students for all using (auth.role() = 'authenticated');
create policy "Admin full access: absenter_groups" on public.absenter_groups for all using (auth.role() = 'authenticated');
create policy "Admin full access: absenter_group_members" on public.absenter_group_members for all using (auth.role() = 'authenticated');
create policy "Admin full access: sections" on public.sections for all using (auth.role() = 'authenticated');
create policy "Admin full access: student_sections" on public.student_sections for all using (auth.role() = 'authenticated');
create policy "Admin full access: meetings" on public.meetings for all using (auth.role() = 'authenticated');
create policy "Admin full access: attendances" on public.attendances for all using (auth.role() = 'authenticated');

-- Public can read meetings by scanner_token (for /scan/[token] page via API route)
-- Public can read students (for /student lookup page via API route)
-- These are handled via service_role key in API routes, not direct client access.

-- ================================================================
-- SAMPLE DATA (optional - remove in production)
-- ================================================================
-- insert into public.semesters (nama, is_active) values ('Ganjil 2025/2026', true);
