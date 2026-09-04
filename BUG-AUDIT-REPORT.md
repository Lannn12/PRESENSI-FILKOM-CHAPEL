# 🐛 Bug Audit Report: Sistem Presensi FILKOM

**Audit Date:** 2026-09-04  
**Total Bugs Found:** 17  
**Status:** ⚠️ ACTION REQUIRED

---

## 📊 Executive Summary

| Severity | Count | Status |
|----------|-------|--------|
| 🔴 **CRITICAL** | 3 | ⚠️ **IMMEDIATE ACTION REQUIRED** |
| 🟠 **HIGH** | 6 | ⚠️ **FIX WITHIN 1 WEEK** |
| 🟡 **MEDIUM** | 6 | 📝 **PLAN TO FIX** |
| 🟢 **LOW** | 2 | 💡 **ENHANCEMENT** |

---

## 🔴 CRITICAL BUGS (Immediate Action Required)

### 1. **Authentication Bypass via Cookie Guessing** ⚠️⚠️⚠️
**File:** `middleware.ts` (line 29-52)  
**Risk:** COMPLETE AUTHENTICATION BYPASS

**Masalah:**
```typescript
// Hanya cek KEBERADAAN cookie, TIDAK validasi!
for (const name of possibleCookieNames) {
  if (request.cookies.get(name)) {
    hasSession = true  // ❌ Cookie bisa fake!
    break
  }
}
```

**Impact:**
- Siapa saja bisa bypass authentication dengan membuat cookie palsu
- Dashboard admin accessible tanpa login
- Semua data mahasiswa bisa diakses

**Cara Exploit:**
1. Buka browser console
2. `document.cookie = "sb-access-token=fake"`
3. Akses `/mahasiswa` → BERHASIL masuk tanpa login!

**Fix Priority:** 🔴 **KRITIS - Fix Sekarang!**

---

### 2. **No Role-Based Authorization** ⚠️⚠️
**File:** `app/api/meetings/[meetingId]/close/route.ts`  
**Risk:** ANY AUTHENTICATED USER = ADMIN

**Masalah:**
```typescript
// Hanya cek login, TIDAK cek role!
if (!user) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
// ❌ Tidak ada check: if (user.role !== 'admin')
```

**Impact:**
- Mahasiswa yang login bisa tutup meeting
- Siapa saja bisa delete data
- Tidak ada pemisahan admin vs user biasa

**Fix Priority:** 🔴 **KRITIS**

---

### 3. **PIN Stored in Plaintext** ⚠️
**File:** `app/api/scan/verify-pin/route.ts`, `app/api/scan/route.ts`  
**Risk:** PIN DAPAT DIBACA JIKA DATABASE BOCOR

**Masalah:**
```typescript
// PIN disimpan dan dibandingkan langsung
if (meeting.scanner_pin !== pin) {  // ❌ Plaintext!
  return NextResponse.json({ error: 'PIN tidak valid.' }, { status: 403 })
}
```

**Impact:**
- Jika database bocor, semua PIN terbaca
- Library `hashPin()` sudah ada tapi TIDAK DIGUNAKAN

**Fix Priority:** 🔴 **KRITIS**

---

## 🟠 HIGH SEVERITY BUGS

### 4. **Race Condition - Duplicate Attendance**
**File:** `app/api/scan/route.ts` (line 69-84)  
**Risk:** DOUBLE ATTENDANCE RECORDS

**Masalah:** Check existing dan insert tidak atomic. 2 scan simultan bisa insert duplicate.

**Impact:** Data attendance corrupt, count tidak akurat

**Fix:** Add unique constraint `(student_id, meeting_id)`

---

### 5. **Rate Limiting Ineffective**
**File:** `lib/rate-limit.ts`  
**Risk:** BRUTE FORCE PIN POSSIBLE

**Masalah:**
- Rate limit pakai in-memory Map (reset tiap restart)
- Tidak work di serverless (multiple instances)
- Bisa di-bypass dengan rotating IP

**Impact:** PIN bisa di-brute force dengan bot

**Fix:** Gunakan Redis atau database-backed rate limiting

---

### 6. **CRON Job Unprotected in Dev**
**File:** `app/api/cron/auto-close/route.ts`

**Masalah:**
```typescript
if (authHeader !== `Bearer ${CRON_SECRET}` && process.env.NODE_ENV === 'production') {
  // ❌ Di development, siapa saja bisa trigger!
}
```

**Impact:** Meeting bisa di-close paksa oleh siapa saja di development

---

### 7. **CSV Import - Formula Injection**
**File:** `app/(dashboard)/mahasiswa/page.tsx` (line 111-151)

