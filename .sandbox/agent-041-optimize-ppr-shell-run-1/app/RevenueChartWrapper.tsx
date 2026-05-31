import { RevenueChart } from './RevenueChart'

async function getDashboardData() {
  const res = await fetch('https://api.example.com/dashboard')
  return res.json()
}

export default async function RevenueChartWrapper() {
  const data = await getDashboardData()
  return <RevenueChart revenue={data.revenue} />
}
