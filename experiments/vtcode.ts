// vtcode experiment config (reference only)
// Use scripts/run-vtcode-evals.ts to run vtcode evals locally.
//
// Usage with HuggingFace:
//   export HF_TOKEN=hf_your_token_here
//   npx tsx scripts/run-vtcode-evals.ts \
//     --provider huggingface \
//     --model huggingface/deepseek-v4-flash \
//     --runs 1
//
// Usage with OpenAI:
//   export OPENAI_API_KEY=sk-...
//   npx tsx scripts/run-vtcode-evals.ts --model gpt-5 --runs 1
//
// The runner sets VTCODE_TRUST_WORKSPACE=full-auto to auto-trust
// sandbox directories. No manual trust configuration needed.
//
// Model presets (resolved automatically):
//   huggingface/deepseek-v4-flash → deepseek-ai/DeepSeek-V4-Flash:novita
//   huggingface/deepseek-v4-pro   → deepseek-ai/DeepSeek-V4-Pro:together
//   huggingface/glm-5             → zai-org/GLM-5:novita
//   huggingface/glm-5.1           → zai-org/GLM-5.1:zai-org

import type { ExperimentConfig } from '@vercel/agent-eval';

const config: ExperimentConfig = {
  agent: 'vtcode',
  model: 'deepseek-ai/DeepSeek-V4-Flash:novita',
  scripts: ['build'],
  runs: 1,
  earlyExit: true,
  timeout: 1200,
  sandbox: 'local',
};

export default config;
