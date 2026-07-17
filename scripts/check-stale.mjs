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

// Current staleness (pin bump to vercel/next.js#95630):
//   - agent-041: converted to the agentic LLM judge; rerun per-model incrementally
//     and delete the pair (fable pair already rerun here).
//   - agent-030 / agent-034: judge conversions from #95440; rerun per-model
//     (fable pair done).
//   - agent-040-instant: renamed upstream from agent-040-unstable-instant; needs
//     first runs everywhere (fable pair + gpt pairs + grok done).
const ACCEPTED_STALE = {
  'claude-opus-4.6': ['agent-030-app-router-migration-hard', 'agent-034-async-cookies', 'agent-040-instant', 'agent-041-optimize-ppr-shell'],
  'claude-opus-4.6--agents-md': ['agent-030-app-router-migration-hard', 'agent-034-async-cookies', 'agent-040-instant', 'agent-041-optimize-ppr-shell'],
  'claude-opus-4.7': ['agent-030-app-router-migration-hard', 'agent-034-async-cookies', 'agent-040-instant', 'agent-041-optimize-ppr-shell'],
  'claude-opus-4.7--agents-md': ['agent-030-app-router-migration-hard', 'agent-034-async-cookies', 'agent-040-instant', 'agent-041-optimize-ppr-shell'],
  'claude-opus-4.8': ['agent-030-app-router-migration-hard', 'agent-034-async-cookies', 'agent-040-instant', 'agent-041-optimize-ppr-shell'],
  'claude-opus-4.8--agents-md': ['agent-030-app-router-migration-hard', 'agent-034-async-cookies', 'agent-040-instant', 'agent-041-optimize-ppr-shell'],
  'claude-sonnet-4.5': ['agent-030-app-router-migration-hard', 'agent-034-async-cookies', 'agent-040-instant', 'agent-041-optimize-ppr-shell'],
  'claude-sonnet-4.5--agents-md': ['agent-030-app-router-migration-hard', 'agent-034-async-cookies', 'agent-040-instant', 'agent-041-optimize-ppr-shell'],
  'claude-sonnet-4.6': ['agent-030-app-router-migration-hard', 'agent-034-async-cookies', 'agent-040-instant', 'agent-041-optimize-ppr-shell'],
  'claude-sonnet-4.6--agents-md': ['agent-030-app-router-migration-hard', 'agent-034-async-cookies', 'agent-040-instant', 'agent-041-optimize-ppr-shell'],
  'cursor-composer-1.5': ['agent-030-app-router-migration-hard', 'agent-034-async-cookies', 'agent-040-instant', 'agent-041-optimize-ppr-shell'],
  'cursor-composer-1.5--agents-md': ['agent-030-app-router-migration-hard', 'agent-034-async-cookies', 'agent-040-instant', 'agent-041-optimize-ppr-shell'],
  'cursor-composer-2.0': ['agent-030-app-router-migration-hard', 'agent-034-async-cookies', 'agent-040-instant', 'agent-041-optimize-ppr-shell'],
  'cursor-composer-2.0--agents-md': ['agent-030-app-router-migration-hard', 'agent-034-async-cookies', 'agent-040-instant', 'agent-041-optimize-ppr-shell'],
  'cursor-composer-2.5': ['agent-030-app-router-migration-hard', 'agent-034-async-cookies', 'agent-040-instant', 'agent-041-optimize-ppr-shell'],
  'cursor-composer-2.5--agents-md': ['agent-030-app-router-migration-hard', 'agent-034-async-cookies', 'agent-040-instant', 'agent-041-optimize-ppr-shell'],
  'gemini-3-pro-preview--agents-md': ['agent-030-app-router-migration-hard', 'agent-034-async-cookies', 'agent-040-instant', 'agent-041-optimize-ppr-shell'],
  'gemini-3-pro-preview-gemini-cli': ['agent-030-app-router-migration-hard', 'agent-034-async-cookies', 'agent-040-instant', 'agent-041-optimize-ppr-shell'],
  'gemini-3.1-pro-preview': ['agent-030-app-router-migration-hard', 'agent-034-async-cookies', 'agent-040-instant', 'agent-041-optimize-ppr-shell'],
  'gemini-3.1-pro-preview--agents-md': ['agent-030-app-router-migration-hard', 'agent-034-async-cookies', 'agent-040-instant', 'agent-041-optimize-ppr-shell'],
  'glm-5.1-opencode': ['agent-030-app-router-migration-hard', 'agent-034-async-cookies', 'agent-040-instant', 'agent-041-optimize-ppr-shell'],
  'glm-5.1-opencode--agents-md': ['agent-030-app-router-migration-hard', 'agent-034-async-cookies', 'agent-040-instant', 'agent-041-optimize-ppr-shell'],
  'glm-5.2': ['agent-030-app-router-migration-hard', 'agent-034-async-cookies', 'agent-040-instant', 'agent-041-optimize-ppr-shell'],
  'glm-5.2--agents-md': ['agent-030-app-router-migration-hard', 'agent-034-async-cookies', 'agent-040-instant', 'agent-041-optimize-ppr-shell'],
  'gpt-5.2-codex-xhigh': ['agent-030-app-router-migration-hard', 'agent-034-async-cookies', 'agent-040-instant', 'agent-041-optimize-ppr-shell'],
  'gpt-5.2-codex-xhigh--agents-md': ['agent-030-app-router-migration-hard', 'agent-034-async-cookies', 'agent-040-instant', 'agent-041-optimize-ppr-shell'],
  'gpt-5.3-codex-xhigh': ['agent-030-app-router-migration-hard', 'agent-034-async-cookies', 'agent-040-instant', 'agent-041-optimize-ppr-shell'],
  'gpt-5.3-codex-xhigh--agents-md': ['agent-030-app-router-migration-hard', 'agent-034-async-cookies', 'agent-040-instant', 'agent-041-optimize-ppr-shell'],
  'gpt-5.4-xhigh': ['agent-030-app-router-migration-hard', 'agent-034-async-cookies', 'agent-040-instant', 'agent-041-optimize-ppr-shell'],
  'gpt-5.4-xhigh--agents-md': ['agent-030-app-router-migration-hard', 'agent-034-async-cookies', 'agent-040-instant', 'agent-041-optimize-ppr-shell'],
  'gpt-5.5-pro': ['agent-030-app-router-migration-hard', 'agent-034-async-cookies', 'agent-040-instant', 'agent-041-optimize-ppr-shell'],
  'gpt-5.5-pro--agents-md': ['agent-030-app-router-migration-hard', 'agent-034-async-cookies', 'agent-040-instant', 'agent-041-optimize-ppr-shell'],
  'grok-4.5': ['agent-041-optimize-ppr-shell'],
  'grok-4.5--agents-md': ['agent-041-optimize-ppr-shell'],
  'kimi-k2.5': ['agent-030-app-router-migration-hard', 'agent-034-async-cookies', 'agent-040-instant', 'agent-041-optimize-ppr-shell'],
  'kimi-k2.5--agents-md': ['agent-030-app-router-migration-hard', 'agent-034-async-cookies', 'agent-040-instant', 'agent-041-optimize-ppr-shell'],
  'kimi-k2.6': ['agent-030-app-router-migration-hard', 'agent-034-async-cookies', 'agent-040-instant', 'agent-041-optimize-ppr-shell'],
  'kimi-k2.6--agents-md': ['agent-030-app-router-migration-hard', 'agent-034-async-cookies', 'agent-040-instant', 'agent-041-optimize-ppr-shell'],
  'kimi-k2.7-code': ['agent-030-app-router-migration-hard', 'agent-034-async-cookies', 'agent-040-instant', 'agent-041-optimize-ppr-shell'],
  'kimi-k2.7-code--agents-md': ['agent-030-app-router-migration-hard', 'agent-034-async-cookies', 'agent-040-instant', 'agent-041-optimize-ppr-shell'],
  'minimax-m2.7': ['agent-030-app-router-migration-hard', 'agent-034-async-cookies', 'agent-040-instant', 'agent-041-optimize-ppr-shell'],
  'minimax-m2.7--agents-md': ['agent-030-app-router-migration-hard', 'agent-034-async-cookies', 'agent-040-instant', 'agent-041-optimize-ppr-shell'],
  'minimax-m3': ['agent-030-app-router-migration-hard', 'agent-034-async-cookies', 'agent-040-instant', 'agent-041-optimize-ppr-shell'],
  'minimax-m3--agents-md': ['agent-030-app-router-migration-hard', 'agent-034-async-cookies', 'agent-040-instant', 'agent-041-optimize-ppr-shell'],
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
