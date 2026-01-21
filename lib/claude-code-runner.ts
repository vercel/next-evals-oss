import fs from "fs/promises";
import path from "path";
import { Sandbox } from "@vercel/sandbox";
import ignore from "ignore";

const DEFAULT_TIMEOUT = 600000; // 10 minutes

const IGNORED_PATTERNS = [
  ".git",
  ".next",
  "node_modules",
  ".DS_Store",
  "*.log",
  "build",
  "pnpm-lock.yaml",
  "package-lock.json",
];

const TEST_FILE_PATTERNS = ["*.test.tsx", "*.test.ts"];

export interface ClaudeCodeEvalOptions {
  timeout?: number;
  verbose?: boolean;
}

export interface ClaudeCodeResult {
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
  evalPath?: string;
  timestamp?: string;
}

/**
 * Collect files from a directory, optionally filtering test files.
 */
async function collectFiles(
  dir: string,
  options: { excludeTests?: boolean; onlyTests?: boolean } = {}
): Promise<{ path: string; content: Buffer }[]> {
  const files: { path: string; content: Buffer }[] = [];
  const ig = ignore();

  ig.add(IGNORED_PATTERNS);

  if (options.excludeTests) {
    ig.add(TEST_FILE_PATTERNS);
  }

  async function processDir(currentDir: string, relativePath: string = ""): Promise<void> {
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
  }

  await processDir(dir);
  return files;
}

/**
 * Run Claude Code eval in an isolated Vercel Sandbox.
 *
 * Test files are withheld from the sandbox until after the agent completes,
 * ensuring the agent cannot access them during code generation.
 */
