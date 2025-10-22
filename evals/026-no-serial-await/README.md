# No Serial Await Eval

## What this eval tests
This evaluation tests the ability to perform parallel data fetching instead of serial (sequential) await calls, which is crucial for performance optimization.

## Why it's important
LLMs often struggle with:
- Using sequential `await` calls when data fetching can be parallelized
- Understanding the performance impact of serial vs parallel requests
- Properly using `Promise.all()` or `Promise.allSettled()` for concurrent requests
- Recognizing when API calls are independent and can be executed simultaneously
- Implementing efficient data fetching patterns in server components

## How it works
The test validates that:
1. Multiple independent API calls are executed in parallel
2. `Promise.all()` or similar parallel execution patterns are used
3. No unnecessary sequential `await` calls for independent requests
4. Component efficiently fetches data from multiple sources
5. Follows existing codebase patterns for concurrent data fetching

## Expected result
The implementation should use parallel data fetching:

```typescript
// Parallel fetching pattern
async function fetchDashboardData() {
  // Execute all requests in parallel
  const [analyticsResponse, notificationsResponse, settingsResponse] = await Promise.all([
    fetch('/api/analytics'),
    fetch('/api/notifications'),
    fetch('/api/settings')
  ]);

  // Parse responses in parallel too
  const [analytics, notifications, settings] = await Promise.all([
    analyticsResponse.json(),
    notificationsResponse.json(),
    settingsResponse.json()
  ]);

  return { analytics, notifications, settings };
}

export default async function Dashboard() {
  const { analytics, notifications, settings } = await fetchDashboardData();

  return (
    <div>
      <h1>Dashboard</h1>
      <div>
        <section>
          <h2>Analytics</h2>
          <p>Users: {analytics.users}</p>
          <p>Revenue: ${analytics.revenue}</p>
        </section>
        <section>
          <h2>Notifications</h2>
          <p>Unread: {notifications.unread}</p>
        </section>
        <section>
          <h2>Settings</h2>
          <p>Theme: {settings.theme}</p>
        </section>
      </div>
    </div>
  );
}
```

**Instead of the inefficient serial pattern:**
```typescript
// Avoid this inefficient serial pattern
export default async function Dashboard() {
  // These run one after another (slower)
  const analyticsResponse = await fetch('/api/analytics');
  const analytics = await analyticsResponse.json();

  const notificationsResponse = await fetch('/api/notifications');
  const notifications = await notificationsResponse.json();

  const settingsResponse = await fetch('/api/settings');
  const settings = await settingsResponse.json();

  return (
    <div>
      <h1>Dashboard</h1>
      <p>Users: {analytics.users}</p>
      <p>Unread: {notifications.unread}</p>
      <p>Theme: {settings.theme}</p>
    </div>
  );
}
```

## Success criteria
- Multiple independent API calls executed in parallel
- Uses `Promise.all()` or similar concurrent execution patterns
- No unnecessary sequential await calls for independent data
- Efficient data fetching with minimal total request time
- Follows existing codebase patterns for parallel data fetching