#!/usr/bin/env bun

import fs from "fs/promises";
import path from "path";
import { parseArgs } from "util";
import { runMistralAgentEval, MistralAgentResult } from "./lib/mistral-agent-runner";

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    help: { type: "boolean", short: "h" },
    eval: { type: "string", short: "e" },
    all: { type: "boolean", short: "a" },
    verbose: { type: "boolean", short: "v" },
    debug: { type: "boolean" },
    timeout: { type: "string", short: "t" },
    "api-key": { type: "string" },
    force: { type: "boolean", short: "f" },
    "output-format": { type: "string", short: "o" },
    "output-file": { type: "string" },
    "save-output": { type: "boolean", short: "s" },
    "model-name": { type: "string", short: "m" },
  },
  allowPositionals: true,
});

function showHelp() {
  console.log(`
Mistral Agent Evals CLI (vibe)

Usage:
  vibe [options] [eval-path]

Options:
  -h, --help                  Show this help message
  -e, --eval <path>           Run a specific eval by path
  -a, --all                   Run all evals with Mistral Agent
  -v, --verbose               Show detailed logs during eval execution
      --debug                 Persist output folders for debugging (don't clean up)
  -t, --timeout <ms>          Timeout in milliseconds (default: 600000 = 10 minutes)
      --api-key <key>         Mistral API key (or use MISTRAL_API_KEY env var)
  -f, --force                 Auto-approve all tool executions (default: enabled)
  -o, --output-format <fmt>   Output format: text, json, or streaming (default: text)
      --output-file <path>    Write results to JSON file
  -s, --save-output           Save output to evals/{eval-name}/output-dry-{model} folder
  -m, --model-name <name>     Model name for output folder (default: mistral-large-latest)

Examples:
  # Run a specific eval
  bun vibe --eval 001-server-component

  # Run eval by positional argument
  bun vibe 001-server-component

  # Run with verbose output and custom timeout
  bun vibe --eval 001-server-component --verbose --timeout 600000

  # Run all evals
  bun vibe --all

  # Run with file modifications enabled
  bun vibe --eval 001-server-component --force

  # Debug mode - keep output folders for inspection
  bun vibe --eval 001-server-component --debug

  # Write results to JSON file
  bun vibe --eval 001-server-component --output-file results-mistral.json

  # Save output to output-dry folder for comparison
  bun vibe --eval 001-server-component --save-output
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

function displayResult(evalPath: string, result: MistralAgentResult) {
  console.log("\n📊 Mistral Agent Results:");
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
    `| ${name} | ${resultStatus.padEnd(10)} | ${build}    | ${lint}   | ${tests}   | ${duration.padEnd(8)} |`
  );

  console.log("═".repeat(80));

  if (!allPassed || !result.success) {
    console.log("\n❌ Error Details:");
    console.log("─".repeat(80));

    if (result.error) {
      console.log(`Mistral Agent Error: ${result.error}`);
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

function displayResultsTable(results: { evalPath: string; result: MistralAgentResult }[]) {
  const totalTests = results.length;
  console.log(`\n📊 Mistral Agent Results Summary (${totalTests} Tests):`);
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
    mistralError?: string;
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
      `| ${name} | ${resultStatus.padEnd(10)} | ${build}    | ${lint}   | ${tests}   | ${duration.padEnd(8)} |`
    );

    // Collect errors for failed evals
    if (!allPassed) {
      const errors: any = { evalPath };

      if (result.error) {
        errors.mistralError = result.error;
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

      if (failed.mistralError) {
        console.log(`  Mistral Agent: ${failed.mistralError}`);
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
  const apiKey = values["api-key"] || process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    console.error("❌ Error: Mistral API key is required.");
    console.error("Set MISTRAL_API_KEY environment variable or use --api-key option.");
    process.exit(1);
  }

  const evalOptions = {
    verbose: values.verbose || false,
    debug: values.debug || false,
    timeout: values.timeout ? parseInt(values.timeout) : 600000, // 10 minutes default
    apiKey,
    force: values.force !== undefined ? values.force : true, // Default to true for auto-approval
    outputFormat: values["output-format"] || "text",
    outputFile: values["output-file"],
    saveOutput: values["save-output"] || false,
    modelName: values["model-name"] || "mistral-large-latest",
  };

  if (values.all) {
    const allEvals = await getAllEvals();
    console.log(`Running ${allEvals.length} evals with Mistral Agent...\n`);

    const results: { evalPath: string; result: MistralAgentResult }[] = [];

    // Don't pass outputFile to individual runs - we'll write all results at the end
    const individualEvalOptions = { ...evalOptions, outputFile: undefined };

    for (const evalPath of allEvals) {
      try {
        console.log(`🚀 Running ${evalPath}...`);
        const result = await runMistralAgentEval(evalPath, individualEvalOptions);
        results.push({ evalPath, result });

        const status = result.success && result.buildSuccess && result.lintSuccess && result.testSuccess
          ? "✅ PASS"
          : "❌ FAIL";
        console.log(`${status} ${evalPath} (${formatDuration(result.duration)})`);

      } catch (error) {
        const errorResult: MistralAgentResult = {
          success: false,
          output: "",
          error: error instanceof Error ? error.message : String(error),
          duration: 0,
          buildSuccess: false,
          lintSuccess: false,
          testSuccess: false,
        };
        results.push({ evalPath, result: errorResult });
        console.log(`❌ FAIL ${evalPath} - ${errorResult.error}`);
      }
    }

    displayResultsTable(results);

    // Write all results to file if outputFile is specified
    if (evalOptions.outputFile) {
      try {
        await fs.writeFile(
          evalOptions.outputFile,
          JSON.stringify(results, null, 2),
          "utf-8"
        );
        console.log(`\n📝 All results written to: ${evalOptions.outputFile}`);
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
    console.error("❌ Error: No eval specified. Use --eval <path>, provide a positional argument, or use --all");
    console.log("\nAvailable evals:");
    const allEvals = await getAllEvals();
    allEvals.forEach((evalName) => console.log(`  ${evalName}`));
    process.exit(1);
  }

  console.log(`🚀 Running Mistral Agent eval: ${evalPath}`);

  try {
    const result = await runMistralAgentEval(evalPath, evalOptions);
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
