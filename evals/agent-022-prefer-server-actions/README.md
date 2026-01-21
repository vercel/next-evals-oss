# Prefer Server Actions Eval

## What this eval tests
This evaluation tests the ability to implement form submission using Next.js server actions instead of client-side API routes or fetch calls.

## Why it's important
LLMs often struggle with:
- Preferring server actions over client-side form handling with `onSubmit` and fetch
- Understanding the benefits of server actions for form processing
- Using the `action` attribute instead of `onSubmit` handlers
- Implementing proper server-side form validation and processing
- Following the progressive enhancement principle with server actions
- Avoiding unnecessary client-side JavaScript for form submissions

## How it works
The test validates that:
1. Form uses server actions instead of client-side submission handlers
2. Server action is properly defined with `'use server'` directive
3. Form data is processed server-side using `FormData` API
4. No client-side `onSubmit` handlers or fetch calls are used
5. Form follows existing codebase patterns for server actions

## Expected result
The implementation should use server actions for form processing:

```typescript
// Server action
async function submitContactForm(formData: FormData) {
  'use server';
  
  const name = formData.get('name') as string;
  const email = formData.get('email') as string;
  const message = formData.get('message') as string;
  
  // Server-side validation
  if (!name || !email || !message) {
    throw new Error('All fields are required');
  }
  
  // Save to database or send email
  await saveContactMessage({ name, email, message });
  
  // Redirect or return success
  redirect('/thank-you');
}

// Component using server action
export default function ContactForm() {
  return (
    <div>
      <h1>Contact Us</h1>
      <form action={submitContactForm}>
        <input 
          name="name" 
          placeholder="Your Name" 
          required 
        />
        <input 
          name="email" 
          type="email" 
          placeholder="Your Email" 
          required 
        />
        <textarea 
          name="message" 
          placeholder="Your Message" 
          required 
        />
        <button type="submit">
          Send Message
        </button>
      </form>
    </div>
  );
}
```

**Instead of the client-side pattern:**
```typescript
// Avoid this pattern
'use client';

import { useState } from 'react';

export default function ContactForm() {
  const [formData, setFormData] = useState({});
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    const response = await fetch('/api/contact', {
      method: 'POST',
      body: JSON.stringify(formData),
    });
    // Handle response...
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* form fields */}
    </form>
  );
}
```

## Success criteria
- Form uses `action` attribute with server action
- Server action defined with `'use server'` directive
- Form data processed using `FormData` API
- No client-side `onSubmit` handlers or fetch calls
- Follows existing codebase patterns for form handling