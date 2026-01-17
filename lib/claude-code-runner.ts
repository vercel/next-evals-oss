import fs from "fs/promises";
import { existsSync, readdirSync } from "fs";
import path from "path";
import { spawn, ChildProcess } from "child_process";
import { performance } from "perf_hooks";
import { homedir } from "os";
import { copyFolder, ensureSharedDependencies } from "./eval-runner";
import { captureAndCompare } from "./visual-diff";

/**
 * Verify that the SKILL.md approach was actually used by checking the conversation transcript.
 * Looks for:
 * 1. `npx @judegao/next-skills pull` command being executed
 * 2. Doc files (.mdx) being read from the temp docs path
 */
export async function verifySkillUsage(outputDir: string): Promise<{
  skillUsed: boolean;
  pullCommandExecuted: boolean;
  docsRead: boolean;
  docsFilesRead: string[];
}> {
  const result = {
    skillUsed: false,
    pullCommandExecuted: false,
    docsRead: false,
    docsFilesRead: [] as string[],
  };

  try {
    // Convert output dir to Claude projects path format
    // e.g., /Users/judegao/code/projects/next-evals-oss/evals/012-parallel-routes/output-claude-code-nextjs-skill-123
    // becomes: -Users-judegao-code-projects-next-evals-oss-evals-012-parallel-routes-output-claude-code-nextjs-skill-123
    const projectPathEncoded = outputDir.replace(/\//g, '-');
    const claudeProjectsDir = path.join(homedir(), '.claude', 'projects', projectPathEncoded);

    if (!existsSync(claudeProjectsDir)) {
      return result;
    }

    // Find the .jsonl transcript file
    const files = readdirSync(claudeProjectsDir);
    const jsonlFile = files.find(f => f.endsWith('.jsonl'));
    if (!jsonlFile) {
      return result;
    }

    const transcriptPath = path.join(claudeProjectsDir, jsonlFile);
    const content = await fs.readFile(transcriptPath, 'utf-8');

    // Check for pull command execution
    if (content.includes('npx @judegao/next-skills pull') || content.includes('next-skills pull')) {
      result.pullCommandExecuted = true;
    }

    // Check for docs being read - look for .mdx files in next-skills temp paths
    const mdxMatches = content.match(/\/(?:tmp|var\/folders)[^"]*next-skills[^"]*\.mdx/g);
    if (mdxMatches && mdxMatches.length > 0) {
      result.docsRead = true;
      // Extract unique file names
      const uniqueFiles = [...new Set(mdxMatches.map(p => path.basename(p)))];
      result.docsFilesRead = uniqueFiles;
    }

    // Skill is considered "used" if pull was executed
    result.skillUsed = result.pullCommandExecuted;

  } catch (error) {
    // Silently fail - verification is best-effort
  }

  return result;
}

// Global port allocator for concurrent eval runs
let nextAvailablePort = 4000;
const portLock: { [key: number]: boolean } = {};

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
  visualDiff?: {
    success: boolean;
    screenshotPath?: string;
    pixelDifference?: number;
    error?: string;
  };
  evalPath?: string;
  timestamp?: string;
  retryStatus?: 'no-retry' | 'retry-passed' | 'retry-failed';
  skillVerification?: {
    skillUsed: boolean;
    pullCommandExecuted: boolean;
    docsRead: boolean;
    docsFilesRead: string[];
  };
}

export interface ClaudeCodeEvalOptions {
  timeout?: number;
  verbose?: boolean;
  debug?: boolean;
  apiKey?: string;
  devServer?: {
    enabled: boolean;
    command?: string;
    port?: number;
  };
  hooks?: {
    preEval?: string;
    postEval?: string;
  };
  visualDiff?: boolean;
  outputFormat?: string;
  outputFile?: string;
  nextjsDocs?: boolean;
  nextjsSkill?: boolean; // Use SKILL.md approach instead of CLAUDE.md
  nextjsSkill2?: boolean; // SKILL.md + CLAUDE.md instructions to boost skill trigger rate
  outputSuffix?: string; // Custom suffix for output folder (e.g., "nextjs-docs" -> "output-claude-code-nextjs-docs")
  maxRetries?: number; // Maximum retry attempts when eval fails (default: 4)
}

