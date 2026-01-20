# Evaluation Criteria

This implementation should create a contact form using Next.js server actions.

## Requirements

1. Has a ContactForm component with input fields for name, email, and message
2. Uses a server action (function with 'use server' directive) to handle form submission
3. The form's action attribute is connected to the server action
4. After submission, displays a success message showing the submitted name and email
5. Uses FormData API to access form field values in the server action
6. Does NOT use client-side patterns like 'use client', onSubmit handlers, or fetch calls
7. Follows the same server action pattern shown in the existing page.tsx (updateProfile example)

## Implementation Notes

- Server actions should be async functions with 'use server' directive
- Form data can be accessed using formData.get('fieldName')
- Success message format should include: "Thank you, [name]" and show the email
- The form should use the action attribute, not onSubmit
- No useState, useEffect, or other client-side hooks should be needed
