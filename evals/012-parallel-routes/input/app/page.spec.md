# Parallel Routes Dashboard Evaluation Criteria

## Required Behavior

1. **Both sections visible simultaneously**: When visiting the home page (/), both an "Analytics" section and a "Settings" section must be visible at the same time without any user interaction.

2. **Analytics section is clearly identifiable**: The page must display content that is clearly labeled or identified as "Analytics" (case-insensitive).

3. **Settings section is clearly identifiable**: The page must display content that is clearly labeled or identified as "Settings" (case-insensitive).

4. **Sections are rendered as separate components**: The Analytics and Settings content should be rendered in separate areas of the page, not overlapping or in the exact same position.

## Implementation Notes

- The solution should use Next.js App Router's parallel routes feature (using @folder naming convention)
- Both route slots should be rendered in the layout simultaneously
- This is a dashboard-style layout where multiple views are shown at once
