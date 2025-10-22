# Server Actions with Cookie Management

## What This Eval Tests

This evaluation tests the ability to create server actions that handle form submissions and cookie management in Next.js App Router. This combines form handling, server-side processing, and cookie operations.

## Why This Is Important

**Common LLM Mistakes:**
- **Client-side cookie handling**: Using document.cookie instead of server actions
- **Missing 'use server' directive**: Not properly marking server actions
- **Form action binding**: Incorrect form action attribute usage
- **Cookie API confusion**: Using wrong Next.js cookie APIs
- **Type safety issues**: Not properly typing form data

**Real-world Impact:**
Server actions are a powerful feature for handling form submissions, authentication, and server-side operations. Cookie management is essential for user sessions, preferences, and authentication flows.

## How The Test Works

**What Gets Tested:**
- ✅ Form has proper action attribute pointing to server action
- ✅ Server action uses `'use server'` directive
- ✅ Correctly extracts form data
- ✅ Sets cookie using Next.js cookies API
- ✅ Handles form submission server-side

## Expected Result

```tsx
import { cookies } from 'next/headers';

async function setUserCookie(formData: FormData) {
  'use server';
  
  const username = formData.get('username') as string;
  cookies().set('user', username);
}

export default function CookieForm() {
  return (
    <form action={setUserCookie}>
      <input
        type="text"
        name="username"
        placeholder="Enter username"
        required
      />
      <button type="submit">Set Cookie</button>
    </form>
  );
}
```

**Success Criteria:**
- Form submits to server action correctly
- Cookie is set with the provided username value
- Server action handles form data properly
- No client-side JavaScript required for basic functionality