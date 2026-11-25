*Next.js 16.4.6 → 16.5.0-canary.65 · eval comparison*
GPT 6 Sol (high) · Codex · <https://github.com/vercel/next-evals-oss/pull/200|Measurement PR> · <https://github.com/vercel/next-evals-oss/blob/main/measurements/releases/16.4.6/42843516470/measurement.json|16.4.6 baseline>

• *Pass@1:* Base 26/28 → 27/28; AGENTS.md 26/28 → 27/28.
• *Observed regressions:* No pass→fail changes across the 28 comparable tasks.
• *Improvements:* `agent-029-use-cache-directive` in Base and `agent-040-instant` with AGENTS.md changed from fail→pass.
• *Estimated coding cost per matched passing task:*
  Base: $0.1935 → $0.2046 (*+5.7%*).
  AGENTS.md: $0.2751 → $0.2631 (*−4.4%*).
  Each condition matches 26/28 tasks; two tasks with failures are excluded, with no missing token usage.
• *Investigate:* `agent-041-optimize-ppr-shell` failed the scored attempt in both releases and both conditions. The canary's later confirmations were unstable; it is not a new regression.

One scored attempt per task. These are observed differences, not proof of a framework cause. Details and per-task cost increases/decreases follow in this thread.

---

*Findings · 16.4.6 → 16.5.0-canary.65*

*Pass→fail:* None.
*Fail→pass:* `agent-029-use-cache-directive` · Base; `agent-040-instant` · AGENTS.md.

*Existing failure to review: `agent-041-optimize-ppr-shell`*
The scored attempt failed in both releases, under both Base and AGENTS.md. In the canary confirmations, Base passed 1/2 and failed 1/2; AGENTS.md passed 2/2. These remain unstable first-attempt failures; confirmations do not replace the pass@1 scores.

The canary grader reports a shared Suspense boundary around `DashboardContent`, which awaits `getDashboardData()` before rendering `CardStats`, `RevenueChart` and `LatestInvoices`. The sections therefore share one fallback. This finding needs task/solution review; it is not a newly established framework regression.

The suite revision, task/grader pins, model/harness and full comparison/execution fingerprints match. The older baseline predates separately recorded configuration/judge hashes, so its exact original fingerprints establish compatibility. Remote model or CLI alias changes can still affect the comparison.

---

*Full task results · 16.4.6 → 16.5.0-canary.65*

*Changes and failures*
`agent-029-use-cache-directive` · Base 0/1 → 1/1 · AGENTS.md 1/1 → 1/1
`agent-040-instant` · Base 1/1 → 1/1 · AGENTS.md 0/1 → 1/1
`agent-041-optimize-ppr-shell` · Base 0/1 → 0/1 · AGENTS.md 0/1 → 0/1

*Passed in both versions and both conditions · Base 1/1 → 1/1 · AGENTS.md 1/1 → 1/1*

`agent-000-app-router-migration-simple`, `agent-021-avoid-fetch-in-effect`, `agent-022-prefer-server-actions`, `agent-023-avoid-getserversideprops`, `agent-024-avoid-redundant-usestate`, `agent-025-prefer-next-link`

`agent-027-prefer-next-image`, `agent-028-prefer-next-font`, `agent-031-proxy-middleware`, `agent-032-use-cache-directive`, `agent-033-forbidden-auth`, `agent-034-async-cookies`

`agent-035-connection-dynamic`, `agent-036-after-response`, `agent-037-updatetag-cache`, `agent-038-refresh-settings`, `agent-039-indirect-proxy`, `agent-042-enable-ppr`

`agent-043-view-transitions`, `agent-045-build-a-nextjs-app`, `agent-048-prefetch-url-data`, `agent-049-prefetch-stage`, `agent-051-prefetch-until-navigation`, `agent-052-cache-components-session-isolation`

`agent-053-cache-components-url-shell`

All original scored outputs, confirmation attempts and traces remain in <https://github.com/vercel/next-evals-oss/pull/200|measurement PR #200>. No coding eval was rerun to produce this comparison.

---

*Estimated coding cost · 16.4.6 → 16.5.0-canary.65*

Mean per unchanged task that passed in both releases. Provider token usage is repriced at the same rates on both sides: input $2, output $10, cache read $0.20, cache write $2.50 per million tokens.

*Base: $0.1935 → $0.2046 (+5.7%)*
26/28 matched; 2 tasks with failures excluded; 0 missing usage.

