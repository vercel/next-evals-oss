# Next.js Evals

Evaluates the quality and correctness of Next.js code against popular AI models.

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) - JavaScript runtime & package manager
- [pnpm](https://pnpm.io) - Package manager (for shared dependency management)

### Local Setup

```bash
# Clone the repository
git clone <repository-url>
cd next-evals

# Install dependencies
pnpm install

# Show help
bun cli.ts --help
```

### Environment Variables

Set up your API keys:

```bash
# For LLM-based evals
export BRAINTRUST_API_KEY="your-braintrust-key"
export AI_GATEWAY_API_KEY="your-ai-gateway-key"

# For Claude Code evals
export ANTHROPIC_API_KEY="your-anthropic-key"
```

**Note:** The `--dry` flag is recommended for testing as it runs evaluations locally without uploading results to Braintrust

## Usage

### CLI Commands

#### LLM-based Evals

Run evals using various LLM models (configured in `lib/models.ts`):

```bash
# Show help and all available options
bun cli.ts --help

# Run a specific eval (uploads results to Braintrust)
bun cli.ts --eval 001-server-component

# Run eval locally without Braintrust upload (recommended for testing)
bun cli.ts --dry --eval 001-server-component

# Run all evals in parallel
bun cli.ts --all --dry

# Run with multiple worker threads for better performance
# (useful for large eval sets, automatically manages concurrency)
bun cli.ts --all --dry --threads 4

# Run with all models (default: only first model)
bun cli.ts --dry --eval 001-server-component --all-models

# Debug mode - keep output folders for inspection
bun cli.ts --dry --debug --eval 001-server-component

# Verbose output - see detailed logs during execution
bun cli.ts --dry --verbose --eval 001-server-component

# Create a new eval from template
bun cli.ts --create --name "my-new-eval" --prompt "Create something cool"
```

#### Claude Code Evals

Run evals using Claude Code (AI coding agent):

```bash
# Run a specific eval with Claude Code
bun claude-code-cli.ts --eval 001-server-component

# Or use the main CLI with --claude-code flag
bun cli.ts --eval 001-server-component --claude-code

# Run all evals with Claude Code
bun claude-code-cli.ts --all

# With custom timeout (default: 600000ms = 10 minutes)
bun claude-code-cli.ts --eval 001-server-component --timeout 900000

# With custom API key (or use ANTHROPIC_API_KEY env var)
bun claude-code-cli.ts --eval 001-server-component --api-key sk-ant-...

# Verbose output
bun claude-code-cli.ts --eval 001-server-component --verbose

# Debug mode - keep output folders
bun claude-code-cli.ts --eval 001-server-component --debug

# Capture full conversation with tool calls (Claude Code only)
bun claude-code-cli.ts --eval 001-server-component --capture-conversation
```

**Conversation Capture (Claude Code only):**

Use the `--capture-conversation` flag to save the full conversation including all tool calls in JSONL format:

- `claude-conversation.jsonl` - Complete conversation with all tool calls and responses in JSONL format
- `claude-output.txt` - Human-readable summary of the evaluation

These files are saved in the output directory (`output-claude-code/`).

#### Claude Code with Dev Server and Hooks

Run Claude Code with a Next.js dev server and lifecycle hooks (e.g., for MCP server setup):

```bash
# Run with dev server and hook scripts
bun cli.ts --eval 001-server-component --claude-code \
  --with-dev-server \
  --pre-eval ./scripts/eval-hooks/nextjs-mcp-pre.sh \
  --post-eval ./scripts/eval-hooks/nextjs-mcp-post.sh

# Customize dev server command and port
bun cli.ts --eval 001-server-component --claude-code \
  --with-dev-server \
  --dev-server-cmd "pnpm dev" \
  --dev-server-port 3001 \
  --pre-eval ./scripts/eval-hooks/nextjs-mcp-pre.sh \
  --post-eval ./scripts/eval-hooks/nextjs-mcp-post.sh
```

**Dev Server & Hook Options:**

- `--with-dev-server` - Start Next.js dev server before eval
- `--dev-server-cmd <cmd>` - Command to start server (default: "npm run dev")
- `--dev-server-port <port>` - Port for dev server (default: 3000)
- `--pre-eval <script>` - Script to run after dev server starts, before Claude runs
- `--post-eval <script>` - Script to run after eval completes (for cleanup)

**Hook scripts receive these environment variables:**

- `$PORT` - The port the dev server is running on
- `$OUTPUT_DIR` - Path to the output directory where Claude is working
- `$EVAL_NAME` - Name of the current eval (e.g., "001-server-component")
- `$EVAL_DIR` - Path to the eval directory

**Example hook scripts** are provided in `scripts/eval-hooks/`:

- `nextjs-mcp-pre.sh` - Configures Next.js MCP server
- `nextjs-mcp-post.sh` - Cleans up Next.js MCP server configuration

## How it works

### Eval structure

Each eval consists of:

1. **Input Directory** (`input/`): A complete Next.js app in its initial state with failing tests
2. **Prompt File** (`prompt.md`): Contains the prompt text for the LLM
3. **Output Directory** (`output/`): Generated during eval run, contains LLM-modified project

### Evaluation Process

1. **Copy**: Input directory is copied to output directory
2. **Dev Server** (optional): Start Next.js dev server if `--with-dev-server` is enabled
3. **Pre-Eval Hook** (optional): Run setup script if `--pre-eval` is provided
4. **Analyze**: LLM reads all project files and receives the eval prompt
5. **Generate**: LLM provides changes as a unified diff
6. **Apply**: Diff is applied to the output directory using git
7. **Validate**: Project is built, linted, and tested
8. **Post-Eval Hook** (optional): Run cleanup script if `--post-eval` is provided
9. **Score**: Success is measured by build/lint/test results (binary 1.0/0.0)
10. **Cleanup**: Output directory and dev server are stopped

### Dry Run Mode

Use `--dry` flag to run evaluations locally without uploading results to Braintrust:

- Results are displayed in the CLI with detailed pass/fail information
- Shows timing for build, lint, and test phases
- Displays debug output for failed evaluations
- Useful for quick testing and development

### Parallel Execution & Multi-Threading

When running `--all`, evals execute in parallel for faster results. You can control the level of parallelism:

- **Single-threaded** (default): `bun cli.ts --all` - All evals run in the main process
- **Multi-threaded**: `bun cli.ts --all --threads 4` - Evals run in isolated worker threads

**Multi-threading benefits:**

- True parallelism across CPU cores
- Memory isolation between evals
- Better resource utilization
- Fault isolation (one failing eval doesn't affect others)
- Automatically limited to available CPU cores

### Table Output

Results are displayed in a summary table:

```
| Eval                     | Status | Build | Lint  | Tests |
|--------------------------|--------|-------|-------|-------|
| 001-server-component     | ✅ PASS  | ✅    | ✅   | ✅   |
| 002-client-component     | ❌ FAIL  | ❌    | ✅   | ✅   |
```

### Debug Mode

Use `--debug` flag to preserve output folders for inspection:

```bash
bun cli.ts --dry --debug --eval 001-server-component
```

This keeps the `output-dry/` folders after completion, allowing you to:

- Inspect the AI-generated changes
- Debug build/lint/test failures
- Understand why an eval failed

### Creating New Evals

The CLI will:

1. Create a new numbered directory under `evals/`
2. Copy the `template/` directory to create the `input/` state
3. Create a `prompt.md` file with your prompt text

## Models

Currently configured models (in `lib/models.ts`).

To add or modify models, edit the `MODELS` array in `lib/models.ts`.

### Custom Model Providers

To add your own custom model providers, see [Custom Model Provider Integration](lib/providers/README.md) for detailed instructions on how to configure and integrate your models.

## Dependency Management

This project uses a **shared dependency system** where all evals use the same `node_modules` for consistency and easier version management.

### Understanding the Setup

- **Shared dependencies**: All 50+ evals share `evals/node_modules/`
- **Template-based**: `template/package.json` is the source of truth for all package versions
- **Centralized updates**: One script syncs versions across all evals

### Quick Start

```bash
# Update dependencies across all evals
# 1. Edit template/package.json with new versions
# 2. Run:
bun scripts/sync-templates.ts
```

The sync script will:

- Copy `template/package.json` to all eval `input/` directories
- Copy `template/next.config.ts` to all eval `input/` directories
- Compare `evals/package.json` with the template
- If different: remove `evals/node_modules`, update, and run `pnpm install`

### Managing Package Dependencies

#### Updating Dependencies (Next.js, React, TypeScript, etc.)

All dependencies are defined in `template/package.json`:

```json
{
  "dependencies": {
    "next": "15.5.4",
    "react": "19.1.0",
    "react-dom": "19.1.0"
  }
}
```

**To update a dependency across all evals:**

1. Edit the version in `template/package.json`:

   ```json
   {
     "dependencies": {
       "next": "15.4.0"
     }
   }
   ```

2. Run the sync script:

   ```bash
   bun scripts/sync-templates.ts
   ```

3. Done! All 50+ evals now use Next.js 15.4.0

The script automatically:

- Copies the updated `package.json` to all evals
- Detects the version change
- Removes old `node_modules`
- Installs fresh dependencies

#### Adding New Dependencies

**For shared dependencies** (used by multiple evals):

1. Add to `template/package.json`:

   ```json
   {
     "dependencies": {
       "my-new-package": "^1.0.0"
     }
   }
   ```

2. Run the sync script:

   ```bash
   bun scripts/sync-templates.ts
   ```

**Note:** `template/package.json` contains the **superset** of all dependencies. Even if only one eval needs a package (like `@ai-sdk/react`), it's included in the template for simplicity.

### Managing Next.js Config Files

The sync script also updates `next.config.ts` across all evals:

1. Edit the template:

   ```bash
   # Edit this file with your desired config
   vim template/next.config.ts
   ```

2. Apply to all evals:
   ```bash
   bun scripts/sync-templates.ts
   ```

### Quick Reference

```bash
# Update dependencies or configs across all evals
# 1. Edit template/package.json or template/next.config.ts
# 2. Run:
bun scripts/sync-templates.ts

# The script will:
# - Copy templates to all eval input/ directories
# - Detect changes and reinstall dependencies if needed
# - Show progress and summary
```

## Template

The `template/` directory contains a basic Next.js project that serves as the starting point for all new evals. It includes:

- Next.js 15 with App Router
- TypeScript configuration
- ESLint and testing setup with Vitest
- A failing test that evals should fix
- All dependencies needed across all evals (superset)

## Eval Lifecycle Hooks

The eval system supports lifecycle hooks that run before and after evaluations. This is useful for:

- Setting up MCP servers for Claude
- Starting additional services
- Configuring development environments
- Cleanup tasks

### Hook Script Structure

Hook scripts receive environment variables with context about the eval:

```bash
#!/bin/bash
# Example pre-eval hook

echo "Setting up for $EVAL_NAME"
echo "Dev server on port: $PORT"
echo "Working directory: $OUTPUT_DIR"

# Your setup logic here
```

**Available environment variables:**

- `$PORT` - Dev server port (if `--with-dev-server` is used)
- `$OUTPUT_DIR` - Absolute path to output directory
- `$EVAL_NAME` - Eval identifier (e.g., "001-server-component")
- `$EVAL_DIR` - Absolute path to eval directory

### Example: Next.js MCP Server

The included example scripts show how to configure Claude's MCP server:

**Pre-eval** (`scripts/eval-hooks/nextjs-mcp-pre.sh`):

```bash
#!/bin/bash
echo "🔧 Setting up Next.js MCP server for $EVAL_NAME"
claude mcp add -t http nextjs-dev-$EVAL_NAME http://localhost:$PORT/_next/mcp
echo "✅ MCP server configured"
```

**Post-eval** (`scripts/eval-hooks/nextjs-mcp-post.sh`):

```bash
#!/bin/bash
echo "🧹 Cleaning up Next.js MCP server for $EVAL_NAME"
claude mcp remove nextjs-dev-$EVAL_NAME
echo "✅ MCP server removed"
```

### Creating Custom Hooks

1. Create your script in `scripts/eval-hooks/`:

   ```bash
   touch scripts/eval-hooks/my-custom-pre.sh
   chmod +x scripts/eval-hooks/my-custom-pre.sh
   ```

2. Add your setup logic using the environment variables

3. Use in evals:
   ```bash
   bun cli.ts --eval 001-server-component --claude-code \
     --pre-eval ./scripts/eval-hooks/my-custom-pre.sh
   ```
