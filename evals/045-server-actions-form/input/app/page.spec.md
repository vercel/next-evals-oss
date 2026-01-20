# Server Actions Form

## Expected Behavior

1. The page displays a form with a name input field and a submit button
2. Submitting the form sends the data to a server action
3. The server action logs the submitted name to the console
4. The form works without client-side JavaScript (progressive enhancement)

## Success Criteria

- Uses a Server Action with the 'use server' directive
- The server action is an async function that accepts FormData
- The form uses the `action` prop to bind to the server action (not `onSubmit`)
- Input field has `name="name"` attribute for FormData extraction
- Input field has `placeholder="Enter your name"`
- Submit button displays "Submit" text
- Server action extracts the name using `formData.get('name')`
- Server action logs the name using `console.log`
