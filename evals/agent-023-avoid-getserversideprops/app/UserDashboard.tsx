// App Router async server component pattern - not getServerSideProps
export default async function UserDashboard() {
  'use cache'
  // Fetch user preferences using cache components pattern
  const res = await fetch('/api/user/preferences');
  const preferences = await res.json();

  return (
    <div>
      <h2>User Dashboard</h2>
      <p>User preferences: {JSON.stringify(preferences)}</p>
    </div>
  );
}