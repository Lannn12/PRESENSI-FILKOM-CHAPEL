import Sidebar from '@/components/layout/sidebar'
import { Ticker } from '@/components/layout/ticker'

const TICKER_ITEMS = [
  'Presensi Kuliah Umum',
  'Universitas Klabat',
  'FILKOM',
  'Real-time QR & Barcode',
  'Rekap Otomatis per Semester',
  'Export Excel · CSV · PDF',
  'Live Attendance Monitor',
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#050506]">
      <Sidebar />
      <main className="flex-1 min-w-0 md:pt-0 pt-14 relative">
        {/* Ambient tube glow di belakang konten */}
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-0 opacity-70"
          style={{
            background:
              'radial-gradient(46% 38% at 78% 6%, rgb(77 107 255 / 12%) 0%, transparent 62%),' +
              'radial-gradient(40% 34% at 12% 92%, rgb(255 61 129 / 9%) 0%, transparent 64%)',
          }}
        />
        <div className="relative z-10">
          <Ticker items={TICKER_ITEMS} />
          <div className="p-4 md:p-8 max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}
