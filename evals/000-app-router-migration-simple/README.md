# Pages Router to App Router Migration

## What This Eval Tests

This evaluation tests the ability to migrate a Next.js project from the legacy Pages Router (Next.js 12 and earlier) to the modern App Router (Next.js 13+). This is a fundamental architectural change that many real-world Next.js projects need to undergo.

## Why This Is Important

**Common LLM Mistakes:**
- **Incomplete migration**: Only copying files without understanding the architectural differences
- **Metadata handling**: Not properly migrating from `next/head` to App Router metadata patterns
- **File structure confusion**: Mixing Pages Router and App Router conventions
- **Missing layout component**: Forgetting to create the required root layout
- **Import path errors**: Not updating component imports and routing patterns

**Real-world Impact:**
Pages Router to App Router migration is one of the most significant upgrades in Next.js history. It affects how routing, layouts, data fetching, and metadata work. LLMs need to understand these fundamental differences to help developers modernize their applications.

## How The Test Works

**Input Structure (Pages Router):**
```
pages/
├── index.tsx          # Homepage with Next/Head metadata
├── _app.tsx           # Custom App component  
└── _document.tsx      # Custom Document component
```

**Expected Output (App Router):**
```
app/
├── layout.tsx         # Root layout with HTML structure and metadata
└── page.tsx           # Homepage migrated from pages/index.tsx
```

**What Gets Tested:**
- ✅ App directory exists with proper structure
- ✅ Root layout includes HTML, body, and children props
- ✅ Page component migrated correctly without `next/head` usage
- ✅ Pages directory is cleaned up (no remaining page files)
- ✅ Navigation uses Next.js Link components properly
- ✅ Project builds and runs successfully

## Expected Result

```tsx
// app/layout.tsx
export const metadata = {
  title: 'Home Page',
  description: 'Welcome to our Next.js app',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

// app/page.tsx  
import Link from 'next/link';

export default function Home() {
  return (
    <main>
      <h1>Home</h1>
      <p>Welcome to our Next.js application!</p>
      <nav>
        <ul>
          <li><Link href="/about">About</Link></li>
          <li><Link href="/contact">Contact</Link></li>
        </ul>
      </nav>
    </main>
  );
}
```

**Success Criteria:**
- App Router structure is properly implemented
- Metadata is handled at the layout level instead of using `next/head`
- Navigation uses Link components correctly
- No Pages Router artifacts remain
- Application builds without errors