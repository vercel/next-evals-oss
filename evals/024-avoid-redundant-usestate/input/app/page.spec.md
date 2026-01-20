# User Statistics Component

## Expected Behavior

1. The UserStats component displays a "User Statistics" heading
2. Shows the count of active users (2 users are active in the initial data)
3. Shows the count of inactive users (1 user is inactive in the initial data)
4. Shows the percentage of active users (approximately 66-67%)

## Success Criteria

- The page displays an h2 with "User Statistics"
- Active users count is displayed and shows "2"
- Inactive users count is displayed and shows "1"
- A percentage is displayed (around 66% or 67%)
- Statistics are computed as derived values from the users prop, not stored in separate state
- The component does NOT use useState for computed/derived values like counts or percentages
- The component does NOT use useEffect to synchronize derived state
