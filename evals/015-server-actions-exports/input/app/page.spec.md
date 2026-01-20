# Server Actions Export Specification

This specification describes the expected behavior for a Next.js application that uses server actions to handle form submissions.

## Requirements

### Server Action File Structure

1. A file named `action.ts` must exist in the `app` directory
2. The file must contain the `'use server'` directive at the top
3. The file must export at least one async function that can be used as a server action

### Form Behavior

1. The home page displays a form with a submit button
2. The form displays a counter showing the current count value
3. Submitting the form increments the counter
4. The counter persists between form submissions within the same session
5. Multiple form submissions should correctly increment the counter each time

### User Experience

1. The page loads without errors
2. The form is visible and interactive
3. Clicking the submit button triggers the server action
4. The counter value updates after form submission without requiring a manual page refresh
