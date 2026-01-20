import fs from "fs/promises";
import path from "path";
import { exec, spawn, ExecSyncOptionsWithStringEncoding, ChildProcess } from "child_process";
import { promisify } from "util";
import {
  currentSpan,
  ExperimentSummary,
  initExperiment,
  traced,
  wrapTraced,
} from "braintrust";
import { generateText } from "ai";
import { MODELS, type Model } from "./models";
import { performance } from "perf_hooks";

// Shared node_modules management
let workspaceDepsInstalled = false;

export async function ensureSharedDependencies(
  verbose: boolean = false,
  forceReinstall: boolean = false,
): Promise<void> {
  // Skip if already installed in this process (unless force reinstall)
  if (workspaceDepsInstalled && !forceReinstall) {
    if (verbose) {
      console.log("✓ Using existing shared dependencies");
    }
    return;
  }

  // Clear workspace state if forcing reinstall
  if (forceReinstall) {
    workspaceDepsInstalled = false;
    if (verbose) {
      console.log("🔄 Force reinstalling shared dependencies...");
    }
  }

  const evalsDir = path.join(process.cwd(), "evals");

  // Check if node_modules exists AND has actual packages (not just empty/workspace state)
  let hasValidNodeModules = false;
  try {
    const nodeModulesPath = path.join(evalsDir, "node_modules");
    const nodeModulesStat = await fs.stat(nodeModulesPath);
    if (nodeModulesStat.isDirectory()) {
      // Check if it has actual packages (look for common packages like 'next')
      const nextExists = await fs
        .stat(path.join(nodeModulesPath, "next"))
        .then((stats) => stats.isDirectory())
        .catch(() => false);
      hasValidNodeModules = nextExists;
    }
  } catch {
    hasValidNodeModules = false;
  }

  // If node_modules already exists with packages, we can skip installation
  if (hasValidNodeModules) {
    if (verbose) {
      console.log("✓ Using existing shared dependencies");
    }
    workspaceDepsInstalled = true;
    return;
  }

  // Run pnpm install in evals directory
  if (verbose) {
    console.log("📦 Installing shared dependencies...");
  }

  const installStart = performance.now();
  try {
    // Create a simple package.json with all dependencies if it doesn't exist
    const rootPackageJson = path.join(evalsDir, "package.json");
    const rootPackageExists = await fs
      .stat(rootPackageJson)
      .then((stats) => stats.isFile())
      .catch(() => false);

    if (!rootPackageExists) {
      // Copy template package.json to evals root
      const templatePackageJson = path.join(
        process.cwd(),
        "template",
        "package.json",
      );
      await fs.copyFile(templatePackageJson, rootPackageJson);
    }

    // Simple pnpm install
    await execAsync(
      `cd "${evalsDir}" && pnpm install --prefer-offline`,
      { encoding: "utf8" },
      300000, // 5 minute timeout
    );

    const installDuration = performance.now() - installStart;

    if (verbose) {
      console.log(
        `✓ Shared dependencies installed (${formatDuration(installDuration)})`,
      );
    }

    workspaceDepsInstalled = true;
  } catch (error) {
    console.error("Failed to install shared dependencies:", error);
    throw error;
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  } else {
    const seconds = ms / 1000;
    return `${seconds.toFixed(1)}s`;
  }
}

async function execAsync(
  command: string,
  options: ExecSyncOptionsWithStringEncoding,
  timeoutMs: number = 120000, // 2 minute default timeout
): Promise<string> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(
      () =>
        reject(
          new Error(`Command timed out after ${timeoutMs}ms: ${command}`),
        ),
      timeoutMs,
    );
  });

  const execPromise = promisify(exec)(command, {
    ...options,
    maxBuffer: 10 * 1024 * 1024, // 10MB buffer to handle large outputs
  });

  const result = await Promise.race([execPromise, timeoutPromise]);
  return result.stdout;
}

