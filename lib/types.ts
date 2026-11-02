export type Gender = 'MALE' | 'FEMALE'
export type EventType = 'CHAPEL' | 'FACULTY_DAY' | 'SABBATH'
export type EventStatus = 'DRAFT' | 'AKTIF' | 'DITUTUP' | 'ARCHIVED'
export type AttendanceStatus = 'HADIR' | 'LATE' | 'TIDAK_HADIR'
export type StudentStatus = 'AKTIF' | 'MAGANG'

export interface Semester {
  id: string
  nama: string
  is_active: boolean
  created_at: string
}

export interface Student {
  id: string
  no_regis: string
  first_name: string
  last_name: string
  major: string
  gender: Gender
  status: StudentStatus
  created_at: string
}

export interface AbsenterGroup {
  id: string
  semester_id: string
  nama_group: string
  deskripsi: string | null
  created_at: string
  member_count?: number
}

export interface AbsenterGroupMember {
  id: string
  group_id: string
  student_id: string
  created_at: string
  student?: Student
}

export interface Section {
  id: string
  semester_id: string
  title: string
  gender: Gender
  capacity: number
  columns_per_row: number
  order: number
  deskripsi: string | null
  created_at: string
  assigned_count?: number
}

export interface StudentSection {
  id: string
  semester_id: string
  student_id: string
  section_id: string
  seat_number: number | null
  created_at: string
  student?: Student
  section?: Section
}

export interface Meeting {
  id: string
  semester_id: string
  nama_event: string
  event_type: EventType
  absenter_group_id: string | null
  tanggal: string
  start_time: string
  end_time: string | null
  deskripsi: string | null
  scanner_token: string
  scanner_pin: string | null
  status: EventStatus
  created_at: string
  absenter_group?: AbsenterGroup
}

export interface Attendance {
  id: string
  student_id: string
  meeting_id: string
  status: AttendanceStatus
  waktu_scan: string | null
  catatan: string | null
  created_at: string
  student?: Student
  meeting?: Meeting
}

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  CHAPEL: 'Chapel',
  FACULTY_DAY: 'Faculty Day',
  SABBATH: 'Sabbath',
}

export const STATUS_LABELS: Record<AttendanceStatus, string> = {
  HADIR: 'Hadir',
  LATE: 'Late',
  TIDAK_HADIR: 'Tidak Hadir',
}

// Palet Active Theory — canvas gelap, warna status gelap + teks terang
export const STATUS_COLORS: Record<AttendanceStatus, string> = {
  HADIR: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/25',
  LATE: 'bg-amber-500/15 text-amber-300 border-amber-400/25',
  TIDAK_HADIR: 'bg-rose-500/15 text-rose-300 border-rose-400/25',
}

export const EVENT_STATUS_COLORS: Record<EventStatus, string> = {
  DRAFT: 'bg-white/[0.08] text-white/70 border-white/[0.12]',
  AKTIF: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/25',
  DITUTUP: 'bg-blue-500/15 text-blue-300 border-blue-400/25',
  ARCHIVED: 'bg-violet-500/15 text-violet-300 border-violet-400/25',
}

export const STUDENT_STATUS_LABELS: Record<StudentStatus, string> = {
  AKTIF: 'Aktif',
  MAGANG: 'Magang',
}

export const STUDENT_STATUS_COLORS: Record<StudentStatus, string> = {
  AKTIF: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/25',
  MAGANG: 'bg-orange-500/15 text-orange-300 border-orange-400/25',
}

// ── Student page shared types ─────────────────

export interface StudentInfo {
  no_regis: string
  first_name: string
  last_name: string
  major: string
  gender: string
}

export interface AttendanceStats {
  total: number
  hadir: number
  late: number
  tidak_hadir: number
}

export interface AttendanceRow {
  id: string
  status: AttendanceStatus
  waktu_scan: string | null
  meeting: {
    nama_event: string
    tanggal: string
    event_type: EventType
    status: string
  } | null
}
