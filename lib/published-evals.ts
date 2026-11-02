export interface EvalPublicationConfig {
  skills?: string[];
  publish?: boolean;
}

// Carry reviewed publication decisions into an older pinned fixture cohort.
export function nonPublicEvalNames(
  config: Record<string, EvalPublicationConfig>,
  policy: { suiteRef: string; evals: Record<string, EvalPublicationConfig> },
  suiteRef: string,
): string[] {
  const effective =
    suiteRef === policy.suiteRef ? { ...config, ...policy.evals } : config;
  return Object.entries(effective)
    .filter(([, value]) => value.publish === false || value.skills?.length)
    .map(([name]) => name);
}
