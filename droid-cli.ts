#!/usr/bin/env bun

import fs from "fs/promises";
import path from "path";
import { type DroidResult, runDroidEval } from "./lib/droid-runner";

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
    } else if (arg === "-m" || arg === "--model") {
      values.model = args[++i];
    } else if (!arg.startsWith("-")) {
      positionals.push(arg);
    }
  }

  return { values, positionals };
}

const { values, positionals } = parseCliArgs(process.argv.slice(2));

function showHelp() {
  console.log(`
Droid Evals CLI

Usage:
  droid-cli.ts [options] [eval-path]

Options:
  -h, --help              Show this help message
  -e, --eval <path>       Run a specific eval by path
  -a, --all               Run all evals with Droid
  -v, --verbose           Show detailed logs during eval execution
      --debug             Persist output folders for debugging (don't clean up)
  -t, --timeout <ms>      Timeout in milliseconds (default: 600000 = 10 minutes)
  -m, --model <model>     Model to use (default: claude-sonnet-4-5-20250929)
      --api-key <key>     Factory API key (or use FACTORY_API_KEY env var)
      --output-file <path> Write results to JSON file (only with --all)

Examples:
  # Run a specific eval
  bun droid-cli.ts --eval 001-server-component

  # Run eval by positional argument
  bun droid-cli.ts 001-server-component

  # Run with different model
  bun droid-cli.ts --eval 001-server-component --model gpt-4

  # Run with verbose output and custom timeout
  bun droid-cli.ts --eval 001-server-component --verbose --timeout 600000

  # Run all evals
  bun droid-cli.ts --all

  # Debug mode - keep output folders for inspection
  bun droid-cli.ts --eval 001-server-component --debug

  # Write results to JSON file when running all evals
  bun droid-cli.ts --all --output-file results.json
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

function displayResult(evalPath: string, result: DroidResult) {
  console.log("\n📊 Droid Results:");
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
      console.log(`Droid Error: ${result.error}`);
    }

    if (!result.buildSuccess && result.buildOutput) {
      console.log(`Build Error:\n${result.buildOutput.slice(-1000)}`);
    }

    if (!result.lintSuccess && result.lintOutput) {
      console.log(`Lint Error:\n${result.lintOutput.slice(-1000)}`);
    }

    if (!result.testSuccess && result.testOutput) {
      console.log(`Test Error:\n${result.testOutput.slice(-1000)}`);
    }
  }

  console.log("═".repeat(80));
}

function displayResultsTable(
  results: { evalPath: string; result: DroidResult }[]
) {
  const totalTests = results.length;
  console.log(`\n📊 Droid Results Summary (${totalTests} Tests):`);
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
    droidError?: string;
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
        errors.droidError = result.error;
      }

      if (!result.buildSuccess && result.buildOutput) {
        errors.buildError = result.buildOutput.slice(-500);
      }

      if (!result.lintSuccess && result.lintOutput) {
        errors.lintError = result.lintOutput.slice(-500);
      }

      if (!result.testSuccess && result.testOutput) {
        errors.testError = result.testOutput.slice(-500);
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

      if (failed.droidError) {
        console.log(`  Droid: ${failed.droidError}`);
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

  const evalOptions = {
    verbose: values.verbose || false,
    debug: values.debug || false,
    timeout: values.timeout ? parseInt(values.timeout) : 600000, // 10 minutes default
    model: values.model,
    apiKey: values["api-key"],
  };

  if (values.all) {
    const allEvals = await getAllEvals();
    console.log(`Running ${allEvals.length} evals with Droid...\n`);

    const results: { evalPath: string; result: DroidResult }[] = [];

    for (const evalPath of allEvals) {
      try {
        console.log(`🚀 Running ${evalPath}...`);
        const result = await runDroidEval(evalPath, evalOptions);
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
        const errorResult: DroidResult = {
          success: false,
          output: "",
          error: error instanceof Error ? error.message : String(error),
          duration: 0,
        };
        results.push({ evalPath, result: errorResult });
        console.log(`❌ FAIL ${evalPath} - ${errorResult.error}`);
      }
    }

    displayResultsTable(results);

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

  console.log(`🚀 Running Droid eval: ${evalPath}`);

  try {
    const result = await runDroidEval(evalPath, evalOptions);
    displayResult(evalPath, result);

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
