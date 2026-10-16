# Release measurements

This directory stores reviewed pass@1 measurements produced for Next.js
releases, backports, and requested canaries. Each run records aggregate scores,
release provenance, compact failure-confirmation data, and the complete
sanitized output from scored and confirmation attempts.

The per-run `results/` directory contains the scored agent transcripts,
evaluator output, and command output. `confirmations/` contains the two
diagnostic attempts made for each first-attempt model failure. The automation
scans this output and the aggregate files for the exact value of any credential
available to the job before opening the draft pull request.

These files are separate from the publishable `results/` tree and
`agent-results.json`. Merging a measurement pull request does not change the
pass@4 leaderboard at `nextjs.org/evals`.
