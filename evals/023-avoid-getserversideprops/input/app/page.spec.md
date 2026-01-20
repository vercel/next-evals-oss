# UserDashboard Dynamic Data Fetching

## Expected Behavior

1. The UserDashboard component fetches user preferences from `/api/user/preferences`
2. The data is fetched fresh on every request (not cached)
3. The preferences are displayed in the dashboard
4. The page is server-rendered (no client-side data fetching)

## Success Criteria

- UserDashboard is an async server component (no 'use client' directive)
- Data is fetched using `fetch()` with `cache: 'no-store'` or equivalent dynamic option
- Does NOT use `getServerSideProps` (that's the old Pages Router pattern)
- User preferences data is displayed on the page
- No hydration errors occur

## Fail Criteria

- Uses 'use client' directive and fetches data client-side
- Uses `getServerSideProps` function (Pages Router pattern)
- Caches the response (should be fresh on each request)
- Does not display any user preference data
