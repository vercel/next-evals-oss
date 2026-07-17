// Map the two validation exits (vitest EVAL.ts, npm run build) to harbor's
// reward.json. Mirrors agent-eval's allPassed = test && every(script).
const [, , vitestExit, buildExit] = process.argv;

const vitestPassed = Number(vitestExit) === 0 ? 1 : 0;
const buildPassed = Number(buildExit) === 0 ? 1 : 0;

console.log(
  JSON.stringify({
    reward: vitestPassed && buildPassed ? 1 : 0,
    vitestPassed,
    buildPassed,
  }),
);
