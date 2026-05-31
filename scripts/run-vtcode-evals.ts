/**
 * Run Next.js evals using vtcode as the agent.
 *
 * Usage:
 *   npx tsx scripts/run-vtcode-evals.ts [options]
 *
 * Options:
 *   --model <name>         Model name (default: reads from VTCODE_MODEL env or "claude-sonnet-4-6")
 *   --provider <name>      LLM provider (default: reads from VTCODE_PROVIDER env)
 *   --agents-md            Include AGENTS.md with Next.js docs in the sandbox
 *   --single <eval>        Run only a specific eval (e.g. "agent-000-app-router-migration-simple")
 *   --runs <n>             Number of runs per eval (default: 1)
 *   --timeout <seconds>    Max seconds per eval run (default: 600)
 *   --vtcode-binary <path> Path to vtcode binary (default: "vtcode")
 *   --vtcode-config <path> Path to vtcode.toml to copy into sandbox (default: none)
 *   --experiment <name>    Experiment name for results dir (default: auto-generated)
 *   --dry-run              Show what would run without running
 *
 * Workspace trust:
 *   The runner sets VTCODE_TRUST_WORKSPACE=full-auto to auto-trust sandbox
 *   directories without interactive prompts or config.toml modifications.
 *   See src/startup/workspace_trust.rs for the full trust resolution order.
 */

import { execSync, spawn } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  cpSync,
  rmSync,
  writeFileSync,
  readFileSync,
  readdirSync,
} from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { platform } from 'node:os';

const ROOT = process.cwd();
const EVALS_DIR = join(ROOT, 'evals');
const RESULTS_DIR = join(ROOT, 'results');

interface EvalResult {
  totalRuns: number;
  passedRuns: number;
  passRate: string;
  meanDuration: number;
  fingerprint: string;
}

// Map common model preset IDs to their actual vtcode model IDs
const MODEL_PRESETS: Record<string, { model: string; provider: string }> = {
  'huggingface/deepseek-v4-flash': { model: 'deepseek-ai/DeepSeek-V4-Flash:novita', provider: 'huggingface' },
  'huggingface/deepseek-v4-pro': { model: 'deepseek-ai/DeepSeek-V4-Pro:together', provider: 'huggingface' },
  'huggingface/glm-5': { model: 'zai-org/GLM-5:novita', provider: 'huggingface' },
  'huggingface/glm-5.1': { model: 'zai-org/GLM-5.1:zai-org', provider: 'huggingface' },
  'huggingface/kimi-k2.6': { model: 'moonshotai/Kimi-K2.6:novita', provider: 'huggingface' },
  'huggingface/minimax-m2.5': { model: 'MiniMaxAI/MiniMax-M2.5:novita', provider: 'huggingface' },
  'huggingface/qwen3-coder-next': { model: 'Qwen/Qwen3-Coder-Next:novita', provider: 'huggingface' },
};

function parseArgs() {
  const args = process.argv.slice(2);
  const opts: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
        opts[key] = args[i + 1];
        i++;
      } else {
        opts[key] = 'true';
      }
    }
  }
  return opts;
}

function getTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').replace(/Z$/, '') + 'Z';
}

function computeFingerprint(evalDir: string, config: { agent: string; model: string; timeout: number }): string {
  const hash = createHash('sha256');
  hash.update(config.agent);
  hash.update(config.model);
  hash.update(String(config.timeout));

  const evalFiles = readdirSync(evalDir).sort();
  for (const file of evalFiles) {
    if (file === 'node_modules') continue;
    const filePath = join(evalDir, file);
    if (existsSync(filePath)) {
      try {
        hash.update(readFileSync(filePath));
      } catch {
        // skip binary/dirs
      }
    }
  }
  return hash.digest('hex');
}

