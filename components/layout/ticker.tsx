'use client'

/**
 * Active Theory signature element — infinite horizontal ticker of
 * uppercase micro-typography separated by a neon dot. Pure CSS animation,
 * no JS, respects prefers-reduced-motion.
 *
 * Animasi memakai pola 2× duplikasi + translateX(-50%). Agar seam-nya
 * presisi, jarak antar-item memakai padding (bukan gap): dengan padding,
 * lebar total = 2 × lebar satu set, sehingga -50% tepat menggeser satu
 * set penuh dan tidak ada lompatan di sambungan.
 */
export function Ticker({ items }: { items: string[] }) {
  if (!items.length) return null
  const row = [...items, ...items]

  return (
    <div className="relative overflow-hidden border-y border-white/[0.06] bg-white/[0.015] py-2.5 select-none">
      <div className="flex w-max animate-marquee items-center whitespace-nowrap">
        {row.map((t, i) => (
          <span key={i} className="flex items-center gap-8 pr-8">
            {/* Tipografi ditulis eksplisit (bukan .at-label) agar tidak bentrok
                dengan text-muted-foreground milik .at-label — urutan utility
                CSS tidak menjamin mana yang menang. */}
            <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/35">
              {t}
            </span>
            <span className="h-1 w-1 rounded-full gradient-primary shrink-0" />
          </span>
        ))}
      </div>
      {/* Fade di kedua sisi */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-[#050506] to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-[#050506] to-transparent" />
    </div>
  )
}
