Create a React client component that checks the navigator API to detect if the browser is Safari or Firefox. If it is Safari or Firefox, render "Unsupported Browser" with an explanation. For other browsers, render a welcome message.

Requirements:
- Use 'use client' directive
- Do NOT use useEffect for browser detection
- Check navigator.userAgent with proper typeof guards for SSR safety
- Safari detection should exclude Chrome (both contain "Safari" in userAgent)
- Handle cases where navigator is undefined