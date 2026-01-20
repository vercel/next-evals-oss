# Evaluation Criteria

This implementation should use a server action to set a cookie from form data.

## Requirements

1. Has a form element with a username input field (name="username")
2. Has a submit button within the form
3. Uses a server action to handle form submission
4. The server action uses 'use server' directive
5. Uses `cookies()` from 'next/headers' to set the cookie
6. Sets a cookie named "user" with the username value from the form
7. The setUserCookie function is exported from actions.ts
