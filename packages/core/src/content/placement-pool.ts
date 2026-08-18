/**
 * The placement-test question pool.
 *
 * Kept separate from lesson content so placement questions are never ones the
 * learner has just been taught. Each entry is tagged with its level and domain,
 * which is what the adaptive ladder and the domain-coverage heuristic in
 * engine/placement.ts read.
 */

import type { PlacementQuestion } from '../engine/placement.js';
import { mcq, numeric, trueFalse } from './builders.js';

export function placementPool(): PlacementQuestion[] {
  return [
    // --- intro ------------------------------------------------------------
    {
      level: 'intro',
      domain: 'foundations',
      exercise: mcq(
        'Which statement about AI, machine learning, and deep learning is correct?',
        [
          'They are three names for the same thing',
          'Deep learning is a subset of machine learning, which is a subset of AI',
          'Machine learning is a subset of deep learning',
          'AI is a subset of machine learning',
        ],
        1,
        ['sk-ai-ml-dl-relationship'],
        'The circles nest inward: deep learning ⊂ machine learning ⊂ AI.',
      ),
    },
    {
      level: 'intro',
      domain: 'machine-learning',
      exercise: mcq(
        'What distinguishes supervised from unsupervised learning?',
        [
          'Supervised learning uses labelled examples',
          'Supervised learning is faster',
          'Unsupervised learning uses neural networks',
          'Supervised learning needs no data',
        ],
        0,
        ['sk-supervised-learning'],
        'Supervised learning trains on inputs paired with correct answers; unsupervised learning finds structure without them.',
      ),
    },
    {
      level: 'intro',
      domain: 'data',
      exercise: trueFalse(
        'You should evaluate a model on the same data it was trained on.',
        false,
        ['sk-train-val-test'],
        'A model can memorise its training data. Only held-out data measures generalisation.',
      ),
    },
    {
      level: 'intro',
      domain: 'llms',
      exercise: mcq(
        'What is a large language model fundamentally trained to do?',
        [
          'Look up facts in a database',
          'Predict the next token in a sequence',
          'Parse sentences into grammar trees',
          'Translate between fixed language pairs',
        ],
        1,
        ['sk-language-modeling'],
        'Next-token prediction is the entire pretraining objective. Everything else emerges from doing it well at scale.',
      ),
    },
    {
      level: 'intro',
      domain: 'prompt-engineering',
      exercise: mcq(
        'Which prompt is most likely to produce consistent output?',
        [
          '"Summarize this well."',
          '"Give me a good summary."',
          '"Summarize in exactly 3 bullets, each under 20 words."',
          '"Please summarize, thank you."',
        ],
        2,
        ['sk-prompt-anatomy'],
        'Specific, checkable constraints reduce the space the model has to guess within.',
      ),
    },
    {
      level: 'intro',
      domain: 'ethics-safety',
      exercise: mcq(
        'A hiring model trained on past decisions rejects more candidates from one group. The most likely cause is:',
        [
          'A bug in the training code',
          'Bias present in the historical training data',
          'Too few model parameters',
          'The learning rate',
        ],
        1,
        ['sk-algorithmic-bias'],
        'The model reproduced the pattern in its data. Bias almost always enters through data and framing.',
      ),
    },
    {
      level: 'intro',
      domain: 'deep-learning',
      exercise: mcq(
        'What does a single artificial neuron compute?',
        [
          'A weighted sum of inputs, plus a bias, passed through an activation function',
          'The average of its inputs',
          'A random value',
          'The maximum of its inputs',
        ],
        0,
        ['sk-perceptron'],
        'Multiply, sum with bias, then apply a nonlinearity. That is the whole operation.',
      ),
    },

    // --- intermediate -----------------------------------------------------
    {
      level: 'intermediate',
      domain: 'machine-learning',
      exercise: mcq(
        'Training accuracy is 99% and validation accuracy is 72%. What is happening?',
        ['Underfitting', 'Overfitting', 'The learning rate is too low', 'Class imbalance'],
        1,
        ['sk-overfitting'],
        'A large train/validation gap is the signature of overfitting.',
      ),
    },
    {
      level: 'intermediate',
      domain: 'machine-learning',
      exercise: numeric(
        'A model flags 200 items; 150 are truly positive. What is its precision, as a percentage?',
        75,
        ['sk-classification-metrics'],
        'Precision = TP / (TP + FP) = 150 / 200 = 75%.',
        { unit: '%' },
      ),
    },
    {
      level: 'intermediate',
      domain: 'llms',
      exercise: mcq(
        'Roughly how many tokens is 1,000 words of English text?',
        ['About 250', 'About 750', 'About 1,300', 'About 4,000'],
        2,
        ['sk-tokenization'],
        'Roughly 0.75 words per token, so 1,000 words is about 1,300 tokens.',
      ),
    },
    {
      level: 'intermediate',
      domain: 'llms',
      exercise: mcq(
        'Your company documents change weekly and answers must cite sources. Fine-tuning or RAG?',
        ['Fine-tuning', 'RAG', 'Neither', 'Both are equivalent here'],
        1,
        ['sk-rag'],
        'RAG updates by re-indexing and produces citable answers. Fine-tuning is slow and unattributable.',
      ),
    },
    {
      level: 'intermediate',
      domain: 'deep-learning',
      exercise: mcq(
        'What happens to a deep network with no activation functions?',
        [
          'It trains faster',
          'It collapses to an equivalent single linear layer',
          'Gradients explode',
          'It overfits more',
        ],
        1,
        ['sk-activation-functions'],
        'Composing linear maps yields a linear map, so depth adds no expressive power.',
      ),
    },
    {
      level: 'intermediate',
      domain: 'mlops',
      exercise: mcq(
        'A deployed model degrades over months with no code change. Most likely cause?',
        ['A code bug', 'Distribution shift', 'Too small a test set', 'Overfitting'],
        1,
        ['sk-model-monitoring'],
        'Static code plus falling performance means the input or the relationship has moved.',
      ),
    },
    {
      level: 'intermediate',
      domain: 'generative-ai',
      exercise: mcq(
        'What does a diffusion model learn to predict during training?',
        [
          'The final image directly',
          'The noise added at a given timestep',
          'The text caption',
          'The next pixel',
        ],
        1,
        ['sk-diffusion'],
        'Noise prediction is a stable regression target, which is why diffusion trains more reliably than GANs.',
      ),
    },
    {
      level: 'intermediate',
      domain: 'agents',
      exercise: mcq(
        'A task has known fixed steps: extract, validate, store. What design is appropriate?',
        [
          'An autonomous agent',
          'A fixed chain of calls',
          'A multi-agent system',
          'Reinforcement learning',
        ],
        1,
        ['sk-agent-loop'],
        'When the sequence is known, a chain is cheaper, faster, and testable. Autonomy buys nothing here.',
      ),
    },

    // --- expert -----------------------------------------------------------
    {
      level: 'expert',
      domain: 'llms',
      exercise: mcq(
        'In `softmax(QKᵀ/√dₖ)V`, why divide by √dₖ?',
        [
          'To normalize the output magnitude',
          'Dot products grow with dimension; unscaled, softmax saturates and gradients vanish',
          'To speed up computation',
          'To keep weights positive',
        ],
        1,
        ['sk-attention'],
        'Variance of the dot product scales with dimension. Scaling keeps softmax out of its saturated regime.',
      ),
    },
    {
      level: 'expert',
      domain: 'llms',
      exercise: mcq(
        'Why is a KL penalty used during RLHF?',
        [
          'To speed up convergence',
          'To keep the policy near the SFT model and prevent reward hacking',
          'To reduce memory use',
          'To increase diversity',
        ],
        1,
        ['sk-rlhf'],
        'Unconstrained optimisation exploits flaws in the reward model. The KL term keeps the policy in the regime where the proxy is valid.',
      ),
    },
    {
      level: 'expert',
      domain: 'deep-learning',
      exercise: mcq(
        'Why do residual connections make very deep networks trainable?',
        [
          'They reduce the parameter count',
          'The identity path gives gradients an unattenuated route to early layers',
          'They remove the need for activations',
          'They act as normalization',
        ],
        1,
        ['sk-vanishing-gradients'],
        'The `+ x` term has derivative 1, so gradient flow does not degrade with depth.',
      ),
    },
    {
      level: 'expert',
      domain: 'llms',
      exercise: mcq(
        'Doubling context length increases attention compute by roughly what factor?',
        ['2×', '4×', '1×', '8×'],
        1,
        ['sk-kv-cache'],
        'Attention is quadratic in sequence length, so 2× tokens means about 4× the attention compute.',
      ),
    },
    {
      level: 'expert',
      domain: 'prompt-engineering',
      exercise: mcq(
        'Why is prompt injection harder to fix than SQL injection?',
        [
          'It is a newer problem',
          'Natural language has no formal grammar separating instructions from data',
          'Models are too large to patch',
          'It only affects agents',
        ],
        1,
        ['sk-prompt-injection'],
        'Parameterised queries work because SQL separates code from data formally. Natural language offers no such boundary.',
      ),
    },
    {
      level: 'expert',
      domain: 'reinforcement-learning',
      exercise: mcq(
        'A robot arm has continuous joint angles. Which RL family fits best?',
        [
          'Q-learning',
          'Policy gradient methods',
          'Supervised learning',
          'k-means',
        ],
        1,
        ['sk-policy-gradient'],
        'Q-learning requires maximising over actions, which is intractable in continuous spaces. Policy methods output distributions directly.',
      ),
    },
    {
      level: 'expert',
      domain: 'ethics-safety',
      exercise: trueFalse(
        'Several common fairness definitions cannot all be satisfied at once when base rates differ between groups.',
        true,
        ['sk-fairness-metrics'],
        'This is a proven impossibility result, not an engineering shortfall. Choosing between them is unavoidable.',
      ),
    },
    {
      level: 'expert',
      domain: 'machine-learning',
      exercise: mcq(
        'You have 5,000 features, suspect most are irrelevant, and need an interpretable model. Which regularization?',
        ['L2 (Ridge)', 'L1 (Lasso)', 'No regularization', 'Dropout'],
        1,
        ['sk-regularization'],
        'L1 drives weak weights exactly to zero, performing feature selection. L2 shrinks without eliminating.',
      ),
    },
  ];
}
