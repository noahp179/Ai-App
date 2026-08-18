/**
 * Track 11 — Math for AI.
 *
 * Deliberately the minimum that actually pays off. Not a maths course: every
 * concept here is one you will hit reading a paper or debugging a model, and
 * each is taught to the depth that makes the AI content make sense — no further.
 */

import type { Track } from '../../domain/types.js';
import { concept, lesson, match, mcq, multi, numeric, shortAnswer, trueFalse } from '../builders.js';

export const mathTrack: Track = {
  id: 'track-math',
  title: 'Math for AI',
  tagline: 'Only the parts you actually need',
  description:
    'Vectors, derivatives, probability, and information theory — taught at the depth that makes machine learning readable, and no deeper.',
  domain: 'math',
  level: 'intermediate',
  icon: '📐',
  gradient: ['#A855F7', '#6366F1'],
  prerequisites: [],
  outcomes: [
    'Read vector and matrix notation in papers',
    'Understand what a derivative tells an optimizer',
    'Apply Bayes’ theorem and reason about base rates',
    'Explain what cross-entropy measures',
  ],
  units: [
    {
      id: 'unit-math-1',
      title: 'Vectors and Change',
      description: 'Linear algebra and calculus, at working depth.',
      lessons: [
        lesson({
          id: 'lesson-vectors',
          title: 'Vectors and Dot Products',
          summary: 'The one operation that appears everywhere.',
          level: 'intro',
          domain: 'math',
          free: true,
          steps: [
            concept(
              'A list of numbers with a direction',
              'A vector is an ordered list of numbers: `[2, -1, 4]`. In machine learning it is almost always a *representation* — the features of one house, the embedding of one word, the activations of one layer.\n\nThe operation you will meet most is the **dot product**: multiply matching entries and sum.\n\n`[2, -1, 4] · [1, 3, 0.5] = 2 - 3 + 2 = 1`\n\nOne number out of two vectors. It measures **alignment**: large and positive when the vectors point the same way, near zero when they are perpendicular, negative when opposed.\n\nThis is why it is everywhere. A neuron computes a dot product of inputs and weights. Attention scores queries against keys with a dot product. Semantic search ranks by (normalised) dot product. All the same operation.',
              { keyTerms: [{ term: 'Dot product', definition: 'Sum of elementwise products. Measures alignment between two vectors.' }] },
            ),
            numeric(
              'What is `[3, 0, -2] · [1, 5, 2]`?',
              -1,
              ['sk-vectors'],
              '(3 × 1) + (0 × 5) + (−2 × 2) = 3 + 0 − 4 = −1. A negative result means the vectors point in broadly opposing directions.',
            ),
            mcq(
              'Two vectors have a dot product of zero. What does that tell you?',
              [
                'They are identical',
                'They are perpendicular — no shared directional component',
                'They both have zero length',
                'One is the negative of the other',
              ],
              1,
              ['sk-vectors'],
              'A zero dot product means orthogonal. In embedding space this is roughly "unrelated" — the two representations share no direction.',
            ),
            concept(
              'Matrix multiplication',
              'A matrix is a grid of numbers, and multiplying by one is a **batch of dot products**. Each output entry is one row of the first matrix dotted with one column of the second.\n\nThe shape rule is the thing to internalise: `(a × b) @ (b × c) → (a × c)`. The inner dimensions must match and they vanish; the outer ones survive.\n\nThis is what a neural network layer *is*. A batch of 32 examples with 128 features times a `(128 × 64)` weight matrix gives `(32 × 64)` — every example transformed by the same weights, all in one operation the GPU executes in parallel.\n\nMost deep learning bugs you will hit in practice are shape errors. Reading the shapes is the debugging skill.',
            ),
            mcq(
              'What shape results from multiplying a `(64 × 256)` matrix by a `(256 × 10)` matrix?',
              ['(64 × 10)', '(256 × 256)', '(64 × 256)', 'The multiplication is invalid'],
              0,
              ['sk-matrices'],
              'The inner 256s match and cancel, leaving the outer dimensions: `(64 × 10)`.',
            ),
            concept(
              'Derivatives: which way is downhill',
              'A **derivative** is a rate of change — how much the output moves when you nudge the input.\n\nGeometrically it is the slope of the tangent line. Positive slope means increasing the input increases the output. Zero slope means you are at a flat point: a minimum, a maximum, or a saddle.\n\nThis is the entire basis of training. The optimizer asks "if I nudge this weight up, does the loss go up or down, and by how much?" — that is a derivative. With millions of weights you take the **partial derivative** with respect to each one, and the vector of all of them is the **gradient**.\n\nThe **chain rule** is what makes it tractable through many layers: if `y` depends on `u` and `u` depends on `x`, then `dy/dx = dy/du × du/dx`. Multiply the local rates along the path. Backpropagation is this rule applied systematically, backwards.',
              { keyTerms: [{ term: 'Partial derivative', definition: 'Rate of change with respect to one variable, holding the others fixed.' }] },
            ),
            numeric(
              'For `f(x) = 3x²`, what is the derivative at x = 2?',
              12,
              ['sk-derivatives'],
              'The derivative of 3x² is 6x. At x = 2 that is 12 — the function is rising steeply, so a gradient step would move x down noticeably.',
              { hint: 'Bring the exponent down and reduce it by one.' },
            ),
            mcq(
              'A loss function has zero gradient at the current weights. What does that mean for training?',
              [
                'Training has definitely found the global minimum',
                'The optimizer has no direction to move — it could be a minimum, maximum, or saddle point',
                'The learning rate is too high',
                'The model has no parameters',
              ],
              1,
              ['sk-derivatives'],
              'Zero gradient means flat, not optimal. In high-dimensional loss landscapes saddle points vastly outnumber true minima, which is exactly why momentum-based optimizers — able to coast through flat regions — outperform plain gradient descent.',
            ),
          ],
        }),

        lesson({
          id: 'lesson-probability',
          title: 'Probability and Bayes',
          summary: 'Why a 99%-accurate test can still be usually wrong.',
          level: 'intermediate',
          domain: 'math',
          steps: [
            concept(
              'Conditional probability',
              '`P(A)` is the probability of A. `P(A | B)` — read "A given B" — is the probability of A *once you know* B has happened.\n\nThe distinction matters enormously and is routinely collapsed. `P(positive test | disease)` and `P(disease | positive test)` are different numbers, often wildly different, and confusing them is called the **base rate fallacy**.\n\nEvery classifier output is a conditional probability: `P(spam | this email\'s features)`. Every language model output is `P(next token | everything so far)`.',
              { keyTerms: [{ term: 'Conditional probability', definition: 'P(A | B) — the probability of A given that B is known to have occurred.' }] },
            ),
            concept(
              'Bayes’ theorem',
              '`P(A | B) = P(B | A) × P(A) / P(B)`\n\nIt lets you flip a conditional around — go from "how often does the test fire when the disease is present" to the thing you actually want, "how likely is the disease given a positive test".\n\nThe classic worked example. A disease affects **1 in 1,000** people. A test is **99% accurate** in both directions. You test positive. What is the chance you have it?\n\nTake 100,000 people:\n- 100 have the disease. 99 test positive.\n- 99,900 do not. 1% of them — **999** — test positive anyway.\n\nSo 1,098 positive tests, of which 99 are real: **about 9%**.\n\nA 99% accurate test, and a positive result still means you probably do not have it. The rarity of the disease dominates. This is why screening programmes for rare conditions generate so many false positives, and why *precision* on rare classes is so hard to achieve.',
            ),
            mcq(
              'A test is 99% accurate for a disease affecting 1 in 1,000. You test positive. Roughly what is the chance you have it?',
              ['99%', 'About 50%', 'About 9%', 'About 1%'],
              2,
              ['sk-bayes'],
              'Around 9%. True positives (99) are swamped by false positives (999) because the healthy population is a thousand times larger. The base rate dominates the result.',
              'Work with 100,000 people and count both groups.',
            ),
            trueFalse(
              '`P(positive test | disease)` and `P(disease | positive test)` are the same quantity.',
              false,
              ['sk-probability-basics'],
              'They are different, and conflating them is the base rate fallacy. Bayes’ theorem is the bridge between them, and the base rate is what determines how far apart they land.',
            ),
            concept(
              'Entropy and cross-entropy',
              '**Entropy** measures uncertainty in a distribution. A fair coin has 1 bit of entropy — you genuinely do not know. A coin that always lands heads has 0 bits — the outcome carries no information.\n\n**Cross-entropy** measures how many bits you waste encoding reality with the wrong distribution. If the truth is P and your model predicts Q, cross-entropy is minimised exactly when Q equals P.\n\nThat is why it is the standard classification loss: **minimising cross-entropy is minimising the gap between your model\'s beliefs and reality.**\n\nIt also explains **perplexity**, the standard language model metric: perplexity is `e^(cross-entropy)`, interpretable as "how many options is the model effectively choosing between at each token". Perplexity 10 means it is about as uncertain as picking uniformly from 10 words. Lower is better.',
              { keyTerms: [{ term: 'Entropy', definition: 'Average uncertainty in a distribution, measured in bits or nats.' }, { term: 'Perplexity', definition: 'Exponentiated cross-entropy. The effective number of choices per token.' }] },
            ),
            mcq(
              'A language model\'s perplexity drops from 40 to 12. What happened?',
              [
                'It became less accurate',
                'It is effectively choosing between far fewer options per token — it predicts text better',
                'It got larger',
                'The context window grew',
              ],
              1,
              ['sk-entropy'],
              'Lower perplexity means lower cross-entropy, which means the predicted distribution is closer to the true one. The model is less surprised by real text.',
            ),
            match(
              'Match each quantity to what it measures.',
              [
                { left: 'Uncertainty within one distribution', right: 'Entropy' },
                { left: 'Mismatch between predicted and true distributions', right: 'Cross-entropy' },
                { left: 'Effective number of choices per token', right: 'Perplexity' },
                { left: 'Probability of A once B is known', right: 'Conditional probability' },
              ],
              ['sk-entropy', 'sk-probability-basics'],
              'Entropy is about one distribution; cross-entropy compares two. Perplexity is just cross-entropy on a more intuitive scale.',
            ),
            shortAnswer(
              'Why does a highly accurate test for a rare disease still produce mostly false positives?',
              ['base rate', 'rare', 'false positives', 'healthy', 'larger'],
              'Because the healthy population is so much larger. Even a small false-positive rate applied to a very large group produces more false positives than the true positives from the tiny affected group. The base rate dominates.',
              ['sk-bayes'],
              'This is the base rate fallacy, and it is the reason precision on rare classes is genuinely hard rather than just a tuning problem.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-math-1',
        title: 'Math Checkpoint',
        passingScore: 0.7,
        exercises: [
          numeric(
            'What is `[1, 2, 3] · [4, 0, -1]`?',
            1,
            ['sk-vectors'],
            '4 + 0 − 3 = 1.',
          ),
          mcq(
            'Why is cross-entropy the standard classification loss?',
            [
              'It is fastest to compute',
              'It is minimised exactly when the predicted distribution matches the true one',
              'It works only for two classes',
              'It requires no gradients',
            ],
            1,
            ['sk-entropy'],
            'Minimising cross-entropy is directly minimising the divergence between the model\'s beliefs and reality.',
          ),
          multi(
            'Which are true of the gradient? (Select all)',
            [
              'It is the vector of partial derivatives',
              'It points in the direction of steepest increase',
              'Gradient descent moves against it',
              'It is always zero at a global minimum only',
            ],
            [0, 1, 2],
            ['sk-derivatives'],
            'The first three are correct. Zero gradient also occurs at maxima and saddle points — which is most flat points in high dimensions.',
          ),
        ],
      },
    },
  ],
};