export async function copyFolder(
  source: string,
  destination: string,
  excludeTestFiles: boolean = false,
) {
  if (
    !(await fs
      .stat(destination)
      .then((stats) => stats.isDirectory())
      .catch(() => false))
  ) {
    await fs.mkdir(destination, { recursive: true });
  }

  const entries = await fs.readdir(source, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name === "node_modules") {
      continue;
    }

    // Skip test and spec files if requested
    if (
      excludeTestFiles &&
      (entry.name.endsWith(".test.tsx") || entry.name.endsWith(".test.ts") ||
       entry.name.endsWith(".spec.tsx") || entry.name.endsWith(".spec.ts") ||
       entry.name.endsWith(".spec.md") || entry.name.endsWith(".e2e.ts") ||
       entry.name === "playwright.config.ts")
    ) {
      continue;
    }

    const srcPath = path.join(source, entry.name);
    const destPath = path.join(destination, entry.name);

    try {
      if (entry.isDirectory()) {
        await copyFolder(srcPath, destPath, excludeTestFiles);
      } else if (entry.isFile()) {
        await fs.copyFile(srcPath, destPath);
      }
    } catch (error) {
      console.warn(
        `Warning: Could not copy ${srcPath}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}

async function copyTestFiles(source: string, destination: string) {
  const entries = await fs.readdir(source, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name === "node_modules") {
      continue;
    }

    const srcPath = path.join(source, entry.name);
    const destPath = path.join(destination, entry.name);

    try {
      if (entry.isDirectory()) {
        // Recursively copy test files from subdirectories
        await copyTestFiles(srcPath, destPath);
      } else if (
        entry.isFile() &&
        (entry.name.endsWith(".test.tsx") || entry.name.endsWith(".test.ts") || entry.name.endsWith(".e2e.ts") || entry.name === "playwright.config.ts")
      ) {
        // Ensure destination directory exists
        await fs.mkdir(path.dirname(destPath), { recursive: true });
        await fs.copyFile(srcPath, destPath);
      }
    } catch (error) {
      console.warn(
        `Warning: Could not copy test file ${srcPath}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}

class SimpleIgnore {
  patterns: string[] = [];

  add(patterns: string | string[]): void {
    if (Array.isArray(patterns)) {
      this.patterns.push(...patterns);
    } else {
      this.patterns.push(
        ...patterns
          .split("\n")
          .filter((line) => line.trim() && !line.startsWith("#")),
      );
    }
  }

  ignores(path: string): boolean {
    return this.patterns.some((pattern) => {
      if (pattern.endsWith("/") && path.startsWith(pattern)) {
        return true;
      }
      if (pattern.includes("*")) {
        const regexPattern = pattern.replace(/\./g, "\\.").replace(/\*/g, ".*");
        return new RegExp(`^${regexPattern}$`).test(path);
      }
      return pattern === path;
    });
  }
}

export async function readProjectFiles(dir: string): Promise<string> {
  const ig = new SimpleIgnore();

  ig.add([
    ".git",
    ".next",
    ".next-docs",
    ".claude",
    "node_modules",
    ".gitignore",
    ".DS_Store",
    "*.log",
    "README.md",
    "build",
    "pnpm-lock.yaml",
    "*.test.tsx",
    "*.test.ts",
    "*.spec.tsx",
    "*.spec.ts",
    "*.spec.md",
    "*.e2e.ts",
    "playwright.config.ts",
  ]);

  // Check if .gitignore exists and use it
  const gitignorePath = path.join(dir, ".gitignore");
  if (
    await fs
      .stat(gitignorePath)
      .then((stats) => stats.isFile())
      .catch(() => false)
  ) {
    const gitignoreContent = await fs.readFile(gitignorePath, "utf8");
    ig.add(gitignoreContent);
  }

  const allFiles: string[] = [];

  async function processDirectory(
    currentDir: string,
    relativePath: string = "",
  ) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const entryRelativePath = path.join(relativePath, entry.name);
      const fullPath = path.join(currentDir, entry.name);

      // Skip if the path should be ignored
      if (ig.ignores(entryRelativePath)) {
        continue;
      }

      if (entry.isDirectory()) {
        await processDirectory(fullPath, entryRelativePath);
      } else {
        try {
          const content = await fs.readFile(fullPath, "utf8");
          allFiles.push(`
File: ${entryRelativePath}
\`\`\`
${content}
\`\`\`
`);
        } catch (error) {
          console.error(`Error reading file ${fullPath}:`, error);
        }
      }
    }
  }

  await processDirectory(dir);
  return allFiles.join("\n");
}

/**
 * Read the spec file (test file) for an eval.
 * This provides the criteria for judging the implementation.
 */
export async function readSpecFile(inputDir: string): Promise<string | null> {
  // Look for spec files in common locations (prefer .spec.md)
  const specPatterns = [
    "app/page.spec.md",
    "app/page.test.tsx",
    "app/page.test.ts",
    "app/page.spec.tsx",
    "app/page.spec.ts",
  ];

  for (const pattern of specPatterns) {
    const specPath = path.join(inputDir, pattern);
    try {
      const content = await fs.readFile(specPath, "utf8");
      return content;
    } catch {
      // File doesn't exist, try next pattern
    }
  }

  return null;
}

const JUDGE_SYSTEM_PROMPT = `You are an expert code reviewer. Your ONLY output must be valid JSON - no markdown, no explanations, no text before or after.

Evaluate if the implementation meets the specification criteria.

Output ONLY this JSON structure (nothing else):
{"score": 0.85, "criteria_met": ["criterion1"], "criteria_failed": ["criterion2"], "explanation": "Brief reason"}

Rules:
- score: 0.0 to 1.0 based on criteria met
- criteria_met: array of requirement names that are satisfied
- criteria_failed: array of requirement names that are not satisfied
- explanation: one sentence summary`;

/**
 * Use an LLM to judge how well the implementation matches the spec.
 * Returns a score from 0.0 to 1.0.
 */