function runCommand(cmd: string, args: string[], opts: { cwd?: string; timeout?: number; quiet?: boolean } = {}): { stdout: string; stderr: string; exitCode: number } {
  try {
    const result = execSync(`${cmd} ${args.map(a => `"${a}"`).join(' ')}`, {
      cwd: opts.cwd,
      timeout: opts.timeout,
      stdio: opts.quiet ? 'pipe' : ['pipe', 'pipe', 'pipe'],
      maxBuffer: 50 * 1024 * 1024,
    });
    return {
      stdout: result.stdout?.toString() || '',
      stderr: result.stderr?.toString() || '',
      exitCode: 0,
    };
  } catch (err: any) {
    return {
      stdout: err.stdout?.toString() || '',
      stderr: err.stderr?.toString() || '',
      exitCode: err.status ?? 1,
    };
  }
}

function runCommandLive(cmd: string, args: string[], opts: {
  cwd?: string;
  timeout?: number;
  env?: Record<string, string | undefined>;
  onStdout?: (line: string) => void;
  onStderr?: (line: string) => void;
} = {}): Promise<{ exitCode: number }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd: opts.cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: opts.env || { ...process.env },
    });

    let timedOut = false;
    const timer = opts.timeout
      ? setTimeout(() => {
          timedOut = true;
          child.kill('SIGTERM');
        }, opts.timeout)
      : null;

    child.stdout?.on('data', (data: Buffer) => {
      const lines = data.toString();
      if (opts.onStdout) opts.onStdout(lines);
      process.stdout.write(lines);
    });

    child.stderr?.on('data', (data: Buffer) => {
      const lines = data.toString();
      if (opts.onStderr) opts.onStderr(lines);
      process.stderr.write(lines);
    });

    child.on('close', (exitCode) => {
      if (timer) clearTimeout(timer);
      resolve({ exitCode: timedOut ? 124 : (exitCode ?? 1) });
    });

    child.on('error', () => {
      if (timer) clearTimeout(timer);
      resolve({ exitCode: 1 });
    });
  });
}

function installDeps(sandboxDir: string): boolean {
  if (existsSync(join(sandboxDir, 'node_modules'))) {
    return true;
  }
  const result = runCommand('npm', ['install', '--no-audit', '--no-fund'], {
    cwd: sandboxDir,
    timeout: 300_000,
  });
  return result.exitCode === 0;
}

function hasVitestConfig(dir: string): boolean {
  return existsSync(join(dir, 'vitest.config.ts'))
    || existsSync(join(dir, 'vitest.config.mts'))
    || existsSync(join(dir, 'vitest.config.js'))
    || existsSync(join(dir, '.vitest'));
}

function runVitest(sandboxDir: string, _evalName: string, timeout: number): { passed: boolean; output: string } {
  if (!existsSync(join(sandboxDir, 'EVAL.ts'))) {
    return { passed: false, output: 'EVAL.ts not found' };
  }

  const result = runCommand('npx', ['vitest', 'run', '--reporter', 'verbose'], {
    cwd: sandboxDir,
    timeout: timeout * 1000,
    quiet: true,
  });

  const output = result.stdout + '\n' + result.stderr;

  // Consider it passed if vitest exits 0
  const passed = result.exitCode === 0;

  return { passed, output };
}

