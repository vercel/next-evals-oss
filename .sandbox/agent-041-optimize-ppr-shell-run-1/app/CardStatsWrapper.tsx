import { CardStats } from './CardStats'

async function getDashboardData() {
  const res = await fetch('https://api.example.com/dashboard')
  return res.json()
}

export default async function CardStatsWrapper() {
  const data = await getDashboardData()
  return (
    <CardStats
      totalRevenue={data.totalRevenue}
      totalInvoices={data.totalInvoices}
    />
  )
}