export const runJudge = wrapTraced(async function runJudge(
  projectFiles: string,
  specContent: string,
  verbose: boolean = false
): Promise<{
  score: number;
  criteria_met: string[];
  criteria_failed: string[];
  explanation: string;
}> {
  const judgePrompt = `## Specification (Test File)
The following test file describes what the implementation should do:

\`\`\`typescript
${specContent}
\`\`\`

## Implementation
Here are the source files to evaluate:

${projectFiles}

Evaluate how well this implementation meets the specification criteria.`;

  if (verbose) {
    console.log("🧑‍⚖️ Running LLM judge...");
  }

  const startTime = Date.now();
  const response = await generateText({
    model: "anthropic/claude-sonnet-4-20250514", // Use Claude Sonnet for judging - fast and capable
    temperature: 0.1,
    messages: [
      {
        role: "system",
        content: JUDGE_SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: judgePrompt,
      },
    ],
  });

  // Log to Braintrust span
  const span = currentSpan();
  if (span) {
    span.log({
      input: { spec: specContent.substring(0, 500) + "..." },
      output: response.text,
      metrics: {
        prompt_tokens: response.usage?.inputTokens || 0,
        completion_tokens: response.usage?.outputTokens || 0,
        llm_duration: Date.now() - startTime,
      },
      metadata: {
        model: "claude-sonnet-4-20250514",
        type: "judge",
      },
    });
  }

  // Parse the JSON response
  try {
    // Extract JSON from the response (handle markdown code blocks)
    let jsonText = response.text;
    const jsonMatch = response.text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1].trim();
    }

    const result = JSON.parse(jsonText);

    if (verbose) {
      console.log(`✅ Judge score: ${result.score}`);
      console.log(`   Criteria met: ${result.criteria_met.join(", ")}`);
      if (result.criteria_failed.length > 0) {
        console.log(`   Criteria failed: ${result.criteria_failed.join(", ")}`);
      }
    }

    return {
      score: Math.min(1.0, Math.max(0.0, result.score)),
      criteria_met: result.criteria_met || [],
      criteria_failed: result.criteria_failed || [],
      explanation: result.explanation || "",
    };
  } catch (error) {
    if (verbose) {
      console.log("⚠️ Failed to parse judge response, defaulting to score 0.5");
      console.log("   Response:", response.text.substring(0, 200));
    }
    return {
      score: 0.5,
      criteria_met: [],
      criteria_failed: [],
      explanation: "Failed to parse judge response",
    };
  }
}, {
  type: "score",
  name: "judge",
});

function createPrompt(prompt: string, fileContents: string): string {
  return `
I'll provide the full content of a Next.js project. You are not allowed to modify any *.test.tsx files. Here are all the files in the project:

${fileContents}

Your task is to ${prompt}.
`;
}

const FULL_FILE_SYSTEM_PROMPT = `
Please provide your changes as complete file contents. Use this format for each file you need to modify, create, or delete:

\`\`\`file=path/to/file.tsx action=replace
complete file content here
\`\`\`

For example:
\`\`\`file=app/Component.tsx action=replace
export default function Component() {
  const new = "code";
  return <div>{new}</div>;
}
\`\`\`

\`\`\`file=app/NewComponent.tsx action=add
export default function NewComponent() {
  return <div>New component</div>;
}
\`\`\`

\`\`\`file=app/OldComponent.tsx action=delete
\`\`\`

Rules:
- Always specify an action: add, replace, or delete
- For add/replace: provide the complete file content, not partial changes
- For delete: you can leave the content empty or omit it
- Use the exact file path relative to the project root
- Maintain proper indentation and formatting
- Include all imports and exports that the file needs
- Do not modify *.test.tsx files
`;

