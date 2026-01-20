# Metadata API Evaluation Criteria

The following criteria should be used to evaluate whether the implementation correctly uses the Next.js Metadata API:

## Page Title
- The browser tab/document title should display "My App"

## Meta Description
- The page should have a meta description tag with content "Welcome to my application"

## OpenGraph Metadata
- The page should include an og:title meta tag with content "My App OG"
- The page should include an og:description meta tag with content "OG Description"

## Page Content
- The page should display an h1 heading with the text "Metadata Example"

## Implementation Notes
- The metadata should be defined using Next.js App Router's Metadata API (exported metadata object or generateMetadata function)
- The page should be a Server Component (not marked with "use client") to properly support the Metadata API
