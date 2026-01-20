# Evaluation Criteria

This implementation should create a contact form using Next.js server actions.

## Requirements

1. Has a form element with input fields for name and email
2. Uses a server action (function with 'use server' directive) to handle form submission
3. The form's action attribute is connected to the server action
4. After submission, displays a success message showing the submitted name and email
5. Uses FormData API to access form field values in the server action
6. The component should be the default export from page.tsx

## Implementation Notes

- Server actions should be async functions with 'use server' directive
- Form data can be accessed using formData.get('fieldName')
- Success message format: "Thank you, [name]! We'll contact you at [email]."
