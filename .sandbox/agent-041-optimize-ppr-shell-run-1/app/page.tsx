import { Suspense } from 'react'
import CardStatsWrapper from './CardStatsWrapper'
import RevenueChartWrapper from './RevenueChartWrapper'
import LatestInvoicesWrapper from './LatestInvoicesWrapper'

function SectionFallback({ label }: { label: string }) {
  return (
    <div className="loading">
      <div className="spinner" />
      <p>Loading {label}...</p>
    </div>
  )
}

export default function Page() {
  return (
    <main>
      <h1>Dashboard</h1>
      <Suspense fallback={<SectionFallback label="stats" />}>
        <CardStatsWrapper />
      </Suspense>
      <Suspense fallback={<SectionFallback label="chart" />}>
        <RevenueChartWrapper />
      </Suspense>
      <Suspense fallback={<SectionFallback label="invoices" />}>
        <LatestInvoicesWrapper />
      </Suspense>
    </main>
  )
}
