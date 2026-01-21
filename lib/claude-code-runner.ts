import { runClaudeCodeInSandbox, type SandboxRunnerOptions, type SandboxRunnerResult } from "./sandbox-runner";

export interface ClaudeCodeResult {
  success: boolean;
  output?: string;
  error?: string;
  duration?: number;
  buildSuccess?: boolean;
  lintSuccess?: boolean;
  testSuccess?: boolean;
  buildOutput?: string;
  lintOutput?: string;
  testOutput?: string;
  sandboxId?: string;
  evalPath?: string;
  timestamp?: string;
}

export interface ClaudeCodeEvalOptions {
  timeout?: number;
  verbose?: boolean;
  debug?: boolean;
  devServer?: {
    enabled: boolean;
    command?: string;
    port?: number;
  };
  hooks?: {
    preEval?: string;
    postEval?: string;
  };
  outputFormat?: string;
  outputFile?: string;
}

/**
 * Run Claude Code eval in an isolated Vercel Sandbox.
 *
 * This provides complete filesystem isolation - test files physically don't exist
 * in the sandbox until after the agent runs, preventing any possibility of cheating.
 *
 * ## Unsupported Features in Sandbox Mode
 *
 * The following features from the original local runner are NOT supported in sandbox mode:
 *
 * - **devServer**: Local dev server management is not supported. The sandbox runs
 *   build/lint/test but does not start a persistent dev server.
 *
 * - **hooks (preEval/postEval)**: Pre and post eval shell scripts are not supported.
 *   The sandbox environment is isolated and doesn't have access to local hook scripts.
 *
 * - **visualDiff**: Screenshot capture and visual regression testing is not supported.
 *   This would require running Playwright inside the sandbox which adds complexity.
 *
 * - **debug**: The debug option to persist output folders is not applicable since
 *   the sandbox is ephemeral and destroyed after each run.
 *
 * - **API keys**: The sandbox uses AI_GATEWAY_API_KEY environment variable exclusively
 *   for Vercel AI Gateway authentication. No custom API key option is provided.
 *
 * - **MCP config**: Loading .mcp.json for MCP servers is not supported in sandbox mode.
 *
 * - **useWorktree**: Git worktree isolation is replaced by sandbox isolation which
 *   provides stronger guarantees (physical file isolation vs filesystem isolation).
 *
 * @param evalPath - The eval directory name (e.g., "001-server-component")
 * @param options - Configuration options
 * @param _useWorktree - Deprecated, ignored (sandbox provides better isolation)
 */
export async function runClaudeCodeEval(
  evalPath: string,
  options: ClaudeCodeEvalOptions = {},
  _useWorktree: boolean = false
): Promise<ClaudeCodeResult> {
  const sandboxOptions: SandboxRunnerOptions = {
    timeout: options.timeout,
    verbose: options.verbose,
  };

  // Log warnings for unsupported options
  if (options.devServer?.enabled) {
    console.warn("⚠️  devServer option is not supported in sandbox mode");
  }
  if (options.hooks?.preEval || options.hooks?.postEval) {
    console.warn("⚠️  hooks (preEval/postEval) are not supported in sandbox mode");
  }
  if (options.visualDiff) {
    console.warn("⚠️  visualDiff option is not supported in sandbox mode");
  }
  if (options.debug) {
    console.warn("⚠️  debug option is not supported in sandbox mode (sandbox is ephemeral)");
  }

  const result: SandboxRunnerResult = await runClaudeCodeInSandbox(evalPath, sandboxOptions);

  return {
    success: result.success,
    output: result.output,
    error: result.error,
    duration: result.duration,
    buildSuccess: result.buildSuccess,
    lintSuccess: result.lintSuccess,
    testSuccess: result.testSuccess,
    buildOutput: result.buildOutput,
    lintOutput: result.lintOutput,
    testOutput: result.testOutput,
    sandboxId: result.sandboxId,
    evalPath,
    timestamp: new Date().toISOString(),
  };
}
