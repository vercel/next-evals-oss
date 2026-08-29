#!/usr/bin/env bun


import fs from "fs/promises";
import path from "path";
import { parseArgs } from "util";
import { runBlackboxEval, BlackboxResult } from "./lib/blackbox-runner";

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    help: { type: "boolean", short: "h" },
    eval: { type: "string", short: "e" },
    all: { type: "boolean", short: "a" },
    verbose: { type: "boolean", short: "v" },
    debug: { type: "boolean" },
    dry: { type: "boolean", short: "d" },
    timeout: { type: "string", short: "t" },
    "api-key": { type: "string" },
    model: { type: "string", short: "m" },
    "output-file": { type: "string" },
  },
  allowPositionals: true,
});

function showHelp() {
  console.log(`
Blackbox Evals CLI

Usage:
  blackbox-cli.ts [options] [eval-path]

  Note: 
  - Make sure to set OPENAI_API_KEY or --api-key option. 
  - Make sure to set OPENAI_BASE_URL to the base url of the API you want to use. Defaults to openrouter Base URL.
  - Make sure to set OPENAI_MODEL to the model you want to use. Defaults to anthropic/claude-sonnet-4.5.

Options:
  -h, --help                  Show this help message
  -e, --eval <path>           Run a specific eval by path
  -a, --all                   Run all evals with Blackbox
  -v, --verbose               Show detailed logs during eval execution
      --debug                 Persist output folders for debugging (don't clean up)
  -d, --dry                   Alias for --debug (preserve output folder)
  -t, --timeout <ms>          Timeout in milliseconds (default: 600000 = 10 minutes)
      --api-key <key>         Blackbox API key (or use BLACKBOX_API_KEY env var)
  -m, --model <model>         Model to use (passed to blackbox as -m <model>)
      --output-file <path>    Custom path for results file (default: results/blackbox-*.json)

Results are automatically written to the results/ directory.

Examples:
  # Run a specific eval (results auto-saved to results/blackbox-*.json)
  bun blackbox-cli.ts --eval 001-server-component

  # Run eval by positional argument
  bun blackbox-cli.ts 001-server-component

  # Run with verbose output and custom timeout
  bun blackbox-cli.ts --eval 001-server-component --verbose --timeout 600000

  # Run with specific model
  bun blackbox-cli.ts --eval 001-server-component --model blackbox-xyz

  # Run all evals (results auto-saved to results/blackbox-all-*.json)
  bun blackbox-cli.ts --all

  # Debug mode - keep output folders for inspection
  bun blackbox-cli.ts --eval 001-server-component --debug

  # Write results to custom location
  bun blackbox-cli.ts --eval 001-server-component --output-file my-results.json
`);
}

