import { Card, CardContent } from '@/components/ui/card'

export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div>
        <div className="h-6 bg-white/[0.06] rounded w-44 mb-3" />
        <div className="h-3 bg-white/[0.04] rounded w-72" />
      </div>

      {/* Summary cards skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="border-white/[0.07] bg-[#0b0b0e]">
            <CardContent className="pt-5">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 bg-white/[0.06] rounded-lg" />
                <div className="space-y-2 flex-1">
                  <div className="h-5 bg-white/[0.07] rounded w-16" />
                  <div className="h-2.5 bg-white/[0.04] rounded w-24" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Chart skeleton */}
      <Card className="border-white/[0.07] bg-[#0b0b0e]">
        <CardContent className="pt-6">
          <div className="h-[280px] bg-white/[0.03] rounded-lg flex items-end justify-center gap-4 px-8 pb-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="bg-white/[0.07] rounded-t w-12"
                style={{ height: `${40 + (i * 9) % 60}%` }}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Bottom cards skeleton */}
      <div className="grid md:grid-cols-2 gap-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i} className="border-white/[0.07] bg-[#0b0b0e]">
            <CardContent className="pt-6 space-y-3">
              <div className="h-4 bg-white/[0.07] rounded w-48" />
              <div className="h-10 bg-white/[0.04] rounded" />
              <div className="h-32 bg-white/[0.04] rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
