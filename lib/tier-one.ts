/**
 * Experiments kept fresh for the public board.
 *
 * Keep the retention rationale in README.md's "Model retention policy" in
 * sync when this list changes. Release automation runs both the base and
 * AGENTS.md variant for every entry here.
 */
export const TIER_ONE_EXPERIMENTS = [
  // Fable 5.1 shipped at least 84 days after Fable 5, outside the
  // previous-version carve-out in the retention policy.
  'claude-fable-5.1',
  // Opus 5.5 shipped about 60 days after Opus 5, so Opus 5 is tier 2.
  'claude-opus-5.5-high',
  'claude-sonnet-5',
  // Astra, Sol, and Luna are current sibling profiles. Sol replaced 5.6 Sol
  // after roughly 75 days; Luna has no previously measured predecessor.
  'gpt-6-astra-high',
  'gpt-6-luna-high',
  'gpt-6-sol-high',
  // Flash and Pro are separate model lines. The Pro experiments remain tier 2
  // until the direct-provider Gemini CLI credentials are available to rerun them.
  'gemini-3.8-flash',
  // Argon is Google's current general reasoning line, distinct from Flash.
  'gemini-4-argon',
  'kimi-k3',
  'kimi-k2.7-code', // Kimi K3 shipped 29 days after it.
  'cursor-composer-2.5',
  'glm-5.2',
  'minimax-m3',
  // Grok 4.7 shipped 40 days after 4.6, outside the carve-out.
  'grok-4.7',
  'pixel-canary',
] as const;

export const TIER_ONE_RELEASE_MATRIX = TIER_ONE_EXPERIMENTS.flatMap((name) => [
  name,
  `${name}--agents-md`,
]);
