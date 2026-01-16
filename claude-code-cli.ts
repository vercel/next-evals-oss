#!/usr/bin/env bun

import fs from "fs/promises";
import path from "path";
import {
  type ClaudeCodeResult,
  runClaudeCodeEval,
} from "./lib/claude-code-runner";

// Simple argument parser for Bun compatibility
function parseCliArgs(args: string[]) {
  const values: Record<string, any> = {};
  const positionals: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "-h" || arg === "--help") {
      values.help = true;
    } else if (arg === "-a" || arg === "--all") {
      values.all = true;
    } else if (arg === "-v" || arg === "--verbose") {
      values.verbose = true;
    } else if (arg === "--debug") {
      values.debug = true;
    } else if (arg === "-e" || arg === "--eval") {
      values.eval = args[++i];
    } else if (arg === "-t" || arg === "--timeout") {
      values.timeout = args[++i];
    } else if (arg === "--api-key") {
      values["api-key"] = args[++i];
    } else if (arg === "--pre-eval") {
      values["pre-eval"] = args[++i];
    } else if (arg === "--post-eval") {
      values["post-eval"] = args[++i];
    } else if (arg === "--output-file") {
      values["output-file"] = args[++i];
    } else if (arg === "--nextjs-docs") {
      values["nextjs-docs"] = true;
    } else if (!arg.startsWith("-")) {
      positionals.push(arg);
    }
  }

  return { values, positionals };
}

const { values, positionals } = parseCliArgs(process.argv.slice(2));

function showHelp() {
  console.log(`
Claude Code Evals CLI

Usage:
  claude-code-cli.ts [options] [eval-path]

Options:
  -h, --help              Show this help message
  -e, --eval <path>       Run a specific eval by path
  -a, --all               Run all evals with Claude Code
  -v, --verbose           Show detailed logs during eval execution
      --debug             Persist output folders for debugging (don't clean up)
  -t, --timeout <ms>      Timeout in milliseconds (default: 600000 = 10 minutes)
      --api-key <key>     Anthropic API key (or use ANTHROPIC_API_KEY env var)
      --pre-eval <script> Path to bash script to run before eval starts
      --post-eval <script> Path to bash script to run after eval completes
      --output-file <path> Write results to JSON file (only with --all)
      --nextjs-docs       Run next-skills to generate CLAUDE.md with Next.js docs before eval

Examples:
  # Run a specific eval
  bun claude-code-cli.ts --eval 001-server-component

  # Run eval by positional argument
  bun claude-code-cli.ts 001-server-component

  # Run with verbose output and custom timeout
  bun claude-code-cli.ts --eval 001-server-component --verbose --timeout 600000

  # Run all evals
  bun claude-code-cli.ts --all

  # Debug mode - keep output folders for inspection
  bun claude-code-cli.ts --eval 001-server-component --debug

  # Run with hooks for MCP setup
  bun claude-code-cli.ts --eval 001-server-component \\
    --pre-eval ./scripts/eval-hooks/nextjs-mcp-pre.sh \\
    --post-eval ./scripts/eval-hooks/nextjs-mcp-post.sh

  # Write results to JSON file when running all evals
  bun claude-code-cli.ts --all --output-file results.json
`);
}

async function getAllEvals(): Promise<string[]> {
  const evalsDir = path.join(process.cwd(), "evals");
  const entries = await fs.readdir(evalsDir, { withFileTypes: true });

  const evals: string[] = [];

  for (const entry of entries) {
    if (entry.isDirectory() && /^\d+/.test(entry.name)) {
      const evalPath = path.join(evalsDir, entry.name);
      // Check if it has both input/ directory and prompt.md
      const hasInput = await fs
        .stat(path.join(evalPath, "input"))
        .then((s) => s.isDirectory())
        .catch(() => false);
      const hasPrompt = await fs
        .stat(path.join(evalPath, "prompt.md"))
        .then((s) => s.isFile())
        .catch(() => false);

      if (hasInput && hasPrompt) {
        evals.push(entry.name);
      }
    }
  }

  return evals.sort();
}

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  } else {
    const seconds = ms / 1000;
    return `${seconds.toFixed(1)}s`;
  }
}

