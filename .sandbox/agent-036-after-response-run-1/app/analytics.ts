export async function logPageView(path: string): Promise<void> {
  // Simulate sending a page view event to an analytics service.
  // In production this would call something like Segment, Amplitude, etc.
  console.log(`[analytics] page view: ${path}`)
}
