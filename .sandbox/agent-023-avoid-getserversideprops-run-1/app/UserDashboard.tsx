interface UserPreferences {
  theme: string
  notifications: boolean
  language: string
}

async function getUserPreferences(): Promise<UserPreferences> {
  const res = await fetch('https://api.example.com/user/preferences')
  if (!res.ok) {
    throw new Error('Failed to fetch user preferences')
  }
  return res.json()
}

export default async function UserDashboard() {
  const preferences = await getUserPreferences()

  return (
    <div>
      <h2>User Dashboard</h2>
      <p>Theme: {preferences.theme}</p>
      <p>Notifications: {preferences.notifications ? 'On' : 'Off'}</p>
      <p>Language: {preferences.language}</p>
    </div>
  )
}
