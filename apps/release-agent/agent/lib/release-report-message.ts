export const releaseEvalThreadSeparator = "<!-- RELEASE_EVAL_THREAD_REPLY -->";

export interface ReleaseEvalSlackReport {
  root: string;
  replies: [string, string, string];
}

export function splitReleaseEvalSlackReport(
  message: string,
): ReleaseEvalSlackReport | null {
  const parts = message
    .split(releaseEvalThreadSeparator)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length !== 4) return null;

  return {
    root: parts[0],
    replies: [parts[1], parts[2], parts[3]],
  };
}
