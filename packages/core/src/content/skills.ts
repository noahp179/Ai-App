/**
 * The skill graph.
 *
 * Every exercise in the catalog references one or more skill ids from here.
 * Mastery, review scheduling, and the profile radar are all computed over this
 * list, so an exercise referencing an unlisted skill is a content bug —
 * `validateCatalog` in content/index.ts catches it.
 */

import type { Skill } from '../domain/types';

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

  // --- Types of machine learning -------------------------------------------
  s('sk-ml-paradigms', 'The four learning paradigms', 'machine-learning', 'intro', ['sk-ai-ml-dl-relationship']),
  s('sk-semi-supervised', 'Semi-supervised learning', 'machine-learning', 'intermediate', ['sk-supervised-learning', 'sk-unsupervised-learning']),
  s('sk-self-supervised', 'Self-supervised learning', 'machine-learning', 'intermediate', ['sk-unsupervised-learning']),
  s('sk-online-vs-batch', 'Online vs batch learning', 'machine-learning', 'intermediate', ['sk-supervised-learning']),
  s('sk-instance-vs-model', 'Instance-based vs model-based', 'machine-learning', 'intermediate', ['sk-supervised-learning']),
  s('sk-active-learning', 'Active learning', 'machine-learning', 'expert', ['sk-semi-supervised']),
  s('sk-federated-learning', 'Federated learning', 'machine-learning', 'expert', ['sk-online-vs-batch']),
  s('sk-multitask-learning', 'Multi-task learning', 'machine-learning', 'expert', ['sk-transfer-learning']),
  s('sk-meta-learning', 'Meta-learning and few-shot', 'machine-learning', 'expert', ['sk-transfer-learning']),
  s('sk-anomaly-detection', 'Anomaly detection', 'machine-learning', 'intermediate', ['sk-unsupervised-learning']),
  s('sk-recommender-systems', 'Recommender systems', 'machine-learning', 'intermediate', ['sk-unsupervised-learning']),
  s('sk-time-series', 'Time-series forecasting', 'machine-learning', 'intermediate', ['sk-classification-regression']),
  s('sk-ranking', 'Learning to rank', 'machine-learning', 'expert', ['sk-classification-regression']),

  // --- Classic algorithms --------------------------------------------------
  s('sk-knn', 'k-nearest neighbours', 'machine-learning', 'intro', ['sk-classification-regression']),
  s('sk-naive-bayes', 'Naive Bayes', 'machine-learning', 'intermediate', ['sk-bayes']),
  s('sk-svm', 'Support vector machines', 'machine-learning', 'expert', ['sk-classification-regression']),
  s('sk-kernel-trick', 'The kernel trick', 'machine-learning', 'expert', ['sk-svm']),
  s('sk-dbscan', 'Density-based clustering', 'machine-learning', 'expert', ['sk-clustering']),
  s('sk-hierarchical-clustering', 'Hierarchical clustering', 'machine-learning', 'expert', ['sk-clustering']),
  s('sk-gradient-boosting', 'Gradient boosting in depth', 'machine-learning', 'expert', ['sk-ensembles']),
  s('sk-hyperparameter-tuning', 'Hyperparameter search', 'machine-learning', 'intermediate', ['sk-cross-validation']),
  s('sk-model-selection', 'Choosing an algorithm', 'machine-learning', 'intermediate', ['sk-ensembles', 'sk-knn']),
  s('sk-calibration', 'Probability calibration', 'machine-learning', 'expert', ['sk-classification-metrics']),
  s('sk-roc-pr-curves', 'ROC and PR curves', 'machine-learning', 'intermediate', ['sk-classification-metrics']),

  // --- Feature engineering -------------------------------------------------
  s('sk-categorical-encoding', 'Encoding categorical features', 'data', 'intermediate', ['sk-features-labels']),
  s('sk-missing-data', 'Handling missing data', 'data', 'intermediate', ['sk-features-labels']),
  s('sk-outliers', 'Outliers and robust statistics', 'data', 'intermediate', ['sk-features-labels']),
  s('sk-feature-selection', 'Feature selection', 'data', 'intermediate', ['sk-regularization']),
  s('sk-feature-crosses', 'Interactions and derived features', 'data', 'intermediate', ['sk-features-labels']),
  s('sk-text-features', 'Text as features', 'data', 'intermediate', ['sk-tokenization']),
  s('sk-data-labelling', 'Labelling and annotation quality', 'data', 'intermediate', ['sk-features-labels']),
  s('sk-dataset-shift', 'Dataset shift in practice', 'data', 'expert', ['sk-model-monitoring']),
  s('sk-data-sourcing', 'Where training data comes from', 'data', 'intro'),
  s('sk-synthetic-data', 'Synthetic data and model collapse', 'data', 'expert', ['sk-data-augmentation']),

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
  s('sk-expectation', 'Expected value and variance', 'math', 'intermediate', ['sk-probability-basics']),
  s('sk-log-probability', 'Why models work in log space', 'math', 'intermediate', ['sk-probability-basics']),
  s('sk-eigenvectors', 'Eigenvectors and principal directions', 'math', 'expert', ['sk-matrices']),

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
  s('sk-image-representation', 'Images as arrays of numbers', 'computer-vision', 'intro'),
  s('sk-object-detection', 'Detection and segmentation', 'computer-vision', 'expert', ['sk-cnn-architecture']),

  // --- NLP -----------------------------------------------------------------
  s('sk-tokenization', 'Tokenization', 'nlp', 'intro'),
  s('sk-bpe', 'Byte-pair encoding', 'nlp', 'expert', ['sk-tokenization']),
  s('sk-word-embeddings', 'Word2Vec and semantic space', 'nlp', 'intermediate', ['sk-embeddings']),
  s('sk-rnn-lstm', 'RNNs and LSTMs', 'nlp', 'expert', ['sk-mlp']),
  s('sk-seq2seq', 'Sequence-to-sequence models', 'nlp', 'expert', ['sk-rnn-lstm']),
  s('sk-text-normalization', 'Normalising text before modelling', 'nlp', 'intro'),
  s('sk-bag-of-words', 'Bag of words and TF-IDF', 'nlp', 'intro', ['sk-text-normalization']),

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
  s('sk-prompt-decomposition', 'Decomposing a task into prompts', 'prompt-engineering', 'intermediate', ['sk-chain-of-thought']),
  s('sk-prompt-evaluation', 'Testing prompts like code', 'prompt-engineering', 'intermediate', ['sk-prompt-anatomy']),

  // --- Generative AI -------------------------------------------------------
  s('sk-generative-vs-discriminative', 'Generative vs discriminative models', 'generative-ai', 'intermediate', ['sk-classification-regression']),
  s('sk-gan', 'GANs', 'generative-ai', 'expert', ['sk-generative-vs-discriminative']),
  s('sk-vae', 'Autoencoders and VAEs', 'generative-ai', 'expert', ['sk-embeddings']),
  s('sk-diffusion', 'Diffusion models', 'generative-ai', 'expert', ['sk-generative-vs-discriminative']),
  s('sk-clip-multimodal', 'Multimodal models and CLIP', 'generative-ai', 'expert', ['sk-embeddings']),
  s('sk-text-to-image', 'Text-to-image generation', 'generative-ai', 'intermediate', ['sk-diffusion']),
  s('sk-latent-space', 'Latent spaces and reconstruction', 'generative-ai', 'intermediate', ['sk-embeddings']),
  s('sk-guidance', 'Conditioning and guidance strength', 'generative-ai', 'expert', ['sk-diffusion']),

  // --- Agents --------------------------------------------------------------
  s('sk-agent-loop', 'The agent loop', 'agents', 'intermediate', ['sk-chain-of-thought']),
  s('sk-tool-use', 'Tool use and function calling', 'agents', 'intermediate', ['sk-structured-output']),
  s('sk-react-pattern', 'ReAct: reasoning and acting', 'agents', 'expert', ['sk-agent-loop']),
  s('sk-agent-memory', 'Agent memory', 'agents', 'expert', ['sk-rag']),
  s('sk-multi-agent', 'Multi-agent systems', 'agents', 'expert', ['sk-agent-loop']),
  s('sk-agent-eval', 'Evaluating agent trajectories', 'agents', 'expert', ['sk-agent-loop']),
  s('sk-human-in-the-loop', 'Human approval and containment', 'agents', 'intermediate', ['sk-agent-loop']),

  // --- Reinforcement learning ----------------------------------------------
  s('sk-rl-basics', 'Agents, states, actions, rewards', 'reinforcement-learning', 'intermediate'),
  s('sk-exploration-exploitation', 'Exploration vs exploitation', 'reinforcement-learning', 'intermediate', ['sk-rl-basics']),
  s('sk-q-learning', 'Q-learning', 'reinforcement-learning', 'expert', ['sk-rl-basics']),
  s('sk-policy-gradient', 'Policy gradients and PPO', 'reinforcement-learning', 'expert', ['sk-q-learning']),
  s('sk-reward-design', 'Reward design and specification gaming', 'reinforcement-learning', 'expert', ['sk-rl-basics']),

  // --- MLOps ---------------------------------------------------------------
  s('sk-model-deployment', 'Serving a model', 'mlops', 'intermediate'),
  s('sk-model-monitoring', 'Monitoring and drift', 'mlops', 'intermediate', ['sk-model-deployment']),
  s('sk-experiment-tracking', 'Experiment tracking and reproducibility', 'mlops', 'intermediate'),
  s('sk-inference-cost', 'Latency, throughput, and cost', 'mlops', 'expert', ['sk-model-deployment']),
  s('sk-ab-testing', 'A/B testing models', 'mlops', 'expert', ['sk-model-deployment']),
  s('sk-rollout-strategy', 'Shadow, canary, and staged rollout', 'mlops', 'intermediate', ['sk-model-deployment']),
  s('sk-retraining', 'When and how to retrain', 'mlops', 'expert', ['sk-model-monitoring']),

  // --- Ethics & safety -----------------------------------------------------
  s('sk-algorithmic-bias', 'Algorithmic bias', 'ethics-safety', 'intro', ['sk-features-labels']),
  s('sk-fairness-metrics', 'Fairness metrics and their tradeoffs', 'ethics-safety', 'expert', ['sk-algorithmic-bias']),
  s('sk-privacy', 'Privacy, PII, and differential privacy', 'ethics-safety', 'intermediate'),
  s('sk-explainability', 'Interpretability and explainability', 'ethics-safety', 'intermediate', ['sk-decision-trees']),
  s('sk-alignment', 'The alignment problem', 'ethics-safety', 'expert', ['sk-rlhf']),
  s('sk-ai-governance', 'Regulation and governance', 'ethics-safety', 'intermediate'),
  s('sk-responsible-deployment', 'Deploying AI responsibly', 'ethics-safety', 'intermediate', ['sk-algorithmic-bias']),
  s('sk-model-cards', 'Documenting a model’s limits', 'ethics-safety', 'intermediate', ['sk-responsible-deployment']),
  s('sk-red-teaming', 'Red-teaming and abuse testing', 'ethics-safety', 'expert', ['sk-responsible-deployment']),

  // --- Computer science fundamentals ---------------------------------------
  s('sk-big-o', 'Big-O and growth rates', 'computer-science', 'intro'),
  s('sk-complexity-analysis', 'Analysing loops and recursion', 'computer-science', 'intermediate', ['sk-big-o']),
  s('sk-space-complexity', 'Space complexity and the time/space trade', 'computer-science', 'intermediate', ['sk-big-o']),
  s('sk-amortised-analysis', 'Amortised analysis', 'computer-science', 'expert', ['sk-complexity-analysis']),
  s('sk-arrays-lists', 'Arrays, dynamic arrays, and linked lists', 'computer-science', 'intro', ['sk-big-o']),
  s('sk-hash-tables', 'Hash tables and collisions', 'computer-science', 'intermediate', ['sk-arrays-lists']),
  s('sk-stacks-queues', 'Stacks, queues, and deques', 'computer-science', 'intro', ['sk-arrays-lists']),
  s('sk-heaps', 'Heaps and priority queues', 'computer-science', 'intermediate', ['sk-arrays-lists']),
  s('sk-binary-search', 'Binary search and sorted invariants', 'computer-science', 'intro', ['sk-arrays-lists']),
  s('sk-trees', 'Binary search trees and balance', 'computer-science', 'intermediate', ['sk-binary-search']),
  s('sk-graphs', 'Graph representations', 'computer-science', 'intermediate', ['sk-stacks-queues']),
  s('sk-graph-traversal', 'BFS, DFS, and shortest paths', 'computer-science', 'expert', ['sk-graphs']),
  s('sk-sorting', 'Sorting algorithms and their trade-offs', 'computer-science', 'intermediate', ['sk-complexity-analysis']),
  s('sk-recursion', 'Recursion and divide and conquer', 'computer-science', 'intermediate', ['sk-complexity-analysis']),
  s('sk-dynamic-programming', 'Memoisation and dynamic programming', 'computer-science', 'expert', ['sk-recursion']),
  s('sk-greedy', 'Greedy algorithms and when they fail', 'computer-science', 'expert', ['sk-sorting']),

  // --- Systems & performance -----------------------------------------------
  s('sk-memory-hierarchy', 'The memory hierarchy', 'systems', 'intro'),
  s('sk-cache-locality', 'Cache lines and locality', 'systems', 'intermediate', ['sk-memory-hierarchy']),
  s('sk-stack-vs-heap', 'Stack and heap allocation', 'systems', 'intermediate', ['sk-memory-hierarchy']),
  s('sk-pointers-references', 'Pointers, references, and ownership', 'systems', 'intermediate', ['sk-stack-vs-heap']),
  s('sk-processes-threads', 'Processes and threads', 'systems', 'intermediate'),
  s('sk-concurrency-parallelism', 'Concurrency versus parallelism', 'systems', 'intermediate', ['sk-processes-threads']),
  s('sk-race-conditions', 'Race conditions and shared state', 'systems', 'expert', ['sk-concurrency-parallelism']),
  s('sk-locks-deadlock', 'Locks, contention, and deadlock', 'systems', 'expert', ['sk-race-conditions']),
  s('sk-async-io', 'Async, event loops, and blocking', 'systems', 'intermediate', ['sk-concurrency-parallelism']),
  s('sk-io-vs-cpu-bound', 'I/O-bound versus CPU-bound work', 'systems', 'intro', ['sk-processes-threads']),
  s('sk-profiling', 'Profiling before optimising', 'systems', 'intermediate'),
  s('sk-amdahls-law', 'Amdahl’s law and the serial fraction', 'systems', 'expert', ['sk-concurrency-parallelism']),

  // --- Computer architecture ------------------------------------------------
  s('sk-binary-representation', 'Binary, hex, and bit widths', 'systems', 'intro'),
  s('sk-twos-complement', 'Two’s complement and overflow', 'systems', 'intermediate', ['sk-binary-representation']),
  s('sk-floating-point', 'Floating point and its gaps', 'systems', 'intermediate', ['sk-binary-representation']),
  s('sk-numerical-stability', 'Numerical stability in practice', 'systems', 'expert', ['sk-floating-point']),
  s('sk-instruction-cycle', 'What a CPU actually executes', 'systems', 'intro'),
  s('sk-compilation-interpretation', 'Compiled, interpreted, and JIT', 'systems', 'intermediate', ['sk-instruction-cycle']),
  s('sk-simd-vectorisation', 'SIMD and vectorisation', 'systems', 'expert', ['sk-instruction-cycle']),
  s('sk-gpu-architecture', 'Why GPUs suit deep learning', 'systems', 'expert', ['sk-simd-vectorisation']),

  // --- Operating systems ----------------------------------------------------
  s('sk-os-role', 'What an operating system is for', 'systems', 'intro'),
  s('sk-scheduling', 'CPU scheduling', 'systems', 'intermediate', ['sk-processes-threads']),
  s('sk-virtual-memory', 'Virtual memory and address spaces', 'systems', 'expert', ['sk-memory-hierarchy']),
  s('sk-paging-swapping', 'Paging, page faults, and thrashing', 'systems', 'expert', ['sk-virtual-memory']),
  s('sk-file-systems', 'Files, inodes, and durability', 'systems', 'intermediate', ['sk-os-role']),
  s('sk-syscalls', 'System calls and the kernel boundary', 'systems', 'intermediate', ['sk-os-role']),
  s('sk-containers', 'Containers, images, and isolation', 'systems', 'intermediate', ['sk-syscalls']),

  // --- Databases ------------------------------------------------------------
  s('sk-relational-model', 'Tables, keys, and the relational model', 'databases', 'intro'),
  s('sk-normalization', 'Normalisation and redundancy', 'databases', 'intermediate', ['sk-relational-model']),
  s('sk-sql-queries', 'SQL as set operations', 'databases', 'intro', ['sk-relational-model']),
  s('sk-joins', 'Joins and what they cost', 'databases', 'intermediate', ['sk-sql-queries']),
  s('sk-db-indexes', 'Indexes and when they help', 'databases', 'intermediate', ['sk-joins']),
  s('sk-query-plans', 'Reading a query plan', 'databases', 'expert', ['sk-db-indexes']),
  s('sk-transactions-acid', 'Transactions and ACID', 'databases', 'intermediate', ['sk-relational-model']),
  s('sk-isolation-levels', 'Isolation levels and their anomalies', 'databases', 'expert', ['sk-transactions-acid']),
  s('sk-oltp-olap', 'OLTP versus OLAP', 'databases', 'intermediate', ['sk-sql-queries']),
  s('sk-nosql', 'When a non-relational store wins', 'databases', 'intermediate', ['sk-relational-model']),
  s('sk-sharding-replication', 'Sharding and replication', 'databases', 'expert', ['sk-transactions-acid']),

  // --- Networking & distributed systems ------------------------------------
  s('sk-network-layers', 'The layers a request passes through', 'networking', 'intro'),
  s('sk-http', 'HTTP, methods, and status codes', 'networking', 'intro', ['sk-network-layers']),
  s('sk-api-design', 'Designing an API surface', 'networking', 'intermediate', ['sk-http']),
  s('sk-latency-bandwidth', 'Latency versus bandwidth', 'networking', 'intro', ['sk-network-layers']),
  s('sk-dns-tls', 'DNS and the TLS handshake', 'networking', 'intermediate', ['sk-network-layers']),
  s('sk-load-balancing', 'Load balancing and horizontal scale', 'networking', 'intermediate', ['sk-http']),
  s('sk-caching-layers', 'Caching, invalidation, and staleness', 'networking', 'intermediate', ['sk-latency-bandwidth']),
  s('sk-cap-theorem', 'The CAP theorem', 'networking', 'expert', ['sk-load-balancing']),
  s('sk-consistency-models', 'Strong and eventual consistency', 'networking', 'expert', ['sk-cap-theorem']),
  s('sk-idempotency', 'Idempotency and exactly-once', 'networking', 'expert', ['sk-http']),
  s('sk-retries-backoff', 'Retries, backoff, and thundering herds', 'networking', 'intermediate', ['sk-idempotency']),
  s('sk-queues-events', 'Queues and event-driven architecture', 'networking', 'intermediate', ['sk-load-balancing']),

  // --- Software engineering practice ---------------------------------------
  s('sk-version-control', 'Version control and commits', 'software-engineering', 'intro'),
  s('sk-branching', 'Branching, merging, and conflicts', 'software-engineering', 'intermediate', ['sk-version-control']),
  s('sk-unit-testing', 'Unit tests and what to assert', 'software-engineering', 'intro'),
  s('sk-test-pyramid', 'The test pyramid', 'software-engineering', 'intermediate', ['sk-unit-testing']),
  s('sk-property-testing', 'Property-based testing', 'software-engineering', 'expert', ['sk-unit-testing']),
  s('sk-ci-cd', 'Continuous integration and delivery', 'software-engineering', 'intermediate', ['sk-unit-testing']),
  s('sk-code-review', 'Code review that finds things', 'software-engineering', 'intermediate', ['sk-version-control']),
  s('sk-debugging', 'Debugging as a discipline', 'software-engineering', 'intermediate'),
  s('sk-abstraction', 'Abstraction and coupling', 'software-engineering', 'intermediate'),
  s('sk-technical-debt', 'Technical debt as a decision', 'software-engineering', 'expert', ['sk-abstraction']),

  // --- Security -------------------------------------------------------------
  s('sk-threat-modelling', 'Threat modelling', 'security', 'intro'),
  s('sk-authn-authz', 'Authentication versus authorisation', 'security', 'intro', ['sk-threat-modelling']),
  s('sk-hashing-vs-encryption', 'Hashing versus encryption', 'security', 'intro'),
  s('sk-password-storage', 'Storing passwords safely', 'security', 'intermediate', ['sk-hashing-vs-encryption']),
  s('sk-tls-pki', 'TLS, certificates, and trust', 'security', 'intermediate', ['sk-hashing-vs-encryption']),
  s('sk-injection', 'Injection and untrusted input', 'security', 'intermediate', ['sk-threat-modelling']),
  s('sk-xss-csrf', 'XSS, CSRF, and the browser model', 'security', 'expert', ['sk-injection']),
  s('sk-secrets-management', 'Secrets and key management', 'security', 'intermediate', ['sk-threat-modelling']),
  s('sk-least-privilege-security', 'Least privilege and blast radius', 'security', 'intermediate', ['sk-authn-authz']),
  s('sk-supply-chain', 'Dependency and supply-chain risk', 'security', 'expert', ['sk-secrets-management']),

  // --- Theory of computation ------------------------------------------------
  s('sk-finite-automata', 'Finite automata', 'computer-science', 'intermediate'),
  s('sk-regular-languages', 'Regular languages and their limits', 'computer-science', 'expert', ['sk-finite-automata']),
  s('sk-context-free', 'Context-free grammars and parsing', 'computer-science', 'expert', ['sk-regular-languages']),
  s('sk-turing-machines', 'Turing machines and computability', 'computer-science', 'expert', ['sk-finite-automata']),
  s('sk-halting-problem', 'Undecidability and the halting problem', 'computer-science', 'expert', ['sk-turing-machines']),
  s('sk-complexity-classes', 'P, NP, and complexity classes', 'computer-science', 'expert', ['sk-big-o']),
  s('sk-np-completeness', 'NP-completeness and reductions', 'computer-science', 'expert', ['sk-complexity-classes']),
  s('sk-approximation', 'Living with intractable problems', 'computer-science', 'expert', ['sk-np-completeness']),

  // --- Discrete mathematics -------------------------------------------------
  s('sk-propositional-logic', 'Propositional logic and truth tables', 'computer-science', 'intro'),
  s('sk-proof-techniques', 'Direct proof, contradiction, contrapositive', 'computer-science', 'intermediate', ['sk-propositional-logic']),
  s('sk-induction', 'Mathematical induction', 'computer-science', 'intermediate', ['sk-proof-techniques']),
  s('sk-sets-relations', 'Sets, relations, and equivalence', 'computer-science', 'intro'),
  s('sk-combinatorics', 'Counting, permutations, combinations', 'computer-science', 'intermediate', ['sk-sets-relations']),
  s('sk-pigeonhole', 'The pigeonhole principle', 'computer-science', 'intermediate', ['sk-combinatorics']),
  s('sk-graph-theory', 'Graph theory and its vocabulary', 'computer-science', 'intermediate', ['sk-graphs']),
  s('sk-modular-arithmetic', 'Modular arithmetic', 'computer-science', 'intermediate'),
  s('sk-recurrence-relations', 'Recurrence relations', 'computer-science', 'expert', ['sk-induction']),

  // --- Programming fundamentals --------------------------------------------
  s('sk-variables-types', 'Variables, values, and types', 'programming', 'intro'),
  s('sk-control-flow', 'Conditionals and branching', 'programming', 'intro', ['sk-variables-types']),
  s('sk-loops', 'Loops and iteration', 'programming', 'intro', ['sk-control-flow']),
  s('sk-functions', 'Functions and return values', 'programming', 'intro', ['sk-variables-types']),
  s('sk-scope-closures', 'Scope, shadowing, and closures', 'programming', 'intermediate', ['sk-functions']),
  s('sk-collections', 'Lists, maps, and sets in practice', 'programming', 'intro', ['sk-variables-types']),
  s('sk-mutability', 'Mutation, copying, and aliasing', 'programming', 'intermediate', ['sk-collections']),
  s('sk-strings-text', 'Strings, encoding, and Unicode', 'programming', 'intermediate', ['sk-variables-types']),
  s('sk-errors-exceptions', 'Errors, exceptions, and failing well', 'programming', 'intermediate', ['sk-functions']),
  s('sk-off-by-one', 'Boundaries and off-by-one errors', 'programming', 'intro', ['sk-loops']),
  s('sk-reading-code', 'Reading code you did not write', 'programming', 'intermediate', ['sk-functions']),
  s('sk-pseudocode', 'From problem statement to algorithm', 'programming', 'intro'),

  // --- Python ---------------------------------------------------------------
  s('sk-python-syntax', 'Python syntax and idiom', 'programming', 'intro', ['sk-variables-types']),
  s('sk-comprehensions', 'Comprehensions and generators', 'programming', 'intermediate', ['sk-python-syntax']),
  s('sk-python-data-model', 'Dunder methods and the data model', 'programming', 'expert', ['sk-python-syntax']),
  s('sk-python-gotchas', 'Mutable defaults and late binding', 'programming', 'intermediate', ['sk-python-syntax']),
  s('sk-numpy', 'NumPy arrays and broadcasting', 'programming', 'intermediate', ['sk-python-syntax']),
  s('sk-pandas', 'DataFrames and split-apply-combine', 'programming', 'intermediate', ['sk-numpy']),
  s('sk-environments', 'Virtual environments and dependency pinning', 'programming', 'intermediate'),
  s('sk-notebooks', 'Notebooks and their hidden state', 'programming', 'intermediate', ['sk-python-syntax']),

  // --- Programming paradigms ------------------------------------------------
  s('sk-encapsulation', 'Objects, state, and encapsulation', 'programming', 'intermediate', ['sk-functions']),
  s('sk-inheritance-composition', 'Inheritance versus composition', 'programming', 'intermediate', ['sk-encapsulation']),
  s('sk-polymorphism', 'Polymorphism and interfaces', 'programming', 'intermediate', ['sk-encapsulation']),
  s('sk-pure-functions', 'Pure functions and side effects', 'programming', 'intermediate', ['sk-functions']),
  s('sk-immutability', 'Immutability as a design choice', 'programming', 'intermediate', ['sk-pure-functions']),
  s('sk-higher-order', 'Map, filter, reduce, and functions as values', 'programming', 'intermediate', ['sk-functions']),
  s('sk-static-dynamic-typing', 'Static and dynamic typing', 'programming', 'intermediate', ['sk-variables-types']),
  s('sk-generics', 'Generics and parametric polymorphism', 'programming', 'expert', ['sk-static-dynamic-typing']),
  s('sk-null-safety', 'Null, optionals, and the billion-dollar mistake', 'programming', 'intermediate', ['sk-static-dynamic-typing']),
  s('sk-declarative-imperative', 'Declarative versus imperative style', 'programming', 'intermediate', ['sk-higher-order']),

  // --- The web --------------------------------------------------------------
  s('sk-html-semantics', 'HTML as structure and meaning', 'web', 'intro'),
  s('sk-css-layout', 'CSS layout: box model, flex, grid', 'web', 'intro', ['sk-html-semantics']),
  s('sk-dom', 'The DOM as a live tree', 'web', 'intermediate', ['sk-html-semantics']),
  s('sk-event-loop', 'The event loop, tasks, and microtasks', 'web', 'expert', ['sk-dom']),
  s('sk-browser-rendering', 'Parse, layout, paint, composite', 'web', 'intermediate', ['sk-dom']),
  s('sk-responsive-design', 'Responsive and mobile-first layout', 'web', 'intermediate', ['sk-css-layout']),
  s('sk-web-accessibility', 'Accessible interfaces by default', 'web', 'intermediate', ['sk-html-semantics']),
  s('sk-frontend-state', 'Client state and rendering models', 'web', 'expert', ['sk-dom']),
  s('sk-web-performance', 'Core web vitals and what moves them', 'web', 'expert', ['sk-browser-rendering']),
  s('sk-web-storage', 'Cookies, storage, and sessions in a browser', 'web', 'intermediate', ['sk-dom']),

  // --- Cloud & infrastructure -----------------------------------------------
  s('sk-service-models', 'IaaS, PaaS, SaaS, and what you still own', 'cloud', 'intro'),
  s('sk-virtual-machines', 'Virtual machines and hypervisors', 'cloud', 'intermediate', ['sk-service-models']),
  s('sk-orchestration', 'Container orchestration and Kubernetes', 'cloud', 'expert', ['sk-containers']),
  s('sk-serverless', 'Serverless and cold starts', 'cloud', 'intermediate', ['sk-service-models']),
  s('sk-iac', 'Infrastructure as code', 'cloud', 'intermediate', ['sk-service-models']),
  s('sk-observability', 'Logs, metrics, traces, and alerts', 'cloud', 'intermediate', ['sk-service-models']),
  s('sk-cloud-cost', 'Cost as an engineering constraint', 'cloud', 'intermediate', ['sk-service-models']),
  s('sk-resilience', 'Redundancy, failover, and recovery objectives', 'cloud', 'expert', ['sk-observability']),
  s('sk-autoscaling', 'Autoscaling and capacity planning', 'cloud', 'intermediate', ['sk-orchestration']),

  // --- Digital logic & hardware ---------------------------------------------
  s('sk-transistors', 'Transistors as switches', 'hardware', 'intro'),
  s('sk-logic-gates', 'Logic gates and their truth tables', 'hardware', 'intro', ['sk-transistors']),
  s('sk-boolean-circuits', 'Boolean algebra and circuit simplification', 'hardware', 'intermediate', ['sk-logic-gates']),
  s('sk-combinational', 'Adders, multiplexers, and decoders', 'hardware', 'intermediate', ['sk-boolean-circuits']),
  s('sk-sequential-logic', 'Flip-flops, state, and the clock', 'hardware', 'intermediate', ['sk-combinational']),
  s('sk-memory-cells', 'How a bit is physically stored', 'hardware', 'intermediate', ['sk-sequential-logic']),
  s('sk-datapath', 'Building a CPU from gates', 'hardware', 'expert', ['sk-sequential-logic']),
  s('sk-abstraction-layers', 'The abstraction stack from sand to software', 'hardware', 'intro', ['sk-logic-gates']),
  s('sk-moores-law', 'Moore’s law, Dennard scaling, and what ended', 'hardware', 'intermediate', ['sk-transistors']),

  // --- Compilers ------------------------------------------------------------
  s('sk-lexing', 'Lexing: text to tokens', 'computer-science', 'intermediate', ['sk-finite-automata']),
  s('sk-parsing-ast', 'Parsing into a syntax tree', 'computer-science', 'expert', ['sk-context-free']),
  s('sk-semantic-analysis', 'Names, scopes, and type checking', 'computer-science', 'expert', ['sk-parsing-ast']),
  s('sk-ir', 'Intermediate representations', 'computer-science', 'expert', ['sk-semantic-analysis']),
  s('sk-optimisation-passes', 'What an optimiser actually does', 'computer-science', 'expert', ['sk-ir']),
  s('sk-codegen', 'Code generation and register allocation', 'computer-science', 'expert', ['sk-ir']),
  s('sk-garbage-collection', 'Garbage collection strategies', 'computer-science', 'expert', ['sk-stack-vs-heap']),
  s('sk-runtime-systems', 'What a language runtime provides', 'computer-science', 'intermediate', ['sk-compilation-interpretation']),

  // --- Information theory ---------------------------------------------------
  s('sk-information-content', 'Surprise, bits, and self-information', 'math', 'intermediate'),
  s('sk-shannon-entropy', 'Entropy as average surprise', 'math', 'intermediate', ['sk-information-content']),
  s('sk-cross-entropy-loss', 'Cross-entropy as a loss function', 'math', 'expert', ['sk-shannon-entropy']),
  s('sk-mutual-information', 'Mutual information and dependence', 'math', 'expert', ['sk-shannon-entropy']),
  s('sk-source-coding', 'Compression and the source coding theorem', 'math', 'expert', ['sk-shannon-entropy']),
  s('sk-huffman', 'Huffman codes and prefix-free encoding', 'math', 'intermediate', ['sk-source-coding']),
  s('sk-channel-capacity', 'Noisy channels and capacity', 'math', 'expert', ['sk-shannon-entropy']),
  s('sk-error-correction', 'Error-detecting and error-correcting codes', 'math', 'intermediate', ['sk-channel-capacity']),
  s('sk-perplexity', 'Perplexity and why language models report it', 'math', 'expert', ['sk-cross-entropy-loss']),

  // --- Cryptography ---------------------------------------------------------
  s('sk-kerckhoffs', 'Kerckhoffs’s principle and why secrecy is the key', 'security', 'intro'),
  s('sk-symmetric-ciphers', 'Symmetric encryption and AES', 'security', 'intermediate', ['sk-kerckhoffs']),
  s('sk-block-modes', 'Block cipher modes and why ECB fails', 'security', 'expert', ['sk-symmetric-ciphers']),
  s('sk-key-exchange', 'Diffie–Hellman and shared secrets', 'security', 'expert', ['sk-symmetric-ciphers']),
  s('sk-public-key', 'Public-key cryptography', 'security', 'intermediate', ['sk-key-exchange']),
  s('sk-signatures', 'Digital signatures and non-repudiation', 'security', 'intermediate', ['sk-public-key']),
  s('sk-mac-aead', 'Message authentication and authenticated encryption', 'security', 'expert', ['sk-block-modes']),
  s('sk-randomness', 'Randomness, seeds, and why it matters', 'security', 'intermediate', ['sk-kerckhoffs']),
  s('sk-post-quantum', 'What quantum computing breaks', 'security', 'expert', ['sk-public-key']),
  s('sk-crypto-practice', 'Why you should not implement it yourself', 'security', 'intro', ['sk-kerckhoffs']),

  // --- Statistics & experimentation -----------------------------------------
  s('sk-sampling', 'Samples, populations, and sampling error', 'math', 'intro'),
  s('sk-sampling-distribution', 'Sampling distributions and the CLT', 'math', 'intermediate', ['sk-sampling']),
  s('sk-confidence-intervals', 'Confidence intervals and what they mean', 'math', 'intermediate', ['sk-sampling-distribution']),
  s('sk-hypothesis-testing', 'Hypothesis tests and p-values', 'math', 'intermediate', ['sk-sampling-distribution']),
  s('sk-p-value-misuse', 'What a p-value is not', 'math', 'intermediate', ['sk-hypothesis-testing']),
  s('sk-statistical-power', 'Power, effect size, and sample size', 'math', 'expert', ['sk-hypothesis-testing']),
  s('sk-ab-testing', 'Running an A/B test that answers something', 'math', 'intermediate', ['sk-hypothesis-testing']),
  s('sk-multiple-comparisons', 'Multiple comparisons and p-hacking', 'math', 'expert', ['sk-hypothesis-testing']),
  s('sk-causal-inference', 'Correlation, causation, and confounding', 'math', 'expert', ['sk-ab-testing']),
  s('sk-selection-bias', 'Selection and survivorship bias', 'math', 'intermediate', ['sk-sampling']),

  // --- Quantum computing ----------------------------------------------------
  s('sk-qubits', 'Qubits and superposition', 'quantum', 'intermediate'),
  s('sk-quantum-gates', 'Quantum gates as rotations', 'quantum', 'expert', ['sk-qubits']),
  s('sk-entanglement', 'Entanglement and correlation at a distance', 'quantum', 'expert', ['sk-qubits']),
  s('sk-measurement', 'Measurement and collapse', 'quantum', 'intermediate', ['sk-qubits']),
  s('sk-quantum-interference', 'Interference as the source of speedup', 'quantum', 'expert', ['sk-quantum-gates']),
  s('sk-quantum-algorithms', 'Shor, Grover, and what they actually do', 'quantum', 'expert', ['sk-quantum-interference']),
  s('sk-decoherence', 'Decoherence and error correction', 'quantum', 'expert', ['sk-measurement']),
  s('sk-quantum-reality', 'What quantum computers will and will not do', 'quantum', 'intro', ['sk-qubits']),

  // --- Computer graphics ----------------------------------------------------
  s('sk-raster-vector', 'Raster and vector representations', 'graphics', 'intro'),
  s('sk-colour-spaces', 'Colour spaces, gamma, and perception', 'graphics', 'intermediate', ['sk-raster-vector']),
  s('sk-transforms', 'Transforms and homogeneous coordinates', 'graphics', 'intermediate', ['sk-matrices']),
  s('sk-rasterization', 'Turning triangles into pixels', 'graphics', 'intermediate', ['sk-transforms']),
  s('sk-shading', 'Lighting and shading models', 'graphics', 'expert', ['sk-rasterization']),
  s('sk-ray-tracing', 'Ray tracing and global illumination', 'graphics', 'expert', ['sk-shading']),
  s('sk-textures', 'Textures, sampling, and filtering', 'graphics', 'intermediate', ['sk-rasterization']),
  s('sk-graphics-pipeline', 'The GPU pipeline end to end', 'graphics', 'expert', ['sk-rasterization']),
  s('sk-anti-aliasing', 'Aliasing and how to fight it', 'graphics', 'intermediate', ['sk-rasterization']),

  // --- Robotics & embedded --------------------------------------------------
  s('sk-microcontrollers', 'Microcontrollers and bare metal', 'robotics', 'intro', ['sk-instruction-cycle']),
  s('sk-sensors-actuators', 'Sensors, actuators, and noise', 'robotics', 'intro', ['sk-microcontrollers']),
  s('sk-real-time', 'Real-time constraints and determinism', 'robotics', 'intermediate', ['sk-scheduling']),
  s('sk-control-loops', 'Feedback control and PID', 'robotics', 'intermediate', ['sk-sensors-actuators']),
  s('sk-state-estimation', 'Filtering and state estimation', 'robotics', 'expert', ['sk-control-loops']),
  s('sk-kinematics', 'Kinematics and coordinate frames', 'robotics', 'expert', ['sk-transforms']),
  s('sk-slam', 'Mapping and localisation', 'robotics', 'expert', ['sk-state-estimation']),
  s('sk-embedded-constraints', 'Power, memory, and thermal budgets', 'robotics', 'intermediate', ['sk-microcontrollers']),
  s('sk-safety-critical', 'Safety-critical engineering', 'robotics', 'expert', ['sk-real-time']),

  // --- Human-computer interaction & product ---------------------------------
  s('sk-mental-models', 'Mental models and conceptual mismatch', 'product', 'intro'),
  s('sk-affordances', 'Affordances, signifiers, and feedback', 'product', 'intro', ['sk-mental-models']),
  s('sk-usability-heuristics', 'Usability heuristics that find real problems', 'product', 'intermediate', ['sk-affordances']),
  s('sk-user-research', 'Asking users the right question', 'product', 'intermediate', ['sk-mental-models']),
  s('sk-information-architecture', 'Structure, navigation, and findability', 'product', 'intermediate', ['sk-mental-models']),
  s('sk-inclusive-design', 'Designing for the range of human ability', 'product', 'intermediate', ['sk-affordances']),
  s('sk-product-metrics', 'Metrics that measure the thing you care about', 'product', 'intermediate', ['sk-ab-testing']),
  s('sk-dark-patterns', 'Persuasion, manipulation, and where the line is', 'product', 'intermediate', ['sk-product-metrics']),

  // --- Working as an engineer -----------------------------------------------
  s('sk-technical-writing', 'Writing that gets read and acted on', 'product', 'intro'),
  s('sk-design-docs', 'Design documents and decision records', 'product', 'intermediate', ['sk-technical-writing']),
  s('sk-estimation', 'Estimating work and being wrong usefully', 'product', 'intermediate'),
  s('sk-scope-negotiation', 'Scope, trade-offs, and saying no well', 'product', 'intermediate', ['sk-estimation']),
  s('sk-incident-response', 'Incidents, mitigation, and blameless postmortems', 'product', 'intermediate', ['sk-observability']),
  s('sk-on-call', 'On-call, alert fatigue, and sustainable operations', 'product', 'intermediate', ['sk-incident-response']),
  s('sk-mentoring', 'Mentoring, feedback, and growing others', 'product', 'intermediate'),
  s('sk-interviewing', 'Technical interviews from both sides', 'product', 'intermediate', ['sk-technical-writing']),
  s('sk-collaboration', 'Working across time zones and disciplines', 'product', 'intro'),
];

export const SKILLS_BY_ID: ReadonlyMap<string, Skill> = new Map(SKILLS.map((sk) => [sk.id, sk]));

export function getSkill(id: string): Skill | undefined {
  return SKILLS_BY_ID.get(id);
}
