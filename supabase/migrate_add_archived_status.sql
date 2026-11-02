-- ================================================================
-- MIGRATION: Allow 'ARCHIVED' on meetings.status
--
-- MASALAH: constraint lama hanya mengizinkan ('DRAFT','AKTIF','DITUTUP'),
-- padahal aplikasi (lib/types.ts, halaman Pertemuan) memakai status
-- 'ARCHIVED' untuk mengarsipkan event. Setiap kali admin menekan tombol
-- "Arsipkan", update ditolak database dengan:
--   new row violates check constraint "meetings_status_check"
-- sehingga event tidak pernah bisa diarsipkan.
--
-- Script ini idempotent: aman dijalankan berkali-kali.
-- Jalankan di Supabase SQL Editor.
-- ================================================================

DO $$
DECLARE
  cname text;
BEGIN
  -- Drop semua CHECK constraint lama yang menempel pada kolom meetings.status
  -- (nama constraint bisa berbeda antar instalasi, jadi cari lewat pg_constraint)
  FOR cname IN
    SELECT c.conname
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
     WHERE n.nspname = 'public'
       AND t.relname = 'meetings'
       AND c.contype = 'c'
       AND a.attname = 'status'
  LOOP
    EXECUTE format('ALTER TABLE public.meetings DROP CONSTRAINT %I', cname);
    RAISE NOTICE 'Dropped constraint: %', cname;
  END LOOP;

  -- Constraint baru yang menyertakan ARCHIVED
  ALTER TABLE public.meetings
    ADD CONSTRAINT meetings_status_check
    CHECK (status IN ('DRAFT', 'AKTIF', 'DITUTUP', 'ARCHIVED'));

  RAISE NOTICE 'meetings_status_check diperbarui: DRAFT, AKTIF, DITUTUP, ARCHIVED.';
END $$;
