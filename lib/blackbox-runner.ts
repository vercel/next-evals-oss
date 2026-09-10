import fs from "fs/promises";
import path from "path";
import { spawn, ChildProcess } from "child_process";
import { performance } from "perf_hooks";
import { copyFolder, ensureSharedDependencies } from "./eval-runner";

export interface BlackboxResult {
  success: boolean;
  output: string;
  error?: string;
  duration: number;
  buildSuccess?: boolean;
  lintSuccess?: boolean;
  testSuccess?: boolean;
  buildOutput?: string;
  lintOutput?: string;
  testOutput?: string;
  evalPath?: string;
  timestamp?: string;
}

export interface BlackboxEvalOptions {
  timeout?: number;
  verbose?: boolean;
  debug?: boolean;
  apiKey?: string;
  model?: string;
  outputFile?: string;
  skipFileWrite?: boolean;
  dry?: boolean;
}

export class BlackboxRunner {
  private processes = new Map<string, ChildProcess>();
  private verbose: boolean;
  private debug: boolean;
  private apiKey?: string;
  private model?: string;

  constructor(options: BlackboxEvalOptions = {}) {
    this.verbose = options.verbose || false;
    this.debug = options.debug || false;
    this.apiKey = options.apiKey || process.env.OPENAI_API_KEY;
    this.model = options.model || process.env.OPENAI_MODEL;
  }

