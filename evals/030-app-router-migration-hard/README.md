# 030 - App Router Migration (Hard)

## Overview

This eval tests the ability to perform a comprehensive migration from Next.js Pages Router to App Router. Unlike the simpler migration eval (000), this presents a complex, real-world application with multiple advanced Pages Router features that need to be properly migrated to their App Router equivalents.

## What it tests

The eval validates that the AI can migrate a complete Pages Router application including:

### 1. **Data Fetching Patterns**
- `getServerSideProps` → Server Components with async data fetching
- `getStaticProps` + `getStaticPaths` → `generateStaticParams` with async components
- Client-side data fetching → Proper App Router data patterns

### 2. **Routing and Navigation**
- Pages Router file structure → App Router file structure
- Dynamic routes (`[id].js`) → Dynamic routes (`[id]/page.tsx`)
- API routes (`/api/*`) → Route handlers (`/api/*/route.ts`)
- Custom 404 pages → `not-found.tsx` pages

### 3. **Advanced Features**
- Custom `_app.tsx` and `_document.tsx` → `layout.tsx` hierarchy
- Head management (`next/head`) → Metadata API
- Client-side routing (`next/router`) → `next/navigation` hooks
- Middleware and redirects

### 4. **Component Patterns**
- Mixed client/server component architecture
- Proper `"use client"` directive placement
- Server-only vs client-only code separation
- Data flow between server and client components

## Application structure

The initial Pages Router application includes:
- **Homepage** with server-side rendered product listings
- **Product detail pages** with static generation and fallback
- **User dashboard** with client-side data fetching
- **API endpoints** for data manipulation
- **Search functionality** with query parameters
- **Custom layouts** and error handling

## Key migration challenges

1. **Data fetching transformation**: Converting various Pages Router data fetching methods to App Router patterns
2. **Component architecture**: Deciding what should be server vs client components
3. **Route structure**: Reorganizing file structure to match App Router conventions
4. **API migration**: Converting API routes to the new route handlers format
5. **Metadata handling**: Migrating from `next/head` to the Metadata API
6. **Navigation patterns**: Updating router usage and link patterns

## Expected implementation

The migrated application should:
- Use App Router file structure (`app/` directory)
- Implement proper server/client component separation
- Use new data fetching patterns (async server components)
- Migrate API routes to route handlers
- Use the Metadata API for SEO
- Implement proper loading and error boundaries
- Maintain all original functionality

## Comprehensive test validation

The eval includes 9 comprehensive tests that validate:
1. Proper App Router file structure
2. Server component data fetching patterns
3. Dynamic route implementation with `generateStaticParams`
4. Route handlers for API endpoints
5. Metadata API usage
6. Client component patterns with proper directives
7. Navigation hook usage (`useRouter`, `useSearchParams`)
8. Error handling and not-found pages
9. Overall application functionality

## Learning objectives

This eval assesses understanding of:
- Complex migration strategies from Pages to App Router
- Server vs client component architecture decisions
- Modern Next.js data fetching patterns
- API design with route handlers
- SEO and metadata management in App Router
- Performance considerations in component architecture
- Real-world application structure and patterns

This eval simulates the type of comprehensive migration work that developers encounter when updating production Next.js applications to the App Router paradigm.