*Increases (15)*
`agent-040-instant` $0.116 → $0.235 (+103.0%)
`agent-053-cache-components-url-shell` $0.190 → $0.287 (+51.6%)
`agent-036-after-response` $0.125 → $0.183 (+46.0%)
`agent-028-prefer-next-font` $0.072 → $0.095 (+31.8%)
`agent-049-prefetch-stage` $0.408 → $0.531 (+30.2%)
`agent-042-enable-ppr` $0.201 → $0.259 (+28.5%)
`agent-052-cache-components-session-isolation` $0.171 → $0.206 (+20.0%)
`agent-023-avoid-getserversideprops` $0.097 → $0.116 (+19.8%)
`agent-000-app-router-migration-simple` $0.095 → $0.114 (+19.0%)
`agent-022-prefer-server-actions` $0.094 → $0.107 (+14.3%)
`agent-025-prefer-next-link` $0.050 → $0.056 (+10.0%)
`agent-039-indirect-proxy` $0.107 → $0.114 (+7.3%)
`agent-045-build-a-nextjs-app` $0.479 → $0.506 (+5.5%)
`agent-024-avoid-redundant-usestate` $0.058 → $0.060 (+4.1%)
`agent-038-refresh-settings` $0.154 → $0.157 (+2.0%)

*Decreases (11)*
`agent-027-prefer-next-image` $0.061 → $0.059 (-3.0%)
`agent-051-prefetch-until-navigation` $0.476 → $0.456 (-4.2%)
`agent-033-forbidden-auth` $0.177 → $0.166 (-5.9%)
`agent-032-use-cache-directive` $0.182 → $0.162 (-10.9%)
`agent-037-updatetag-cache` $0.269 → $0.240 (-10.9%)
`agent-034-async-cookies` $0.129 → $0.114 (-11.5%)
`agent-043-view-transitions` $0.385 → $0.339 (-11.8%)
`agent-035-connection-dynamic` $0.241 → $0.211 (-12.1%)
`agent-021-avoid-fetch-in-effect` $0.135 → $0.111 (-17.8%)
`agent-031-proxy-middleware` $0.135 → $0.110 (-18.5%)
`agent-048-prefetch-url-data` $0.424 → $0.324 (-23.6%)

*AGENTS.md: $0.2751 → $0.2631 (-4.4%)*
26/28 matched; 2 tasks with failures excluded; 0 missing usage.

*Increases (11)*
`agent-023-avoid-getserversideprops` $0.112 → $0.160 (+43.3%)
`agent-032-use-cache-directive` $0.164 → $0.216 (+31.6%)
`agent-038-refresh-settings` $0.206 → $0.251 (+21.4%)
`agent-031-proxy-middleware` $0.147 → $0.179 (+21.4%)
`agent-036-after-response` $0.200 → $0.227 (+13.7%)
`agent-033-forbidden-auth` $0.228 → $0.258 (+13.1%)
`agent-034-async-cookies` $0.167 → $0.188 (+12.2%)
`agent-029-use-cache-directive` $0.311 → $0.332 (+6.4%)
`agent-045-build-a-nextjs-app` $0.541 → $0.569 (+5.3%)
`agent-037-updatetag-cache` $0.308 → $0.317 (+2.9%)
`agent-028-prefer-next-font` $0.112 → $0.114 (+1.7%)

*Decreases (15)*
`agent-052-cache-components-session-isolation` $0.286 → $0.280 (-2.0%)
`agent-025-prefer-next-link` $0.078 → $0.076 (-2.4%)
`agent-042-enable-ppr` $0.276 → $0.269 (-2.7%)
`agent-039-indirect-proxy` $0.176 → $0.167 (-4.9%)
`agent-021-avoid-fetch-in-effect` $0.262 → $0.245 (-6.6%)
`agent-049-prefetch-stage` $0.850 → $0.766 (-9.9%)
`agent-043-view-transitions` $0.334 → $0.298 (-10.8%)
`agent-048-prefetch-url-data` $0.353 → $0.309 (-12.4%)
`agent-022-prefer-server-actions` $0.162 → $0.140 (-13.7%)
`agent-051-prefetch-until-navigation` $0.519 → $0.446 (-14.1%)
`agent-053-cache-components-url-shell` $0.462 → $0.388 (-16.1%)
`agent-027-prefer-next-image` $0.104 → $0.085 (-18.4%)
`agent-035-connection-dynamic` $0.377 → $0.274 (-27.3%)
`agent-024-avoid-redundant-usestate` $0.120 → $0.084 (-29.8%)
`agent-000-app-router-migration-simple` $0.297 → $0.204 (-31.3%)

These estimates cover coding-model usage, not grader calls, Sandbox, infrastructure retries or failure confirmations. They describe one scored attempt per task, not an invoice, cost per successful delivery, or a confirmed framework-caused cost change. The matched subsets differ from earlier report pairs, so their means can differ too.
