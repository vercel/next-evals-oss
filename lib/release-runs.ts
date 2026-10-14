const releaseRunCountVariable = 'NEXT_RELEASE_EVAL_RUNS';

/**
 * Keep normal and publishable experiment runs at pass@4 while allowing the
 * release/backport workflow to collect its separate pass@1 measurement.
 */
export function releaseEvalRuns(defaultRuns = 4): number {
  const override = process.env[releaseRunCountVariable];
  if (override === undefined) return defaultRuns;
  if (override !== '1') {
    throw new Error(`${releaseRunCountVariable} must be 1 when set`);
  }
  return 1;
}
