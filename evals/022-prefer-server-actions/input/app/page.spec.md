# Evaluation Criteria

This implementation should create a contact form using Next.js server actions.

## Requirements

1. Has a ContactForm component with input fields for name, email, and message
2. Uses a server action (function with 'use server' directive) to handle form submission
3. The form is connected to the server action (via action attribute or useActionState)
4. After submission, displays a success message showing the submitted name and email
5. Uses FormData API to access form field values in the server action
6. Does NOT use traditional client-side fetch calls or API routes for form submission

## Implementation Notes

- Server actions should be async functions with 'use server' directive
- Form data can be accessed using formData.get('fieldName')
- Success message format should include: "Thank you, [name]" and show the email
- Either simple form action attribute OR useActionState hook is acceptable
- useActionState is the modern React 19 pattern for server actions with state
