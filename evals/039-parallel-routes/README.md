# Parallel Routes

## What This Eval Tests

This evaluation tests the ability to implement parallel routes in Next.js App Router. Parallel routes allow simultaneous rendering of multiple pages in the same layout, enabling complex UI patterns like modals and dashboards.

## Why This Is Important

**Common LLM Mistakes:**
- **Missing @ convention**: Not using @ prefix for parallel route folders
- **Incorrect slot props**: Not properly receiving slots as props in layout
- **Missing page files**: Forgetting to create page.tsx in each slot folder
- **Wrong layout structure**: Not understanding how slots are passed to layout component
- **Client component confusion**: Adding unnecessary 'use client' directives

**Real-world Impact:**
Parallel routes are essential for:
- Building complex dashboard layouts with independent sections
- Creating modals that preserve context
- Implementing split views and multi-pane interfaces
- Enabling independent error and loading states for different UI sections

## How The Test Works

**Input State:**
```tsx
export default function Page() {
  return <div>Page component not implemented</div>;
}
```

**What Gets Tested:**
- ✅ Creates @analytics folder with page.tsx
- ✅ Creates @team folder with page.tsx  
- ✅ Layout receives slots as props
- ✅ Renders both slots in layout
- ✅ Each slot has correct className
- ✅ Content matches requirements

## Expected Result

**app/layout.tsx:**
```tsx
export default function Layout({
  children,
  analytics,
  team,
}: {
  children: React.ReactNode;
  analytics: React.ReactNode;
  team: React.ReactNode;
}) {
  return (
    <html>
      <body>
        <div style={{ display: 'flex' }}>
          {analytics}
          {team}
        </div>
        {children}
      </body>
    </html>
  );
}
```

**app/@analytics/page.tsx:**
```tsx
export default function AnalyticsPage() {
  return <div className="analytics">Analytics Dashboard</div>;
}
```

**app/@team/page.tsx:**
```tsx
export default function TeamPage() {
  return <div className="team">Team Overview</div>;
}
```

**Key Patterns Validated:**
- **Parallel Route Convention**: Uses @ prefix for slot folders
- **Layout Props**: Correctly receives and renders slot props
- **Folder Structure**: Proper organization of parallel routes
- **Independent Rendering**: Each slot renders independently

**Success Criteria:**
- Both parallel routes render correctly
- Layout receives and displays both slots
- Correct classNames are applied
- Application builds and renders without errors