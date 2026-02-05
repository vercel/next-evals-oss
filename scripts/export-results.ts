/**
 * Export eval results to JSON format for nextjs.org/evals
 *
 * Usage:
 *   npx tsx scripts/export-results.ts [experiments...]
 *
 * Examples:
 *   npx tsx scripts/export-results.ts claude-opus-4.5 gemini-3-pro
 *   npx tsx scripts/export-results.ts  # exports latest from all experiments
 *
 * Output: agent-results.json (copy this to front repo)
 */

import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

interface SummaryJson {
  totalRuns: number;
  passedRuns: number;
  meanDuration: number;
}

interface AgentResult {
  evalPath: string;
  result: {
    success: boolean;
    duration: number;
    evalPath: string;
    timestamp: string;
  };
}

interface ExportedData {
  metadata: {
    exportedAt: string;
    experiments: Array<{
      name: string;
      timestamp: string;
      agentName: string;
    }>;
  };
  results: Record<string, AgentResult[]>;
}

const AGENT_NAMES: Record<string, string> = {
  'claude-opus-4.5': 'Claude Opus 4.5',
  'claude-sonnet-4.5': 'Claude Sonnet 4.5',
  'gemini-3-pro-preview': 'Gemini 3 Pro Preview',
  'gpt-5.2-high': 'GPT 5.2 High',
};

function parseTimestamp(ts: string): string {
  const match = ts.match(
    /^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})\.(\d+)Z$/
  );
  if (match) {
    return `${match[1]}T${match[2]}:${match[3]}:${match[4]}.${match[5]}Z`;
  }
  return ts;
}

function formatAgentName(experiment: string): string {
  return AGENT_NAMES[experiment] || experiment;
}

async function getLatestTimestamp(expDir: string): Promise<string | null> {
  try {
    const timestamps = await readdir(expDir);
    const validTimestamps = timestamps.filter((ts) => !ts.startsWith('.'));
    if (validTimestamps.length === 0) return null;

    let latest: { ts: string; date: Date } | null = null;
    for (const ts of validTimestamps) {
      const parsed = parseTimestamp(ts);
      const date = new Date(parsed);
      if (!isNaN(date.getTime()) && (!latest || date > latest.date)) {
        latest = { ts, date };
      }
    }
    return latest?.ts || null;
  } catch {
    return null;
  }
}

async function exportExperiment(
  resultsDir: string,
  experiment: string
): Promise<{ agentName: string; timestamp: string; results: AgentResult[] } | null> {
  const expDir = join(resultsDir, experiment);

  try {
    await stat(expDir);
  } catch {
    console.warn(`Experiment not found: ${experiment}`);
    return null;
  }

  const timestamp = await getLatestTimestamp(expDir);
  if (!timestamp) {
    console.warn(`No results found for: ${experiment}`);
    return null;
  }

  const runDir = join(expDir, timestamp);
  const evalDirs = await readdir(runDir);
  const agentResults: AgentResult[] = [];

  for (const evalDir of evalDirs) {
    if (evalDir.startsWith('.')) continue;

    const summaryPath = join(runDir, evalDir, 'summary.json');
    try {
      const summaryRaw = await readFile(summaryPath, 'utf-8');
      const summary: SummaryJson = JSON.parse(summaryRaw);

      agentResults.push({
        evalPath: evalDir,
        result: {
          success: summary.passedRuns > 0,
          duration: summary.meanDuration * 1000,
          evalPath: evalDir,
          timestamp: parseTimestamp(timestamp),
        },
      });
    } catch {
      // Skip evals without summary
    }
  }

  if (agentResults.length === 0) {
    console.warn(`No eval results found for: ${experiment}`);
    return null;
  }

  return {
    agentName: formatAgentName(experiment),
    timestamp,
    results: agentResults.sort((a, b) => a.evalPath.localeCompare(b.evalPath)),
  };
}

async function main(): Promise<void> {
  const resultsDir = join(process.cwd(), 'results');

  let experiments = process.argv.slice(2);

  if (experiments.length === 0) {
    // Export from all experiments with results
    const allDirs = await readdir(resultsDir);
    experiments = allDirs.filter((d) => !d.startsWith('.'));
  }

  console.log(`Exporting from experiments: ${experiments.join(', ')}\n`);

  const exportedData: ExportedData = {
    metadata: {
      exportedAt: new Date().toISOString(),
      experiments: [],
    },
    results: {},
  };

  for (const experiment of experiments) {
    const data = await exportExperiment(resultsDir, experiment);
    if (!data) continue;

    const passed = data.results.filter((r) => r.result.success).length;
    console.log(`${experiment} -> ${data.agentName}: ${data.results.length} evals, ${passed} passed`);

    exportedData.metadata.experiments.push({
      name: experiment,
      timestamp: parseTimestamp(data.timestamp),
      agentName: data.agentName,
    });

    // Merge results by agent name
    if (exportedData.results[data.agentName]) {
      exportedData.results[data.agentName].push(...data.results);
    } else {
      exportedData.results[data.agentName] = data.results;
    }
  }

  const outputPath = join(process.cwd(), 'agent-results.json');
  await writeFile(outputPath, JSON.stringify(exportedData, null, 2));

  console.log(`\nExported to: ${outputPath}`);
  console.log(
    `Agents: ${Object.keys(exportedData.results).join(', ') || 'none'}`
  );
}

main().catch(console.error);