  async runBlackboxEval(
    inputDir: string,
    outputDir: string,
    prompt: string,
    timeout: number = 600000, // 10 minutes default
  ): Promise<BlackboxResult> {
    const startTime = performance.now();

    try {
      await fs.mkdir(outputDir, { recursive: true });
      await copyFolder(inputDir, outputDir, true); // Exclude test files so blackbox doesn't see them

      await ensureSharedDependencies(this.verbose);

      if (this.verbose) {
        console.log(`🤖 Running Blackbox on ${outputDir}...`);
        console.log(`📝 Prompt: ${prompt}`);
        console.log("─".repeat(80));
      }

      const blackboxResult = await this.executeBlackbox(outputDir, prompt, timeout);

      if (!blackboxResult.success) {
        return {
          success: false,
          output: blackboxResult.output,
          error: blackboxResult.error,
          duration: performance.now() - startTime,
        };
      }

      if (this.verbose) {
        console.log("📋 Copying test files and eslint config back for evaluation...");
      }
      await this.copyTestFilesBack(inputDir, outputDir);

      const evalResults = await this.runEvaluation(outputDir);

      return {
        success: true,
        output: blackboxResult.output,
        duration: performance.now() - startTime,
        buildSuccess: evalResults.buildSuccess,
        lintSuccess: evalResults.lintSuccess,
        testSuccess: evalResults.testSuccess,
        buildOutput: evalResults.buildOutput,
        lintOutput: evalResults.lintOutput,
        testOutput: evalResults.testOutput,
      };
    } catch (error) {
      return {
        success: false,
        output: "",
        error: error instanceof Error ? error.message : String(error),
        duration: performance.now() - startTime,
      };
    } finally {
      if (!this.debug) {
        try {
          await fs.rm(outputDir, { recursive: true, force: true });
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  }

  private async executeBlackbox(
    projectDir: string,
    prompt: string,
    timeout?: number,
  ): Promise<{ success: boolean; output: string; error?: string }> {
    return new Promise((resolve) => {
      const processId = Math.random().toString(36).substr(2, 9);
      const startTime = Date.now();

      const enhancedPrompt = `${prompt}

IMPORTANT: Do not run any pnpm, npm, or yarn commands (like pnpm dev, npm run dev, pnpm install, etc.). Do not start any development servers. Just make the necessary code changes to the files and exit when done. Do not ask any followup questions either.`;

      const env = { ...process.env };
      if (this.apiKey) {
        env.OPENAI_API_KEY = this.apiKey;
      }

      const args = ["-y","--include-directories", projectDir];
      if (this.model) {
        args.push("-m", this.model);
      }

      if (this.verbose) {
        console.log("🚀 Spawning blackbox process with:");
        console.log("  Command: blackbox");
        console.log("  Args:", args);
        console.log("  Working Directory:", projectDir);
        console.log("  API Key present:", !!this.apiKey);
        if (this.model) {
          console.log("  Model:", this.model);
        }
        console.log("  Prompt length:", enhancedPrompt.length, "chars");
      }

      const blackboxProcess = spawn("blackbox", args, {
        cwd: projectDir,
        env,
        stdio: ["pipe", "pipe", "pipe"],
      });
      this.processes.set(processId, blackboxProcess);

      if (blackboxProcess.stdin) {
        blackboxProcess.stdin.write(enhancedPrompt);
        blackboxProcess.stdin.end();
      }

      let stdout = "";
      let stderr = "";
      let lastOutputTime = startTime;
      let resolved = false;

      const idleTimeoutMs = 90000; // 90 second idle timeout
      let idleTimeoutHandle: NodeJS.Timeout | null = null;

      function resolveOnce(result: { success: boolean; output: string; error?: string }) {
        if (resolved) return;
        resolved = true;
        clearTimeout(absoluteTimeoutId);
        if (idleTimeoutHandle) clearTimeout(idleTimeoutHandle);
        clearInterval(heartbeat);
        resolve(result);
      }

      function resetIdleTimeout() {
        if (idleTimeoutHandle) clearTimeout(idleTimeoutHandle);

        idleTimeoutHandle = setTimeout(() => {
          const sinceLastOutput = Date.now() - lastOutputTime;
          console.log(
            `⏱️  Idle timeout reached (${(sinceLastOutput / 1000).toFixed(1)}s since last output)`,
          );
          console.log(`🛑 Forcefully terminating blackbox process ${blackboxProcess.pid}...`);
          blackboxProcess.kill("SIGTERM");

          setTimeout(() => {
            if (!resolved) {
              console.log("🛑 Process didn't respond to SIGTERM, using SIGKILL...");
              blackboxProcess.kill("SIGKILL");
            }
          }, 5000);
        }, idleTimeoutMs);
      }

      resetIdleTimeout();

      const heartbeat = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const sinceLastOutput = Date.now() - lastOutputTime;
        console.log(
          `⏳ Blackbox still running... (${(elapsed / 1000).toFixed(1)}s elapsed, ${(sinceLastOutput / 1000).toFixed(1)}s since last output)`,
        );
      }, 5000);

      blackboxProcess.stdout?.on("data", (data) => {
        const output = data.toString();
        lastOutputTime = Date.now();
        resetIdleTimeout();
        process.stdout.write(`[blackbox stdout] ${output}`);
        if (this.verbose) {
          console.log(`[DEBUG] stdout bytes: ${JSON.stringify(output)}`);
        }
        stdout += output;
      });

      blackboxProcess.stderr?.on("data", (data) => {
        const output = data.toString();
        lastOutputTime = Date.now();
        resetIdleTimeout();
        process.stderr.write(`[blackbox stderr] ${output}`);
        if (this.verbose) {
          console.log(`[DEBUG] stderr bytes: ${JSON.stringify(output)}`);
        }
        stderr += output;
      });

      const absoluteTimeoutId = setTimeout(() => {
        console.log(`⏱️  Absolute timeout reached (${timeout}ms)`);
        blackboxProcess.kill("SIGTERM");
        setTimeout(() => {
          blackboxProcess.kill("SIGKILL");
        }, 5000);
        resolveOnce({
          success: false,
          output: stdout,
          error: `Blackbox process timed out after ${timeout}ms`,
        });
      }, timeout);

      blackboxProcess.on("exit", (code, signal) => {
        const elapsed = Date.now() - startTime;
        if (this.verbose) {
          console.log(
            `✓ Blackbox process exited with code: ${code}, signal: ${signal} after ${(elapsed / 1000).toFixed(1)}s`,
          );
        }

        resolveOnce({
          success: code === 0 && !signal,
          output: stdout,
          error: signal
            ? `Blackbox process killed by signal ${signal}`
            : code !== 0
              ? stderr || `Blackbox process exited with code ${code}`
              : undefined,
        });
      });

      blackboxProcess.on("error", (error) => {
        resolveOnce({
          success: false,
          output: stdout,
          error: error.message,
        });
      });
    });
  }

  private async copyTestFilesBack(inputDir: string, outputDir: string): Promise<void> {
    const entries = await fs.readdir(inputDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name === "node_modules") {
        continue;
      }

      const isTestFile =
        entry.name.endsWith(".test.tsx") ||
        entry.name.endsWith(".test.ts") ||
        entry.name.endsWith(".spec.tsx") ||
        entry.name.endsWith(".spec.ts") ||
        entry.name.endsWith(".test.jsx") ||
        entry.name.endsWith(".test.js") ||
        entry.name.endsWith(".spec.jsx") ||
        entry.name.endsWith(".spec.js");
      const isTestDir = entry.name === "__tests__" || entry.name === "test" || entry.name === "tests";
      const isEslintConfig =
        entry.name === ".eslintrc.json" ||
        entry.name === ".eslintrc.js" ||
        entry.name === ".eslintrc.cjs" ||
        entry.name === ".eslintrc.yml" ||
        entry.name === ".eslintrc.yaml" ||
        entry.name === "eslint.config.js" ||
        entry.name === "eslint.config.mjs" ||
        entry.name === "eslint.config.cjs";

      const srcPath = path.join(inputDir, entry.name);
      const destPath = path.join(outputDir, entry.name);

      try {
        if (isTestFile || isEslintConfig) {
          await fs.copyFile(srcPath, destPath);
        } else if (entry.isDirectory() && isTestDir) {
          await fs.cp(srcPath, destPath, { recursive: true, force: true });
        } else if (entry.isDirectory()) {
          await this.copyTestFilesBack(srcPath, destPath);
        }
      } catch {
        // Ignore errors (e.g., directory doesn't exist in output)
      }
    }
  }

