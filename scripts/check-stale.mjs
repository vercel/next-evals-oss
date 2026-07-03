/**
 * CI gate for eval staleness — the policy lives HERE, in the consumer, not in the
 * agent-eval framework. The framework only reports (`agent-eval status --json`); this
 * script decides which staleness is acceptable.
 *
 * Fails if any experiment NOT in ACCEPTED_STALE has new or changed evals. Run after
 * `pnpm sync-evals <sha>`.
 */
import { execSync } from 'node:child_process';

// Experiments intentionally left on an older eval version (e.g. expensive models we
// haven't refreshed yet). Remove an entry once you rerun that experiment, so it's
// enforced fresh again. Empty = every experiment must be fully run/up-to-date.
const ACCEPTED_STALE = [
  // 'gpt-5.2-codex-xhigh',
];

const { work } = JSON.parse(execSync('pnpm exec agent-eval status --json', { encoding: 'utf-8' }));
const offenders = work.filter((w) => !ACCEPTED_STALE.includes(w.experiment));

if (offenders.length > 0) {
  console.error('Stale evals that are not accepted:\n');
  for (const o of offenders) {
    const parts = [
      o.new.length ? `new: ${o.new.join(', ')}` : '',
      o.changed.length ? `changed: ${o.changed.join(', ')}` : '',
    ].filter(Boolean).join('  ');
    console.error(`  ${o.experiment}  (${parts})`);
  }
  console.error(
    '\nRun them — `agent-eval run <experiment>` — or add the experiment to ' +
      'ACCEPTED_STALE in scripts/check-stale.mjs to keep it on an older eval for now.'
  );
  process.exit(1);
}

console.log('Eval cache OK: every experiment is fresh or accepted-stale.');
