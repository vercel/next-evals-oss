interface UserProfileData {
  name: string
  email: string
}

async function getUserProfile(): Promise<UserProfileData> {
  try {
    const res = await fetch('/api/users/profile')
    return res.json()
  } catch {
    // Return mock data for build time
    return { name: 'Guest', email: 'guest@example.com' }
  }
}

export default async function UserProfile() {
  const user = await getUserProfile()

  return (
    <div>
      <h2>User Profile</h2>
      <p>Name: {user.name}</p>
      <p>Email: {user.email}</p>
    </div>
  )
}