  private async runEvaluation(
    projectDir: string,
  ): Promise<{
    buildSuccess: boolean;
    lintSuccess: boolean;
    testSuccess: boolean;
    buildOutput: string;
    lintOutput: string;
    testOutput: string;
  }> {
    let buildSuccess = false;
    let buildOutput = "";
    let lintSuccess = false;
    let lintOutput = "";
    let testSuccess = false;
    let testOutput = "";

    try {
      if (this.verbose) {
        console.log("Running build...");
      }
      buildOutput = await this.execCommand(`cd "${projectDir}" && ../../node_modules/.bin/next build`, 60000);
      buildSuccess = true;
      if (this.verbose) {
        console.log("✅ Build completed");
      }
    } catch (error) {
      if (error && typeof error === "object" && "stdout" in error) {
        buildOutput += (error as any).stdout || "";
        if ((error as any).stderr) {
          buildOutput += "\n" + (error as any).stderr;
        }
      } else {
        buildOutput += error instanceof Error ? error.message : String(error);
      }
      if (this.verbose) {
        console.log("❌ Build failed");
      }
    }

    try {
      if (this.verbose) {
        console.log("Running lint...");
      }

      const eslintConfigPath = path.join(projectDir, ".eslintrc.json");
      const eslintConfigExists = await fs
        .stat(eslintConfigPath)
        .then(() => true)
        .catch(() => false);

      if (!eslintConfigExists) {
        const basicEslintConfig = { extends: "next/core-web-vitals" };
        await fs.writeFile(eslintConfigPath, JSON.stringify(basicEslintConfig, null, 2));
      }

      lintOutput = await this.execCommand(`cd "${projectDir}" && ../../node_modules/.bin/next lint`, 30000);
      lintSuccess = true;
      if (this.verbose) {
        console.log("✅ Lint completed");
      }
    } catch (error) {
      if (error && typeof error === "object" && "stdout" in error) {
        lintOutput = (error as any).stdout || "";
        if ((error as any).stderr) {
          lintOutput += "\n" + (error as any).stderr;
        }
      } else {
        lintOutput = error instanceof Error ? error.message : String(error);
      }
      if (this.verbose) {
        console.log("❌ Lint failed");
      }
    }

    try {
      if (this.verbose) {
        console.log("Running tests...");
      }
      testOutput = await this.execCommand(`cd "${projectDir}" && ../../node_modules/.bin/vitest run`, 30000);
      testSuccess = true;
      if (this.verbose) {
        console.log("✅ Tests completed");
      }
    } catch (error) {
      if (error && typeof error === "object" && "stdout" in error) {
        testOutput = (error as any).stdout || "";
        if ((error as any).stderr) {
          testOutput += "\n" + (error as any).stderr;
        }
      } else {
        testOutput = error instanceof Error ? error.message : String(error);
      }
      if (this.verbose) {
        console.log("❌ Tests failed");
      }
    }

    return { buildSuccess, buildOutput, lintSuccess, lintOutput, testSuccess, testOutput };
  }

