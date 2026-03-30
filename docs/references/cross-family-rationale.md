# Cross-Family Review: Research Rationale

## Why cross-family matters

LLMs exhibit **self-preference bias** and **family bias** when evaluating code/text:
- Same-family models systematically rate each other's outputs higher
- This is a structural blind spot, not a quality issue

## Key papers

### LLM Evaluators Recognize and Favor Their Own Generations
- **Venue**: NeurIPS 2024 (NYU team)
- **arXiv**: [2404.13076](https://arxiv.org/abs/2404.13076)
- **Findings**:
  1. LLMs score their own outputs higher than others'; human annotators see equal quality
  2. GPT-4, Llama 2 can distinguish "self-written" from "other-written" with non-trivial accuracy
  3. Linear correlation: stronger self-recognition → stronger self-preference (validated via fine-tuning, confounders ruled out)

### Play Favorites: A Statistical Method to Measure Self-Bias in LLM-as-a-Judge
- **arXiv**: [2508.06709](https://arxiv.org/abs/2508.06709)
- **Findings**:
  1. Bias extends beyond self → **same model family** outputs get inflated scores
  2. Empirical: GPT-4o and Claude 3.5 Sonnet both systematically favor same-family outputs
  3. Proposes statistical framework to quantify and account for this bias

### Self-Preference Bias in LLM-as-a-Judge
- **arXiv**: [2410.21819](https://arxiv.org/abs/2410.21819)
- **Root cause hypothesis**: LLMs favor outputs with lower perplexity (more "familiar" text), regardless of whether self-generated — self-preference is a special case of familiarity preference

### Extreme Self-Preference in Language Models
- **arXiv**: [2509.26464](https://arxiv.org/abs/2509.26464)
- **Finding**: Self-love follows *assigned* identity, not true identity — telling LLM1 it is LLM2 shifts preference to LLM2's outputs. Extends to consequential settings (hiring, security, medical).

## Practical implication for ae plugin

Cross-family review (Codex + Gemini alongside Claude) is not optional polish — it addresses a structurally documented bias. Claude reviewers share reasoning patterns and blind spots. A different model family applies different heuristics and catches what Claude collectively misses.
