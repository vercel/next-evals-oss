# Server Actions Form

## What This Eval Tests

This evaluation tests the ability to implement forms using Server Actions in Next.js App Router, a modern approach to handling form submissions without API routes.

## Why This Is Important

**Common LLM Mistakes:**
- **Missing 'use server'**: Forgetting the directive for server actions
- **Client-side handling**: Using onSubmit instead of action prop
- **Wrong FormData handling**: Not properly accessing FormData fields
- **Async function**: Forgetting to make action async
- **API route confusion**: Creating unnecessary API routes

**Real-world Impact:**
Server Actions enable:
- Progressive enhancement (works without JS)
- Simplified form handling
- Direct database access from actions
- Better security with server-side validation
- Reduced client-server round trips

## How The Test Works

**Input State:**
```tsx
export default function Page() {
  return <div>Page component not implemented</div>;
}
```

**What Gets Tested:**
- ✅ Creates server action function
- ✅ Uses 'use server' directive
- ✅ Form uses action prop
- ✅ Input field with correct attributes
- ✅ FormData handling
- ✅ Async function implementation

## Expected Result

```tsx
async function submitForm(formData: FormData) {
  'use server';
  
  const name = formData.get('name');
  console.log(name);
}

export default function Page() {
  return (
    <form action={submitForm}>
      <input name="name" placeholder="Enter your name" />
      <button type="submit">Submit</button>
    </form>
  );
}
```

**Key Patterns Validated:**
- **Server Action**: Uses 'use server' directive
- **Form Action**: Uses action prop not onSubmit
- **FormData API**: Correctly gets form fields
- **Async Function**: Action is async
- **Form Structure**: Proper input and button

**Success Criteria:**
- Server action defined with 'use server'
- Form uses action prop with server action
- Input has name attribute
- Submit button present
- FormData handled correctly