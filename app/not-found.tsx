import Link from 'next/link'
import { BookOpen } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="text-center space-y-8 max-w-md">
        {/* Logo */}
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg" style={{ background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)' }}>
            <BookOpen className="w-8 h-8 text-white" />
          </div>
        </div>

        {/* 404 */}
        <div className="space-y-3">
          <h1 className="text-8xl font-black text-blue-100 tracking-tighter select-none">404</h1>
          <h2 className="text-xl font-bold text-gray-800">Halaman Tidak Ditemukan</h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            Halaman yang Anda cari tidak ada<br />atau telah dipindahkan.
          </p>
        </div>

        {/* Action */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 text-white text-sm font-semibold rounded-xl shadow-md transition-all duration-200 hover:shadow-blue-500/30 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
          style={{ background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)' }}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
          Kembali ke Dashboard
        </Link>
      </div>
    </div>
  )
}