async function getAllEvals(): Promise<string[]> {
  const evalsDir = path.join(process.cwd(), "evals");
  const entries = await fs.readdir(evalsDir, { withFileTypes: true });

  const evals: string[] = [];

  for (const entry of entries) {
    if (entry.isDirectory() && /^\d+/.test(entry.name)) {
      const evalPath = path.join(evalsDir, entry.name);
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
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function displayResult(evalPath: string, result: BlackboxResult) {
  console.log("\n📊 Blackbox Results:");
  console.log("═".repeat(80));

  const evalColWidth = Math.max(25, evalPath.length);
  const header = `| ${"Eval".padEnd(evalColWidth)} | Result     | Build | Lint  | Tests | Duration |`;
  const separator = `|${"-".repeat(evalColWidth + 2)}|------------|-------|-------|-------|----------|`;

  console.log(header);
  console.log(separator);

  const name = evalPath.padEnd(evalColWidth);
  const build = result.buildSuccess ? "✅" : "❌";
  const lint = result.lintSuccess ? "✅" : "❌";
  const tests = result.testSuccess ? "✅" : "❌";
  const allPassed = result.buildSuccess && result.lintSuccess && result.testSuccess;
  const resultStatus = allPassed ? "✅ PASS" : "❌ FAIL";
  const duration = formatDuration(result.duration);

  console.log(
    `| ${name} | ${resultStatus.padEnd(10)} | ${build}    | ${lint}   | ${tests}   | ${duration.padEnd(8)} |`,
  );

  console.log("═".repeat(80));

  if (!allPassed || !result.success) {
    console.log("\n❌ Error Details:");
    console.log("─".repeat(80));

    if (result.error) {
      console.log(`Blackbox Error: ${result.error}`);
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

function displayResultsTable(results: { evalPath: string; result: BlackboxResult }[]) {
  const totalTests = results.length;
  console.log(`\n📊 Blackbox Results Summary (${totalTests} Tests):`);
  console.log("═".repeat(120));

  const header = `| ${"Eval".padEnd(25)} | Result     | Build | Lint  | Tests | Duration |`;
  const separator = `|${"-".repeat(27)}|------------|-------|-------|-------|----------|`;

  console.log(header);
  console.log(separator);

  const failedEvals: Array<{
    evalPath: string;
    buildError?: string;
    lintError?: string;
    testError?: string;
    blackboxError?: string;
  }> = [];

  let passedEvals = 0;

  for (const { evalPath, result } of results) {
    const name = evalPath.padEnd(25);
    const build = result.buildSuccess ? "✅" : "❌";
    const lint = result.lintSuccess ? "✅" : "❌";
    const tests = result.testSuccess ? "✅" : "❌";
    const allPassed = result.success && result.buildSuccess && result.lintSuccess && result.testSuccess;
    const resultStatus = allPassed ? "✅ PASS" : "❌ FAIL";
    const duration = formatDuration(result.duration);

    if (allPassed) {
      passedEvals++;
    }

    console.log(
      `| ${name} | ${resultStatus.padEnd(10)} | ${build}    | ${lint}   | ${tests}   | ${duration.padEnd(8)} |`,
    );

    if (!allPassed) {
      const errors: any = { evalPath };

      if (result.error) {
        errors.blackboxError = result.error;
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

  console.log(`\n📈 Summary: ${passedEvals}/${totalTests} evals passed`);

  if (failedEvals.length > 0) {
    console.log("\n❌ Error Summaries:");
    console.log("─".repeat(120));

    for (const failed of failedEvals) {
      console.log(`\n${failed.evalPath}:`);

      if (failed.blackboxError) {
        console.log(`  Blackbox: ${failed.blackboxError}`);
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

  const apiKey = values["api-key"] || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("❌ Error: API key is required.");
    console.error("Set OPENAI_API_KEY environment variable or use --api-key option. By default the base url is set to openrouter Base URL. Set OPENAI_BASE_URL to change.");
    process.exit(1);
  }

  const model = values["model"] || process.env.OPENAI_MODEL
  if (!model){
    values["model"] = "anthropic/claude-sonnet-4.5"
    console.log("⚠️ OPENAI_MODEL environment variable or --model argument is not set, defaulting the model to `anthropic/claude-sonnet-4.5`")
  }

  const evalOptions = {
    verbose: values.verbose || false,
    debug: values.debug || values.dry || false,
    dry: values.dry || false,
    timeout: values.timeout ? parseInt(values.timeout) : 600000,
    apiKey,
    model: values.model,
    outputFile: values["output-file"],
  };

  if (values.all) {
    const allEvals = await getAllEvals();
    console.log(
      `Running ${allEvals.length} evals with Blackbox...${values.model ? ` (model: ${values.model})` : ""}\n`,
    );

    if(values.model){
      process.env.OPENAI_MODEL = values.model
    }

    const results: { evalPath: string; result: BlackboxResult }[] = [];
    const individualEvalOptions = { ...evalOptions, skipFileWrite: true };

    for (const evalPath of allEvals) {
      try {
        console.log(`🚀 Running ${evalPath}...`);
        const result = await runBlackboxEval(evalPath, individualEvalOptions);
        results.push({ evalPath, result });

        const status = result.success && result.buildSuccess && result.lintSuccess && result.testSuccess ? "✅ PASS" : "❌ FAIL";
        console.log(`${status} ${evalPath} (${formatDuration(result.duration)})`);
      } catch (error) {
        const errorResult: BlackboxResult = {
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

    let allResultsFile = evalOptions.outputFile;
    if (!allResultsFile) {
      const resultsDir = path.join(process.cwd(), "results");
      await fs.mkdir(resultsDir, { recursive: true });
      const timestamp = Date.now();
      allResultsFile = path.join(resultsDir, `blackbox-all-${timestamp}.json`);
    }

    try {
      await fs.writeFile(allResultsFile, JSON.stringify(results, null, 2), "utf-8");
      console.log(`\n📝 All results written to: ${allResultsFile}`);
    } catch (error) {
      console.error(
        `⚠️  Failed to write results to file: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return;
  }

  const evalPath = values.eval || positionals[0];
  if (!evalPath) {
    console.error("❌ Error: No eval specified. Use --eval <path>, provide a positional argument, or use --all");
    console.log("\nAvailable evals:");
    const allEvals = await getAllEvals();
    allEvals.forEach((evalName) => console.log(`  ${evalName}`));
    process.exit(1);
  }

  console.log(`🚀 Running Blackbox eval: ${evalPath}${values.model ? ` (model: ${values.model})` : ""}`);

  try {
    const result = await runBlackboxEval(evalPath, evalOptions);
    displayResult(evalPath, result);

    const success = result.success && result.buildSuccess && result.lintSuccess && result.testSuccess;
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

// @ts-ignore
if (import.meta.main) {
  main().catch((error) => {
    console.error("Unexpected error:", error);
    process.exit(1);
  });
}

