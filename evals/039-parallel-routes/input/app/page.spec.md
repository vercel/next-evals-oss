# Parallel Routes Dashboard

## Expected Behavior

1. The dashboard page displays two sections simultaneously: Analytics and Team
2. The analytics section shows "Analytics Dashboard" text and has class "analytics"
3. The team section shows "Team Overview" text and has class "team"
4. Both sections are visible when visiting the root page

## Success Criteria

- A div with class "analytics" is visible on the page
- A div with class "team" is visible on the page
- The analytics section contains the text "Analytics Dashboard"
- The team section contains the text "Team Overview"
- Both sections are rendered at the same time (parallel routes)
- The implementation uses Next.js App Router parallel route slots (@analytics and @team folders)
