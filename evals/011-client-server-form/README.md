# Client-Server Form Eval

## What this eval tests
This evaluation tests the ability to create a form component that properly integrates client-side form handling with server-side actions using Next.js App Router patterns.

## Why it's important
LLMs often struggle with:
- Understanding the distinction between client components and server actions
- Properly using the `action` attribute with server actions vs `onSubmit` handlers
- Creating server actions with the `'use server'` directive
- Handling form data using `FormData` API instead of controlled inputs
- Understanding when to use client components (`'use client'`) for form interactions
- Mixing client-side state management with server-side form processing

## How it works
The test validates that:
1. A form component is created that can handle form submissions
2. Server actions are properly defined with `'use server'` directive
3. The form uses the `action` attribute to connect to server actions
4. Form data is processed server-side using `FormData` API
5. The component properly handles both client and server aspects

## Expected result
The implementation should create a form component and server action:

```typescript
// Server action (in page.tsx or separate file)
async function submitForm(formData: FormData) {
  'use server'
  
  const name = formData.get('name') as string;
  const email = formData.get('email') as string;
  
  // Process form data server-side
  console.log('Form submitted:', { name, email });
}

// Client component or form in page
export default function Page() {
  return (
    <div>
      <h1>Contact Form</h1>
      <form action={submitForm}>
        <input name="name" placeholder="Name" required />
        <input name="email" type="email" placeholder="Email" required />
        <button type="submit">Submit</button>
      </form>
    </div>
  );
}
```

## Success criteria
- Form element with proper `action` attribute pointing to server action
- Server action function with `'use server'` directive
- Form data accessed using `FormData` API methods
- Proper separation of client UI and server processing
- Form submission works without client-side JavaScript (progressive enhancement)