# useActionState Form Evaluation

## Expected Behavior

1. The page displays a form that submits data to a server action
2. After submission, the form shows a success or error message based on the server response
3. The form state is managed using React 19's `useActionState` hook

## Success Criteria

- A form element is visible on the page with a submit button
- The form uses a server action (function with 'use server' directive or imported from a server actions file)
- The component uses `useActionState` from 'react' to manage form state and display messages
- The component does NOT use `useState` for managing form submission state
- The component does NOT use the deprecated `useFormState` from 'react-dom'
- The component that uses `useActionState` has the 'use client' directive (since it's a client hook)
- Success and error messages are displayed based on the action response state