const applyFullFiles = wrapTraced(async function applyFullFiles(
  llmOutput: string,
  targetDir: string,
  verbose: boolean = false,
) {
  if (verbose) {
    console.log("Applying full file changes...");
  }

  const fileBlocks = parseFullFileBlocks(llmOutput);
  let successfulFiles = 0;

  for (const fileBlock of fileBlocks) {
    try {
      await writeFullFile(fileBlock, targetDir, verbose);
      successfulFiles++;
    } catch (error) {
      if (verbose) {
        console.warn(
          `Failed to write file ${fileBlock.filePath}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }

  if (verbose) {
    console.log(
      `✓ Applied ${successfulFiles}/${fileBlocks.length} files successfully`,
    );
  }

  if (successfulFiles === 0 && fileBlocks.length === 0) {
    if (verbose) {
      console.warn("No file blocks found in LLM output");
    }
  }
});

interface FileBlock {
  filePath: string;
  content: string;
  action: "add" | "replace" | "delete";
}

function parseFullFileBlocks(llmOutput: string): FileBlock[] {
  const fileBlocks: FileBlock[] = [];
  const regex =
    /```file=([^\s]+)(?:\s+action=(add|replace|delete))?\n([\s\S]*?)```/g;
  let match;

  while ((match = regex.exec(llmOutput)) !== null) {
    const filePath = match[1].trim();
    const action = (match[2] || "replace") as "add" | "replace" | "delete"; // Default to 'replace' for backward compatibility
    const content = match[3] || ""; // Content can be empty for delete action

    // Skip test files as per original rule
    if (filePath.endsWith(".test.tsx") || filePath.endsWith(".test.ts")) {
      continue;
    }

    fileBlocks.push({
      filePath,
      content,
      action,
    });
  }

  return fileBlocks;
}

async function writeFullFile(
  fileBlock: FileBlock,
  targetDir: string,
  verbose: boolean = false,
): Promise<void> {
  const filePath = path.join(targetDir, fileBlock.filePath);

  switch (fileBlock.action) {
    case "delete":
      // Delete the file if it exists
      try {
        await fs.unlink(filePath);
        if (verbose) {
          console.log(`  ✓ Deleted ${fileBlock.filePath}`);
        }
      } catch (error) {
        // File doesn't exist, which is fine for delete operation
        if (verbose && (error as any).code !== "ENOENT") {
          console.log(
            `  ⚠ Could not delete ${fileBlock.filePath}: ${(error as any).message}`,
          );
        }
      }
      break;

    case "add":
    case "replace":
    default:
      // Create directory if it doesn't exist
      await fs.mkdir(path.dirname(filePath), { recursive: true });

      // Write the complete file content
      await fs.writeFile(filePath, fileBlock.content, "utf8");

      if (verbose) {
        const actionText = fileBlock.action === "add" ? "Added" : "Updated";
        console.log(`  ✓ ${actionText} ${fileBlock.filePath}`);
      }
      break;
  }
}

// Check if e2e test files exist in the project
async function hasE2ETests(projectDir: string): Promise<boolean> {
  async function findE2EFiles(dir: string): Promise<boolean> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name === "node_modules" || entry.name === ".next") continue;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (await findE2EFiles(fullPath)) return true;
        } else if (entry.isFile() && entry.name.endsWith(".e2e.ts")) {
          return true;
        }
      }
    } catch {
      // Ignore errors
    }
    return false;
  }
  return findE2EFiles(projectDir);
}

// Start a Next.js server and return the process
async function startNextServer(
  projectDir: string,
  port: number,
  verbose: boolean = false
): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    const serverProcess = spawn(
      "../../node_modules/.bin/next",
      ["start", "-p", String(port)],
      {
        cwd: projectDir,
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, PORT: String(port) },
      }
    );

    let serverOutput = "";
    let resolved = false;

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        reject(new Error(`Server startup timeout after 30s. Output: ${serverOutput}`));
      }
    }, 30000);

    serverProcess.stdout?.on("data", (data) => {
      serverOutput += data.toString();
      if (verbose) {
        process.stdout.write(data);
      }
      // Check if server is ready
      if (!resolved && (serverOutput.includes("Ready in") || serverOutput.includes(`localhost:${port}`))) {
        clearTimeout(timeout);
        resolved = true;
        // Give server a moment to fully initialize
        setTimeout(() => resolve(serverProcess), 500);
      }
    });

    serverProcess.stderr?.on("data", (data) => {
      serverOutput += data.toString();
      if (verbose) {
        process.stderr.write(data);
      }
    });

    serverProcess.on("error", (err) => {
      clearTimeout(timeout);
      if (!resolved) {
        resolved = true;
        reject(err);
      }
    });

    serverProcess.on("exit", (code) => {
      clearTimeout(timeout);
      if (!resolved) {
        resolved = true;
        reject(new Error(`Server exited with code ${code}. Output: ${serverOutput}`));
      }
    });
  });
}

// Run Playwright tests
async function runPlaywrightTests(
  projectDir: string,
  port: number,
  verbose: boolean = false
): Promise<{ success: boolean; output: string; duration: number }> {
  const startTime = performance.now();
  let output = "";
  let success = false;

  try {
    output = await execAsync(
      `cd "${projectDir}" && BASE_URL=http://localhost:${port} ../../node_modules/.bin/playwright test --reporter=list`,
      { encoding: "utf8" },
      60000 // 1 minute timeout for e2e tests
    );
    success = true;
  } catch (error) {
    if (error && typeof error === "object" && "stdout" in error) {
      output = (error as any).stdout || "";
      if ((error as any).stderr) {
        output += "\n" + (error as any).stderr;
      }
    } else {
      output = error instanceof Error ? error.message : String(error);
    }
  }

  return {
    success,
    output,
    duration: performance.now() - startTime,
  };
}

const runEvaluation = wrapTraced(async function runEvaluation(
  projectDir: string,
  verbose: boolean = false,
) {
  let buildSuccess = false;
  let buildOutput = "";
  let lintSuccess = false;
  let lintOutput = "";
  let testSuccess = false;
  let testOutput = "";
  let buildDuration = 0;
  let lintDuration = 0;
  let testDuration = 0;

  // Dependencies are now provided via symlink to shared node_modules
  // No need to run pnpm install individually for each eval

  try {
    // Run next build
    if (verbose) {
      console.log("Running build...");
    }
    const buildStart = performance.now();
    buildOutput += await execAsync(
      "cd " + projectDir + " && ../../node_modules/.bin/next build",
      {
        encoding: "utf8",
      },
      60000,
    ); // 1 minute timeout for build
    buildDuration = performance.now() - buildStart;
    buildSuccess = true;
    if (verbose) {
      console.log(`✓ Build completed (${formatDuration(buildDuration)})`);
    }
  } catch (error) {
    // Capture both stdout and stderr from failed build command
    if (error && typeof error === "object" && "stdout" in error) {
      buildOutput += (error as any).stdout || "";
      if ((error as any).stderr) {
        buildOutput += "\n" + (error as any).stderr;
      }
    } else {
      buildOutput += error instanceof Error ? error.message : String(error);
    }
    if (verbose) {
      console.log("✗ Build failed");
    }
  }

  try {
    // Run linting
    if (verbose) {
      console.log("Running lint...");
    }
    const lintStart = performance.now();
    // Check if .eslintrc.json exists, create a basic one if not
    const eslintConfigPath = path.join(projectDir, ".eslintrc.json");
    const eslintConfigExists = await fs
      .stat(eslintConfigPath)
      .then(() => true)
      .catch(() => false);

    if (!eslintConfigExists) {
      // Create a basic ESLint config to prevent interactive prompts
      const basicEslintConfig = {
        extends: "next/core-web-vitals",
      };
      await fs.writeFile(
        eslintConfigPath,
        JSON.stringify(basicEslintConfig, null, 2),
      );
    }

    lintOutput = await execAsync(
      "cd " + projectDir + " && ../../node_modules/.bin/next lint ",
      {
        encoding: "utf8",
      },
      30000,
    ); // 30 second timeout for lint
    lintDuration = performance.now() - lintStart;
    lintSuccess = true;
    if (verbose) {
      console.log(`✓ Lint completed (${formatDuration(lintDuration)})`);
    }
  } catch (error) {
    // Capture both stdout and stderr from failed lint command
    if (error && typeof error === "object" && "stdout" in error) {
      lintOutput = (error as any).stdout || "";
      if ((error as any).stderr) {
        lintOutput += "\n" + (error as any).stderr;
      }
    } else {
      lintOutput = error instanceof Error ? error.message : String(error);
    }
    if (verbose) {
      console.log("✗ Lint failed");
    }
  }

  // Check if we have e2e tests
  const hasE2E = await hasE2ETests(projectDir);

  if (hasE2E) {
    // Run Playwright e2e tests
    let serverProcess: ChildProcess | null = null;
    const port = 3000 + Math.floor(Math.random() * 1000); // Random port to avoid conflicts

    try {
      if (verbose) {
        console.log("Starting Next.js server for e2e tests...");
      }

      // Start the Next.js server
      serverProcess = await startNextServer(projectDir, port, verbose);

      if (verbose) {
        console.log(`✓ Server started on port ${port}`);
        console.log("Running Playwright e2e tests...");
      }

      // Run Playwright tests
      const testStart = performance.now();
      const playwrightResult = await runPlaywrightTests(projectDir, port, verbose);
      testDuration = playwrightResult.duration;
      testOutput = playwrightResult.output;
      testSuccess = playwrightResult.success;

      if (verbose) {
        if (testSuccess) {
          console.log(`✓ E2E tests completed (${formatDuration(testDuration)})`);
        } else {
          console.log("✗ E2E tests failed");
        }
      }
    } catch (error) {
      testOutput = error instanceof Error ? error.message : String(error);
      if (verbose) {
        console.log(`✗ E2E test setup failed: ${testOutput}`);
      }
    } finally {
      // Kill the server
      if (serverProcess) {
        serverProcess.kill("SIGTERM");
        // Give it a moment to clean up
        await new Promise((resolve) => setTimeout(resolve, 500));
        if (!serverProcess.killed) {
          serverProcess.kill("SIGKILL");
        }
        if (verbose) {
          console.log("✓ Server stopped");
        }
      }
    }
  } else {
    // Run vitest tests
    try {
      if (verbose) {
        console.log("Running tests...");
      }
      const testStart = performance.now();
      testOutput = await execAsync(
        "cd " + projectDir + " && ../../node_modules/.bin/vitest run",
        {
          encoding: "utf8",
        },
        30000,
      ); // 30 second timeout for tests
      testDuration = performance.now() - testStart;
      testSuccess = true;
      if (verbose) {
        console.log(`✓ Tests completed (${formatDuration(testDuration)})`);
      }
    } catch (error) {
      // Capture both stdout and stderr from failed test command
      if (error && typeof error === "object" && "stdout" in error) {
        testOutput = (error as any).stdout || "";
        if ((error as any).stderr) {
          testOutput += "\n" + (error as any).stderr;
        }
      } else {
        testOutput = error instanceof Error ? error.message : String(error);
      }
      if (verbose) {
        console.log("✗ Tests failed");
      }
    }
  }

  return {
    buildSuccess,
    buildOutput,
    buildDuration,
    lintSuccess,
    lintOutput,
    lintDuration,
    testSuccess,
    testOutput,
    testDuration,
  };
});

export const runSingleEval = wrapTraced(
  async function runSingleEval(
    model: Model,
    inputDir: string,
    outputDir: string,
    prompt: string,
  ) {
    // Copy files from input to output, excluding test files initially
    await copyFolder(inputDir, outputDir, true);
    const fileContents = await readProjectFiles(inputDir);
    const fullPrompt = createPrompt(prompt, fileContents);

    // Generate response from the model
    const startTime = Date.now();
    const response = await generateText({
      model: model.model,
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content: FULL_FILE_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: fullPrompt,
        },
      ],
    });

    // Manually log metrics to current Braintrust span using AI SDK 5 property names
    const span = currentSpan();
    if (span) {
      // Log the usage data in the format Braintrust expects
      span.log({
        input: {
          messages: [
            { role: "system", content: FULL_FILE_SYSTEM_PROMPT },
            { role: "user", content: fullPrompt },
          ],
          temperature: 0.1,
        },
        output: response.text,
        metrics: {
          // Report token metrics in Braintrust format
          prompt_tokens: response.usage?.inputTokens || 0,
          completion_tokens: response.usage?.outputTokens || 0,
          total_tokens: response.usage?.totalTokens || 0,
          prompt_cached_tokens: response.usage?.cachedInputTokens || 0,
          llm_duration: Date.now() - startTime,
        },
        metadata: {
          model: model.name,
          duration: Date.now() - startTime,
          reasoning_tokens: response.usage?.reasoningTokens || 0,
        },
      });
    }

    const diffContent = response.text;

    // Parse and apply the full files to the output directory
    await applyFullFiles(diffContent, outputDir);

    // Copy test files back after LLM generation and file changes
    await copyTestFiles(inputDir, outputDir);

    // Run the build and tests
    const results = await runEvaluation(outputDir);

    // Score the results (including LLM judge)
    const scoreResult = await scoreEval({
      modelResponse: diffContent,
      evaluationResults: results,
      inputDir,
      outputDir,
      debug: false, // Braintrust runs don't use debug mode
    });

    return {
      modelResponse: diffContent,
      evaluationResults: results,
      judgeResult: scoreResult.judgeResult,
    };
  },
  {
    type: "task",
  },
);

const scoreEval = wrapTraced(
  async function scoreEval({
    modelResponse,
    evaluationResults: results,
    inputDir,
    outputDir,
    debug = false,
    verbose = false,
  }: {
    modelResponse: string;
    evaluationResults: Awaited<ReturnType<typeof runEvaluation>>;
    inputDir: string;
    outputDir: string;
    debug?: boolean;
    verbose?: boolean;
  }) {
    // Score based on individual component success
    const buildScore = results.buildSuccess ? 1.0 : 0.0;
    const lintScore = results.lintSuccess ? 1.0 : 0.0;
    const testScore = results.testSuccess ? 1.0 : 0.0;

    // Run LLM judge if spec file exists
    let judgeResult: Awaited<ReturnType<typeof runJudge>> | null = null;
    const specContent = await readSpecFile(inputDir);

    if (specContent) {
      // Read the generated project files for judging
      const projectFiles = await readProjectFiles(outputDir);
      judgeResult = await runJudge(projectFiles, specContent, verbose);
    }

    const judgeScore = judgeResult?.score ?? 1.0; // Default to 1.0 if no spec

    // Overall score now includes judge (weighted average)
    // Build/Lint/Test must pass, but judge score gives more nuance
    const passingScore = buildScore * lintScore * testScore;
    const overallScore = passingScore * judgeScore;

    // Clean up by deleting the output folder (unless in debug mode)
    if (
      !debug &&
      (await fs
        .stat(outputDir)
        .then((stats) => stats.isDirectory())
        .catch(() => false))
    ) {
      try {
        await fs.rm(outputDir, { recursive: true, force: true });
        console.log(`Cleaned up output directory: ${outputDir}`);
      } catch (error) {
        console.error(
          `Failed to clean up output directory: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    } else if (debug) {
      console.log(`🐛 Debug mode: Output preserved at ${outputDir}`);
    }

    currentSpan().log({
      scores: {
        eval_score: overallScore,
        build_score: buildScore,
        lint_score: lintScore,
        test_score: testScore,
        judge_score: judgeScore,
      },
      metadata: {
        reasoning: `
Build: ${results.buildSuccess ? "Success" : "Failed"} (${
          results.buildDuration
        }ms)
Lint: ${results.lintSuccess ? "Success" : "Failed"} (${results.lintDuration}ms)
Tests: ${results.testSuccess ? "Success" : "Failed"} (${results.testDuration}ms)
Judge: ${judgeScore.toFixed(2)} ${judgeResult ? `(${judgeResult.explanation})` : "(no spec)"}

Build Output: ${results.buildOutput}
Lint Output: ${results.lintOutput}
Test Output: ${results.testOutput}
`,
        judge_criteria_met: judgeResult?.criteria_met || [],
        judge_criteria_failed: judgeResult?.criteria_failed || [],
      },
    });

    return { judgeResult };
  },
  {
    type: "score",
  },
);

async function runSingleEvalDry(
  model: Model,
  inputDir: string,
  outputDir: string,
  prompt: string,
  verbose: boolean = false,
  debug: boolean = false,
) {
  // Clear environment variables that might affect subsequent builds
  const envVarsToReset = [
    "NEXT_TELEMETRY_DISABLED",
    "NODE_ENV",
    "BUILD_ID",
    "ESLINT_NO_DEV_ERRORS",
    "GENERATE_SOURCEMAP",
  ];

  const originalEnv: Record<string, string | undefined> = {};

  for (const envVar of envVarsToReset) {
    originalEnv[envVar] = process.env[envVar];
    // Reset to clean state
    if (envVar === "NEXT_TELEMETRY_DISABLED") {
      process.env[envVar] = "1"; // Disable telemetry to prevent side effects
    } else {
      delete process.env[envVar];
    }
  }

  try {
    // Ensure output directory exists and copy files from input to output, excluding test files initially
    try {
      await fs.mkdir(outputDir, { recursive: true });
      await copyFolder(inputDir, outputDir, true);

      // Verify the directory was created successfully
      const outputDirExists = await fs
        .stat(outputDir)
        .then((stats) => stats.isDirectory())
        .catch(() => false);

      if (!outputDirExists) {
        throw new Error(`Failed to create output directory: ${outputDir}`);
      }
    } catch (error) {
      throw new Error(
        `Failed to set up output directory ${outputDir}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    // Read all files from output directory
    const fileContents = await readProjectFiles(outputDir);
    // Create the full prompt with file contents
    const fullPrompt = createPrompt(prompt, fileContents);

    if (verbose) {
      console.log(`🤖 Generating changes with ${model.name}...`);
    }

    // Generate response from the model (without Braintrust wrapping)
    const response = await generateText({
      model: model.model,
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content: FULL_FILE_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: fullPrompt,
        },
      ],
    });
    const diffContent = response.text;

    if (verbose) {
      console.log(`\n🤖 Raw LLM Generation from ${model.name}:`);
      console.log("─".repeat(80));
      console.log(diffContent);
      console.log("─".repeat(80));
      console.log(`📝 Applying file changes to ${outputDir}...`);
    }

    // Parse and apply the full files to the output directory
    await applyFullFiles(diffContent, outputDir, verbose);

    // Copy test files back after LLM generation and file changes
    await copyTestFiles(inputDir, outputDir);

    if (verbose) {
      console.log(`🔨 Running build...`);
    }

    // Run the build and tests on the modified directory
    const results = await runEvaluation(outputDir, verbose);

    // Clean up build artifacts and caches that might contaminate next run
    try {
      const buildDirs = [
        path.join(outputDir, ".next"),
        path.join(outputDir, "node_modules/.cache"),
        path.join(outputDir, ".eslintcache"),
        path.join(outputDir, "dist"),
        path.join(outputDir, "build"),
      ];

      for (const dir of buildDirs) {
        await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
      }
    } catch (error) {
      // Ignore cleanup errors
    }

    // Clean up output directory if not in debug mode
    if (!debug) {
      try {
        await fs.rm(outputDir, { recursive: true, force: true });
      } catch (error) {
        // Ignore cleanup errors
      }
    }

    return {
      modelResponse: diffContent,
      evaluationResults: results,
    };
  } finally {
    // Restore original environment variables
    for (const [envVar, originalValue] of Object.entries(originalEnv)) {
      if (originalValue === undefined) {
        delete process.env[envVar];
      } else {
        process.env[envVar] = originalValue;
      }
    }
  }
}



export async function createNewEval(name: string, prompt: string) {
  const evalsDir = path.join(process.cwd(), "evals");
  const templateDir = path.join(process.cwd(), "template");

  // Find the next available number
  const entries = await fs.readdir(evalsDir, { withFileTypes: true });
  const maxNum = entries
    .filter((entry) => entry.isDirectory() && /^\d+/.test(entry.name))
    .map((entry) => parseInt(entry.name.split("-")[0]))
    .reduce((max, num) => Math.max(max, num), -1);

  const newNum = String(maxNum + 1).padStart(3, "0");
  const evalName = `${newNum}-${name.toLowerCase().replace(/\s+/g, "-")}`;

  // Create eval directory
  const evalDir = path.join(evalsDir, evalName);
  await fs.mkdir(evalDir, { recursive: true });

  // Create the input directory by copying from template
  const inputDir = path.join(evalDir, "input");
  await fs.mkdir(inputDir, { recursive: true });
  await copyFolder(templateDir, inputDir);

  // Create the prompt.md file
  const promptFile = path.join(evalDir, "prompt.md");
  await fs.writeFile(promptFile, prompt, "utf8");

  console.log(`✅ Created new eval: ${evalName}`);
  console.log(`   Input directory: ${inputDir}`);
  console.log(`   Prompt file: ${promptFile}`);
  console.log(`
To run this eval:
  bun cli.ts --eval ${evalName}

Use --all to run all evals.`);
}

async function runSingleModelInProcess(
  modelIndex: number,
  evalPath: string,
  verbose: boolean,
  debug: boolean,
): Promise<{ model: string; result: any; score: number }> {
  const model = MODELS[modelIndex];
  const evalsDir = path.join(process.cwd(), "evals");
  const fullEvalPath = path.join(evalsDir, evalPath);
  const inputDir = path.join(fullEvalPath, "input");
  const promptFile = path.join(fullEvalPath, "prompt.md");
  const prompt = await fs.readFile(promptFile, "utf8");

  // Create model-specific output directory to avoid conflicts
  const modelOutputDir = path.join(
    fullEvalPath,
    `output-dry-${model.name.replace(/\s+/g, "-").toLowerCase()}`,
  );

  if (verbose) {
    console.log(`🤖 Running with ${model.name} in isolated process...`);
    console.log(`📁 Output Directory: ${modelOutputDir}\n`);
  }

  try {
    const result = await runSingleEvalDry(
      model,
      inputDir,
      modelOutputDir,
      prompt,
      verbose,
      debug,
    );

    const score =
      result.evaluationResults.buildSuccess &&
      result.evaluationResults.lintSuccess &&
      result.evaluationResults.testSuccess
        ? 1.0
        : 0.0;

    if (verbose) {
      console.log(`\n📊 Results for ${model.name}:`);
      console.log(
        `   Overall Score: ${score === 1.0 ? "✅ PASS" : "❌ FAIL"} (${score})`,
      );
      console.log(
        `   Build: ${
          result.evaluationResults.buildSuccess ? "✅" : "❌"
        } (${formatDuration(result.evaluationResults.buildDuration)})`,
      );
      console.log(
        `   Lint: ${
          result.evaluationResults.lintSuccess ? "✅" : "❌"
        } (${formatDuration(result.evaluationResults.lintDuration)})`,
      );
      console.log(
        `   Tests: ${
          result.evaluationResults.testSuccess ? "✅" : "❌"
        } (${formatDuration(result.evaluationResults.testDuration)})`,
      );

      if (score === 0.0) {
        console.log(`\n🔍 Debug Output:`);
        if (!result.evaluationResults.buildSuccess) {
          console.log(
            `   Build Error:\n${result.evaluationResults.buildOutput.slice(
              -500,
            )}`,
          );
        }
        if (!result.evaluationResults.lintSuccess) {
          console.log(
            `   Lint Error:\n${result.evaluationResults.lintOutput.slice(
              -500,
            )}`,
          );
        }
        if (!result.evaluationResults.testSuccess) {
          console.log(
            `   Test Error:\n${result.evaluationResults.testOutput.slice(
              -500,
            )}`,
          );
        }
      }

      console.log("\n" + "─".repeat(60) + "\n");
    }

    return {
      model: model.name,
      result,
      score,
    };
  } catch (error) {
    if (verbose) {
      console.log(
        `   ❌ Error: ${
          error instanceof Error ? error.message : String(error)
        }\n`,
      );
    }
    return {
      model: model.name,
      result: {
        error: error instanceof Error ? error.message : String(error),
      },
      score: 0.0,
    };
  }
}

async function runEvalDry(
  evalPath: string,
  verbose: boolean = false,
  debug: boolean = false,
  allModels: boolean = false,
) {
  const evalsDir = path.join(process.cwd(), "evals");
  const fullEvalPath = path.join(evalsDir, evalPath);

  // Check if the eval directory exists
  const evalStat = await fs.stat(fullEvalPath).catch(() => null);
  if (!evalStat || !evalStat.isDirectory()) {
    throw new Error(`Eval directory not found: ${evalPath}`);
  }

  // Look for input directory
  const inputDir = path.join(fullEvalPath, "input");
  const inputExists = await fs
    .stat(inputDir)
    .then((s) => s.isDirectory())
    .catch(() => false);
  if (!inputExists) {
    throw new Error(`No input directory found in ${evalPath}`);
  }

  // Read prompt from prompt.md
  const promptFile = path.join(fullEvalPath, "prompt.md");
  const promptExists = await fs
    .stat(promptFile)
    .then((s) => s.isFile())
    .catch(() => false);
  if (!promptExists) {
    throw new Error(`No prompt.md file found in ${evalPath}`);
  }

  const prompt = await fs.readFile(promptFile, "utf8");

  if (verbose) {
    console.log(`📝 Prompt: ${prompt}`);
    console.log(`📁 Input Directory: ${inputDir}`);
  }

  // Run all models or just the first one based on allModels flag
  const modelsToRun = allModels ? MODELS : [MODELS[0]];
  const modelResults: { model: string; result: any; score: number }[] = [];

  if (allModels && MODELS.length > 1) {
    // For multiple models, run each with separate output directories
    if (verbose) {
      console.log(
        `🔒 Running ${modelsToRun.length} models with isolated output directories`,
      );
    }

    // Run each model with its own output directory
    for (let i = 0; i < modelsToRun.length; i++) {
      const model = modelsToRun[i];
      const modelIndex = MODELS.findIndex((m) => m.name === model.name);

      if (verbose) {
        console.log(
          `🚀 Running model ${i + 1}/${modelsToRun.length}: ${model.name}`,
        );
      }

      const result = await runSingleModelInProcess(
        modelIndex,
        evalPath,
        verbose,
        debug,
      );

      modelResults.push(result);
    }
  } else {
    // For single model, run in the current process (backward compatibility)
    const model = modelsToRun[0];
    const modelIndex = MODELS.findIndex((m) => m.name === model.name);
    const result = await runSingleModelInProcess(
      modelIndex,
      evalPath,
      verbose,
      debug,
    );
    modelResults.push(result);
  }

  // Return appropriate result based on whether we ran all models or just one
  if (allModels) {
    return { modelResults };
  } else {
    // For single model, return the result in the original format for backward compatibility
    return modelResults[0].result;
  }
}

async function createExperiments(evalName: string) {
  return Object.fromEntries(
    MODELS.map((model) => [
      model.name,
      {
        experiment: initExperiment("EVALS", {
          experiment: model.name,
          metadata: {
            model: model.name,
            evalName,
          },
          setCurrent: false,
        }),
        model,
      },
    ]),
  );
}

export async function runEval(
  evalPath: string,
  dryRun: boolean = false,
  verbose: boolean = false,
  debug: boolean = false,
  allModels: boolean = false,
) {
  if (dryRun) {
    const result = await runEvalDry(evalPath, verbose, debug, allModels);
    // Return in a consistent format for dry runs
    if (allModels && result.modelResults) {
      // For all models, return the model results
      return {
        evalPath,
        modelResults: result.modelResults,
      };
    } else {
      // For single model, return the original format
      return {
        evalPath,
        evaluationResults: result.evaluationResults,
        modelResponse: result.modelResponse,
      };
    }
  }

  const evalsDir = path.join(process.cwd(), "evals");
  const fullEvalPath = path.join(evalsDir, evalPath);

  // Check if the eval directory exists
  const evalStat = await fs.stat(fullEvalPath).catch(() => null);
  if (!evalStat || !evalStat.isDirectory()) {
    throw new Error(`Eval directory not found: ${evalPath}`);
  }

  // Look for input directory
  const inputDir = path.join(fullEvalPath, "input");
  const inputExists = await fs
    .stat(inputDir)
    .then((s) => s.isDirectory())
    .catch(() => false);
  if (!inputExists) {
    throw new Error(`No input directory found in ${evalPath}`);
  }

  // Read prompt from prompt.md
  const promptFile = path.join(fullEvalPath, "prompt.md");
  const promptExists = await fs
    .stat(promptFile)
    .then((s) => s.isFile())
    .catch(() => false);
  if (!promptExists) {
    throw new Error(`No prompt.md file found in ${evalPath}`);
  }

  const prompt = await fs.readFile(promptFile, "utf8");
  const outputDir = path.join(fullEvalPath, "output-dry");

  // Set up Braintrust experiments
  const experiments = await createExperiments(evalPath);

  await Promise.all(
    Object.values(experiments).map(async ({ experiment, model }) =>
      experiment.traced(
        async () => {
          // Use a unique output directory for each model to avoid conflicts
          const modelOutputDir = path.join(
            fullEvalPath,
            `output-dry-${model.name.replace(/\s+/g, "-")}`,
          );
          await runSingleEval(model, inputDir, modelOutputDir, prompt.trim());
        },
        {
          event: {
            input: prompt.trim(),
            metadata: {
              evalName: evalPath,
              inputDir,
              outputDir,
            },
          },
          name: "eval",
          type: "task",
        },
      ),
    ),
  );

  const allResults: ExperimentSummary[] = [];

  for (const experiment of Object.values(experiments)) {
    const result = await experiment.experiment.summarize();
    console.log(result);
    allResults.push(result);
  }

  return allResults.length > 0 ? allResults : [{ success: true }]; // Return all experiment results
}
