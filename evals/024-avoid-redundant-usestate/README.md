# Avoid Redundant useState Eval

## What this eval tests
This evaluation tests the ability to compute derived values directly from data instead of using redundant `useState` for values that can be calculated from existing state or props.

## Why it's important
LLMs often struggle with:
- Overusing `useState` for values that can be computed from existing data
- Understanding when to derive values vs storing them in state
- Recognizing that calculated values don't need separate state management
- Avoiding unnecessary re-renders caused by redundant state updates
- Following React best practices for state management efficiency

## How it works
The test validates that:
1. Derived values are computed directly from data, not stored in state
2. No redundant `useState` hooks for calculated values
3. Component efficiently computes statistics from existing data
4. Proper use of useMemo for expensive calculations if needed
5. Follows existing codebase patterns for derived data

## Expected result
The implementation should compute derived values directly:

```typescript
interface User {
  id: number;
  name: string;
  active: boolean;
}

interface UserStatsProps {
  users: User[];
}

export default function UserStats({ users }: UserStatsProps) {
  // Derive values directly from props - no useState needed
  const activeUsers = users.filter(user => user.active);
  const inactiveUsers = users.filter(user => !user.active);
  const activeCount = activeUsers.length;
  const inactiveCount = inactiveUsers.length;
  const totalUsers = users.length;
  const activePercentage = totalUsers > 0 
    ? Math.round((activeCount / totalUsers) * 100) 
    : 0;

  return (
    <div>
      <h1>User Statistics</h1>
      <div>
        <p>Active Users: {activeCount}</p>
        <p>Inactive Users: {inactiveCount}</p>
        <p>Active Percentage: {activePercentage}%</p>
      </div>
    </div>
  );
}
```

**Instead of the redundant state pattern:**
```typescript
// Avoid this pattern
export default function UserStats({ users }: UserStatsProps) {
  const [activeCount, setActiveCount] = useState(0);
  const [inactiveCount, setInactiveCount] = useState(0);
  const [activePercentage, setActivePercentage] = useState(0);

  useEffect(() => {
    const active = users.filter(user => user.active).length;
    const inactive = users.filter(user => !user.active).length;
    const percentage = users.length > 0 ? (active / users.length) * 100 : 0;
    
    setActiveCount(active);
    setInactiveCount(inactive);
    setActivePercentage(percentage);
  }, [users]);

  return (
    <div>
      <p>Active Users: {activeCount}</p>
      <p>Inactive Users: {inactiveCount}</p>
      <p>Active Percentage: {activePercentage}%</p>
    </div>
  );
}
```

## Success criteria
- Derived values computed directly from props/data
- No redundant `useState` for calculated values
- No `useEffect` for updating derived state
- Efficient computation without unnecessary state management
- Follows existing codebase patterns for derived data handling