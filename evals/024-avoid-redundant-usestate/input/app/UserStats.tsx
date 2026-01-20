interface User {
  id: number;
  name: string;
  isActive: boolean;
}

interface UserStatsProps {
  users: User[];
}

export default function UserStats({ users }: UserStatsProps) {
  return (
    <div>
      <h2>User Statistics</h2>
      <p>Stats will go here</p>
    </div>
  );
}
