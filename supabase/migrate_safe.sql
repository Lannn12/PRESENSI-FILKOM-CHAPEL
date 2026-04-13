-- ================================================================
-- SAFE MIGRATION - Tidak akan error jika tabel sudah ada
-- Jalankan di Supabase SQL Editor
-- ================================================================

create extension if not exists "pgcrypto";

-- 1. SEMESTERS
create table if not exists public.semesters (
  id uuid primary key default gen_random_uuid(),
  nama varchar not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index if not exists semesters_active_idx on public.semesters (is_active) where is_active = true;

-- 2. STUDENTS
create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  no_regis varchar not null unique,
  first_name varchar not null,
  last_name varchar not null,
  major varchar not null,
  gender varchar not null check (gender in ('MALE', 'FEMALE')),
  created_at timestamptz not null default now()
);
create index if not exists students_no_regis_idx on public.students (no_regis);
create index if not exists students_name_idx on public.students (first_name, last_name);

-- 3. ABSENTER GROUPS
create table if not exists public.absenter_groups (
  id uuid primary key default gen_random_uuid(),
  semester_id uuid not null references public.semesters (id) on delete cascade,
  nama_group varchar not null,
  deskripsi text,
  created_at timestamptz not null default now()
);

create table if not exists public.absenter_group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.absenter_groups (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (group_id, student_id)
);

-- 4. SECTIONS (SEATING)
create table if not exists public.sections (
  id uuid primary key default gen_random_uuid(),
  semester_id uuid not null references public.semesters (id) on delete cascade,
  title varchar not null,
  gender varchar not null check (gender in ('MALE', 'FEMALE')),
  capacity integer not null default 0,
  columns_per_row integer not null default 4,
  "order" integer not null default 0,
  deskripsi text,
  created_at timestamptz not null default now()
);

create table if not exists public.student_sections (
  id uuid primary key default gen_random_uuid(),
  semester_id uuid not null references public.semesters (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  section_id uuid not null references public.sections (id) on delete cascade,
  seat_number integer,
  created_at timestamptz not null default now(),
  unique (semester_id, student_id)
);

-- 5. MEETINGS (EVENTS)
create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  semester_id uuid not null references public.semesters (id) on delete cascade,
  nama_event varchar not null,
  event_type varchar not null check (event_type in ('CHAPEL', 'FACULTY_DAY', 'SABBATH')),
  absenter_group_id uuid references public.absenter_groups (id) on delete set null,
  tanggal date not null,
  start_time time not null,
  end_time time,
  deskripsi text,
  scanner_token varchar not null unique default gen_random_uuid()::text,
  scanner_pin varchar,
  status varchar(10) not null default 'DRAFT' check (status in ('DRAFT', 'AKTIF', 'DITUTUP')),
  created_at timestamptz not null default now()
);
create index if not exists meetings_semester_idx on public.meetings (semester_id);
create index if not exists meetings_token_idx on public.meetings (scanner_token);

-- 6. ATTENDANCES
create table if not exists public.attendances (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  status varchar(12) not null check (status in ('HADIR', 'LATE', 'TIDAK_HADIR')),
  waktu_scan timestamptz,
  catatan text,
  created_at timestamptz not null default now(),
  unique (student_id, meeting_id)
);
create index if not exists attendances_meeting_idx on public.attendances (meeting_id);
create index if not exists attendances_student_idx on public.attendances (student_id);

-- ================================================================
-- ROW LEVEL SECURITY (RLS) - aman dijalankan berkali-kali
-- ================================================================
alter table public.semesters enable row level security;
alter table public.students enable row level security;
alter table public.absenter_groups enable row level security;
alter table public.absenter_group_members enable row level security;
alter table public.sections enable row level security;
alter table public.student_sections enable row level security;
alter table public.meetings enable row level security;
alter table public.attendances enable row level security;

-- RLS Policies - gunakan DROP IF EXISTS lalu CREATE
do $$
begin
  -- Semesters
  drop policy if exists "Admin full access: semesters" on public.semesters;
  create policy "Admin full access: semesters" on public.semesters for all using (auth.role() = 'authenticated');

  -- Students
  drop policy if exists "Admin full access: students" on public.students;
  create policy "Admin full access: students" on public.students for all using (auth.role() = 'authenticated');

  -- Absenter Groups
  drop policy if exists "Admin full access: absenter_groups" on public.absenter_groups;
  create policy "Admin full access: absenter_groups" on public.absenter_groups for all using (auth.role() = 'authenticated');

  -- Absenter Group Members
  drop policy if exists "Admin full access: absenter_group_members" on public.absenter_group_members;
  create policy "Admin full access: absenter_group_members" on public.absenter_group_members for all using (auth.role() = 'authenticated');

  -- Sections
  drop policy if exists "Admin full access: sections" on public.sections;
  create policy "Admin full access: sections" on public.sections for all using (auth.role() = 'authenticated');

  -- Student Sections
  drop policy if exists "Admin full access: student_sections" on public.student_sections;
  create policy "Admin full access: student_sections" on public.student_sections for all using (auth.role() = 'authenticated');

  -- Meetings
  drop policy if exists "Admin full access: meetings" on public.meetings;
  create policy "Admin full access: meetings" on public.meetings for all using (auth.role() = 'authenticated');

  -- Attendances
  drop policy if exists "Admin full access: attendances" on public.attendances;
  create policy "Admin full access: attendances" on public.attendances for all using (auth.role() = 'authenticated');
end $$;
