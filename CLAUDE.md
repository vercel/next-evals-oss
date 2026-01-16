# Eval the effects of Next.js docs

To run all eval tests:

```
bun cli.ts --claude-code --all --compare-nextjs-docs
```

To run a specific eval test case:

```
bun cli.ts --claude-code --eval 040-intercepting-routes --compare-nextjs-docs
```

The test runner auto removes the output after completion, using

```
--debug
```

config to persist the output dir.
