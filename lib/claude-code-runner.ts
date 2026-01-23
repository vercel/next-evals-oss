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
  preHook?: string; // Command to run before Claude Code (e.g., "npx @judegao/next-skills --agent claude")
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
  generatedFiles?: Record<string, string>; // filepath -> content
  claudeMdContent?: string; // Content of CLAUDE.md after pre-hook
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
  const timeout = options.timeout ?? DEFAULT_TIMEOUT;

  // Validate eval exists
  const evalStat = await fs.stat(fullEvalPath).catch(() => null);
  if (!evalStat || !evalStat.isDirectory()) {
    throw new Error(`Eval directory not found: ${evalPath}`);
  }

  const inputExists = await fs
    .stat(inputDir)
    .then((s) => s.isDirectory())
    .catch(() => false);
  if (!inputExists) {
    throw new Error(`No input directory found in ${evalPath}`);
  }

  const promptExists = await fs
    .stat(promptFile)
    .then((s) => s.isFile())
    .catch(() => false);
  if (!promptExists) {
    throw new Error(`No prompt.md file found in ${evalPath}`);
  }

  const prompt = await fs.readFile(promptFile, "utf8");

  const workspaceFiles = await collectFiles(inputDir, { excludeTests: true });
  const testFiles = await collectFiles(inputDir, { onlyTests: true });

  const sandbox = await Sandbox.create({ runtime: "node24", timeout });

  const startTime = Date.now();
  let claudeOutput = "";
  let claudeMdContent: string | undefined;

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
    const installResult = await sandbox.runCommand("pnpm", ["install"]);
    if (installResult.exitCode !== 0) {
      throw new Error(`pnpm install failed: ${await installResult.stderr()}`);
    }

    // Install Claude Code CLI
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

    // Run pre-hook if specified
    if (options.preHook) {
      const hookResult = await sandbox.runCommand({
        cmd: "bash",
        args: ["-c", options.preHook],
      });
      const hookOutput = await hookResult.output("both");
      if (hookResult.exitCode !== 0) {
        throw new Error(`Pre-hook failed (exit ${hookResult.exitCode}): ${hookOutput}`);
      }
    }

    // Capture CLAUDE.md content before running Claude Code
    const claudeMdResult = await sandbox.runCommand({
      cmd: "bash",
      args: ["-c", "cat CLAUDE.md 2>/dev/null || echo '[CLAUDE.md not found]'"],
    });
    claudeMdContent = await claudeMdResult.stdout();

    // Run Claude Code
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      throw new Error("ANTHROPIC_API_KEY environment variable is required");
    }

    const enhancedPrompt = `${prompt.trim()}

IMPORTANT: Do not run npm, pnpm, yarn, or any package manager commands. Dependencies have already been installed. Do not run build, test, or dev server commands. Just write the code files.`;

    const claudeResult = await sandbox.runCommand({
      cmd: "claude",
      args: ["--print", "--model", "opus", "--dangerously-skip-permissions", enhancedPrompt],
      env: {
        ANTHROPIC_API_KEY: anthropicKey,
      },
    });

    claudeOutput = await claudeResult.output("both");

    if (claudeResult.exitCode !== 0) {
      return {
        success: false,
        output: claudeOutput,
        error: `Claude Code exited with code ${claudeResult.exitCode}`,
        duration: Date.now() - startTime,
        sandboxId: sandbox.sandboxId,
        evalPath,
        timestamp: new Date().toISOString(),
        claudeMdContent,
      };
    }

    // Upload test files for validation
    await sandbox.writeFiles(testFiles);

    // Run validation
    const [buildResult, lintResult, testResult] = await Promise.all([
      runBuild(sandbox),
      runLint(sandbox),
      runTests(sandbox),
    ]);

    // Capture generated files from sandbox
    const generatedFiles = await captureGeneratedFiles(sandbox);

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
      generatedFiles,
      claudeMdContent,
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
      claudeMdContent,
    };
  } finally {
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

/**
 * Capture generated files and Claude transcript from sandbox for analysis.
 */
async function captureGeneratedFiles(sandbox: Sandbox): Promise<Record<string, string>> {
  const files: Record<string, string> = {};

  try {
    // Find all source files in app/ directory
    const findResult = await sandbox.runCommand("find", [
      "app", "-type", "f",
      "(", "-name", "*.ts", "-o", "-name", "*.tsx", "-o", "-name", "*.js", "-o", "-name", "*.jsx", ")",
    ]);

    const filePaths = (await findResult.stdout())
      .trim()
      .split("\n")
      .filter(Boolean);

    // Read each file
    for (const filePath of filePaths) {
      try {
        const catResult = await sandbox.runCommand("cat", [filePath]);
        if (catResult.exitCode === 0) {
          files[filePath] = await catResult.stdout();
        }
      } catch {
        // Skip unreadable files
      }
    }

    // Capture Claude transcript - search multiple locations
    const transcriptFind = await sandbox.runCommand({
      cmd: "bash",
      args: ["-c", "find /root /home /vercel -name '*.jsonl' -type f 2>/dev/null || true"],
    });
    const transcriptPaths = (await transcriptFind.stdout())
      .trim()
      .split("\n")
      .filter(Boolean);

    for (const transcriptPath of transcriptPaths) {
      try {
        const catResult = await sandbox.runCommand("cat", [transcriptPath]);
        if (catResult.exitCode === 0) {
          files[transcriptPath] = await catResult.stdout();
        }
      } catch {
        // Skip unreadable files
      }
    }

    // Also capture any .tsx/.ts files in root (Claude sometimes puts them there)
    const rootFiles = await sandbox.runCommand({
      cmd: "bash",
      args: ["-c", "find /vercel/sandbox -maxdepth 1 -name '*.tsx' -o -name '*.ts' 2>/dev/null || true"],
    });
    const rootFilePaths = (await rootFiles.stdout())
      .trim()
      .split("\n")
      .filter(Boolean);

    for (const filePath of rootFilePaths) {
      try {
        const catResult = await sandbox.runCommand("cat", [filePath]);
        if (catResult.exitCode === 0) {
          files[filePath] = await catResult.stdout();
        }
      } catch {
        // Skip
      }
    }
  } catch {
    // If capture fails, return empty object
  }

  return files;
}
