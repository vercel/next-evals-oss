// Formatting utilities for displaying eval results in table format

export interface EvalResult {
  evalPath: string;
  result: {
    buildSuccess: boolean;
    lintSuccess: boolean;
    testSuccess: boolean;
    duration?: number;
    retryStatus?: 'no-retry' | 'retry-passed' | 'retry-failed';
  };
}

export function formatClaudeCodeResultsTable(results: EvalResult[]): string {
  const lines: string[] = [];

  const evalColWidth = Math.max(25, ...results.map(r => r.evalPath.length));

  // Calculate overall scores first to determine column width
  const totalEvals = results.length;
  const buildPassed = results.filter(r => r.result.buildSuccess).length;
  const lintPassed = results.filter(r => r.result.lintSuccess).length;
  const testPassed = results.filter(r => r.result.testSuccess).length;

  const buildPct = totalEvals > 0 ? Math.round((buildPassed / totalEvals) * 100) : 0;
  const lintPct = totalEvals > 0 ? Math.round((lintPassed / totalEvals) * 100) : 0;
  const testPct = totalEvals > 0 ? Math.round((testPassed / totalEvals) * 100) : 0;

  const scoreText = `${buildPassed}/${lintPassed}/${testPassed} (${buildPct}%, ${lintPct}%, ${testPct}%)`;

  // Calculate max visual width for emoji rows with timing and retry indicator
  // Emojis display as 2 visual chars each but count as 1 string char
  const maxEmojiVisualWidth = Math.max(
    ...results.map(r => {
      const timeStr = r.result.duration ? `(${(r.result.duration / 1000).toFixed(1)}s)` : '';
      const hasRetryIndicator = r.result.retryStatus && r.result.retryStatus !== 'no-retry';
      // Visual width: 3 emojis * 2 = 6, + retry indicator (space + 2 emojis = 5), + optional space and time string
      const retryWidth = hasRetryIndicator ? 5 : 0;
      return timeStr ? 6 + retryWidth + 1 + timeStr.length : 6 + retryWidth;
    })
  );

  // Set column width to accommodate header, score text, and emoji+time rows (all visual widths)
  const modelColWidth = Math.max(20, scoreText.length, maxEmojiVisualWidth);


  // Build header
  const header = `| ${"Eval".padEnd(evalColWidth)} | ${"Claude Code".padEnd(modelColWidth)} |`;
  lines.push(header);

  // Build separator
  const separator = `|${"-".repeat(evalColWidth + 2)}|${"-".repeat(modelColWidth + 2)}|`;
  lines.push(separator);

  // Build rows
  for (const { evalPath, result } of results) {
    const build = result.buildSuccess ? "✅" : "❌";
    const lint = result.lintSuccess ? "✅" : "❌";
    const test = result.testSuccess ? "✅" : "❌";

    // Format retry status indicator
    let retryIndicator = '';
    if (result.retryStatus === 'retry-passed') {
      retryIndicator = ' 🔄✅';
    } else if (result.retryStatus === 'retry-failed') {
      retryIndicator = ' 🔄❌';
    }

    // Format duration - show nothing if not available
    const timeStr = result.duration ? `(${(result.duration / 1000).toFixed(1)}s)` : '';

    // Build emoji string
    const emojiString = timeStr
      ? `${build}${lint}${test}${retryIndicator} ${timeStr}`
      : `${build}${lint}${test}${retryIndicator}`;

    // Calculate visual width: 3 emojis * 2 = 6 visual, + retry indicator (4 visual if present), + optional space and time string
    const retryVisualWidth = retryIndicator ? 5 : 0; // space + 2 emojis = 1 + 4 = 5
    const emojiVisualWidth = timeStr ? 6 + retryVisualWidth + 1 + timeStr.length : 6 + retryVisualWidth;

    // Pad to match visual width of model column
    // modelColWidth is the target visual width
    // We have emojiVisualWidth so far, need to add spaces to reach modelColWidth visual width
    const visualPaddingNeeded = Math.max(0, modelColWidth - emojiVisualWidth);
    const row = `| ${evalPath.padEnd(evalColWidth)} | ${emojiString}${' '.repeat(visualPaddingNeeded)} |`;
    lines.push(row);
  }

  // Display overall scores
  lines.push(separator); // Separator before Overall row
  const overallRow = `| ${"Overall (B/L/T)".padEnd(evalColWidth)} | ${scoreText.padEnd(modelColWidth)} |`;
  lines.push(overallRow);

  return lines.join('\n');
}