async function runEval(
  evalName: string,
  evalDir: string,
  config: {
    model: string;
    provider?: string;
    vtcodeBinary: string;
    vtcodeConfig?: string;
    timeout: number;
    agentsMd: boolean;
    runNumber: number;
    totalRuns: number;
    experimentName: string;
  },
): Promise<{ passed: boolean; durationMs: number; error?: string }> {
  const sandboxBase = join(ROOT, '.sandbox');
  const sandboxDir = join(sandboxBase, `${evalName}-run-${config.runNumber}`);
  const startTime = Date.now();

  // Clean up any leftover sandbox
  if (existsSync(sandboxDir)) {
    rmSync(sandboxDir, { recursive: true, force: true });
  }

  console.log(`\n  Setting up sandbox...`);

  // Create sandbox and copy eval files
  mkdirSync(sandboxDir, { recursive: true });
  cpSync(evalDir, sandboxDir, { recursive: true });

  // Write vtcode.toml
  const vtcodeToml = [
    '[automation.full_auto]',
    'enabled = true',
    'allowed_tools = ["*"]',
    'max_turns = 100',
    '',
    '[agent]',
    `default_model = "${config.model}"`,
    config.provider ? `provider = "${config.provider}"` : null,
    config.provider === 'huggingface' ? 'api_key_env = "HF_TOKEN"' : null,
    'reasoning_effort = "none"',
    '',
    '[agent.harness]',
    'orchestration_mode = "single"',
    '',
    '[permissions]',
    'default_mode = "auto"',
    'dangerously_skip_permissions = true',
    '',
    '[output]',
    'quiet = false',
  ].filter(Boolean).join('\n');
  writeFileSync(join(sandboxDir, 'vtcode.toml'), vtcodeToml);

  // Copy user's vtcode.toml if provided
  if (config.vtcodeConfig && existsSync(config.vtcodeConfig)) {
    const userConfig = readFileSync(config.vtcodeConfig, 'utf-8');
    const merged = vtcodeToml + '\n' + userConfig;
    writeFileSync(join(sandboxDir, 'vtcode.toml'), merged);
  }

  // Optionally add AGENTS.md with Next.js docs guidance
  if (config.agentsMd) {
    const agentsMd = `<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in \`node_modules/next/dist/docs/\` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
`;
    writeFileSync(join(sandboxDir, 'AGENTS.md'), agentsMd);
    writeFileSync(join(sandboxDir, 'CLAUDE.md'), '@AGENTS.md\n');
  }

  // Install dependencies
  console.log(`  Installing npm dependencies...`);
  if (!installDeps(sandboxDir)) {
    return { passed: false, durationMs: Date.now() - startTime, error: 'npm install failed' };
  }

  // Read the prompt
  const promptPath = join(sandboxDir, 'PROMPT.md');
  if (!existsSync(promptPath)) {
    return { passed: false, durationMs: Date.now() - startTime, error: 'PROMPT.md not found' };
  }
  const prompt = readFileSync(promptPath, 'utf-8').trim();

  // Build vtcode args
  const vtcodeArgs: string[] = ['exec', '--json', '--permission-mode', 'bypass_permissions'];
  if (config.provider) {
    vtcodeArgs.push('--provider', config.provider);
  }
  vtcodeArgs.push(prompt);

  // Run vtcode exec
  console.log(`  Running vtcode exec (timeout: ${config.timeout}s)...`);

  const { exitCode } = await runCommandLive(config.vtcodeBinary, vtcodeArgs, {
    cwd: sandboxDir,
    timeout: config.timeout * 1000,
    env: {
      ...process.env,
      VTCODE_TRUST_WORKSPACE: 'full-auto',
      VTCODE_TRUST_WORKSPACE_QUIET: '1',
    },
  });

  const durationMs = Date.now() - startTime;

  if (exitCode === 124) {
    return { passed: false, durationMs, error: 'vtcode timed out' };
  }
  if (exitCode !== 0) {
    return { passed: false, durationMs, error: `vtcode exited with code ${exitCode}` };
  }

  // Wait a moment for any file writes to settle
  await new Promise((r) => setTimeout(r, 500));

  console.log(`  Running EVAL.ts tests...`);

  // Create a vitest config if one doesn't exist
  if (!hasVitestConfig(sandboxDir)) {
    writeFileSync(join(sandboxDir, 'vitest.config.ts'), [
      'import { defineConfig } from "vitest/config";',
      'import react from "@vitejs/plugin-react";',
      'import tsconfigPaths from "vite-tsconfig-paths";',
      'export default defineConfig({',
      '  plugins: [react(), tsconfigPaths()],',
      '  test: { include: ["EVAL.ts"] },',
      '});',
      '',
    ].join('\n'));
  }

  const vitestResult = runVitest(sandboxDir, evalName, config.timeout);

  // Log vitest output summary
  const vitestLines = vitestResult.output.split('\n').filter(l =>
    l.includes('✓') || l.includes('✗') || l.includes('FAIL') || l.includes('PASS') ||
    l.includes('Tests') || l.includes('×') || l.includes('❯') || l.includes('❌') ||
    l.includes('❯')
  ).slice(0, 20);
  for (const line of vitestLines) {
    const trimmed = line.trim();
    if (trimmed) {
      const icon = trimmed.startsWith('✓') || trimmed.includes('PASS') ? '  ✅' :
                   trimmed.startsWith('✗') || trimmed.includes('FAIL') || trimmed.startsWith('×') ? '  ❌' : '   ';
      console.log(`${icon} ${trimmed}`);
    }
  }

  return { passed: vitestResult.passed, durationMs };
}

