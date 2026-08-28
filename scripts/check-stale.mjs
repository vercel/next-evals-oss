/**
 * CI gate for eval staleness — the policy lives HERE, in the consumer, not in the
 * agent-eval framework. The framework only reports (`agent-eval status --json`);
 * this script decides which staleness is acceptable.
 *
 * ACCEPTED_STALE maps experiment -> evals it may stay stale on: each (experiment,
 * eval) pair is an explicit "this model keeps its old result for this eval until
 * rerun". Anything stale outside these pairs fails CI. Run after
 * `pnpm sync-evals <sha>`.
 */
import { execSync } from 'node:child_process';

// The accepted set follows the README's model retention policy: tier-2
// (previously measured) experiments keep their last results and are not rerun
// as evals change, so every eval that drifts past a tier-2 model's final run
// lands here. Tier-1 experiments must NOT appear — they get rerun instead.
const ACCEPTED_STALE = {
  'claude-melon-eap': ['agent-029-use-cache-directive', 'agent-031-proxy-middleware', 'agent-041-optimize-ppr-shell', 'agent-044-uses-nextjs', 'agent-045-build-a-nextjs-app'],
  'claude-melon-eap--agents-md': ['agent-029-use-cache-directive', 'agent-031-proxy-middleware', 'agent-041-optimize-ppr-shell', 'agent-044-uses-nextjs', 'agent-045-build-a-nextjs-app'],
  'claude-opus-4.6': ['agent-029-use-cache-directive', 'agent-030-app-router-migration-hard', 'agent-031-proxy-middleware', 'agent-034-async-cookies', 'agent-040-instant', 'agent-041-optimize-ppr-shell', 'agent-044-uses-nextjs', 'agent-045-build-a-nextjs-app'],
  'claude-opus-4.6--agents-md': ['agent-029-use-cache-directive', 'agent-030-app-router-migration-hard', 'agent-031-proxy-middleware', 'agent-034-async-cookies', 'agent-040-instant', 'agent-041-optimize-ppr-shell', 'agent-044-uses-nextjs', 'agent-045-build-a-nextjs-app'],
  'claude-opus-4.7': ['agent-029-use-cache-directive', 'agent-030-app-router-migration-hard', 'agent-031-proxy-middleware', 'agent-034-async-cookies', 'agent-040-instant', 'agent-041-optimize-ppr-shell', 'agent-044-uses-nextjs', 'agent-045-build-a-nextjs-app'],
  'claude-opus-4.7--agents-md': ['agent-029-use-cache-directive', 'agent-030-app-router-migration-hard', 'agent-031-proxy-middleware', 'agent-034-async-cookies', 'agent-040-instant', 'agent-041-optimize-ppr-shell', 'agent-044-uses-nextjs', 'agent-045-build-a-nextjs-app'],
  'claude-opus-4.8': ['agent-029-use-cache-directive', 'agent-030-app-router-migration-hard', 'agent-031-proxy-middleware', 'agent-034-async-cookies', 'agent-040-instant', 'agent-041-optimize-ppr-shell', 'agent-044-uses-nextjs', 'agent-045-build-a-nextjs-app'],
  'claude-opus-4.8--agents-md': ['agent-029-use-cache-directive', 'agent-030-app-router-migration-hard', 'agent-031-proxy-middleware', 'agent-034-async-cookies', 'agent-040-instant', 'agent-041-optimize-ppr-shell', 'agent-044-uses-nextjs', 'agent-045-build-a-nextjs-app'],
  'claude-opus-5-control': ['agent-029-use-cache-directive', 'agent-031-proxy-middleware', 'agent-041-optimize-ppr-shell', 'agent-044-uses-nextjs', 'agent-045-build-a-nextjs-app'],
  'claude-sonnet-4.5': ['agent-029-use-cache-directive', 'agent-030-app-router-migration-hard', 'agent-031-proxy-middleware', 'agent-034-async-cookies', 'agent-040-instant', 'agent-041-optimize-ppr-shell', 'agent-044-uses-nextjs', 'agent-045-build-a-nextjs-app'],
  'claude-sonnet-4.5--agents-md': ['agent-029-use-cache-directive', 'agent-030-app-router-migration-hard', 'agent-031-proxy-middleware', 'agent-034-async-cookies', 'agent-040-instant', 'agent-041-optimize-ppr-shell', 'agent-044-uses-nextjs', 'agent-045-build-a-nextjs-app'],
  'claude-sonnet-4.6': ['agent-029-use-cache-directive', 'agent-030-app-router-migration-hard', 'agent-031-proxy-middleware', 'agent-034-async-cookies', 'agent-040-instant', 'agent-041-optimize-ppr-shell', 'agent-044-uses-nextjs', 'agent-045-build-a-nextjs-app'],
  'claude-sonnet-4.6--agents-md': ['agent-029-use-cache-directive', 'agent-030-app-router-migration-hard', 'agent-031-proxy-middleware', 'agent-034-async-cookies', 'agent-040-instant', 'agent-041-optimize-ppr-shell', 'agent-044-uses-nextjs', 'agent-045-build-a-nextjs-app'],
  'cursor-composer-2.0': ['agent-029-use-cache-directive', 'agent-030-app-router-migration-hard', 'agent-031-proxy-middleware', 'agent-034-async-cookies', 'agent-040-instant', 'agent-041-optimize-ppr-shell', 'agent-044-uses-nextjs', 'agent-045-build-a-nextjs-app'],
  'cursor-composer-2.0--agents-md': ['agent-029-use-cache-directive', 'agent-030-app-router-migration-hard', 'agent-031-proxy-middleware', 'agent-034-async-cookies', 'agent-040-instant', 'agent-041-optimize-ppr-shell', 'agent-044-uses-nextjs', 'agent-045-build-a-nextjs-app'],
  'cursor-composer-2.5': ['agent-030-app-router-migration-hard', 'agent-034-async-cookies', 'agent-040-instant', 'agent-041-optimize-ppr-shell'],
  'cursor-composer-2.5--agents-md': ['agent-030-app-router-migration-hard', 'agent-034-async-cookies', 'agent-040-instant', 'agent-041-optimize-ppr-shell'],
  'fable5-local': ['agent-029-use-cache-directive', 'agent-031-proxy-middleware', 'agent-041-optimize-ppr-shell', 'agent-044-uses-nextjs', 'agent-045-build-a-nextjs-app'],
  'fable5-local--agents-md': ['agent-029-use-cache-directive', 'agent-031-proxy-middleware', 'agent-041-optimize-ppr-shell', 'agent-044-uses-nextjs', 'agent-045-build-a-nextjs-app'],
  'fable5-vercel': ['agent-000-app-router-migration-simple', 'agent-021-avoid-fetch-in-effect', 'agent-022-prefer-server-actions', 'agent-023-avoid-getserversideprops', 'agent-024-avoid-redundant-usestate', 'agent-026-no-serial-await', 'agent-027-prefer-next-image', 'agent-028-prefer-next-font', 'agent-029-use-cache-directive', 'agent-030-app-router-migration-hard', 'agent-031-proxy-middleware', 'agent-032-use-cache-directive', 'agent-033-forbidden-auth', 'agent-034-async-cookies', 'agent-035-connection-dynamic', 'agent-036-after-response', 'agent-037-updatetag-cache', 'agent-038-refresh-settings', 'agent-039-indirect-proxy', 'agent-040-instant', 'agent-042-enable-ppr', 'agent-043-view-transitions', 'agent-044-uses-nextjs', 'agent-045-build-a-nextjs-app'],
  'gemini-3-pro-preview--agents-md': ['agent-029-use-cache-directive', 'agent-030-app-router-migration-hard', 'agent-031-proxy-middleware', 'agent-034-async-cookies', 'agent-040-instant', 'agent-041-optimize-ppr-shell', 'agent-044-uses-nextjs', 'agent-045-build-a-nextjs-app'],
  'gemini-3-pro-preview-gemini-cli': ['agent-029-use-cache-directive', 'agent-030-app-router-migration-hard', 'agent-031-proxy-middleware', 'agent-034-async-cookies', 'agent-040-instant', 'agent-041-optimize-ppr-shell', 'agent-044-uses-nextjs', 'agent-045-build-a-nextjs-app'],
  'gemini-3.1-pro-preview': ['agent-029-use-cache-directive', 'agent-030-app-router-migration-hard', 'agent-031-proxy-middleware', 'agent-034-async-cookies', 'agent-040-instant', 'agent-041-optimize-ppr-shell', 'agent-044-uses-nextjs', 'agent-045-build-a-nextjs-app'],
  'gemini-3.1-pro-preview--agents-md': ['agent-029-use-cache-directive', 'agent-030-app-router-migration-hard', 'agent-031-proxy-middleware', 'agent-034-async-cookies', 'agent-040-instant', 'agent-041-optimize-ppr-shell', 'agent-044-uses-nextjs', 'agent-045-build-a-nextjs-app'],
  'glm-5.1-opencode': ['agent-029-use-cache-directive', 'agent-030-app-router-migration-hard', 'agent-031-proxy-middleware', 'agent-034-async-cookies', 'agent-040-instant', 'agent-041-optimize-ppr-shell', 'agent-044-uses-nextjs', 'agent-045-build-a-nextjs-app'],
  'glm-5.1-opencode--agents-md': ['agent-029-use-cache-directive', 'agent-030-app-router-migration-hard', 'agent-031-proxy-middleware', 'agent-034-async-cookies', 'agent-040-instant', 'agent-041-optimize-ppr-shell', 'agent-044-uses-nextjs', 'agent-045-build-a-nextjs-app'],
  'glm-5.2': ['agent-030-app-router-migration-hard', 'agent-034-async-cookies', 'agent-040-instant', 'agent-041-optimize-ppr-shell'],
  'glm-5.2--agents-md': ['agent-030-app-router-migration-hard', 'agent-034-async-cookies', 'agent-040-instant', 'agent-041-optimize-ppr-shell'],
  'gpt-5.2-codex-xhigh': ['agent-029-use-cache-directive', 'agent-030-app-router-migration-hard', 'agent-031-proxy-middleware', 'agent-034-async-cookies', 'agent-040-instant', 'agent-041-optimize-ppr-shell', 'agent-044-uses-nextjs', 'agent-045-build-a-nextjs-app'],
  'gpt-5.2-codex-xhigh--agents-md': ['agent-029-use-cache-directive', 'agent-030-app-router-migration-hard', 'agent-031-proxy-middleware', 'agent-034-async-cookies', 'agent-040-instant', 'agent-041-optimize-ppr-shell', 'agent-044-uses-nextjs', 'agent-045-build-a-nextjs-app'],
  'gpt-5.3-codex-xhigh': ['agent-030-app-router-migration-hard', 'agent-034-async-cookies', 'agent-040-instant', 'agent-041-optimize-ppr-shell'],
  'gpt-5.3-codex-xhigh--agents-md': ['agent-030-app-router-migration-hard', 'agent-034-async-cookies', 'agent-040-instant', 'agent-041-optimize-ppr-shell'],
  'gpt-5.4-xhigh': ['agent-029-use-cache-directive', 'agent-030-app-router-migration-hard', 'agent-031-proxy-middleware', 'agent-034-async-cookies', 'agent-040-instant', 'agent-041-optimize-ppr-shell', 'agent-044-uses-nextjs', 'agent-045-build-a-nextjs-app'],
  'gpt-5.4-xhigh--agents-md': ['agent-029-use-cache-directive', 'agent-030-app-router-migration-hard', 'agent-031-proxy-middleware', 'agent-034-async-cookies', 'agent-040-instant', 'agent-041-optimize-ppr-shell', 'agent-044-uses-nextjs', 'agent-045-build-a-nextjs-app'],
  'gpt-5.5-pro': ['agent-029-use-cache-directive', 'agent-030-app-router-migration-hard', 'agent-031-proxy-middleware', 'agent-034-async-cookies', 'agent-040-instant', 'agent-041-optimize-ppr-shell', 'agent-044-uses-nextjs', 'agent-045-build-a-nextjs-app'],
  'gpt-5.5-pro--agents-md': ['agent-029-use-cache-directive', 'agent-030-app-router-migration-hard', 'agent-031-proxy-middleware', 'agent-034-async-cookies', 'agent-040-instant', 'agent-041-optimize-ppr-shell', 'agent-044-uses-nextjs', 'agent-045-build-a-nextjs-app'],
  'grok-4.5': ['agent-029-use-cache-directive', 'agent-031-proxy-middleware', 'agent-041-optimize-ppr-shell', 'agent-044-uses-nextjs', 'agent-045-build-a-nextjs-app'],
  'grok-4.5--agents-md': ['agent-029-use-cache-directive', 'agent-031-proxy-middleware', 'agent-041-optimize-ppr-shell', 'agent-044-uses-nextjs', 'agent-045-build-a-nextjs-app'],
  'grok-4.6': ['agent-029-use-cache-directive', 'agent-031-proxy-middleware', 'agent-041-optimize-ppr-shell', 'agent-044-uses-nextjs', 'agent-045-build-a-nextjs-app'],
  'grok-4.6--agents-md': ['agent-029-use-cache-directive', 'agent-031-proxy-middleware', 'agent-041-optimize-ppr-shell', 'agent-044-uses-nextjs', 'agent-045-build-a-nextjs-app'],
  'kimi-k2.5': ['agent-029-use-cache-directive', 'agent-030-app-router-migration-hard', 'agent-031-proxy-middleware', 'agent-034-async-cookies', 'agent-040-instant', 'agent-041-optimize-ppr-shell', 'agent-044-uses-nextjs', 'agent-045-build-a-nextjs-app'],
  'kimi-k2.5--agents-md': ['agent-029-use-cache-directive', 'agent-030-app-router-migration-hard', 'agent-031-proxy-middleware', 'agent-034-async-cookies', 'agent-040-instant', 'agent-041-optimize-ppr-shell', 'agent-044-uses-nextjs', 'agent-045-build-a-nextjs-app'],
  'kimi-k2.6': ['agent-029-use-cache-directive', 'agent-030-app-router-migration-hard', 'agent-031-proxy-middleware', 'agent-034-async-cookies', 'agent-040-instant', 'agent-041-optimize-ppr-shell', 'agent-044-uses-nextjs', 'agent-045-build-a-nextjs-app'],
  'kimi-k2.6--agents-md': ['agent-029-use-cache-directive', 'agent-030-app-router-migration-hard', 'agent-031-proxy-middleware', 'agent-034-async-cookies', 'agent-040-instant', 'agent-041-optimize-ppr-shell', 'agent-044-uses-nextjs', 'agent-045-build-a-nextjs-app'],
  'kimi-k2.7-code': ['agent-030-app-router-migration-hard', 'agent-034-async-cookies', 'agent-040-instant', 'agent-041-optimize-ppr-shell'],
  'kimi-k2.7-code--agents-md': ['agent-030-app-router-migration-hard', 'agent-034-async-cookies', 'agent-040-instant', 'agent-041-optimize-ppr-shell'],
  'minimax-m2.7': ['agent-029-use-cache-directive', 'agent-030-app-router-migration-hard', 'agent-031-proxy-middleware', 'agent-034-async-cookies', 'agent-040-instant', 'agent-041-optimize-ppr-shell', 'agent-044-uses-nextjs', 'agent-045-build-a-nextjs-app'],
  'minimax-m2.7--agents-md': ['agent-029-use-cache-directive', 'agent-030-app-router-migration-hard', 'agent-031-proxy-middleware', 'agent-034-async-cookies', 'agent-040-instant', 'agent-041-optimize-ppr-shell', 'agent-044-uses-nextjs', 'agent-045-build-a-nextjs-app'],
  'minimax-m3': ['agent-030-app-router-migration-hard', 'agent-034-async-cookies', 'agent-040-instant', 'agent-041-optimize-ppr-shell'],
  'minimax-m3--agents-md': ['agent-030-app-router-migration-hard', 'agent-034-async-cookies', 'agent-040-instant', 'agent-041-optimize-ppr-shell'],
  'opus5-local--agents-md': ['agent-029-use-cache-directive', 'agent-031-proxy-middleware', 'agent-041-optimize-ppr-shell', 'agent-044-uses-nextjs', 'agent-045-build-a-nextjs-app'],
};

const { work } = JSON.parse(execSync('pnpm exec agent-eval status --json', { encoding: 'utf-8' }));
const offenders = work
  .map((w) => ({
    experiment: w.experiment,
    evals: [...w.new, ...w.changed].filter((e) => !(ACCEPTED_STALE[w.experiment] ?? []).includes(e)),
  }))
  .filter((w) => w.evals.length > 0);

if (offenders.length > 0) {
  console.error('Stale evals that are not accepted:\n');
  for (const o of offenders) {
    console.error(`  ${o.experiment}: ${o.evals.join(', ')}`);
  }
  console.error(
    '\nRerun them — `agent-eval run <experiment>` — or add the (experiment, eval) ' +
      'pair to ACCEPTED_STALE in scripts/check-stale.mjs to keep the old result for now.'
  );
  process.exit(1);
}

console.log('Eval cache OK: every (experiment, eval) is fresh or accepted-stale.');
