const reviewedFiles = new Set(['EVAL.ts', 'PROMPT.md', 'tsconfig.json']);

// Companion files are explicit: a reviewed grader fix must not replace app code.
export function pinnedGraderOverrides(
  policy: { suiteRef: string; graders: Record<string, unknown> },
  suiteRef: string,
) {
  if (policy.suiteRef !== suiteRef) return [];
  return Object.entries(policy.graders).map(([evalName, override]) => {
    const value =
      typeof override === 'object' && override !== null
        ? (override as Record<string, unknown>)
        : undefined;
    const ref = typeof override === 'string' ? override : value?.ref;
    const files = typeof override === 'string' ? ['EVAL.ts'] : value?.files;
    if (
      !/^agent-[a-z0-9-]+$/.test(evalName) ||
      typeof ref !== 'string' ||
      !/^[a-f0-9]{40}$/.test(ref) ||
      !Array.isArray(files) ||
      !files.includes('EVAL.ts') ||
      new Set(files).size !== files.length ||
      files.some((file) => !reviewedFiles.has(file))
    ) {
      throw new Error('Invalid pinned grader override');
    }
    return { evalName, ref, files: files as string[] };
  });
}
