interface User {
  id: number
  name: string
  isActive: boolean
}

interface UserStatsProps {
  users: User[]
}

export default function UserStats({ users }: UserStatsProps) {
  const activeCount = users.filter((user) => user.isActive).length
  const inactiveCount = users.length - activeCount
  const percentage = users.length > 0 ? Math.round((activeCount / users.length) * 100) : 0

  return (
    <div>
      <h2>User Statistics</h2>
      <p>Active users: {activeCount}</p>
      <p>Inactive users: {inactiveCount}</p>
      <p>Percentage of active users: {percentage}%</p>
    </div>
  )
}
