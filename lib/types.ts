export type Gender = 'MALE' | 'FEMALE'
export type EventType = 'CHAPEL' | 'FACULTY_DAY' | 'SABBATH'
export type EventStatus = 'DRAFT' | 'AKTIF' | 'DITUTUP'
export type AttendanceStatus = 'HADIR' | 'LATE' | 'TIDAK_HADIR'

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

export const STATUS_COLORS: Record<AttendanceStatus, string> = {
  HADIR: 'bg-green-100 text-green-800',
  LATE: 'bg-yellow-100 text-yellow-800',
  TIDAK_HADIR: 'bg-red-100 text-red-800',
}

export const EVENT_STATUS_COLORS: Record<EventStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  AKTIF: 'bg-green-100 text-green-800',
  DITUTUP: 'bg-blue-100 text-blue-800',
}
