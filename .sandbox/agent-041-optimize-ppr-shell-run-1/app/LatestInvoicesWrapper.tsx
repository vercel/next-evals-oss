import { LatestInvoices } from './LatestInvoices'

async function getDashboardData() {
  const res = await fetch('https://api.example.com/dashboard')
  return res.json()
}

export default async function LatestInvoicesWrapper() {
  const data = await getDashboardData()
  return <LatestInvoices invoices={data.invoices} />
}