function displayResult(evalPath: string, result: ClaudeCodeResult, nextjsDocs: boolean = false) {
  const mode = nextjsDocs ? "Claude Code + Next.js Docs" : "Claude Code";
  console.log(`\n📊 ${mode} Results:`);
  console.log("═".repeat(80));

  const evalColWidth = Math.max(25, evalPath.length);
  const header = `| ${"Eval".padEnd(
    evalColWidth
  )} | Result     | Build | Lint  | Tests | Duration |`;
  const separator = `|${"-".repeat(
    evalColWidth + 2
  )}|------------|-------|-------|-------|----------|`;

  console.log(header);
  console.log(separator);

  const name = evalPath.padEnd(evalColWidth);
  const build = result.buildSuccess ? "✅" : "❌";
  const lint = result.lintSuccess ? "✅" : "❌";
  const tests = result.testSuccess ? "✅" : "❌";
  const allPassed =
    result.buildSuccess && result.lintSuccess && result.testSuccess;
  const resultStatus = allPassed ? "✅ PASS" : "❌ FAIL";
  const duration = formatDuration(result.duration);

  console.log(
    `| ${name} | ${resultStatus.padEnd(
      10
    )} | ${build}    | ${lint}   | ${tests}   | ${duration.padEnd(8)} |`
  );

  console.log("═".repeat(80));

  if (!allPassed || !result.success) {
    console.log("\n❌ Error Details:");
    console.log("─".repeat(80));

    if (result.error) {
      console.log(`Claude Code Error: ${result.error}`);
    }

    if (!result.buildSuccess && result.buildOutput) {
      console.log(`Build Error:\n${result.buildOutput.slice(-3000)}`);
    }

    if (!result.lintSuccess && result.lintOutput) {
      console.log(`Lint Error:\n${result.lintOutput.slice(-3000)}`);
    }

    if (!result.testSuccess && result.testOutput) {
      console.log(`Test Error:\n${result.testOutput.slice(-3000)}`);
    }
  }

  console.log("═".repeat(80));
}

function displayResultsTable(
  results: { evalPath: string; result: ClaudeCodeResult }[],
  nextjsDocs: boolean = false
) {
  const totalTests = results.length;
  const mode = nextjsDocs ? "Claude Code + Next.js Docs" : "Claude Code";
  console.log(`\n📊 ${mode} Results Summary (${totalTests} Tests):`);
  console.log("═".repeat(120));

  const header = `| ${"Eval".padEnd(
    25
  )} | Result     | Build | Lint  | Tests | Duration |`;
  const separator = `|${"-".repeat(
    27
  )}|------------|-------|-------|-------|----------|`;

  console.log(header);
  console.log(separator);

  const failedEvals: Array<{
    evalPath: string;
    buildError?: string;
    lintError?: string;
    testError?: string;
    claudeError?: string;
  }> = [];

  let passedEvals = 0;

  for (const { evalPath, result } of results) {
    const name = evalPath.padEnd(25);
    const build = result.buildSuccess ? "✅" : "❌";
    const lint = result.lintSuccess ? "✅" : "❌";
    const tests = result.testSuccess ? "✅" : "❌";
    const allPassed =
      result.success &&
      result.buildSuccess &&
      result.lintSuccess &&
      result.testSuccess;
    const resultStatus = allPassed ? "✅ PASS" : "❌ FAIL";
    const duration = formatDuration(result.duration);

    if (allPassed) {
      passedEvals++;
    }

    console.log(
      `| ${name} | ${resultStatus.padEnd(
        10
      )} | ${build}    | ${lint}   | ${tests}   | ${duration.padEnd(8)} |`
    );

    // Collect errors for failed evals
    if (!allPassed) {
      const errors: any = { evalPath };

      if (result.error) {
        errors.claudeError = result.error;
      }

      if (!result.buildSuccess && result.buildOutput) {
        errors.buildError = result.buildOutput.slice(-1500);
      }

      if (!result.lintSuccess && result.lintOutput) {
        errors.lintError = result.lintOutput.slice(-1500);
      }

      if (!result.testSuccess && result.testOutput) {
        errors.testError = result.testOutput.slice(-1500);
      }

      failedEvals.push(errors);
    }
  }

  console.log("═".repeat(120));

  // Summary stats
  console.log(`\n📈 Summary: ${passedEvals}/${totalTests} evals passed`);

  // Display error summaries
  if (failedEvals.length > 0) {
    console.log("\n❌ Error Summaries:");
    console.log("─".repeat(120));

    for (const failed of failedEvals) {
      console.log(`\n${failed.evalPath}:`);

      if (failed.claudeError) {
        console.log(`  Claude Code: ${failed.claudeError}`);
      }

      if (failed.buildError) {
        console.log(`  Build: ${failed.buildError}`);
      }

      if (failed.lintError) {
        console.log(`  Lint: ${failed.lintError}`);
      }

      if (failed.testError) {
        console.log(`  Tests: ${failed.testError}`);
      }
    }
  }
}

