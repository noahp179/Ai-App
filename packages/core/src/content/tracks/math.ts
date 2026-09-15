/**
 * Track 11 — Math for AI.
 *
 * Deliberately the minimum that actually pays off. Not a maths course: every
 * concept here is one you will hit reading a paper or debugging a model, and
 * each is taught to the depth that makes the AI content make sense — no further.
 */

import type { Track } from '../../domain/types';
import { categorize, concept, interactive, lesson, match, mcq, multi, numeric, shortAnswer, trueFalse } from '../builders';

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
    'Read a matrix as a transformation and say what its principal directions mean',
    'Choose between Euclidean distance and cosine similarity, and say why',
    'Explain expected value, variance, and why models optimise in log space',
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
            interactive(
              'Follow the slope',
              'gradient-descent',
              'The derivative is just the slope. Watch the optimizer read it and step downhill — and watch what happens when the step is larger than the valley is wide.',
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
            interactive(
              'Compute the posterior',
              'bayes-calculator',
              'Set prevalence and test accuracy, then read off the probability that a positive result is real. Drag prevalence from 1-in-10 to 1-in-10,000 and watch the answer collapse.',
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
            interactive(
              'Move the probabilities',
              'entropy-explorer',
              'Drag a distribution from uniform to near-certain and watch entropy fall from maximum to zero. Then compare entropy against cross-entropy when the predicted distribution drifts from the true one.',
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
    // -----------------------------------------------------------------------
    {
      id: 'unit-math-2',
      title: 'Matrices and Similarity',
      description: 'What a matrix does to space, and how to measure closeness.',
      lessons: [
        lesson({
          id: 'lesson-matrices',
          title: 'Matrices as Transformations',
          summary: 'Stop reading matrices as grids of numbers. They are functions.',
          level: 'intermediate',
          domain: 'math',
          steps: [
            concept(
              'A matrix is a function on space',
              'The grid-of-numbers picture is technically true and almost useless. The working picture is this: **a matrix takes a vector and returns a different vector.** It is a function, and matrix multiplication is function application.\n\nWhat kinds of function? Ones that keep the origin fixed and keep straight lines straight — rotations, scalings, shears, projections, and combinations of them.\n\nThe columns tell you everything. Multiply a matrix by `[1, 0]` and you get its first column; by `[0, 1]` and you get its second. **A matrix is fully described by where it sends the basis vectors**, because everything else follows by linearity.\n\nSo when a neural network layer multiplies by a weight matrix, it is not "mixing numbers". It is applying a learned linear transformation to the representation — rotating and stretching the space until the classes are easier to separate. The nonlinearity that follows is what lets the next layer bend space rather than just tilt it.',
              {
                keyTerms: [
                  { term: 'Linear transformation', definition: 'A function that preserves straight lines and the origin. Every matrix is one.' },
                  { term: 'Basis vectors', definition: 'The unit vectors along each axis. A matrix is defined by where it sends them.' },
                ],
              },
            ),
            mcq(
              'A 2×2 matrix has columns `[0, 1]` and `[-1, 0]`. What does it do to a vector?',
              [
                'Scales it by 2',
                'Rotates it 90° counter-clockwise',
                'Projects it onto the x-axis',
                'Leaves it unchanged',
              ],
              1,
              ['sk-matrices'],
              'The columns say where the basis vectors land: `[1, 0]` goes to `[0, 1]` and `[0, 1]` goes to `[-1, 0]`. Both have rotated a quarter turn counter-clockwise, so every vector does.',
              'Ask where each basis vector ends up.',
            ),
            concept(
              'Eigenvectors: the directions a matrix does not turn',
              'Most vectors get both rotated and stretched. A few special ones only get **stretched** — they come out pointing the same way, just longer or shorter. Those are the matrix\'s **eigenvectors**, and the stretch factor for each is its **eigenvalue**.\n\n`A v = λ v` — applying the matrix is the same as multiplying by a single number.\n\nThis is not a curiosity. It is what **PCA** runs on. Take your data, build its covariance matrix, and find that matrix\'s eigenvectors: they are the directions along which the data varies, ordered by how much. The top eigenvector is the single direction that explains the most variance. Keep the top few and you have compressed the data while keeping most of its structure.\n\nThe same idea reappears as **spectral clustering**, as **PageRank** (the ranking is the top eigenvector of the link matrix), and in the stability analysis that tells you whether a recurrent network\'s activations will explode or die.',
              {
                keyTerms: [
                  { term: 'Eigenvector', definition: 'A direction a matrix only scales, never rotates.' },
                  { term: 'Eigenvalue', definition: 'The factor by which its eigenvector is scaled.' },
                ],
              },
            ),
            interactive(
              'Find the direction of most variance',
              'pca-projection',
              'Rotate the projection axis and watch the variance of the projected points rise and fall. The angle that maximises it is the top eigenvector of the covariance matrix — PCA is nothing more than finding it.',
            ),
            mcq(
              'PCA keeps the top two principal components of a 50-dimensional dataset. What has it kept?',
              [
                'The two original features with the largest values',
                'The two directions in feature space along which the data varies most',
                'The first two rows of the data',
                'The two features most correlated with the label',
              ],
              1,
              ['sk-eigenvectors', 'sk-dimensionality-reduction'],
              'Principal components are directions, not original features — each is a weighted combination of all 50. And PCA never looks at the label, which is exactly why it can discard a low-variance direction that happened to be the one that mattered.',
            ),
            trueFalse(
              'Matrix multiplication is associative: `(AB)C` always equals `A(BC)`.',
              true,
              ['sk-matrices'],
              'Associative yes, commutative no — `AB` and `BA` are generally different matrices, and may not even have compatible shapes. Associativity is what lets you collapse a chain of linear layers into a single matrix, and choose the cheapest order in which to multiply them.',
            ),
            numeric(
              'You multiply a `(32 × 784)` batch by a `(784 × 128)` weight matrix, then by a `(128 × 10)` output matrix. How many columns does the final result have?',
              10,
              ['sk-matrices'],
              '`(32 × 784) @ (784 × 128) → (32 × 128)`, then `(32 × 128) @ (128 × 10) → (32 × 10)`. The batch dimension of 32 rides through untouched; the feature dimension is what each layer reshapes.',
            ),
          ],
        }),

        lesson({
          id: 'lesson-similarity',
          title: 'Measuring Similarity',
          summary: 'Euclidean or cosine? The choice changes what "similar" means.',
          level: 'intermediate',
          domain: 'math',
          steps: [
            concept(
              'Two vectors, two questions',
              'Given two vectors there are two different questions you might be asking, and they have different answers.\n\n**Euclidean distance** asks *how far apart are these points?* — straight-line distance, `√Σ(aᵢ − bᵢ)²`. Small means close.\n\n**Cosine similarity** asks *are these pointing the same way?* — the dot product divided by both lengths, which is exactly the cosine of the angle between them. It runs from 1 (same direction) through 0 (perpendicular) to −1 (opposite), and it **ignores magnitude entirely**.\n\nThe difference bites in practice. Take two documents about the same subject, one three times longer. Their word-count vectors point in nearly the same direction but sit far apart in Euclidean space. Cosine says "the same topic". Euclidean says "very different documents". For topic search, cosine is the question you meant to ask.',
              {
                keyTerms: [
                  { term: 'Cosine similarity', definition: 'Dot product normalised by both lengths. Measures direction, not magnitude.' },
                  { term: 'Euclidean distance', definition: 'Straight-line distance. Sensitive to magnitude.' },
                ],
              },
            ),
            mcq(
              'Why do embedding search systems almost always rank by cosine similarity rather than Euclidean distance?',
              [
                'Cosine is faster to compute',
                'Meaning is carried by direction in embedding space; magnitude mostly reflects things like length and frequency',
                'Euclidean distance does not work in high dimensions',
                'Cosine similarity is bounded and Euclidean is not',
              ],
              1,
              ['sk-cosine-similarity'],
              'Direction encodes what the text is about; magnitude tends to track incidental properties. Rank by cosine and a one-line question can match a long document that answers it. (Once vectors are length-normalised the two rankings agree exactly — which is why vector databases normalise on write and then use a plain dot product.)',
            ),
            interactive(
              'Move through embedding space',
              'embedding-space',
              'Drag a point around and watch which neighbours it picks up. Notice that the nearest words change with direction, not with how far from the origin you drag.',
            ),
            numeric(
              'What is the cosine similarity of `[3, 4]` and `[6, 8]`?',
              1,
              ['sk-cosine-similarity'],
              'The second vector is exactly twice the first, so they point the same way: cosine 1. Their Euclidean distance, meanwhile, is 5 — not small at all. Same direction, different magnitude, and the two measures disagree completely.',
              { tolerance: 0.01, hint: 'Look at the two vectors before computing anything.' },
            ),
            match(
              'Match each task to the measure that fits it.',
              [
                { left: 'Ranking documents by topic, regardless of length', right: 'Cosine similarity' },
                { left: 'Finding the nearest weather station to a farm', right: 'Euclidean distance' },
                { left: 'Grouping customers by absolute spend', right: 'Euclidean distance' },
                { left: 'Matching a short question to a long answer', right: 'Cosine similarity' },
              ],
              ['sk-cosine-similarity', 'sk-vectors'],
              'The rule of thumb: if magnitude is part of what you mean by different, use Euclidean. If it is noise, use cosine.',
            ),
            trueFalse(
              'If two vectors are length-normalised, ranking by cosine similarity and ranking by Euclidean distance give the same order.',
              true,
              ['sk-cosine-similarity'],
              'True, and it is why vector databases normalise on write. On the unit sphere, `d² = 2 − 2·cos`, a strictly decreasing function of cosine — so the orderings are identical and you can use whichever the hardware computes faster.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-math-2',
        title: 'Matrices Checkpoint',
        passingScore: 0.7,
        exercises: [
          mcq(
            'What does the top principal component of a dataset represent?',
            [
              'The feature most correlated with the target',
              'The direction in feature space along which the data varies most',
              'The mean of all features',
              'The feature with the largest values',
            ],
            1,
            ['sk-eigenvectors'],
            'It is the top eigenvector of the covariance matrix — a direction built from every feature, chosen without seeing the label.',
          ),
          numeric(
            'What is the cosine similarity of [2, 0] and [5, 0]?',
            1,
            ['sk-cosine-similarity'],
            'Same direction, different magnitude: cosine 1. Their Euclidean distance is 3, which is why the choice of measure changes the answer.',
            { tolerance: 0.01 },
          ),
          trueFalse(
            'Matrix multiplication is commutative.',
            false,
            ['sk-matrices'],
            'Rotating then stretching lands somewhere different from stretching then rotating. Order is meaning — which is why layer order in a network is not arbitrary.',
          ),
        ],
      },
    },

    // -----------------------------------------------------------------------
    {
      id: 'unit-math-3',
      title: 'Uncertainty and Optimization',
      description: 'Expectations, variance, and why everything is done in log space.',
      lessons: [
        lesson({
          id: 'lesson-expectation',
          title: 'Expected Value and Variance',
          summary: 'The average outcome, and how much you should trust it.',
          level: 'intermediate',
          domain: 'math',
          steps: [
            concept(
              'The long-run average',
              '**Expected value** is the probability-weighted average of the outcomes: `E[X] = Σ P(x) · x`. It is what you would get per trial if you ran the thing forever.\n\nA bet paying £10 on a fair coin and losing £4 otherwise has `E = 0.5 × 10 + 0.5 × (−4) = £3`. Worth taking, on repeat.\n\nThe catch is that the expected value need not be an outcome that can ever happen — the expected number of heads in one flip is 0.5 — and it says nothing at all about the spread. That is what **variance** is for: `Var(X) = E[(X − E[X])²]`, the average squared distance from the mean. Standard deviation is its square root, back in the original units.\n\nTwo models can share a validation accuracy of 84% and be completely different products: one at 84% ± 1% across folds, one at 84% ± 12%. Report the mean without the variance and you have hidden the only number that told you whether the result was real.',
              {
                keyTerms: [
                  { term: 'Expected value', definition: 'The probability-weighted mean of a random variable.' },
                  { term: 'Variance', definition: 'Average squared deviation from the mean. Its square root is the standard deviation.' },
                ],
              },
            ),
            numeric(
              'A model earns £5 when it is right and costs £20 when it is wrong. It is right 80% of the time. What is the expected value per prediction, in pounds?',
              0,
              ['sk-expectation'],
              '`0.8 × 5 + 0.2 × (−20) = 4 − 4 = 0`. Break-even. An 80%-accurate model sounds good and is worth exactly nothing here, because the cost of an error is four times the value of a success. Accuracy without the cost matrix is not a business case.',
              { unit: '£', hint: 'Weight each outcome by how often it happens.' },
            ),
            concept(
              'Variance is where bias–variance comes from',
              'The bias–variance decomposition you meet in machine learning is this same variance, applied to the model itself.\n\nImagine retraining your model on many different samples of the data. **Bias** is how far the average prediction lands from the truth — error from the model being too simple to represent the pattern. **Variance** is how much the prediction jumps around between those retrainings — error from the model chasing the noise in whichever sample it got.\n\nA deep tree grown to purity has near-zero bias and enormous variance: a different sample gives a different tree. A straight line fitted to a curve has low variance and stubborn bias: every sample gives roughly the same wrong answer.\n\n**Random forests attack variance** — average many high-variance trees and the noise cancels while the signal survives. **Boosting attacks bias** — add small models that each fix what the current ensemble gets wrong. Knowing which one your error is made of tells you which fix to reach for.',
              { figure: 'overfitting-curves' },
            ),
            interactive(
              'Slide model complexity',
              'bias-variance',
              'Move complexity from underfit to overfit and watch training error fall monotonically while test error turns around. The turning point is where added variance starts costing more than the removed bias was worth.',
            ),
            mcq(
              'Five-fold cross-validation gives accuracies of 91%, 62%, 88%, 59%, and 90%. What should you conclude?',
              [
                'The model is 78% accurate — report the mean and move on',
                'The variance is huge; the mean is not trustworthy and something differs between folds',
                'The model is definitely overfitting',
                'Two folds are corrupted and should be dropped',
              ],
              1,
              ['sk-expectation', 'sk-cross-validation'],
              'A 30-point spread means the estimate is unstable. Report it and investigate — a bimodal split like this usually means the folds are not exchangeable: a grouping leaked across them, or the data is ordered in time and two folds got a different regime.',
            ),
            categorize(
              'Sort each remedy by whether it mainly reduces bias or variance.',
              ['Reduces bias', 'Reduces variance'],
              [
                { item: 'Add features or increase model capacity', category: 'Reduces bias' },
                { item: 'Gradient boosting', category: 'Reduces bias' },
                { item: 'Train on more data', category: 'Reduces variance' },
                { item: 'Bagging / random forests', category: 'Reduces variance' },
                { item: 'Stronger L2 regularization', category: 'Reduces variance' },
              ],
              ['sk-bias-variance', 'sk-expectation'],
              'Capacity and boosting close the gap between the model and the truth. More data, averaging, and regularization all stop the model from chasing the particular noise in its sample.',
            ),
          ],
        }),

        lesson({
          id: 'lesson-log-space',
          title: 'Why Everything Happens in Log Space',
          summary: 'Multiply a thousand probabilities and you get zero. Logs are the fix.',
          level: 'intermediate',
          domain: 'math',
          steps: [
            concept(
              'Probabilities underflow',
              'A language model assigns a probability to each token. The probability of a 1,000-token document is the product of a thousand numbers, each well below 1.\n\nTry it: `0.1¹⁰⁰⁰` is about `10⁻¹⁰⁰⁰`. The smallest positive number a 64-bit float can hold is around `10⁻³⁰⁸`. So the true answer is not small — it is **zero**, as far as the hardware is concerned, and every document scores identically.\n\nTake logs and the product becomes a sum: `log(a × b) = log a + log b`. A thousand log-probabilities, each around −2.3, sum to about −2,300. Perfectly representable, and order-preserving — because `log` is monotonic, whichever document had the higher probability still has the higher log-probability.\n\nThis is why you see `log_softmax`, `logsumexp`, and negative log-likelihood everywhere instead of the "obvious" versions. It is not mathematical taste. The obvious version returns zero.',
              {
                keyTerms: [
                  { term: 'Log-probability', definition: 'The logarithm of a probability. Always ≤ 0; sums where probabilities would multiply.' },
                  { term: 'Underflow', definition: 'A number too small for the float format, silently rounded to zero.' },
                ],
              },
            ),
            mcq(
              'Why is the loss called *negative* log-likelihood?',
              [
                'Because the model is being penalised',
                'Because log-probabilities are always ≤ 0, so negating turns "maximise likelihood" into "minimise a positive number"',
                'Because gradients must be negative',
                'Because the likelihood is subtracted from 1',
              ],
              1,
              ['sk-log-probability'],
              'Probabilities live in [0, 1], so their logs are ≤ 0. Negating gives a non-negative quantity that is zero for a perfect prediction and grows without bound as the model gets more confidently wrong — exactly the shape an optimizer wants to minimise.',
            ),
            numeric(
              'A model assigns probability 0.5 to each of 3 tokens. What is the total log-probability, using log base 2?',
              -3,
              ['sk-log-probability'],
              '`log₂(0.5) = −1` for each token, and logs add: `−1 + −1 + −1 = −3`. In base 2 the units are bits, so this sequence costs 3 bits to encode — which is exactly what cross-entropy measures.',
              { tolerance: 0.01 },
            ),
            concept(
              'Maximum likelihood is cross-entropy',
              'Here is the connection that makes the whole training objective click.\n\nYou want parameters that make the observed data as likely as possible — **maximum likelihood**. Write that down, take the log so the product becomes a sum, and negate so it is a minimisation:\n\n`minimise −(1/N) Σ log P(yᵢ | xᵢ)`\n\nThat expression *is* the cross-entropy between the true distribution (all mass on the observed label) and the model\'s predicted distribution. They are not analogous. They are the same formula reached from two directions — one from statistics, one from information theory.\n\nSo when you train a classifier with cross-entropy loss, you are doing maximum likelihood estimation. When a language model reports **perplexity**, that is `e` raised to the same number. One quantity, three names, depending on who is talking.',
            ),
            interactive(
              'Watch uncertainty become a number',
              'entropy-explorer',
              'Drag the predicted distribution away from the truth and watch cross-entropy climb. Put all the mass on the right answer and it falls to zero — that is a loss of nothing left to learn.',
            ),
            match(
              'Match each name to the field it comes from.',
              [
                { left: 'Negative log-likelihood', right: 'Statistics' },
                { left: 'Cross-entropy', right: 'Information theory' },
                { left: 'Perplexity', right: 'Language modelling' },
                { left: 'Log loss', right: 'Applied machine learning' },
              ],
              ['sk-log-probability', 'sk-entropy'],
              'Four names, one quantity (perplexity being its exponential). Papers switch between them without comment, so it is worth being able to read all four as the same thing.',
            ),
            shortAnswer(
              'Why can you not simply multiply token probabilities to score a long document?',
              ['underflow', 'zero', 'small', 'float', 'log'],
              'Each probability is below 1, so the product shrinks geometrically. After a few hundred tokens it falls below the smallest representable float and underflows to zero, making every document score the same. Summing log-probabilities gives the same ordering in a range the hardware can hold.',
              ['sk-log-probability'],
              'The failure is silent — you get zeros, not an error — which is what makes it worth recognising before you hit it.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-math-3',
        title: 'Math Checkpoint II',
        passingScore: 0.7,
        exercises: [
          mcq(
            'What does the top principal component of a dataset represent?',
            [
              'The feature most correlated with the target',
              'The direction in feature space along which the data varies most',
              'The average of all features',
              'The feature with the largest raw values',
            ],
            1,
            ['sk-eigenvectors'],
            'It is the top eigenvector of the covariance matrix — a direction, built from all features, chosen without ever seeing the label.',
          ),
          numeric(
            'A prediction wins £8 when right and loses £2 when wrong, and is right 60% of the time. Expected value per prediction, in pounds?',
            4,
            ['sk-expectation'],
            '`0.6 × 8 + 0.4 × (−2) = 4.8 − 0.8 = £4`.',
            { unit: '£', tolerance: 0.01 },
          ),
          trueFalse(
            'Minimising cross-entropy loss and maximising likelihood are two names for the same optimization.',
            true,
            ['sk-log-probability', 'sk-entropy'],
            'True. Take the log of the likelihood, negate it, and you have written cross-entropy.',
          ),
        ],
      },
    },
  ],
};
