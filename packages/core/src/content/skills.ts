/**
 * The skill graph.
 *
 * Every exercise in the catalog references one or more skill ids from here.
 * Mastery, review scheduling, and the profile radar are all computed over this
 * list, so an exercise referencing an unlisted skill is a content bug —
 * `validateCatalog` in content/index.ts catches it.
 */

import type { Skill } from '../domain/types.js';

const s = (
  id: string,
  name: string,
  domain: Skill['domain'],
  level: Skill['level'],
  prerequisites: string[] = [],
): Skill => ({ id, name, domain, level, prerequisites });

export const SKILLS: Skill[] = [
  // --- Foundations ---------------------------------------------------------
  s('sk-ai-definition', 'What counts as AI', 'foundations', 'intro'),
  s('sk-ai-ml-dl-relationship', 'AI vs ML vs deep learning', 'foundations', 'intro', ['sk-ai-definition']),
  s('sk-narrow-vs-general', 'Narrow vs general intelligence', 'foundations', 'intro', ['sk-ai-definition']),
  s('sk-ai-history', 'Key eras of AI research', 'foundations', 'intro'),
  s('sk-symbolic-vs-statistical', 'Symbolic vs statistical AI', 'foundations', 'intermediate', ['sk-ai-history']),
  s('sk-inductive-bias', 'Inductive bias', 'foundations', 'intermediate', ['sk-ai-ml-dl-relationship']),

  // --- Data ----------------------------------------------------------------
  s('sk-features-labels', 'Features and labels', 'data', 'intro'),
  s('sk-train-val-test', 'Train / validation / test splits', 'data', 'intro', ['sk-features-labels']),
  s('sk-data-leakage', 'Data leakage', 'data', 'intermediate', ['sk-train-val-test']),
  s('sk-feature-scaling', 'Normalization and standardization', 'data', 'intermediate', ['sk-features-labels']),
  s('sk-class-imbalance', 'Class imbalance', 'data', 'intermediate', ['sk-features-labels']),
  s('sk-data-augmentation', 'Data augmentation', 'data', 'intermediate', ['sk-features-labels']),

  // --- Machine learning ----------------------------------------------------
  s('sk-supervised-learning', 'Supervised learning', 'machine-learning', 'intro', ['sk-features-labels']),
  s('sk-unsupervised-learning', 'Unsupervised learning', 'machine-learning', 'intro', ['sk-features-labels']),
  s('sk-classification-regression', 'Classification vs regression', 'machine-learning', 'intro', ['sk-supervised-learning']),
  s('sk-linear-regression', 'Linear regression', 'machine-learning', 'intro', ['sk-classification-regression']),
  s('sk-logistic-regression', 'Logistic regression', 'machine-learning', 'intermediate', ['sk-linear-regression']),
  s('sk-loss-functions', 'Loss functions', 'machine-learning', 'intermediate', ['sk-linear-regression']),
  s('sk-gradient-descent', 'Gradient descent', 'machine-learning', 'intermediate', ['sk-loss-functions']),
  s('sk-overfitting', 'Overfitting and underfitting', 'machine-learning', 'intro', ['sk-train-val-test']),
  s('sk-bias-variance', 'The bias–variance tradeoff', 'machine-learning', 'intermediate', ['sk-overfitting']),
  s('sk-regularization', 'L1 / L2 regularization', 'machine-learning', 'intermediate', ['sk-overfitting']),
  s('sk-cross-validation', 'Cross-validation', 'machine-learning', 'intermediate', ['sk-train-val-test']),
  s('sk-decision-trees', 'Decision trees', 'machine-learning', 'intermediate', ['sk-classification-regression']),
  s('sk-ensembles', 'Bagging, boosting, random forests', 'machine-learning', 'intermediate', ['sk-decision-trees']),
  s('sk-clustering', 'k-means and clustering', 'machine-learning', 'intermediate', ['sk-unsupervised-learning']),
  s('sk-dimensionality-reduction', 'PCA and dimensionality reduction', 'machine-learning', 'expert', ['sk-unsupervised-learning']),
  s('sk-classification-metrics', 'Precision, recall, F1, ROC-AUC', 'machine-learning', 'intermediate', ['sk-classification-regression']),
  s('sk-confusion-matrix', 'Reading a confusion matrix', 'machine-learning', 'intro', ['sk-classification-regression']),

  // --- Math ----------------------------------------------------------------
  s('sk-vectors', 'Vectors and dot products', 'math', 'intro'),
  s('sk-matrices', 'Matrix multiplication', 'math', 'intermediate', ['sk-vectors']),
  s('sk-derivatives', 'Derivatives and slopes', 'math', 'intermediate'),
  s('sk-chain-rule', 'The chain rule', 'math', 'intermediate', ['sk-derivatives']),
  s('sk-probability-basics', 'Probability and conditional probability', 'math', 'intro'),
  s('sk-bayes', 'Bayes’ theorem', 'math', 'intermediate', ['sk-probability-basics']),
  s('sk-entropy', 'Entropy and cross-entropy', 'math', 'expert', ['sk-probability-basics']),
  s('sk-cosine-similarity', 'Cosine similarity', 'math', 'intermediate', ['sk-vectors']),

  // --- Deep learning -------------------------------------------------------
  s('sk-perceptron', 'The artificial neuron', 'deep-learning', 'intro', ['sk-vectors']),
  s('sk-activation-functions', 'Activation functions', 'deep-learning', 'intermediate', ['sk-perceptron']),
  s('sk-mlp', 'Multilayer perceptrons', 'deep-learning', 'intermediate', ['sk-perceptron']),
  s('sk-forward-pass', 'The forward pass', 'deep-learning', 'intermediate', ['sk-mlp']),
  s('sk-backpropagation', 'Backpropagation', 'deep-learning', 'expert', ['sk-chain-rule', 'sk-forward-pass']),
  s('sk-optimizers', 'SGD, momentum, and Adam', 'deep-learning', 'expert', ['sk-gradient-descent']),
  s('sk-learning-rate', 'Learning rate and schedules', 'deep-learning', 'intermediate', ['sk-gradient-descent']),
  s('sk-batch-size', 'Batches and epochs', 'deep-learning', 'intermediate', ['sk-gradient-descent']),
  s('sk-vanishing-gradients', 'Vanishing and exploding gradients', 'deep-learning', 'expert', ['sk-backpropagation']),
  s('sk-dropout', 'Dropout', 'deep-learning', 'intermediate', ['sk-regularization']),
  s('sk-batch-norm', 'Batch and layer normalization', 'deep-learning', 'expert', ['sk-mlp']),
  s('sk-embeddings', 'Embeddings', 'deep-learning', 'intermediate', ['sk-vectors']),
  s('sk-transfer-learning', 'Transfer learning and fine-tuning', 'deep-learning', 'intermediate', ['sk-mlp']),
  s('sk-scaling-laws', 'Scaling laws', 'deep-learning', 'expert', ['sk-transfer-learning']),

  // --- Computer vision -----------------------------------------------------
  s('sk-convolution', 'Convolution and filters', 'computer-vision', 'intermediate', ['sk-matrices']),
  s('sk-pooling', 'Pooling layers', 'computer-vision', 'intermediate', ['sk-convolution']),
  s('sk-cnn-architecture', 'CNN architectures', 'computer-vision', 'expert', ['sk-pooling']),
  s('sk-vision-transformers', 'Vision transformers', 'computer-vision', 'expert', ['sk-attention']),

  // --- NLP -----------------------------------------------------------------
  s('sk-tokenization', 'Tokenization', 'nlp', 'intro'),
  s('sk-bpe', 'Byte-pair encoding', 'nlp', 'expert', ['sk-tokenization']),
  s('sk-word-embeddings', 'Word2Vec and semantic space', 'nlp', 'intermediate', ['sk-embeddings']),
  s('sk-rnn-lstm', 'RNNs and LSTMs', 'nlp', 'expert', ['sk-mlp']),
  s('sk-seq2seq', 'Sequence-to-sequence models', 'nlp', 'expert', ['sk-rnn-lstm']),

  // --- LLMs ----------------------------------------------------------------
  s('sk-language-modeling', 'Next-token prediction', 'llms', 'intro', ['sk-tokenization']),
  s('sk-attention', 'Self-attention', 'llms', 'expert', ['sk-matrices', 'sk-embeddings']),
  s('sk-multi-head-attention', 'Multi-head attention', 'llms', 'expert', ['sk-attention']),
  s('sk-positional-encoding', 'Positional encoding', 'llms', 'expert', ['sk-attention']),
  s('sk-transformer-block', 'The transformer block', 'llms', 'expert', ['sk-multi-head-attention']),
  s('sk-context-window', 'Context windows', 'llms', 'intro', ['sk-tokenization']),
  s('sk-sampling', 'Temperature, top-k, and top-p', 'llms', 'intermediate', ['sk-language-modeling']),
  s('sk-pretraining-finetuning', 'Pretraining vs fine-tuning', 'llms', 'intermediate', ['sk-language-modeling']),
  s('sk-rlhf', 'RLHF and preference tuning', 'llms', 'expert', ['sk-pretraining-finetuning']),
  s('sk-hallucination', 'Hallucination and grounding', 'llms', 'intro', ['sk-language-modeling']),
  s('sk-rag', 'Retrieval-augmented generation', 'llms', 'intermediate', ['sk-embeddings', 'sk-cosine-similarity']),
  s('sk-vector-databases', 'Vector databases', 'llms', 'intermediate', ['sk-rag']),
  s('sk-quantization', 'Quantization and distillation', 'llms', 'expert', ['sk-scaling-laws']),
  s('sk-mixture-of-experts', 'Mixture of experts', 'llms', 'expert', ['sk-transformer-block']),
  s('sk-kv-cache', 'KV caching and inference cost', 'llms', 'expert', ['sk-attention']),
  s('sk-eval-llm', 'Evaluating LLMs', 'llms', 'intermediate', ['sk-language-modeling']),

  // --- Prompt engineering --------------------------------------------------
  s('sk-prompt-anatomy', 'Anatomy of a good prompt', 'prompt-engineering', 'intro'),
  s('sk-few-shot', 'Zero-shot vs few-shot prompting', 'prompt-engineering', 'intro', ['sk-prompt-anatomy']),
  s('sk-chain-of-thought', 'Chain-of-thought prompting', 'prompt-engineering', 'intermediate', ['sk-few-shot']),
  s('sk-system-prompts', 'System prompts and role setting', 'prompt-engineering', 'intro', ['sk-prompt-anatomy']),
  s('sk-structured-output', 'Getting structured output', 'prompt-engineering', 'intermediate', ['sk-prompt-anatomy']),
  s('sk-prompt-injection', 'Prompt injection', 'prompt-engineering', 'expert', ['sk-system-prompts']),

  // --- Generative AI -------------------------------------------------------
  s('sk-generative-vs-discriminative', 'Generative vs discriminative models', 'generative-ai', 'intermediate', ['sk-classification-regression']),
  s('sk-gan', 'GANs', 'generative-ai', 'expert', ['sk-generative-vs-discriminative']),
  s('sk-vae', 'Autoencoders and VAEs', 'generative-ai', 'expert', ['sk-embeddings']),
  s('sk-diffusion', 'Diffusion models', 'generative-ai', 'expert', ['sk-generative-vs-discriminative']),
  s('sk-clip-multimodal', 'Multimodal models and CLIP', 'generative-ai', 'expert', ['sk-embeddings']),
  s('sk-text-to-image', 'Text-to-image generation', 'generative-ai', 'intermediate', ['sk-diffusion']),

  // --- Agents --------------------------------------------------------------
  s('sk-agent-loop', 'The agent loop', 'agents', 'intermediate', ['sk-chain-of-thought']),
  s('sk-tool-use', 'Tool use and function calling', 'agents', 'intermediate', ['sk-structured-output']),
  s('sk-react-pattern', 'ReAct: reasoning and acting', 'agents', 'expert', ['sk-agent-loop']),
  s('sk-agent-memory', 'Agent memory', 'agents', 'expert', ['sk-rag']),
  s('sk-multi-agent', 'Multi-agent systems', 'agents', 'expert', ['sk-agent-loop']),

  // --- Reinforcement learning ----------------------------------------------
  s('sk-rl-basics', 'Agents, states, actions, rewards', 'reinforcement-learning', 'intermediate'),
  s('sk-exploration-exploitation', 'Exploration vs exploitation', 'reinforcement-learning', 'intermediate', ['sk-rl-basics']),
  s('sk-q-learning', 'Q-learning', 'reinforcement-learning', 'expert', ['sk-rl-basics']),
  s('sk-policy-gradient', 'Policy gradients and PPO', 'reinforcement-learning', 'expert', ['sk-q-learning']),

  // --- MLOps ---------------------------------------------------------------
  s('sk-model-deployment', 'Serving a model', 'mlops', 'intermediate'),
  s('sk-model-monitoring', 'Monitoring and drift', 'mlops', 'intermediate', ['sk-model-deployment']),
  s('sk-experiment-tracking', 'Experiment tracking and reproducibility', 'mlops', 'intermediate'),
  s('sk-inference-cost', 'Latency, throughput, and cost', 'mlops', 'expert', ['sk-model-deployment']),
  s('sk-ab-testing', 'A/B testing models', 'mlops', 'expert', ['sk-model-deployment']),

  // --- Ethics & safety -----------------------------------------------------
  s('sk-algorithmic-bias', 'Algorithmic bias', 'ethics-safety', 'intro', ['sk-features-labels']),
  s('sk-fairness-metrics', 'Fairness metrics and their tradeoffs', 'ethics-safety', 'expert', ['sk-algorithmic-bias']),
  s('sk-privacy', 'Privacy, PII, and differential privacy', 'ethics-safety', 'intermediate'),
  s('sk-explainability', 'Interpretability and explainability', 'ethics-safety', 'intermediate', ['sk-decision-trees']),
  s('sk-alignment', 'The alignment problem', 'ethics-safety', 'expert', ['sk-rlhf']),
  s('sk-ai-governance', 'Regulation and governance', 'ethics-safety', 'intermediate'),
  s('sk-responsible-deployment', 'Deploying AI responsibly', 'ethics-safety', 'intermediate', ['sk-algorithmic-bias']),
];

export const SKILLS_BY_ID: ReadonlyMap<string, Skill> = new Map(SKILLS.map((sk) => [sk.id, sk]));

export function getSkill(id: string): Skill | undefined {
  return SKILLS_BY_ID.get(id);
}
