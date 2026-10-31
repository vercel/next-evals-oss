import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Scope historical-result retention to the exact reviewed fixture and summary.
// Future task edits or new results must pass the normal staleness gate again.
export function fixtureDigest(directory) {
  const hash = createHash('sha256');
  function visit(path, relative = '') {
    for (const name of readdirSync(path).sort()) {
      if (name === 'node_modules' || name === '.git') continue;
      const file = join(path, name);
      const key = `${relative}${name}`;
      if (statSync(file).isDirectory()) visit(file, `${key}/`);
      else
        hash.update(key).update('\0').update(readFileSync(file)).update('\0');
    }
  }
  visit(directory);
  return hash.digest('hex');
}

export function retainsGraderResult(root, experiment, evalName, policy) {
  const entry = policy[evalName];
  if (
    !entry ||
    fixtureDigest(join(root, 'evals', evalName)) !== entry.fixtureDigest
  )
    return false;
  const experimentDir = join(root, 'results', experiment);
  for (const timestamp of readdirSync(experimentDir).sort().reverse()) {
    const relativePath = `results/${experiment}/${timestamp}/${evalName}/summary.json`;
    let bytes;
    try {
      bytes = readFileSync(join(root, relativePath));
    } catch (error) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }
    if (JSON.parse(bytes).valid === false) continue;
    return (
      entry.summaries[relativePath] ===
      createHash('sha256').update(bytes).digest('hex')
    );
  }
  return false;
}
