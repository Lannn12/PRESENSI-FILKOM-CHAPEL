import { Card, CardContent } from '@/components/ui/card'

export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div>
        <div className="h-7 bg-gray-200 rounded w-40 mb-2" />
        <div className="h-4 bg-gray-100 rounded w-72" />
      </div>

      {/* Summary cards skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-5">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 bg-gray-200 rounded" />
                <div className="space-y-2 flex-1">
                  <div className="h-6 bg-gray-200 rounded w-16" />
                  <div className="h-3 bg-gray-100 rounded w-24" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Chart skeleton */}
      <Card>
        <CardContent className="pt-6">
          <div className="h-[280px] bg-gray-100 rounded flex items-end justify-center gap-4 px-8 pb-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="bg-gray-200 rounded-t w-12"
                style={{ height: `${40 + Math.random() * 60}%` }}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Bottom cards skeleton */}
      <div className="grid md:grid-cols-2 gap-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6 space-y-3">
              <div className="h-5 bg-gray-200 rounded w-48" />
              <div className="h-10 bg-gray-100 rounded" />
              <div className="h-32 bg-gray-100 rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
