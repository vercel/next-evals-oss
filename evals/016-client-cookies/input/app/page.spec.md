# Evaluation Criteria

This implementation should demonstrate the correct pattern for setting cookies from a client component via a server action in Next.js.

## Requirements

1. Uses 'use client' directive - required for the component that handles the button click
2. Has a button element labeled "Set Cookie" that users can click
3. Calls a server action when the button is clicked
4. The server action uses the Next.js cookies() API to set a cookie named "theme" with value "dark"
5. The server action is marked with 'use server' directive (either inline or in a separate file)
6. The component should be the default export
