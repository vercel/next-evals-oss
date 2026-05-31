export default async function Dashboard() {
  const [analytics, notifications, settings] = await Promise.all([
    fetch('/api/analytics').then((r) => r.json()),
    fetch('/api/notifications').then((r) => r.json()),
    fetch('/api/settings').then((r) => r.json()),
  ])

  return (
    <div>
      <h2>Dashboard Content</h2>
      <section>
        <h3>Analytics</h3>
        <pre>{JSON.stringify(analytics, null, 2)}</pre>
      </section>
      <section>
        <h3>Notifications</h3>
        <pre>{JSON.stringify(notifications, null, 2)}</pre>
      </section>
      <section>
        <h3>Settings</h3>
        <pre>{JSON.stringify(settings, null, 2)}</pre>
      </section>
    </div>
  )
}
