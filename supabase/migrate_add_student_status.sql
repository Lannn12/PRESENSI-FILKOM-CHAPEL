-- ================================================================
-- MIGRATION: Add status column to students table
-- Run this in Supabase SQL Editor
-- ================================================================

-- Add status column with default 'AKTIF'
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS status varchar NOT NULL DEFAULT 'AKTIF'
  CHECK (status IN ('AKTIF', 'MAGANG'));

-- Create index for filtering by status
CREATE INDEX IF NOT EXISTS students_status_idx ON public.students (status);