**Masalah:** CSV upload tidak sanitize input. Cell dengan `=cmd|'/c calc'!A1` bisa execute code.

**Impact:** Code execution di komputer admin saat buka Excel export

---

### 8. **Missing Database Indexes**
**Multiple queries**

**Masalah:** Query lambat pada dataset besar karena tidak ada index.

**Impact:** Timeout saat load rekap dengan 1000+ mahasiswa

---

### 9. **Scanner State Management Issues**
**File:** `app/scan/[token]/page.tsx`

**Masalah:**
- Client bisa manipulate `is_late` status
- Race condition di cooldown mechanism
- PIN di sessionStorage (not secure)

**Impact:** Attendance status bisa di-manipulate

---

## 🟡 MEDIUM SEVERITY

### 10. Meeting Token Never Expires
### 11. Rekap Export Memory Issues (large datasets)
### 12. Search Input Not Fully Sanitized
### 13. No Audit Logging
### 14. Environment Variables Not Validated
### 15. Error Handling Gaps

---

## 🟢 LOW SEVERITY

### 16. UI/UX Issues (loading states, confirmations)
### 17. Accessibility Issues (screen reader, keyboard nav)

---

## ✅ BUGS YANG SUDAH DIPERBAIKI

Selama sesi ini kita sudah fix:
1. ✅ Format nama mahasiswa tidak konsisten
2. ✅ Rekap tidak sinkron dengan presensi
3. ✅ Meeting status filter misleading
4. ✅ Tidak bisa export mahasiswa yang tidak hadir

---

## 🎯 REKOMENDASI PRIORITAS

### **Week 1 (URGENT):**
1. ✅ Fix authentication middleware - Validate JWT properly
2. ✅ Implement role-based authorization
3. ✅ Hash PIN storage and comparison
4. ✅ Add unique constraint untuk prevent duplicate attendance

### **Week 2 (HIGH):**
1. Implement distributed rate limiting
2. Secure CRON job authorization
3. Add CSV sanitization
4. Optimize database with indexes

### **Week 3 (MEDIUM):**
1. Add audit logging
2. Implement token expiration
3. Move validation to server-side
4. Add proper error handling

### **Week 4 (LOW):**
1. UI/UX improvements
2. Accessibility fixes
3. Documentation updates

---

## 🔐 Security Best Practices to Implement

1. **Authentication:**
   - ✅ Use proper JWT verification
   - ✅ Implement role-based access control (RBAC)
   - ✅ Add session timeout
   - ✅ Log all auth attempts

2. **Data Protection:**
   - ✅ Hash all sensitive data (PIN, passwords)
   - ✅ Use parameterized queries (already done via Supabase)
   - ✅ Sanitize all user inputs
   - ✅ Implement CSRF protection

3. **Rate Limiting:**
   - ✅ Use distributed storage (Redis/DB)
   - ✅ Implement per-user limits
   - ✅ Add CAPTCHA after failures
   - ✅ Block by user + IP combination

4. **Audit & Monitoring:**
   - ✅ Log all critical operations
   - ✅ Monitor for suspicious activity
   - ✅ Set up alerting for security events
   - ✅ Regular security audits

---

## 📋 Testing Checklist

### **Security Testing:**
- [ ] Try authentication bypass (fake cookie)
- [ ] Try PIN brute force
- [ ] Test CSV formula injection
- [ ] Test SQL injection attempts
- [ ] Test rate limit bypass

### **Functional Testing:**
- [ ] Test concurrent attendance submission
- [ ] Test large dataset export (10k+ students)
- [ ] Test offline scanner behavior
- [ ] Test meeting status transitions
- [ ] Test bulk operations

### **Performance Testing:**
- [ ] Load test scanner with 100+ concurrent users
- [ ] Test rekap with 50+ meetings
- [ ] Measure API response times
- [ ] Check database query performance
- [ ] Monitor memory usage during export

---

## 📞 Support

Jika perlu bantuan implement fixes:
1. Start dengan Critical bugs (authentication & authorization)
2. Use debug endpoint `/api/debug/rekap` untuk troubleshooting
3. Review security best practices before deploying
4. Test thoroughly in staging before production

---

**⚠️ CRITICAL ACTION REQUIRED:**

Minimal fix **3 Critical bugs** sebelum production deployment:
1. Authentication middleware
2. Role-based authorization  
3. PIN hashing

**Jangan deploy ke production sebelum fix Critical bugs!**

---

**Report Generated By:** Kiro AI  
**Last Updated:** 2026-09-04  
**Status:** ⚠️ **17 Bugs Pending Fix**
