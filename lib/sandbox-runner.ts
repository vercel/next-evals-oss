import fs from "fs/promises";
import path from "path";
import { Sandbox } from "@vercel/sandbox";
import ignore from "ignore";

export interface SandboxRunnerOptions {
  timeout?: number;
  verbose?: boolean;
  captureScreenshot?: boolean;
}

export interface SandboxRunnerResult {
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
  sandboxId?: string;
  screenshot?: Buffer;
}

/**
 * Collect files from a directory, optionally excluding test files
 */
async function collectFiles(
  dir: string,
  options: { excludeTests?: boolean; onlyTests?: boolean } = {}
): Promise<{ path: string; content: Buffer }[]> {
  const files: { path: string; content: Buffer }[] = [];
  const ig = ignore();

  ig.add([
    ".git",
    ".next",
    "node_modules",
    ".DS_Store",
    "*.log",
    "build",
    "pnpm-lock.yaml",
    "package-lock.json",
  ]);

  if (options.excludeTests) {
    ig.add(["*.test.tsx", "*.test.ts"]);
  }

  const processDir = async (currentDir: string, relativePath: string = "") => {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const entryRelativePath = relativePath
        ? `${relativePath}/${entry.name}`
        : entry.name;
      const fullPath = path.join(currentDir, entry.name);

      if (ig.ignores(entryRelativePath)) {
        continue;
      }

      if (entry.isDirectory()) {
        await processDir(fullPath, entryRelativePath);
      } else {
        const isTestFile =
          entry.name.endsWith(".test.tsx") || entry.name.endsWith(".test.ts");

        if (options.onlyTests && !isTestFile) {
          continue;
        }

        if (options.excludeTests && isTestFile) {
          continue;
        }

        try {
          const content = await fs.readFile(fullPath);
          files.push({ path: entryRelativePath, content });
        } catch {
          // Skip unreadable files
        }
      }
    }
  };

  await processDir(dir);
  return files;
}

/**
 * Run Claude Code agent inside Vercel Sandbox
 *
 * This ensures Claude Code cannot access test files because they
 * physically don't exist in the sandbox until after the agent runs.
 */