  private async execCommand(command: string, timeout: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const { exec } = require("child_process");
      exec(
        command,
        { maxBuffer: 10 * 1024 * 1024, timeout },
        (error: any, stdout: string, stderr: string) => {
          if (error) {
            error.stdout = stdout;
            error.stderr = stderr;
            reject(error);
          } else {
            resolve(stdout);
          }
        },
      );
    });
  }

  async cleanup(): Promise<void> {
    const promises = Array.from(this.processes.entries()).map(([processId, process]) => {
      return new Promise<void>((resolve) => {
        process.kill("SIGTERM");
        process.on("exit", () => {
          this.processes.delete(processId);
          resolve();
        });
        setTimeout(() => {
          process.kill("SIGKILL");
          this.processes.delete(processId);
          resolve();
        }, 5000);
      });
    });
    await Promise.all(promises);
  }
}

export async function runBlackboxEval(
  evalPath: string,
  options: BlackboxEvalOptions = {},
): Promise<BlackboxResult> {
  const evalsDir = path.join(process.cwd(), "evals");
  const fullEvalPath = path.join(evalsDir, evalPath);

  const evalStat = await fs.stat(fullEvalPath).catch(() => null);
  if (!evalStat || !evalStat.isDirectory()) {
    throw new Error(`Eval directory not found: ${evalPath}`);
  }

  const inputDir = path.join(fullEvalPath, "input");
  const inputExists = await fs
    .stat(inputDir)
    .then((s) => s.isDirectory())
    .catch(() => false);
  if (!inputExists) {
    throw new Error(`No input directory found in ${evalPath}`);
  }

  const promptFile = path.join(fullEvalPath, "prompt.md");
  const promptExists = await fs
    .stat(promptFile)
    .then((s) => s.isFile())
    .catch(() => false);
  if (!promptExists) {
    throw new Error(`No prompt.md file found in ${evalPath}`);
  }

  const prompt = await fs.readFile(promptFile, "utf8");
  const outputDir = path.join(fullEvalPath, "output-blackbox");

  const runner = new BlackboxRunner(options);

  const base_url = process.env.OPENAI_BASE_URL;
  if (!base_url) {
    process.env.OPENAI_BASE_URL = "https://openrouter.ai/api/v1"
    console.warn("⚠️ OPENAI_BASE_URL environment variable is not set.By default the base url is set to openrouter Base URL. Set OPENAI_BASE_URL to change.");
  }

  try {
    const result = await runner.runBlackboxEval(inputDir, outputDir, prompt,options.timeout);
    const timestamp = new Date().toISOString();
    const enrichedResult: BlackboxResult = { ...result, evalPath, timestamp };

    if (!options.skipFileWrite) {
      let outputFile = options.outputFile;
      if (!outputFile) {
        const resultsDir = path.join(process.cwd(), "results");
        await fs.mkdir(resultsDir, { recursive: true });
        const sanitizedEvalPath = evalPath.replace(/\//g, "-");
        const timestampStr = Date.now();
        outputFile = path.join(resultsDir, `blackbox-${sanitizedEvalPath}-${timestampStr}.json`);
      }

      try {
        await fs.writeFile(outputFile, JSON.stringify(enrichedResult, null, 2), "utf-8");
        console.log(`📝 Results written to: ${outputFile}`);
      } catch (error) {
        console.error(
          `⚠️  Failed to write results to file: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    return enrichedResult;
  } finally {
    await runner.cleanup();
  }
}

