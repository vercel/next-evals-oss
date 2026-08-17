/**
 * CI gate + scrubber for credentials that leak into committed eval results.
 *
 * Why this exists: the opencode agent is configured through a project-local
 * `opencode.json` that the framework writes into the sandbox with the live AI
 * Gateway credential at `provider.vercel.options.apiKey`. When a model decides to
 * `read` that file — which it does, it is one of the first files in /workspace —
 * the credential lands in the run's transcript, and the transcript is committed.
 * In practice the credential is a Vercel OIDC token (12h TTL, issued by
 * oidc.vercel.com), so a leak is short-lived, but this repo is public and the
 * tokens should not be published at all.
 *
 * The durable fix belongs upstream in @vercel/agent-eval: it knows the value it
 * put in the config, so it can redact that exact string when it serializes a
 * transcript. Until it does, this script is the backstop.
 *
 *   node scripts/check-secrets.mjs           # check mode; lists offenders, exits 1
 *   node scripts/check-secrets.mjs --write   # rewrite offenders in place
 *
 * Detection is decode-aware rather than prefix-based: a hit must be a structurally
 * real JWT (three base64url segments whose payload decodes to a JSON object) or
 * match a known vendor key shape. That keeps it off base64-ish lookalikes — the
 * framework's own `ses_…` session IDs contain `eyJ` substrings.
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const WRITE = process.argv.includes('--write');

const PLACEHOLDER = 'REDACTED_CREDENTIAL';

// Vendor keys that are long-lived and would need real rotation if they ever landed
// here. None have so far; they are listed so the gate covers the case where an
// experiment is pointed at a provider directly instead of through the Gateway.
const KEY_SHAPES = [
  { name: 'vercel-ai-gateway-key', re: /(?<![A-Za-z0-9_-])vck_[A-Za-z0-9]{20,}/g },
  { name: 'openai-key', re: /(?<![A-Za-z0-9_-])sk-[A-Za-z0-9_-]{20,}/g },
  { name: 'xai-key', re: /(?<![A-Za-z0-9_-])xai-[A-Za-z0-9]{20,}/g },
  { name: 'google-key', re: /(?<![A-Za-z0-9_-])AIza[A-Za-z0-9_-]{30,}/g },
  { name: 'github-token', re: /(?<![A-Za-z0-9_-])gh[pousr]_[A-Za-z0-9]{20,}/g },
];

// Three base64url segments. The lookbehind stops it matching an `eyJ` that is just
// the middle of a longer identifier.
const JWT_RE = /(?<![A-Za-z0-9_-])eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}/g;

/** A JWT's issuer, or null when the payload is not decodable JSON (i.e. not a real JWT). */
function issuerOf(jwt) {
  const payload = jwt.split('.')[1];
  try {
    const json = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
    if (typeof json !== 'object' || json === null) return null;
    return json.iss ?? '(no iss claim)';
  } catch {
    return null;
  }
}

const files = execSync('git ls-files -z', { encoding: 'utf-8', maxBuffer: 1 << 28 })
  .split('\0')
  .filter(Boolean);

const offenders = [];

for (const file of files) {
  if (file === 'scripts/check-secrets.mjs') continue; // the regexes above are not hits

  let text;
  try {
    text = readFileSync(file, 'utf-8');
  } catch {
    continue; // unreadable or binary; nothing to scrub
  }
  if (!text.includes('eyJ') && !KEY_SHAPES.some((k) => text.match(k.re))) continue;

  const hits = new Map(); // secret -> label

  for (const jwt of text.match(JWT_RE) ?? []) {
    const iss = issuerOf(jwt);
    if (iss) hits.set(jwt, `jwt iss=${iss}`);
  }
  for (const { name, re } of KEY_SHAPES) {
    for (const key of text.match(re) ?? []) hits.set(key, name);
  }
  if (hits.size === 0) continue;

  offenders.push({ file, labels: [...new Set(hits.values())] });

  if (WRITE) {
    let scrubbed = text;
    for (const secret of hits.keys()) scrubbed = scrubbed.split(secret).join(PLACEHOLDER);
    writeFileSync(file, scrubbed);
  }
}

if (offenders.length === 0) {
  console.log('No credentials found in tracked files.');
  process.exit(0);
}

const byLabel = new Map();
for (const { labels } of offenders) {
  for (const label of labels) byLabel.set(label, (byLabel.get(label) ?? 0) + 1);
}
const summary = [...byLabel].map(([label, n]) => `${label} (${n} files)`).join(', ');

if (WRITE) {
  console.log(`Redacted credentials in ${offenders.length} files: ${summary}`);
  process.exit(0);
}

console.error(`Credentials found in ${offenders.length} tracked files: ${summary}\n`);
for (const { file, labels } of offenders) {
  console.error(`  ${file} — ${labels.join(', ')}`);
}
console.error(
  '\nRun `node scripts/check-secrets.mjs --write` to redact them, then commit the result.\n' +
    'If a long-lived vendor key is listed above, rotate it as well — redacting the file ' +
    'does not revoke a key that was already pushed.'
);
process.exit(1);
