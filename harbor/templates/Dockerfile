# Shared environment image for every eval. sync-tasks.sh copies the eval's
# fixture next to this file under workspace/ before the build.
FROM node:22-bookworm

WORKDIR /app
COPY workspace/ /app/
# Parity with @vercel/agent-eval: project deps are installed before the agent
# starts, then Next.js is bumped to the latest canary (the setup step every
# experiment in experiments/ runs). The canary version is whatever is current
# at image-build time; rebuild with --no-cache to re-pin.
RUN npm install
RUN npm install next@canary
