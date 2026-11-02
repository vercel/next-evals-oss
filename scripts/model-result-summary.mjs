/** Read the exported dataset as data only. Never load code from a model PR. */
export function summarizeModelResults(dataset, pairs, excludedEvals = []) {
  const excluded = new Set(excludedEvals);
  return pairs.map(({ base }) => {
    const model = dataset.metadata?.experiments?.find(
      (entry) => entry.name === base,
    );
    const rows = dataset.results?.[base];
    const impact = model?.docsImpact;
    if (
      !model ||
      !Array.isArray(rows) ||
      !rows.length ||
      !impact ||
      ![1, 2].includes(model.tier) ||
      typeof model.modelName !== 'string' ||
      rows.some(
        (row) => row.notAvailable || typeof row.result?.success !== 'boolean',
      )
    ) {
      throw new Error(`Missing complete Base/AGENTS.md results for ${base}`);
    }
    const names = rows.map((row) => row.evalPath);
    const newlyPassed = impact.newlyPassed;
    const newlyFailed = impact.newlyFailed;
    if (
      new Set(names).size !== names.length ||
      names.some((name) => typeof name !== 'string') ||
      !Array.isArray(newlyPassed) ||
      !Array.isArray(newlyFailed)
    ) {
      throw new Error(`Invalid task comparison for ${base}`);
    }
    const flips = [...newlyPassed, ...newlyFailed];
    const docsPassed = new Set(
      rows.filter((row) => row.result.success).map((row) => row.evalPath),
    );
    if (
      new Set(flips).size !== flips.length ||
      flips.some((name) => !names.includes(name)) ||
      newlyPassed.some((name) => !docsPassed.has(name)) ||
      newlyFailed.some((name) => docsPassed.has(name))
    ) {
      throw new Error(`Invalid task comparison for ${base}`);
    }

    // The export retains the AGENTS.md rows and the exact task flips. Recover
    // the Base count from those flips, not from the rounded percentage.
    const basePassed =
      docsPassed.size - newlyPassed.length + newlyFailed.length;
    if (
      Math.round((100 * basePassed) / rows.length) !== impact.baseSuccessRate ||
      Math.round((100 * docsPassed.size) / rows.length) !==
        impact.docsSuccessRate
    ) {
      throw new Error(`Inconsistent score totals for ${base}`);
    }
    const publicNames = names.filter((name) => !excluded.has(name));
    if (!publicNames.length) throw new Error(`No public results for ${base}`);
    const publicDocsPassed = publicNames.filter((name) =>
      docsPassed.has(name),
    ).length;
    const publicNewlyPassed = newlyPassed.filter((name) => !excluded.has(name));
    const publicNewlyFailed = newlyFailed.filter((name) => !excluded.has(name));
    return {
      experiment: base,
      model: model.modelName,
      tier: model.tier,
      total: publicNames.length,
      basePassed:
        publicDocsPassed - publicNewlyPassed.length + publicNewlyFailed.length,
      agentsMdPassed: publicDocsPassed,
      newlyPassed: publicNewlyPassed,
      newlyFailed: publicNewlyFailed,
      failedBoth: publicNames.filter(
        (name) => !docsPassed.has(name) && !newlyFailed.includes(name),
      ),
    };
  });
}
