# Release measurements

This directory stores reviewed pass@1 measurements produced for Next.js
releases, backports, and requested canaries. Each run records aggregate scores,
release provenance, and compact failure-confirmation data.

Raw agent transcripts, generated applications, evaluator output, and command
output are deliberately excluded. The automation also rejects a proposed
measurement if it contains the exact value of any credential available to the
job.

These files are separate from the publishable `results/` tree and
`agent-results.json`. Merging a measurement pull request does not change the
pass@4 leaderboard at `nextjs.org/evals`.