export async function runClaudeCodeEval(
  evalPath: string,
  options: ClaudeCodeEvalOptions = {}
): Promise<ClaudeCodeResult> {
  const evalsDir = path.join(process.cwd(), "evals");
  const fullEvalPath = path.join(evalsDir, evalPath);
  const inputDir = path.join(fullEvalPath, "input");
  const promptFile = path.join(fullEvalPath, "prompt.md");
  const templateDir = path.join(process.cwd(), "template");
  const verbose = options.verbose ?? false;
  const timeout = options.timeout ?? DEFAULT_TIMEOUT;

  const log = (msg: string) => verbose && console.log(msg);

  log(`\n🚀 Running Claude Code in sandbox for: ${evalPath}`);

  const prompt = await fs.readFile(promptFile, "utf8");
  log(`📝 Task: ${prompt.trim().slice(0, 100)}...`);

  const workspaceFiles = await collectFiles(inputDir, { excludeTests: true });
  const testFiles = await collectFiles(inputDir, { onlyTests: true });
  log(`📂 Found ${workspaceFiles.length} workspace files, ${testFiles.length} test files`);

  const sandbox = await Sandbox.create({ runtime: "node24", timeout });
  log(`🔲 Sandbox created: ${sandbox.sandboxId}`);

  const startTime = Date.now();
  let claudeOutput = "";

  try {
    // Upload workspace files (excluding tests)
    await sandbox.writeFiles(workspaceFiles);

    // Upload template files
    const [templatePkg, eslintConfig] = await Promise.all([
      fs.readFile(path.join(templateDir, "package.json")),
      fs.readFile(path.join(templateDir, "eslint.config.mjs")),
    ]);
    await sandbox.writeFiles([
      { path: "package.json", content: templatePkg },
      { path: "eslint.config.mjs", content: eslintConfig },
    ]);

    // Install dependencies
    log(`📦 Installing dependencies...`);
    const installResult = await sandbox.runCommand("pnpm", ["install"]);
    if (installResult.exitCode !== 0) {
      throw new Error(`pnpm install failed: ${await installResult.stderr()}`);
    }

    // Install Claude Code CLI
    log(`🤖 Installing Claude Code CLI...`);
    const cliInstall = await sandbox.runCommand("npm", ["install", "-g", "@anthropic-ai/claude-code"]);
    if (cliInstall.exitCode !== 0) {
      throw new Error(`Claude Code install failed: ${await cliInstall.stderr()}`);
    }

    // Verify test file isolation
    const testCheck = await sandbox.runCommand("find", [
      ".", "-path", "./node_modules", "-prune", "-o",
      "-name", "*.test.tsx", "-print", "-o",
      "-name", "*.test.ts", "-print",
    ]);
    const foundTests = (await testCheck.stdout()).trim();
    if (foundTests) {
      throw new Error(`Test files found in sandbox before agent run: ${foundTests}`);
    }
    log(`🔒 Test file isolation verified`);

    // Run Claude Code
    log(`🤖 Running Claude Code...`);
    const aiGatewayKey = process.env.AI_GATEWAY_API_KEY;
    if (!aiGatewayKey) {
      throw new Error("AI_GATEWAY_API_KEY environment variable is required");
    }

    const enhancedPrompt = `${prompt.trim()}

IMPORTANT: Do not run npm, pnpm, yarn, or any package manager commands. Dependencies have already been installed. Do not run build, test, or dev server commands. Just write the code files.`;

    const claudeResult = await sandbox.runCommand({
      cmd: "claude",
      args: ["--print", "--dangerously-skip-permissions", enhancedPrompt],
      env: {
        ANTHROPIC_BASE_URL: "https://ai-gateway.vercel.sh",
        ANTHROPIC_AUTH_TOKEN: aiGatewayKey,
        ANTHROPIC_API_KEY: "", // Must be empty so Claude Code uses AUTH_TOKEN
      },
    });

    claudeOutput = await claudeResult.output("both");
    log(`✅ Claude Code finished (exit: ${claudeResult.exitCode})`);

    if (claudeResult.exitCode !== 0) {
      return {
        success: false,
        output: claudeOutput,
        error: `Claude Code exited with code ${claudeResult.exitCode}`,
        duration: Date.now() - startTime,
        sandboxId: sandbox.sandboxId,
        evalPath,
        timestamp: new Date().toISOString(),
      };
    }

    // Upload test files for validation
    log(`📤 Uploading test files...`);
    await sandbox.writeFiles(testFiles);

    // Run validation
    log(`🔨 Running validation...`);
    const [buildResult, lintResult, testResult] = await Promise.all([
      runBuild(sandbox),
      runLint(sandbox),
      runTests(sandbox),
    ]);

    log(`   Build: ${buildResult.success ? "✅" : "❌"}`);
    log(`   Lint: ${lintResult.success ? "✅" : "❌"}`);
    log(`   Tests: ${testResult.success ? "✅" : "❌"}`);

    return {
      success: buildResult.success && lintResult.success && testResult.success,
      output: claudeOutput,
      duration: Date.now() - startTime,
      buildSuccess: buildResult.success,
      lintSuccess: lintResult.success,
      testSuccess: testResult.success,
      buildOutput: buildResult.output,
      lintOutput: lintResult.output,
      testOutput: testResult.output,
      sandboxId: sandbox.sandboxId,
      evalPath,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      success: false,
      output: claudeOutput,
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime,
      sandboxId: sandbox.sandboxId,
      evalPath,
      timestamp: new Date().toISOString(),
    };
  } finally {
    log(`🧹 Stopping sandbox...`);
    await sandbox.stop();
  }
}

async function runBuild(sandbox: Sandbox): Promise<{ success: boolean; output: string }> {
  try {
    const result = await sandbox.runCommand("npx", ["next", "build"]);
    return {
      success: result.exitCode === 0,
      output: await result.output("both"),
    };
  } catch (e) {
    return { success: false, output: String(e) };
  }
}

async function runLint(sandbox: Sandbox): Promise<{ success: boolean; output: string }> {
  try {
    const result = await sandbox.runCommand({
      cmd: "bash",
      args: ["-c", "./node_modules/.bin/eslint app/"],
    });
    return {
      success: result.exitCode === 0,
      output: await result.output("both"),
    };
  } catch (e) {
    return { success: false, output: String(e) };
  }
}

async function runTests(sandbox: Sandbox): Promise<{ success: boolean; output: string }> {
  try {
    const result = await sandbox.runCommand("npx", ["vitest", "run"]);
    return {
      success: result.exitCode === 0,
      output: await result.output("both"),
    };
  } catch (e) {
    return { success: false, output: String(e) };
  }
}