async function main() {
  const opts = parseArgs();

  if (opts['dry-run']) {
    const model = opts.model || process.env.VTCODE_MODEL || 'claude-sonnet-4-6';
    const provider = opts.provider || process.env.VTCODE_PROVIDER || '(default)';
    console.log('[DRY RUN] Would run vtcode evals with:');
    console.log(`  model:       ${model}`);
    console.log(`  provider:    ${provider}`);
    console.log(`  agents-md:   ${opts['agents-md'] || false}`);
    console.log(`  runs:        ${opts.runs || 1}`);
    console.log(`  timeout:     ${opts.timeout || 600}s`);
    console.log(`  vtcode:      ${opts['vtcode-binary'] || 'vtcode'}`);
    console.log(`  single:      ${opts.single || '(all evals)'}`);
    if (provider === 'huggingface') {
      console.log(`  HF_TOKEN:    ${process.env.HF_TOKEN ? '(set)' : '(NOT SET - required!)'}`);
    }
    console.log('');
    console.log('Evals to run:');
    for (const entry of readdirSync(EVALS_DIR)) {
      if (entry.startsWith('.')) continue;
      const evalDir = join(EVALS_DIR, entry);
      if (!existsSync(join(evalDir, 'PROMPT.md'))) continue;
      console.log(`  - ${entry}`);
    }
    return;
  }

  let model = opts.model || process.env.VTCODE_MODEL || 'claude-sonnet-4-6';
  let provider = opts.provider || process.env.VTCODE_PROVIDER || undefined;

  // Resolve model presets
  const preset = MODEL_PRESETS[model];
  if (preset) {
    model = preset.model;
    if (!provider) provider = preset.provider;
  }

  const vtcodeBinary = opts['vtcode-binary'] || 'vtcode';
  const vtcodeConfig = opts['vtcode-config'] || undefined;
  const timeout = parseInt(opts.timeout || '600', 10);
  const runs = parseInt(opts.runs || '1', 10);
  const agentsMd = opts['agents-md'] === 'true';
  const singleEval = opts.single || undefined;

  // Verify vtcode binary exists
  try {
    execSync(`${vtcodeBinary} --version`, { stdio: 'pipe', timeout: 5000 });
  } catch {
    console.error(`Error: Cannot run '${vtcodeBinary}'. Make sure vtcode is installed and in PATH.`);
    console.error('Tip: build vtcode first with `cargo build` and use `--vtcode-binary /path/to/vtcode`');
    process.exit(1);
  }

  // Check HF_TOKEN for HuggingFace provider
  if (provider === 'huggingface' && !process.env.HF_TOKEN) {
    console.error('Error: HF_TOKEN environment variable is required for HuggingFace provider.');
    console.error('Set it with: export HF_TOKEN=hf_your_token_here');
    console.error('Get a token at: https://huggingface.co/settings/tokens');
    process.exit(1);
  }

  // Verify evals directory
  if (!existsSync(EVALS_DIR)) {
    console.error(`Error: Evals directory not found at ${EVALS_DIR}`);
    console.error('Run `pnpm sync-evals` first to fetch the evals.');
    process.exit(1);
  }

  // Collect evals
  let evalEntries = readdirSync(EVALS_DIR)
    .filter((e) => !e.startsWith('.'))
    .filter((e) => existsSync(join(EVALS_DIR, e, 'PROMPT.md')));

  if (singleEval) {
    if (!evalEntries.includes(singleEval)) {
      console.error(`Error: Eval '${singleEval}' not found in ${EVALS_DIR}`);
      console.error(`Available: ${evalEntries.join(', ')}`);
      process.exit(1);
    }
    evalEntries = [singleEval];
  }

  if (!agentsMd) {
    console.log(`\nAgent: vtcode (${vtcodeBinary})`);
  } else {
    console.log(`\nAgent: vtcode (${vtcodeBinary}) + AGENTS.md`);
  }
  console.log(`Model: ${model}`);
  console.log(`Runs:  ${runs} per eval (${runs * evalEntries.length} total)`);
  console.log(`Timeout: ${timeout}s per run`);
  console.log(`Evals: ${evalEntries.length}\n`);

  const experimentName = opts.experiment || `vtcode-${model.replace(/[/:]/g, '-')}${agentsMd ? '--agents-md' : ''}`;
  const timestamp = getTimestamp();
  const expResultsDir = join(RESULTS_DIR, experimentName, timestamp);
  mkdirSync(expResultsDir, { recursive: true });

  let totalPassed = 0;
  let totalTests = 0;
  let totalDurationMs = 0;

  for (const [idx, evalName] of evalEntries.entries()) {
    const evalDir = join(EVALS_DIR, evalName);
    console.log(`[${idx + 1}/${evalEntries.length}] ${evalName}`);
    console.log(`  ${'-'.repeat(Math.min(70, evalName.length + 6))}`);

    let evalPassedCount = 0;
    const evalDurations: number[] = [];
    const evalErrors: string[] = [];

    for (let run = 1; run <= runs; run++) {
      console.log(`  Run ${run}/${runs}`);
      const result = await runEval(evalName, evalDir, {
        model,
        provider,
        vtcodeBinary,
        vtcodeConfig,
        timeout,
        agentsMd,
        runNumber: run,
        totalRuns: runs,
        experimentName,
      });

      evalPassedCount += result.passed ? 1 : 0;
      evalDurations.push(result.durationMs / 1000); // store in seconds
      totalDurationMs += result.durationMs;

      if (result.error) {
        evalErrors.push(`run ${run}: ${result.error}`);
      }

      const status = result.passed ? 'PASS' : 'FAIL';
      console.log(`  → ${status} (${(result.durationMs / 1000).toFixed(1)}s)`);
      if (result.error) {
        console.log(`    Error: ${result.error}`);
      }

      totalTests++;
      if (result.passed) totalPassed++;
    }

    const meanDuration = evalDurations.length > 0
      ? evalDurations.reduce((a, b) => a + b, 0) / evalDurations.length
      : 0;

    // Write summary.json
    const evalResultDir = join(expResultsDir, evalName);
    mkdirSync(evalResultDir, { recursive: true });

    const summary: EvalResult = {
      totalRuns: runs,
      passedRuns: evalPassedCount,
      passRate: `${Math.round((evalPassedCount / runs) * 100)}%`,
      meanDuration,
      fingerprint: computeFingerprint(evalDir, { agent: 'vtcode', model, timeout }),
    };
    writeFileSync(join(evalResultDir, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');

    // Write error log if any
    if (evalErrors.length > 0) {
      writeFileSync(join(evalResultDir, 'errors.log'), evalErrors.join('\n') + '\n');
    }

    const passStr = evalPassedCount === runs ? '✅' : evalPassedCount > 0 ? '⚠️' : '❌';
    console.log(`  ${passStr} Result: ${evalPassedCount}/${runs} passed (${meanDuration.toFixed(1)}s avg)\n`);
  }

  // Final summary
  const totalDurationMin = (totalDurationMs / 1000 / 60).toFixed(1);
  console.log('='.repeat(60));
  console.log('RESULTS SUMMARY');
  console.log('='.repeat(60));
  console.log(`  Experiment:  ${experimentName}`);
  console.log(`  Model:       ${model}`);
  console.log(`  Total evals: ${evalEntries.length} (${totalTests} runs)`);
  console.log(`  Passed:      ${totalPassed}/${totalTests} (${Math.round((totalPassed / totalTests) * 100)}%)`);
  console.log(`  Duration:    ${totalDurationMin} min`);
  console.log(`  Results:     ${expResultsDir}`);
  console.log('');
  console.log('To export results:');
  console.log(`  npx tsx scripts/export-results.ts ${experimentName}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