export class ClaudeCodeRunner {
  private processes = new Map<string, ChildProcess>();
  private devServerProcess?: ChildProcess;
  private verbose: boolean;
  private debug: boolean;
  private apiKey?: string;
  private devServer?: { enabled: boolean; command?: string; port?: number };
  private hooks?: { preEval?: string; postEval?: string };
  private visualDiff: boolean;
  private nextjsDocs: boolean;
  private nextjsSkill: boolean;
  private nextjsSkill2: boolean;

  constructor(options: ClaudeCodeEvalOptions = {}) {
    this.verbose = options.verbose || false;
    this.debug = options.debug || false;
    this.apiKey = options.apiKey || process.env.ANTHROPIC_API_KEY;
    this.devServer = options.devServer;
    this.hooks = options.hooks;
    this.visualDiff = options.visualDiff || false;
    this.nextjsDocs = options.nextjsDocs || false;
    this.nextjsSkill = options.nextjsSkill || false;
    this.nextjsSkill2 = options.nextjsSkill2 || false;
  }

  async runClaudeCodeEval(
    inputDir: string,
    outputDir: string,
    prompt: string,
    evalName: string,
    timeout: number = 600000 // 10 minutes default
  ): Promise<ClaudeCodeResult> {
    const startTime = performance.now();
    let postEvalHookRan = false;

    try {
      // Ensure output directory exists and copy input files
      await fs.mkdir(outputDir, { recursive: true });
      await copyFolder(inputDir, outputDir);

      // If we're in a worktree, install dependencies in outputDir
      if (outputDir.includes('.worktrees/')) {
        if (this.verbose) {
          console.log(`📦 Installing dependencies in worktree...`);
        }

        try {
          const { spawn } = await import("child_process");
          await new Promise<void>((resolve, reject) => {
            const proc = spawn("npm", ["install"], {
              cwd: outputDir,
              stdio: this.verbose ? "inherit" : "pipe"
            });

            proc.on("exit", (code) => {
              if (code === 0) {
                if (this.verbose) {
                  console.log(`✅ Dependencies installed in worktree`);
                }
                resolve();
              } else {
                reject(new Error(`npm install failed with code ${code}`));
              }
            });

            proc.on("error", reject);
          });
        } catch (installError) {
          console.error(`⚠️  Failed to install dependencies: ${installError}`);
          throw installError;
        }
      }

      // Ensure shared dependencies are available
      await ensureSharedDependencies(this.verbose);

      // Run next-skills to generate CLAUDE.md with Next.js docs if enabled
      if (this.nextjsDocs) {
        await this.runNextSkills(outputDir);
      }

      // Create SKILL.md for on-demand docs pulling if enabled
      if (this.nextjsSkill) {
        await this.createNextjsSkill(outputDir);
      }

      // Create SKILL.md + CLAUDE.md with skill-boost instructions for SKILL2
      if (this.nextjsSkill2) {
        await this.createNextjsSkill2(outputDir);
      }

      // Start dev server if enabled
      if (this.devServer?.enabled) {
        await this.startDevServer(outputDir, evalName);
      }

      // Run pre-eval hook
      if (this.hooks?.preEval) {
        await this.runHookScript(this.hooks.preEval, outputDir, evalName);
      }

      if (this.verbose) {
        console.log(`\n🤖 Running Claude Code on ${outputDir}...`);
        console.log(`📝 Prompt: ${prompt}`);
        console.log('─'.repeat(80));
      }

      // Run Claude Code with the prompt
      const claudeResult = await this.executeClaudeCode(outputDir, prompt, timeout);

      if (!claudeResult.success) {
        return {
          success: false,
          output: claudeResult.output,
          error: claudeResult.error,
          duration: performance.now() - startTime,
        };
      }

      // Run evaluation (build, lint, test) on the modified code
      const evalResults = await this.runEvaluation(outputDir);

      // Run post-eval hook
      if (this.hooks?.postEval) {
        await this.runHookScript(this.hooks.postEval, outputDir, evalName);
        postEvalHookRan = true;
      }

      // Run visual diff if enabled and dev server is running
      let visualDiffResult;
      if (this.visualDiff && this.devServer?.enabled) {
        const port = this.devServer.port || 3000;
        visualDiffResult = await captureAndCompare({
          url: `http://localhost:${port}`,
          outputDir,
          evalPath: evalName,
          enabled: true,
        });
      }

      return {
        success: true,
        output: claudeResult.output,
        duration: performance.now() - startTime,
        buildSuccess: evalResults.buildSuccess,
        lintSuccess: evalResults.lintSuccess,
        testSuccess: evalResults.testSuccess,
        buildOutput: evalResults.buildOutput,
        lintOutput: evalResults.lintOutput,
        testOutput: evalResults.testOutput,
        visualDiff: visualDiffResult,
      };
    } catch (error) {
      return {
        success: false,
        output: "",
        error: error instanceof Error ? error.message : String(error),
        duration: performance.now() - startTime,
      };
    } finally {
      // Run post-eval hook even on error (if it hasn't run yet)
      if (this.hooks?.postEval && !postEvalHookRan) {
        try {
          await this.runHookScript(this.hooks.postEval, outputDir, evalName);
        } catch (hookError) {
          // Log but don't fail if post-eval hook fails
          console.error(`Post-eval hook failed: ${hookError}`);
        }
      }
      // Clean up if not in debug mode
      if (!this.debug) {
        try {
          await fs.rm(outputDir, { recursive: true, force: true });
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    }
  }

  private async executeClaudeCode(
    projectDir: string,
    prompt: string,
    timeout: number
  ): Promise<{ success: boolean; output: string; error?: string }> {
    return new Promise((resolve, reject) => {
      const processId = Math.random().toString(36).substr(2, 9);

      // Prepare environment variables
      const env = { ...process.env };
      if (this.apiKey) {
        env.ANTHROPIC_API_KEY = this.apiKey;
      }

      // Enhance the prompt with additional instructions (similar to cursor-agent)
      const enhancedPrompt = `${prompt}

IMPORTANT: Do not run npm, pnpm, yarn, or any package manager commands. Dependencies have already been installed. Do not run build, test, or dev server commands. Just write the code files. DO Not ask any followup questions either.`;

      // Spawn Claude Code process with --print flag for non-interactive mode
      // Additional flags to ensure it works well in automation:
      // --dangerously-skip-permissions: bypass file/execution permission prompts
      // --print: non-interactive mode that prints response and exits
      // --mcp-config: load MCP servers from .mcp.json if it exists
      const mcpConfigPath = path.join(projectDir, '.mcp.json');
      const mcpConfigExists = existsSync(mcpConfigPath);

      const args = [
        ...(mcpConfigExists ? ['--mcp-config', mcpConfigPath] : []),
        '--print',
        '--dangerously-skip-permissions',
        enhancedPrompt
      ];

      if (this.verbose) {
        console.log('🚀 Spawning claude process with:');
        console.log('  Command: claude');
        console.log('  Args:', args);
        console.log('  Working Directory:', projectDir);
        console.log('  API Key present:', !!this.apiKey);
      }

      const claudeProcess = spawn('claude', args, {
        cwd: projectDir,
        env,
        stdio: ['pipe', 'pipe', 'pipe'] // pipe stdin to send "yes" for MCP prompts
      });
      this.processes.set(processId, claudeProcess);

      // Auto-approve MCP server trust prompt by sending "1" (Yes, proceed)
      if (claudeProcess.stdin) {
        claudeProcess.stdin.write('1\n');
        claudeProcess.stdin.end();
      }

      let stdout = '';
      let stderr = '';

      claudeProcess.stdout?.on('data', (data) => {
        const output = data.toString();
        if (this.verbose) {
          console.log('📝 Claude stdout:', JSON.stringify(output));
        }
        stdout += output;
      });

      claudeProcess.stderr?.on('data', (data) => {
        const output = data.toString();
        if (this.verbose) {
          console.log('⚠️  Claude stderr:', JSON.stringify(output));
        }
        stderr += output;
      });

      const timeoutId = setTimeout(() => {
        claudeProcess.kill('SIGTERM');
        setTimeout(() => {
          claudeProcess.kill('SIGKILL');
        }, 5000);
        resolve({
          success: false,
          output: stdout,
          error: `Claude Code process timed out after ${timeout}ms`
        });
      }, timeout);

      claudeProcess.on('exit', (code, signal) => {
        clearTimeout(timeoutId);
        this.processes.delete(processId);

        if (this.verbose) {
          console.log('─'.repeat(80));
          console.log(`Claude Code finished with code: ${code}, signal: ${signal}`);
        }

        if (signal) {
          resolve({
            success: false,
            output: stdout,
            error: `Claude Code process killed by signal ${signal}`
          });
        } else if (code === 0) {
          resolve({
            success: true,
            output: stdout
          });
        } else {
          resolve({
            success: false,
            output: stdout,
            error: stderr || `Claude Code process exited with code ${code}`
          });
        }
      });

      claudeProcess.on('error', (error) => {
        clearTimeout(timeoutId);
        this.processes.delete(processId);
        resolve({
          success: false,
          output: stdout,
          error: error.message
        });
      });
    });
  }

  private async runEvaluation(projectDir: string): Promise<{
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

    // Determine node_modules path based on whether we're in a worktree
    // In worktree: ./node_modules (symlinked in outputDir)
    // In regular: ../../node_modules (shared at repo root)
    const nodeModulesPath = projectDir.includes('.worktrees/')
      ? './node_modules/.bin'
      : '../../node_modules/.bin';

    // Run next build
    try {
      if (this.verbose) {
        console.log("Running build...");
      }
      buildOutput = await this.execCommand(
        `cd "${projectDir}" && ${nodeModulesPath}/next build`,
        60000
      );
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

    // Run linting
    try {
      if (this.verbose) {
        console.log("Running lint...");
      }

      // Use eslint directly (template includes eslint.config.mjs)
      lintOutput = await this.execCommand(
        `cd "${projectDir}" && ${nodeModulesPath}/eslint .`,
        30000
      );
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

    // Run tests
    try {
      if (this.verbose) {
        console.log("Running tests...");
      }
      testOutput = await this.execCommand(
        `cd "${projectDir}" && ${nodeModulesPath}/vitest run`,
        30000
      );
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

    return {
      buildSuccess,
      buildOutput,
      lintSuccess,
      lintOutput,
      testSuccess,
      testOutput,
    };
  }

  private async execCommand(command: string, timeout: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const { exec } = require('child_process');
      const process = exec(command, {
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        timeout
      }, (error: any, stdout: string, stderr: string) => {
        if (error) {
          error.stdout = stdout;
          error.stderr = stderr;
          reject(error);
        } else {
          resolve(stdout);
        }
      });
    });
  }

  private async allocatePort(): Promise<number> {
    // Simple synchronized port allocation
    while (portLock[nextAvailablePort]) {
      nextAvailablePort++;
    }
    const port = nextAvailablePort;
    portLock[port] = true;
    nextAvailablePort++;
    return port;
  }

  private releasePort(port: number): void {
    delete portLock[port];
  }

  private async findAvailablePort(startPort: number): Promise<number> {
    const net = await import('net');

    return new Promise((resolve, reject) => {
      const server = net.createServer();

      server.listen(startPort, () => {
        const port = (server.address() as any).port;
        server.close(() => resolve(port));
      });

      server.on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          // Port is in use, try next one
          resolve(this.findAvailablePort(startPort + 1));
        } else {
          reject(err);
        }
      });
    });
  }

