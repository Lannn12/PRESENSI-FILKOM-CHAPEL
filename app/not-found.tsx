import Link from 'next/link'
import { BookOpen, ArrowLeft } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="tubes-canvas min-h-screen flex items-center justify-center px-4">
      <div className="absolute inset-0 tubes-grain pointer-events-none" />

      <div className="relative z-10 text-center space-y-10 max-w-md">
        {/* Logo */}
        <div className="flex justify-center">
          <div className="relative w-16 h-16 flex items-center justify-center">
            <div className="absolute inset-0 rounded-xl gradient-primary opacity-70 blur-xl" />
            <div className="relative w-16 h-16 rounded-xl bg-[#0b0b0e] border border-white/10 flex items-center justify-center">
              <BookOpen className="h-7 w-7 text-white" />
            </div>
          </div>
        </div>

        {/* 404 */}
        <div className="space-y-4">
          <h1 className="at-display text-8xl font-bold tracking-[-0.05em] text-gradient select-none">404</h1>
          <h2 className="at-title text-lg">Halaman Tidak Ditemukan</h2>
          <p className="text-sm text-white/40 leading-relaxed">
            Halaman yang Anda cari tidak ada<br />atau telah dipindahkan.
          </p>
        </div>

        {/* Action */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 text-white text-[11px] font-semibold uppercase tracking-[0.16em] rounded-lg shadow-blue transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] overflow-hidden relative animate-sweep"
          style={{ background: 'linear-gradient(120deg, #4d6bff 0%, #8b5cf6 52%, #ff3d81 100%)' }}
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali ke Dashboard
        </Link>
      </div>
    </div>
  )
}