async function main() {
  if (values.help) {
    showHelp();
    return;
  }

  // Check for API key
  const apiKey = values["api-key"] || process.env.ANTHROPIC_API_KEY;

  const evalOptions = {
    verbose: values.verbose || false,
    debug: values.debug || false,
    timeout: values.timeout ? parseInt(values.timeout) : 600000, // 10 minutes default
    apiKey,
    nextjsDocs: values["nextjs-docs"] || false,
    ...(values["pre-eval"] || values["post-eval"]
      ? {
          hooks: {
            preEval: values["pre-eval"],
            postEval: values["post-eval"],
          },
        }
      : {}),
  };

  if (values.all) {
    const allEvals = await getAllEvals();
    const mode = evalOptions.nextjsDocs ? "Claude Code + Next.js Docs" : "Claude Code";
    console.log(`Running ${allEvals.length} evals with ${mode}...\n`);

    const results: { evalPath: string; result: ClaudeCodeResult }[] = [];

    for (const evalPath of allEvals) {
      try {
        console.log(`🚀 Running ${evalPath}...`);
        const result = await runClaudeCodeEval(evalPath, evalOptions);
        results.push({ evalPath, result });

        const status =
          result.success &&
          result.buildSuccess &&
          result.lintSuccess &&
          result.testSuccess
            ? "✅ PASS"
            : "❌ FAIL";
        console.log(
          `${status} ${evalPath} (${formatDuration(result.duration)})`
        );
      } catch (error) {
        const errorResult: ClaudeCodeResult = {
          success: false,
          output: "",
          error: error instanceof Error ? error.message : String(error),
          duration: 0,
        };
        results.push({ evalPath, result: errorResult });
        console.log(`❌ FAIL ${evalPath} - ${errorResult.error}`);
      }
    }

    displayResultsTable(results, evalOptions.nextjsDocs);

    // Write all results to file if outputFile is specified
    if (values["output-file"]) {
      try {
        await fs.writeFile(
          values["output-file"],
          JSON.stringify(results, null, 2),
          "utf-8"
        );
        console.log(`\n📝 All results written to: ${values["output-file"]}`);
      } catch (error) {
        console.error(
          `⚠️  Failed to write results to file: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }

    return;
  }

  const evalPath = values.eval || positionals[0];
  if (!evalPath) {
    console.error(
      "❌ Error: No eval specified. Use --eval <path>, provide a positional argument, or use --all"
    );
    console.log("\nAvailable evals:");
    const allEvals = await getAllEvals();
    // biome-ignore lint/suspicious/useIterableCallbackReturn: cautious
    allEvals.forEach((evalName) => console.log(`  ${evalName}`));
    process.exit(1);
  }

  const mode = evalOptions.nextjsDocs ? "Claude Code + Next.js Docs" : "Claude Code";
  console.log(`🚀 Running ${mode} eval: ${evalPath}`);

  try {
    const result = await runClaudeCodeEval(evalPath, evalOptions);
    displayResult(evalPath, result, evalOptions.nextjsDocs);

    const success =
      result.success &&
      result.buildSuccess &&
      result.lintSuccess &&
      result.testSuccess;
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error(
      `❌ Error: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  }
}

// @ts-expect-error
if (import.meta.main) {
  main().catch((error) => {
    console.error("Unexpected error:", error);
    process.exit(1);
  });
}
