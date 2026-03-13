# Fix: Event Status Tidak Bisa Aktif & PIN Tidak Valid di Vercel

## ✅ Masalah yang Diperbaiki

### Issue #1: Status Event Tidak Bisa Aktif
1. **hashPin menggunakan Node.js `crypto`** - Tidak bisa jalan di browser/client-side
2. **scanner_pin field varchar(6)** - Terlalu pendek untuk hash SHA-256 (64 karakter)
3. **Verify PIN API** - Masih menggunakan hashPin yang tidak compatible

### Issue #2: PIN Tidak Valid di Scanner (Manual Input)
1. **`/api/scan/route.ts`** - Masih menggunakan `hashPin()` untuk validasi PIN
2. **Mismatch** - PIN disimpan sebagai plain text tapi divalidasi dengan hash

### Issue #3: PIN Tidak Valid Saat Scan Barcode/ID Card **(FIX BARU!)**
1. **pinRef tidak di-load dari sessionStorage** - PIN yang sudah di-verify tidak otomatis terisi ke ref
2. **Barcode scanner mengirim empty PIN** - Karena pinRef.current = '', scan barcode gagal dengan "PIN tidak valid"

## 🔧 Perubahan yang Dilakukan

### 1. Update `app/(dashboard)/pertemuan/page.tsx`
- ✅ Menghapus penggunaan `hashPin()` 
- ✅ Menyimpan PIN 6-digit sebagai plain text
- ✅ Menambahkan `console.error` untuk debugging

### 2. Update `app/api/scan/verify-pin/route.ts`
- ✅ Menghapus import `hashPin`
- ✅ Compare PIN plain text (tidak di-hash)

### 3. Update `app/api/scan/route.ts` **(FIX!)**
- ✅ Menghapus import `hashPin`
- ✅ Validasi PIN menggunakan plain text comparison
- ✅ PIN yang dimasukkan user langsung dibandingkan dengan scanner_pin di database

### 4. Update `app/scan/[token]/page.tsx` **(FIX BARU!)**
- ✅ Load PIN dari sessionStorage ke `pinRef.current` di `loadMeeting()`
- ✅ Memastikan barcode scanner bisa mengirim PIN yang benar
- ✅ PIN otomatis terisi setelah verifikasi pertama

### 5. Update `supabase/schema.sql`
- ✅ Mengubah `scanner_pin varchar(6)` menjadi `scanner_pin varchar` (tanpa limit)

## 📋 Langkah yang Harus Dilakukan di Supabase

### Opsi 1: Update Manual via SQL Editor (RECOMMENDED)

Jalankan SQL ini di Supabase SQL Editor untuk update kolom scanner_pin:

```sql
-- Alter scanner_pin column to allow longer values
ALTER TABLE public.meetings 
ALTER COLUMN scanner_pin TYPE varchar;

-- Optional: Drop existing PIN data if you want to reset
UPDATE public.meetings SET scanner_pin = NULL WHERE scanner_pin IS NOT NULL;
```

### Opsi 2: Apply Full Schema

Jika Anda ingin apply seluruh schema dari `supabase/schema.sql`:

1. Buka Supabase Dashboard
2. Masuk ke SQL Editor
3. Copy isi file `supabase/schema.sql`
4. Paste dan Run

**⚠️ PERHATIAN:** Ini akan drop dan recreate semua tabel jika sudah ada constraint conflicts!

## 🚀 Deploy ke Vercel

Setelah push ke GitHub, Vercel akan otomatis deploy:

1. **Commit sudah di-push** ✅
2. **Buka Vercel Dashboard** - https://vercel.com/dashboard
3. **Pilih project** PRESSENSI-FILKOM-CHAPEL
4. **Tunggu deployment selesai** (biasanya 1-2 menit)
5. **Test aktivasi event** di production

## 🧪 Testing di Production

Setelah deploy selesai:

1. **Login ke aplikasi** di Vercel URL
2. **Buat event baru** atau gunakan event existing
3. **Klik dropdown status** → Pilih "Aktif"
4. **Perhatikan toast notification** - harus muncul PIN 6-digit
5. **Cek database** di Supabase:
   ```sql
   SELECT id, nama_event, status, scanner_pin 
   FROM public.meetings 
   ORDER BY created_at DESC 
   LIMIT 5;
   ```
6. **Test scanner** dengan PIN yang ditampilkan

## 🔍 Debugging Jika Masih Bermasalah

### 1. Cek Browser Console
- Buka DevTools (F12)
- Lihat error di Console tab
- Perhatikan network requests di Network tab

### 2. Cek Vercel Function Logs
1. Buka Vercel Dashboard
2. Pilih project → Deployments
3. Klik deployment terbaru
4. Klik "View Function Logs"
5. Cari error saat aktivasi event

### 3. Cek Supabase Logs
1. Buka Supabase Dashboard
2. Masuk ke Database → Logs
3. Filter untuk error pada tabel `meetings`

### 4. Test API Langsung
```bash
# Test verify-pin API
curl -X POST https://your-vercel-url.app/api/scan/verify-pin \
  -H "Content-Type: application/json" \
  -d '{"token":"your-token","pin":"123456"}'
```

## 📝 Catatan Penting

1. **RLS Policies** - Pastikan policy "Admin full access: meetings" sudah aktif
2. **Environment Variables** - Pastikan `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY` sudah set di Vercel
3. **Auth Session** - User harus login untuk bisa update status event
4. **PIN Security** - PIN 6-digit disimpan plain text tapi ada rate limiting (5 request/menit) di API

## ✅ Checklist

- [ ] Update kolom scanner_pin di Supabase (run SQL)
- [ ] Tunggu deployment Vercel selesai
- [ ] Test aktivasi event
- [ ] Test verify PIN di scanner page
- [ ] Cek logs jika ada error

## 🆘 Jika Masih Ada Masalah

Buat issue di GitHub dengan menyertakan:
1. Screenshot error di browser console
2. Vercel function logs
3. Supabase logs (jika ada)
4. Langkah untuk reproduce masalah
