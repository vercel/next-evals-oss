# Server Actions Exports Eval

## What this eval tests
This evaluation tests the ability to create a properly structured server action in a separate file with correct exports and the `'use server'` directive.

## Why it's important
LLMs often struggle with:
- Understanding where to place the `'use server'` directive (top of file vs per function)
- Creating server actions in separate files vs inline in components
- Properly exporting server action functions for use in other components
- Understanding the file naming conventions for server actions
- Mixing server actions with client-side code inappropriately
- Forgetting the `'use server'` directive entirely

## How it works
The test validates that:
1. A separate file `action.ts` (or similar) is created for server actions
2. The file contains the `'use server'` directive at the top
3. Server action functions are properly exported
4. Functions can be imported and used in other components
5. The server action follows proper TypeScript patterns

## Expected result
The implementation should create a file structure like:

```
app/
├── action.ts           # Server actions file
└── page.tsx           # Component using the actions
```

With action.ts:
```typescript
'use server';

export async function createUser(formData: FormData) {
  const name = formData.get('name') as string;
  const email = formData.get('email') as string;
  
  // Simulate database operation
  console.log('Creating user:', { name, email });
  
  // Return result or redirect
  return { success: true, message: 'User created successfully' };
}

export async function updateUser(id: string, formData: FormData) {
  const name = formData.get('name') as string;
  
  console.log('Updating user:', id, name);
  
  return { success: true, message: 'User updated successfully' };
}
```

And usage in page.tsx:
```typescript
import { createUser } from './action';

export default function Page() {
  return (
    <div>
      <h1>User Form</h1>
      <form action={createUser}>
        <input name="name" placeholder="Name" required />
        <input name="email" type="email" placeholder="Email" required />
        <button type="submit">Create User</button>
      </form>
    </div>
  );
}
```

## Success criteria
- Server actions file created with `'use server'` directive at the top
- Functions are properly exported from the actions file
- Server actions accept appropriate parameters (FormData, etc.)
- Actions can be imported and used in other components
- No mixing of client-side code in server actions file