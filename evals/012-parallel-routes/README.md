# Parallel Routes Eval

## What this eval tests
This evaluation tests the ability to implement Next.js App Router's parallel routes feature to create a dashboard layout with simultaneously rendered analytics and settings sections.

## Why it's important
LLMs often struggle with:
- Understanding the `@folder` naming convention for parallel route slots
- Creating the correct file structure for parallel routes (`@analytics`, `@settings`)
- Implementing layout components that accept multiple slot props
- Understanding how parallel routes differ from regular nested routes
- Properly defining default.tsx files for parallel route fallbacks
- Managing independent loading and error states for each parallel route

## How it works
The test validates that:
1. Parallel route directories are created with `@` prefix (`@analytics`, `@settings`)
2. Layout component properly accepts and renders slot props
3. Each parallel route has its own page.tsx file
4. The dashboard renders both sections simultaneously
5. Routes can be navigated independently without affecting each other

## Expected result
The implementation should create a file structure like:

```
app/
├── dashboard/
│   ├── layout.tsx          # Layout accepting slot props
│   ├── page.tsx           # Main dashboard page
│   ├── @analytics/
│   │   └── page.tsx       # Analytics slot content
│   ├── @settings/
│   │   └── page.tsx       # Settings slot content
│   ├── @analytics/default.tsx  # Optional fallback
│   └── @settings/default.tsx   # Optional fallback
```

With layout.tsx:
```typescript
export default function DashboardLayout({
  children,
  analytics,
  settings,
}: {
  children: React.ReactNode;
  analytics: React.ReactNode;
  settings: React.ReactNode;
}) {
  return (
    <div>
      <h1>Dashboard</h1>
      {children}
      <div style={{ display: 'flex' }}>
        <div>{analytics}</div>
        <div>{settings}</div>
      </div>
    </div>
  );
}
```

## Success criteria
- Parallel route directories created with `@` prefix naming
- Layout component accepts and renders slot props correctly
- Both analytics and settings content render simultaneously
- Each parallel route has independent page.tsx files
- Navigation between tabs works without full page reload