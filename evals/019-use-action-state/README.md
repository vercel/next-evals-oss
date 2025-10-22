# useActionState Hook Eval

## What this eval tests
This evaluation tests the proper usage of React's `useActionState` hook with Next.js server actions for handling form state and server responses without using `useState`.

## Why it's important
LLMs often struggle with:
- Understanding the new `useActionState` hook introduced in React 19
- Using `useActionState` instead of `useState` for server action responses
- Properly connecting server actions with client-side state management
- Handling loading states and error messages from server actions
- Understanding the correct import path for `useActionState`
- Integrating server action responses with form validation feedback

## How it works
The test validates that:
1. Component uses `'use client'` directive
2. `useActionState` is imported from `react` (React 19)
3. Server action is properly connected to the hook
4. Form state is managed through `useActionState` not `useState`
5. Success/error messages are displayed based on action response
6. Loading states are handled appropriately

## Expected result
The implementation should create a form component using `useActionState`:

```typescript
'use client';

import { useActionState } from 'react';
import { submitContactForm } from './actions';

export default function ContactForm() {
  const [state, formAction, isPending] = useActionState(submitContactForm, {
    message: '',
    success: false,
  });

  return (
    <div>
      <form action={formAction}>
        <input 
          name="name" 
          placeholder="Name" 
          required 
          disabled={isPending}
        />
        <input 
          name="email" 
          type="email" 
          placeholder="Email" 
          required 
          disabled={isPending}
        />
        <textarea 
          name="message" 
          placeholder="Message" 
          required 
          disabled={isPending}
        />
        <button type="submit" disabled={isPending}>
          {isPending ? 'Submitting...' : 'Submit'}
        </button>
      </form>
      
      {state.message && (
        <div className={state.success ? 'success' : 'error'}>
          {state.message}
        </div>
      )}
    </div>
  );
}
```

With a server action that returns state:
```typescript
'use server';

export async function submitContactForm(prevState: any, formData: FormData) {
  try {
    const name = formData.get('name') as string;
    const email = formData.get('email') as string;
    const message = formData.get('message') as string;
    
    // Process form data
    await saveContactMessage({ name, email, message });
    
    return {
      success: true,
      message: 'Thank you for your message!',
    };
  } catch (error) {
    return {
      success: false,
      message: 'Failed to send message. Please try again.',
    };
  }
}
```

## Success criteria
- Component uses `'use client'` directive
- `useActionState` imported from `react` (not `useState`)
- Server action properly connected to the hook
- Form state managed through action responses
- Loading states handled with `isPending`
- Success/error messages displayed based on server response