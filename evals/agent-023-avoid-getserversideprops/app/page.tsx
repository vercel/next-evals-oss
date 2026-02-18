import { Suspense } from 'react';
import UserDashboard from './UserDashboard';

// Example of App Router data fetching
async function getStaticData() {
  'use cache'
  try {
    const res = await fetch('/api/stats');
    return res.json();
  } catch {
    // Return mock data for build time
    return { users: 100 };
  }
}

export default async function Page() {
  const stats = await getStaticData();

  return (
    <div>
      <h1>Dashboard</h1>
      <p>Total users: {stats.users}</p>
      <Suspense fallback={<p>Loading user dashboard...</p>}>
        <UserDashboard />
      </Suspense>
    </div>
  );
}