export async function runClaudeCodeInSandbox(
  evalPath: string,
  options: SandboxRunnerOptions = {}
): Promise<SandboxRunnerResult> {
  const evalsDir = path.join(process.cwd(), "evals");
  const fullEvalPath = path.join(evalsDir, evalPath);
  const inputDir = path.join(fullEvalPath, "input");
  const promptFile = path.join(fullEvalPath, "prompt.md");
  const verbose = options.verbose ?? false;

  const log = (msg: string) => verbose && console.log(msg);

  log(`\n🚀 Running Claude Code in sandbox for: ${evalPath}`);

  // Read prompt
  const prompt = await fs.readFile(promptFile, "utf8");
  log(`📝 Task: ${prompt.trim().slice(0, 100)}...`);

  // Collect files excluding tests
  const files = await collectFiles(inputDir, { excludeTests: true });
  log(`📂 Found ${files.length} files (excluding tests)`);

  // Get test files count for info
  const testFiles = await collectFiles(inputDir, { onlyTests: true });
  log(`🔒 ${testFiles.length} test files will be added AFTER agent runs`);

  // Create sandbox
  log(`\n🔲 Creating sandbox...`);
  const sandbox = await Sandbox.create({
    runtime: "node24",
    timeout: options.timeout || 600000, // 10 min
  });
  log(`   ✅ Sandbox: ${sandbox.sandboxId}`);

  const startTime = Date.now();
  let claudeOutput = "";

  try {
    // Step 1: Upload workspace files (NO test files!)
    log(`\n📤 Uploading workspace files...`);
    await sandbox.writeFiles(files);

    // Step 2: Copy template package.json
    const templatePkg = await fs.readFile(
      path.join(process.cwd(), "template", "package.json")
    );
    await sandbox.writeFiles([{ path: "package.json", content: templatePkg }]);

    // Step 3: Install project dependencies
    log(`\n📦 Installing project dependencies...`);
    const installResult = await sandbox.runCommand("pnpm", ["install"]);
    if (installResult.exitCode !== 0) {
      throw new Error(`pnpm install failed: ${await installResult.stderr()}`);
    }
    log(`   ✅ Dependencies installed`);

    // Step 4: Install Claude Code CLI
    log(`\n🤖 Installing Claude Code CLI...`);
    const cliInstall = await sandbox.runCommand(
      "npm",
      ["install", "-g", "@anthropic-ai/claude-code"]
    );
    if (cliInstall.exitCode !== 0) {
      throw new Error(`Claude Code install failed: ${await cliInstall.stderr()}`);
    }
    log(`   ✅ Claude Code CLI installed`);

    // Verify no project test files in sandbox (ignore node_modules)
    log(`\n🔍 Verifying no test files in sandbox...`);
    const testCheck = await sandbox.runCommand("find", [
      ".", "-path", "./node_modules", "-prune", "-o",
      "-name", "*.test.tsx", "-print", "-o",
      "-name", "*.test.ts", "-print"
    ]);
    const foundTests = (await testCheck.stdout()).trim();
    if (foundTests) {
      throw new Error(`Test files found in sandbox before agent run: ${foundTests}`);
    }
    log(`   ✅ No test files - isolation confirmed`);

    // Step 5: Run Claude Code with the prompt (via Vercel AI Gateway)
    log(`\n🤖 Running Claude Code (via AI Gateway)...`);
    const enhancedPrompt = `${prompt.trim()}

IMPORTANT: Do not run npm, pnpm, yarn, or any package manager commands. Dependencies have already been installed. Do not run build, test, or dev server commands. Just write the code files.`;

    // Use Vercel AI Gateway
    const aiGatewayKey = process.env.AI_GATEWAY_API_KEY;
    if (!aiGatewayKey) {
      throw new Error("AI_GATEWAY_API_KEY environment variable is required");
    }

    const claudeEnv: Record<string, string> = {
      ANTHROPIC_BASE_URL: "https://ai-gateway.vercel.sh",
      ANTHROPIC_AUTH_TOKEN: aiGatewayKey,
      ANTHROPIC_API_KEY: "", // Must be empty so Claude Code uses AUTH_TOKEN
    };

    log(`   Using Vercel AI Gateway`);

    const claudeResult = await sandbox.runCommand({
      cmd: "claude",
      args: ["--print", "--dangerously-skip-permissions", enhancedPrompt],
      env: claudeEnv,
    });

    claudeOutput = await claudeResult.output("both");
    log(`   ✅ Claude Code finished (exit: ${claudeResult.exitCode})`);

    if (claudeResult.exitCode !== 0) {
      return {
        success: false,
        output: claudeOutput,
        error: `Claude Code exited with code ${claudeResult.exitCode}`,
        duration: Date.now() - startTime,
        sandboxId: sandbox.sandboxId,
      };
    }

    // Step 6: NOW upload test files for validation
    log(`\n📤 Uploading test files for validation...`);
    await sandbox.writeFiles(testFiles);

    // Upload template eslint config
    const eslintConfig = await fs.readFile(
      path.join(process.cwd(), "template", "eslint.config.mjs")
    );
    await sandbox.writeFiles([{ path: "eslint.config.mjs", content: eslintConfig }]);
    log(`   ✅ ${testFiles.length} test files uploaded`);

    // Step 7: Run validation (build, lint, test)
    log(`\n🔨 Running validation...`);

    let buildSuccess = false;
    let buildOutput = "";
    let lintSuccess = false;
    let lintOutput = "";
    let testSuccess = false;
    let testOutput = "";

    // Build
    try {
      log(`   → Building...`);
      const buildResult = await sandbox.runCommand("npx", ["next", "build"]);
      buildOutput = await buildResult.output("both");
      buildSuccess = buildResult.exitCode === 0;
      log(`   → Build: ${buildSuccess ? "✅" : "❌"}`);
    } catch (e) {
      buildOutput = String(e);
    }

    // Lint (eslint directly)
    try {
      log(`   → Linting...`);
      const lintResult = await sandbox.runCommand({
        cmd: "bash",
        args: ["-c", "./node_modules/.bin/eslint app/"],
      });
      lintOutput = await lintResult.output("both");
      lintSuccess = lintResult.exitCode === 0;
      log(`   → Lint: ${lintSuccess ? "✅" : "❌"}`);
    } catch (e) {
      lintOutput = String(e);
    }

    // Test
    try {
      log(`   → Testing...`);
      const testResult = await sandbox.runCommand("npx", ["vitest", "run"]);
      testOutput = await testResult.output("both");
      testSuccess = testResult.exitCode === 0;
      log(`   → Tests: ${testSuccess ? "✅" : "❌"}`);
    } catch (e) {
      testOutput = String(e);
    }

    // Step 8: Capture screenshot if enabled
    let screenshot: Buffer | undefined;
    if (options.captureScreenshot && buildSuccess) {
      try {
        log(`\n📸 Capturing screenshot...`);

        // Install Playwright
        log(`   → Installing Playwright...`);
        await sandbox.runCommand("npx", ["playwright", "install", "chromium"], {
          timeout: 120000,
        });

        // Create screenshot script
        const screenshotScript = `
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/tmp/screenshot.png', fullPage: true });
  await browser.close();
})();
`;
        await sandbox.writeFiles([{ path: "screenshot.js", content: Buffer.from(screenshotScript) }]);

        // Start dev server in background
        log(`   → Starting dev server...`);
        sandbox.runCommand("npx", ["next", "dev", "-p", "3000"], { timeout: 60000 });

        // Wait for server to start
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Run screenshot script
        log(`   → Taking screenshot...`);
        const screenshotResult = await sandbox.runCommand("node", ["screenshot.js"], {
          timeout: 30000,
        });

        if (screenshotResult.exitCode === 0) {
          // Read the screenshot file
          const screenshotFiles = await sandbox.readFiles(["/tmp/screenshot.png"]);
          if (screenshotFiles.length > 0) {
            screenshot = screenshotFiles[0].content;
            log(`   → Screenshot: ✅`);
          }
        } else {
          log(`   → Screenshot: ❌ (${await screenshotResult.stderr()})`);
        }
      } catch (e) {
        log(`   → Screenshot: ❌ (${e})`);
      }
    }

    return {
      success: buildSuccess && lintSuccess && testSuccess,
      output: claudeOutput,
      duration: Date.now() - startTime,
      buildSuccess,
      lintSuccess,
      testSuccess,
      buildOutput,
      lintOutput,
      testOutput,
      sandboxId: sandbox.sandboxId,
      screenshot,
    };
  } catch (error) {
    return {
      success: false,
      output: claudeOutput,
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime,
      sandboxId: sandbox.sandboxId,
    };
  } finally {
    log(`\n🧹 Stopping sandbox...`);
    await sandbox.stop();
  }
}
