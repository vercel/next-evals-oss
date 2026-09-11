<!-- CLAUDE.md is a symlink to this file. Edit this one. -->

# Working in this repo

Read [README.md](README.md) first — it is the spec for this repo, not a summary of it.
"Adding a new model", "Reasoning effort", "Model retention policy", and "Scoring and
cost methodology" are the rules the board is published under.

## Skills

Skills live in [`.agents/skills/`](.agents/skills/), with `.claude/skills` symlinked to
that directory so Claude Code and other harnesses read the same copy.

| Skill | Use it for |
|-------|------------|
| [`add-eval-model`](.agents/skills/add-eval-model/SKILL.md) | Adding, registering, running, or publishing a model on nextjs.org/evals |

## Finish the run

Almost every task here ends in numbers on a public board, and the work only counts once
those numbers exist. An experiment with no results is not exported at all, so a PR that
registers a model and stops changes nothing anyone can see — the README calls that state
"a staging post, not a destination".

Merging to `main` here is what publishes: nextjs.org/evals fetches
`agent-results.json` from this repo's `main` on the server, and `main` CI invalidates
its cache. `vercel/front` used to carry a copy of the file and no longer does
(vercel/front#85415, 2026-09-09), so a results PR against the site repo is not part of
the task — only a site-side change that is genuinely about the site is. See
"Publishing to nextjs.org/evals" in the README.

Eval runs cost real money and take 30–90 minutes. That is the normal price of a task in
this repo, not a reason to stop and ask. Run them, then report what they cost.