  private async startDevServer(
    projectDir: string,
    evalName: string
  ): Promise<void> {
    if (!this.devServer?.enabled) return;

    // Only start if not already running
    if (this.devServerProcess) return;

    const command = this.devServer.command || "npm run dev";

    // Allocate a unique port for concurrent execution
    const port = await this.allocatePort();

    // Update the port in devServer config so hooks can use it
    this.devServer.port = port;

    return new Promise((resolve, reject) => {
      const [cmd, ...args] = command.split(' ');

      this.devServerProcess = spawn(cmd, args, {
        cwd: projectDir,
        env: { ...process.env, PORT: String(port) },
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let output = '';

      const onData = (data: Buffer) => {
        const str = data.toString();
        output += str;
        if (this.verbose) {
          console.log(`[dev-server] ${str.trim()}`);
        }

        // Check for various "ready" indicators
        if (
          str.includes('Ready in') ||
          str.includes('started server on') ||
          str.includes('Local:') ||
          str.includes(`http://localhost:${port}`)
        ) {
          this.devServerProcess?.stdout?.off('data', onData);
          this.devServerProcess?.stderr?.off('data', onData);
          resolve();
        }
      };

      this.devServerProcess.stdout?.on('data', onData);
      this.devServerProcess.stderr?.on('data', onData);

      this.devServerProcess.on('error', (error) => {
        reject(new Error(`Failed to start dev server: ${error.message}`));
      });

      this.devServerProcess.on('exit', (code) => {
        if (code !== 0) {
          reject(new Error(`Dev server exited with code ${code}\n${output}`));
        }
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.devServerProcess && !this.devServerProcess.killed) {
          reject(new Error('Dev server startup timeout (30s)\n' + output));
        }
      }, 30000);
    });
  }

  private async stopDevServer(): Promise<void> {
    if (!this.devServerProcess) return;

    const port = this.devServer?.port;

    if (this.verbose) {
      console.log('🛑 Stopping dev server...');
    }

    return new Promise<void>((resolve) => {
      this.devServerProcess!.kill('SIGTERM');
      this.devServerProcess!.on('exit', () => {
        this.devServerProcess = undefined;
        // Release the port back to the pool
        if (port) {
          this.releasePort(port);
        }
        resolve();
      });
      // Force kill after 5 seconds
      setTimeout(() => {
        if (this.devServerProcess && !this.devServerProcess.killed) {
          this.devServerProcess.kill('SIGKILL');
          this.devServerProcess = undefined;
        }
        resolve();
      }, 5000);
    });
  }

  private async runNextSkills(projectDir: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn('npx', ['@judegao/next-skills@latest', '--experimental-claude-md'], {
        cwd: projectDir,
        stdio: this.verbose ? 'inherit' : 'pipe'
      });

      let output = '';

      if (!this.verbose) {
        proc.stdout?.on('data', (data) => {
          output += data.toString();
        });
        proc.stderr?.on('data', (data) => {
          output += data.toString();
        });
      }

      proc.on('exit', (code) => {
        if (code === 0) {
          resolve();
        } else {
          if (this.verbose) {
            console.log(`next-skills output: ${output}`);
          }
          reject(new Error(`next-skills exited with code ${code}`));
        }
      });

      proc.on('error', (error) => {
        console.log(` ❌`);
        reject(new Error(`Failed to run next-skills: ${error.message}`));
      });
    });
  }

  private async createNextjsSkill(projectDir: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn('npx', ['@judegao/next-skills@latest', '--agent', 'claude'], {
        cwd: projectDir,
        stdio: this.verbose ? 'inherit' : 'pipe'
      });

      let output = '';

      if (!this.verbose) {
        proc.stdout?.on('data', (data) => {
          output += data.toString();
        });
        proc.stderr?.on('data', (data) => {
          output += data.toString();
        });
      }

      proc.on('exit', (code) => {
        if (code === 0) {
          resolve();
        } else {
          if (this.verbose) {
            console.log(`next-skills --agent claude output: ${output}`);
          }
          reject(new Error(`next-skills --agent claude exited with code ${code}`));
        }
      });

      proc.on('error', (error) => {
        reject(new Error(`Failed to run next-skills --agent claude: ${error.message}`));
      });
    });
  }

  private async createNextjsSkill2(projectDir: string): Promise<void> {
    // Step 1: Create SKILL.md (same as SKILL approach)
    await this.createNextjsSkill(projectDir);

    // Step 2: Pre-run npx @judegao/next-skills pull to download docs
    await this.pullNextSkillsDocs(projectDir);

    // Step 3: Create simple CLAUDE.md that nudges to use the skill
    const claudeMdContent = `# Next.js Project

Before starting any Next.js task, always use the \`nextjs-doc\` skill first. Your training data may be outdated.
`;

    const claudeMdPath = path.join(projectDir, 'CLAUDE.md');
    await fs.writeFile(claudeMdPath, claudeMdContent, 'utf-8');
  }

  private async pullNextSkillsDocs(projectDir: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn('npx', ['@judegao/next-skills', 'pull'], {
        cwd: projectDir,
        stdio: this.verbose ? 'inherit' : 'pipe'
      });

      proc.on('exit', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`next-skills pull exited with code ${code}`));
        }
      });

      proc.on('error', (error) => {
        reject(new Error(`Failed to run next-skills pull: ${error.message}`));
      });
    });
  }

  private async runHookScript(
    script: string,
    outputDir: string,
    evalName: string
  ): Promise<void> {
    const port = this.devServer?.port || 3000;
    const evalDir = path.dirname(path.dirname(outputDir)); // Go up from output dir to eval dir

    return new Promise((resolve, reject) => {
      const hookProcess = spawn('bash', [script], {
        env: {
          ...process.env,
          PORT: String(port),
          OUTPUT_DIR: outputDir,
          EVAL_NAME: evalName,
          EVAL_DIR: evalDir,
        },
        stdio: this.verbose ? 'inherit' : 'pipe'
      });

      hookProcess.on('exit', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Hook script exited with code ${code}`));
        }
      });

      hookProcess.on('error', (error) => {
        reject(new Error(`Failed to run hook script: ${error.message}`));
      });
    });
  }

  async cleanup(): Promise<void> {
    // Stop dev server first
    await this.stopDevServer();

    // Then cleanup Claude processes
    const promises = Array.from(this.processes.entries()).map(
      ([processId, process]) =>
        new Promise<void>((resolve) => {
          process.kill('SIGTERM');
          process.on('exit', () => {
            this.processes.delete(processId);
            resolve();
          });
          // Force kill after 5 seconds if not terminated
          setTimeout(() => {
            process.kill('SIGKILL');
            this.processes.delete(processId);
            resolve();
          }, 5000);
        })
    );
    await Promise.all(promises);
  }
}

export async function runClaudeCodeEval(
  evalPath: string,
  options: ClaudeCodeEvalOptions = {},
  useWorktree: boolean = false,
  attemptNumber: number = 0 // 0 = first attempt, 1 = first retry, etc.
): Promise<ClaudeCodeResult> {
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

  let outputDir: string;
  let worktreePath: string | undefined;
  let worktreeInputDir: string;

  // Generate a unique timestamp for this run to ensure isolation
  const runTimestamp = Date.now();

  if (useWorktree) {
    // Create a git worktree for isolated execution
    const worktreesDir = path.join(process.cwd(), ".worktrees");
    await fs.mkdir(worktreesDir, { recursive: true });

    worktreePath = path.join(worktreesDir, `${evalPath}-${Date.now()}`);

    try {
      // Create worktree (detached HEAD to avoid branch conflicts)
      const { spawn } = await import("child_process");
      await new Promise<void>((resolve, reject) => {
        const proc = spawn("git", ["worktree", "add", "--detach", worktreePath, "HEAD"], {
          cwd: process.cwd(),
          stdio: "pipe"
        });

        proc.on("exit", (code) => {
          if (code === 0) resolve();
          else reject(new Error(`Failed to create worktree (exit code ${code})`));
        });

        proc.on("error", reject);
      });

      // We'll symlink node_modules after outputDir is created

      // Also symlink .next build artifacts if they exist
      const mainNextDir = path.join(process.cwd(), ".next");
      const worktreeNextDir = path.join(worktreePath, ".next");
      const nextExists = await fs.stat(mainNextDir).then(() => true).catch(() => false);

      if (nextExists) {
        try {
          await fs.symlink(mainNextDir, worktreeNextDir, "dir");
        } catch {
          // Ignore if symlink fails
        }
      }
    } catch (error) {
      throw new Error(`Failed to create worktree: ${error}`);
    }

    // Use flattened paths within the worktree
    // Copy input files directly to worktree root to avoid deep nesting
    worktreeInputDir = inputDir; // Still read from original location
    const attemptSuffix = attemptNumber > 0 ? `-attempt${attemptNumber + 1}` : '';
    const outputFolderName = options.outputSuffix
      ? `output-claude-code-${options.outputSuffix}-${runTimestamp}${attemptSuffix}`
      : `output-claude-code-${runTimestamp}${attemptSuffix}`;
    outputDir = path.join(worktreePath, outputFolderName);
  } else {
    worktreeInputDir = inputDir;
    const attemptSuffix = attemptNumber > 0 ? `-attempt${attemptNumber + 1}` : '';
    const outputFolderName = options.outputSuffix
      ? `output-claude-code-${options.outputSuffix}-${runTimestamp}${attemptSuffix}`
      : `output-claude-code-${runTimestamp}${attemptSuffix}`;
    outputDir = path.join(fullEvalPath, outputFolderName);
  }

  const runner = new ClaudeCodeRunner(options);

  const maxRetries = options.maxRetries ?? 4; // Total (1 initial + maxRetries) attempts

  try {
    const result = await runner.runClaudeCodeEval(worktreeInputDir, outputDir, prompt, evalPath, options.timeout);

    // Verify skill usage if this is a skill run (SKILL or SKILL2)
    if (options.nextjsSkill || options.nextjsSkill2) {
      const skillVerification = await verifySkillUsage(outputDir);
      result.skillVerification = skillVerification;
    }

    // If test didn't fully pass and we have retries remaining, try again
    const fullyPassed = result.buildSuccess && result.lintSuccess && result.testSuccess;
    if (!fullyPassed && attemptNumber < maxRetries) {
      if (options.verbose) {
        console.log(`\n🔄 Test didn't fully pass, retrying (attempt ${attemptNumber + 2}/${maxRetries + 1})...`);
      }

      // Cleanup current runner before retry
      await runner.cleanup();

      // Keep the output directory for debugging (each retry gets its own folder)

      // Cleanup worktree if used
      if (worktreePath) {
        try {
          const { spawn } = await import("child_process");
          await new Promise<void>((resolve) => {
            const proc = spawn("git", ["worktree", "remove", "--force", worktreePath], {
              cwd: process.cwd(),
              stdio: "pipe"
            });
            proc.on("exit", () => resolve());
            proc.on("error", () => resolve());
          });
        } catch {
          // Ignore cleanup errors
        }
      }

      // Retry the eval with incremented attempt number
      const retryResult = await runClaudeCodeEval(evalPath, options, useWorktree, attemptNumber + 1);

      // Return the better result (prefer the one that passed more checks)
      const originalScore = (result.buildSuccess ? 1 : 0) + (result.lintSuccess ? 1 : 0) + (result.testSuccess ? 1 : 0);
      const retryScore = (retryResult.buildSuccess ? 1 : 0) + (retryResult.lintSuccess ? 1 : 0) + (retryResult.testSuccess ? 1 : 0);

      if (retryScore > originalScore) {
        return { ...retryResult, retryStatus: 'retry-passed' as const };
      } else {
        return { ...result, retryStatus: 'retry-failed' as const };
      }
    }

    return { ...result, retryStatus: 'no-retry' as const };
  } finally {
    await runner.cleanup();

    // Cleanup worktree if used
    if (worktreePath) {
      try {
        const { spawn } = await import("child_process");
        await new Promise<void>((resolve) => {
          const proc = spawn("git", ["worktree", "remove", "--force", worktreePath], {
            cwd: process.cwd(),
            stdio: "pipe"
          });

          proc.on("exit", () => resolve());
          proc.on("error", () => resolve()); // Continue even if cleanup fails
        });
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}