/**
 * Track — Classic ML Algorithms.
 *
 * The algorithms that still win on most real datasets. Deep learning gets the
 * attention, but a very large share of deployed models are logistic regression
 * or gradient-boosted trees, and a practitioner who cannot reach for the right
 * classical method reaches for a neural network that overfits 5,000 rows.
 *
 * Every algorithm here gets an interactive widget. You cannot build intuition
 * for a decision boundary by reading about one.
 */

import type { Track } from '../../domain/types.js';
import { categorize, codeOutput, concept, fill, interactive, lesson, match, mcq, multi, numeric, order, shortAnswer, trueFalse } from '../builders.js';

export const classicMlTrack: Track = {
  id: 'track-classic-ml',
  title: 'Classic ML Algorithms',
  tagline: 'The methods that still win on real data',
  description:
    'k-NN, Naive Bayes, SVMs, trees, forests, and boosting — how each one actually decides, where it breaks, and how to pick between them. Every algorithm comes with something you can pull on.',
  domain: 'machine-learning',
  level: 'intermediate',
  icon: '🧮',
  gradient: ['#F59E0B', '#84CC16'],
  prerequisites: ['track-types-of-ml'],
  outcomes: [
    'Explain how each classic algorithm forms its decision boundary',
    'Pick an appropriate algorithm from dataset shape and constraints',
    'Tune the hyperparameters that actually matter for each',
    'Read ROC and PR curves and choose an operating threshold',
  ],
  units: [
    // =======================================================================
    {
      id: 'unit-cml-1',
      title: 'Distance and Probability',
      description: 'k-NN and Naive Bayes — the two simplest things that work.',
      lessons: [
        lesson({
          id: 'lesson-knn',
          title: 'k-Nearest Neighbours',
          summary: 'The algorithm with no training step at all.',
          level: 'intro',
          domain: 'machine-learning',
          free: true,
          steps: [
            concept(
              'Ask the neighbours',
              'k-NN is the simplest usable classifier, and stating it takes one sentence: **to classify a new point, find the k closest training points and take a majority vote.**\n\nFor regression, average their values instead of voting.\n\nThere is no training. No parameters are fitted, no loss is minimised. The "model" is the dataset.\n\nThree choices are all you get, and each matters:\n\n**k.** Small k follows every local wobble — low bias, high variance, and one mislabelled point creates its own island. Large k smooths aggressively and eventually predicts the majority class everywhere. Odd k avoids ties in binary problems.\n\n**Distance metric.** Euclidean is the default. Manhattan is more robust in high dimensions. Cosine ignores magnitude and is right for text and embeddings.\n\n**Scaling.** Not optional. k-NN measures distance, so a feature ranging 0–100,000 drowns one ranging 0–1 entirely. **Always standardise before k-NN.**',
              {
                figure: 'knn-boundary',
                keyTerms: [
                  { term: 'k', definition: 'How many neighbours vote. The single most important hyperparameter.' },
                  { term: 'Decision boundary', definition: 'The surface where the predicted class changes.' },
                ],
              },
            ),

            interactive(
              'Vary k and watch the boundary',
              'knn',
              'Place a query point, then sweep k from 1 to 25. At k=1 every training point owns a little territory of its own; by k=25 the boundary is nearly a straight line. Somewhere between is the model you want.',
            ),

            mcq(
              'A k-NN model with k=1 achieves 100% training accuracy but 61% test accuracy. What is happening?',
              [
                'The test set is corrupted',
                'k=1 memorises — every training point is its own nearest neighbour, so training accuracy is meaningless',
                'The learning rate is too high',
                'k-NN cannot do classification',
              ],
              1,
              ['sk-knn', 'sk-overfitting'],
              'With k=1 every training point is trivially closest to itself, so training accuracy is always 100% and tells you nothing. This is the clearest example anywhere of why you must evaluate on held-out data.',
            ),

            mcq(
              'You forget to standardise features before k-NN. Income ranges 20,000–200,000 and age ranges 18–90. What happens?',
              [
                'Nothing — k-NN is scale-invariant',
                'Distance is dominated by income; age becomes effectively invisible',
                'The model will not train',
                'Age dominates because it has fewer digits',
              ],
              1,
              ['sk-knn', 'sk-feature-scaling'],
              'Euclidean distance squares raw differences. An income gap of 50,000 swamps an age gap of 40 by six orders of magnitude, so the model is effectively using one feature.',
            ),

            interactive(
              'See scaling change the answer',
              'feature-scaling',
              'Toggle standardisation on and off over a two-feature dataset and watch the nearest neighbours change identity. Same data, same algorithm, different answer.',
            ),

            numeric(
              'With k=5, the nearest neighbours have labels [A, A, B, A, B]. What does the model predict? Enter 1 for A, 2 for B.',
              1,
              ['sk-knn'],
              'Three A votes against two B votes, so the prediction is A. Note that "3 of 5" can also be read as a 60% confidence estimate — one way k-NN gives you a probability.',
            ),

            multi(
              'Which are genuine weaknesses of k-NN? (Select all)',
              [
                'Prediction is slow — every query searches the dataset',
                'Memory grows with the dataset and never shrinks',
                'It degrades badly in high dimensions',
                'It requires a long training phase',
              ],
              [0, 1, 2],
              ['sk-knn', 'sk-instance-vs-model'],
              'Slow prediction, unbounded memory, and the curse of dimensionality are all real. Training is the one thing k-NN is fastest at — because it does not happen.',
            ),
          ],
        }),

        lesson({
          id: 'lesson-naive-bayes',
          title: 'Naive Bayes',
          summary: 'An assumption everyone knows is false, and a classifier that works anyway.',
          level: 'intermediate',
          domain: 'machine-learning',
          steps: [
            concept(
              'Bayes, plus one heroic assumption',
              'Naive Bayes applies Bayes\' theorem to classification. To decide whether an email is spam given its words:\n\n`P(spam | words) ∝ P(words | spam) × P(spam)`\n\nThe problem is `P(words | spam)` — the probability of that *exact combination* of words. You would need astronomically more data than exists to estimate it.\n\nSo Naive Bayes assumes the features are **conditionally independent given the class**:\n\n`P(w₁, w₂, ... | spam) = P(w₁ | spam) × P(w₂ | spam) × ...`\n\nNow each term is easy: count how often each word appears in spam. A hard problem becomes counting.\n\nThe assumption is **obviously false** — "free" and "money" co-occur in spam far more than independently. That is why it is called *naive*.\n\nAnd it works anyway. The reason is subtle and worth knowing: **classification only needs the right class to score highest, not the probabilities to be correct.** The estimated probabilities are badly wrong — Naive Bayes is notoriously overconfident, often outputting 0.9999 — but the *ranking* between classes survives. Use it to classify, never to report a calibrated probability.',
              {
                keyTerms: [
                  { term: 'Conditional independence', definition: 'Features assumed independent once the class is known.' },
                  { term: 'Laplace smoothing', definition: 'Adding a small count to every term so an unseen word does not zero the whole product.' },
                ],
              },
            ),

            interactive(
              'Watch base rates dominate',
              'bayes-calculator',
              'Set the disease prevalence and the test accuracy, then read the posterior. At 1-in-1000 prevalence, a 99% accurate test yields a positive that is right less than 10% of the time. The base rate does the heavy lifting.',
            ),

            mcq(
              'A Naive Bayes spam filter assigns 0.9999 probability to a message being spam. How much should you trust that number?',
              [
                'Completely — it is a probability',
                'Not as a probability. Naive Bayes is systematically overconfident because it multiplies correlated evidence as if independent',
                'It means the model is broken',
                'Only if there are fewer than 100 features',
              ],
              1,
              ['sk-naive-bayes', 'sk-calibration'],
              'Correlated features get counted as independent evidence, so probabilities pile up toward 0 or 1. The classification is often right; the confidence is not. Calibration on a held-out set is required if the number matters.',
            ),

            mcq(
              'A word in a test email never appeared in the training spam corpus. Without smoothing, what happens?',
              [
                'The word is ignored',
                'Its probability is zero, which zeroes the entire product and destroys the prediction',
                'The model throws an error',
                'The email is automatically classified as spam',
              ],
              1,
              ['sk-naive-bayes'],
              'One zero factor annihilates the whole product regardless of every other piece of evidence. Laplace (add-one) smoothing exists precisely to prevent this, and it is not optional in practice.',
            ),

            concept(
              'Why it is still used',
              'Naive Bayes survives in production for reasons that have nothing to do with accuracy ceilings:\n\n- **Training is a single pass of counting.** No iterations, no gradient descent, no hyperparameter search.\n- **It handles thousands of features comfortably** — text is its natural home.\n- **It needs very little data**, because it estimates one parameter per feature per class rather than modelling interactions.\n- **It updates incrementally.** New data just increments counts, which makes it a natural online learner.\n- **It is fully interpretable.** You can print exactly which words pushed the decision each way.\n\nIt is the right first baseline for any text classification problem. If a well-tuned gradient-boosted model cannot beat Naive Bayes by a useful margin, the extra complexity is not paying for itself.',
            ),

            categorize(
              'Sort these by whether Naive Bayes is a reasonable choice.',
              ['Good fit', 'Poor fit'],
              [
                { item: 'Spam filtering on word counts', category: 'Good fit' },
                { item: 'Fast baseline for document topic labelling', category: 'Good fit' },
                { item: 'Needing well-calibrated probabilities for a risk score', category: 'Poor fit' },
                { item: 'Features with strong known interactions', category: 'Poor fit' },
                { item: 'Very little training data, many features', category: 'Good fit' },
                { item: 'Predicting a continuous house price', category: 'Poor fit' },
              ],
              ['sk-naive-bayes'],
              'Naive Bayes shines on high-dimensional discrete data with limited examples. It fails when you need calibrated probabilities, when interactions carry the signal, or when the target is continuous.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-cml-1',
        title: 'Distance & Probability Checkpoint',
        passingScore: 0.7,
        exercises: [
          mcq(
            'Which preprocessing step is mandatory before k-NN?',
            ['One-hot encoding', 'Feature scaling', 'PCA', 'Oversampling'],
            1,
            ['sk-knn', 'sk-feature-scaling'],
            'k-NN is a distance algorithm, so unscaled features let the largest-magnitude one dominate entirely.',
          ),
          trueFalse(
            'The independence assumption in Naive Bayes is usually true in practice.',
            false,
            ['sk-naive-bayes'],
            'It is almost always false — hence "naive". It works because classification needs the correct ranking, not correct probabilities.',
          ),
        ],
      },
    },

    // =======================================================================
    {
      id: 'unit-cml-2',
      title: 'Boundaries and Trees',
      description: 'SVMs, decision trees, and the ensembles built from them.',
      lessons: [
        lesson({
          id: 'lesson-svm',
          title: 'Support Vector Machines',
          summary: 'Not just any boundary — the one with the widest margin.',
          level: 'expert',
          domain: 'machine-learning',
          steps: [
            concept(
              'Maximise the margin',
              'When two classes are separable, infinitely many lines separate them. SVMs pick a specific one: **the line with the largest distance to the nearest point of either class.**\n\nThat distance is the **margin**, and maximising it is a principled choice — a boundary crammed against the training points is fragile, while one sitting in the middle of the gap has room to be slightly wrong about new data.\n\nThe points sitting *on* the margin are the **support vectors**. They are the only points that matter. Delete every other training example and the boundary is unchanged, which makes SVMs remarkably memory-efficient at prediction time.\n\nReal data is rarely cleanly separable, so **soft-margin** SVMs allow violations, penalised by a parameter **C**:\n\n- **Large C** — violations are expensive. The boundary contorts to classify every training point. Risks overfitting.\n- **Small C** — violations are cheap. A wider, smoother margin that tolerates mistakes. Risks underfitting.\n\nC is the regularisation dial, and it is the first thing to tune.',
              {
                figure: 'svm-margin',
                keyTerms: [
                  { term: 'Margin', definition: 'Distance from the boundary to the nearest training point of either class.' },
                  { term: 'Support vector', definition: 'A training point on or inside the margin; the only points that define the boundary.' },
                ],
              },
            ),

            concept(
              'The kernel trick',
              'Some data is not linearly separable in its original space — a ring of one class around a core of another has no separating line.\n\nBut project it into a higher-dimensional space and it often becomes separable. Add a third dimension equal to distance-from-centre, and the ring lifts above the core; now a flat plane separates them cleanly.\n\nThe problem is that explicitly computing high-dimensional projections is expensive, and for some useful mappings the target space is infinite-dimensional.\n\nThe **kernel trick** avoids computing them at all. SVMs only ever need *dot products between pairs of points*, and a kernel function computes what that dot product **would have been** in the projected space — directly from the original coordinates. You get the benefit of infinite dimensions at the cost of a small function call.\n\n**Linear** — no projection. Fast, and usually right for text, where features already outnumber examples.\n**RBF (Gaussian)** — the flexible default. Similarity decays with distance. `gamma` controls how fast: high gamma means each point influences only its immediate vicinity, which overfits.\n**Polynomial** — models feature interactions of a chosen degree.\n\nThe honest limitation: SVM training scales roughly between quadratically and cubically with sample count, so beyond ~100k rows they become impractical and gradient boosting takes over.',
              { keyTerms: [{ term: 'Kernel', definition: 'A function computing dot products in an implicit higher-dimensional space.' }] },
            ),

            match(
              'Match each SVM parameter to its effect.',
              [
                { left: 'Large C', right: 'Fits training data tightly, risks overfitting' },
                { left: 'Small C', right: 'Wider margin, tolerates errors, risks underfitting' },
                { left: 'High gamma (RBF)', right: 'Each point influences only its close neighbourhood' },
                { left: 'Linear kernel', right: 'No projection — best when features outnumber examples' },
              ],
              ['sk-svm', 'sk-kernel-trick'],
              'C trades margin width against training errors; gamma sets the reach of each support vector. Both control the same underlying thing — how flexible the boundary is allowed to be.',
            ),

            mcq(
              'You delete 90% of the training data, keeping all support vectors. What happens to a trained SVM\'s boundary?',
              [
                'It shifts substantially',
                'It is unchanged — only support vectors define the boundary',
                'The model must be retrained from scratch',
                'Accuracy drops by 90%',
              ],
              1,
              ['sk-svm'],
              'Non-support-vector points sit outside the margin and contribute nothing to the optimisation. This is a genuinely unusual and useful property.',
            ),

            mcq(
              'A dataset has 2 million rows and 20 features. Is an RBF-kernel SVM a good choice?',
              [
                'Yes — RBF handles any data',
                'No — kernel SVM training scales poorly with sample count; gradient boosting is the practical choice',
                'Yes, but only with a linear kernel',
                'No — SVMs cannot handle 20 features',
              ],
              1,
              ['sk-svm', 'sk-model-selection'],
              'Kernel SVMs scale roughly O(n²)–O(n³) in samples. At 2M rows that is out of reach. Gradient-boosted trees handle this shape easily and usually win on tabular data anyway.',
            ),

            trueFalse(
              'The kernel trick explicitly computes coordinates in the higher-dimensional space.',
              false,
              ['sk-kernel-trick'],
              'It computes only the *dot products* that the projected coordinates would have produced. Never materialising the projection is precisely what makes infinite-dimensional feature spaces tractable.',
            ),
          ],
        }),

        lesson({
          id: 'lesson-trees-interactive',
          title: 'Decision Trees, Hands On',
          summary: 'Choose the splits yourself and watch impurity fall.',
          level: 'intermediate',
          domain: 'machine-learning',
          steps: [
            concept(
              'What a split is actually optimising',
              'A decision tree asks yes/no questions about one feature at a time. The learning is entirely in **which question to ask**.\n\nAt each node the algorithm tries every feature and every threshold, and keeps the split that most reduces **impurity** — how mixed the classes are within the resulting groups.\n\n**Gini impurity** = `1 − Σ pᵢ²`. Zero when a node is pure; 0.5 for a balanced binary node.\n**Entropy** = `−Σ pᵢ log₂(pᵢ)`. Zero when pure; 1 bit for a balanced binary node.\n\nThe two rarely disagree about which split to take. Gini is marginally cheaper and is the usual default.\n\nWhat the algorithm maximises is **information gain**: the impurity of the parent minus the weighted average impurity of the children. A split that separates the classes cleanly has high gain; one that leaves both children as mixed as the parent has zero gain and is not worth taking.',
              { keyTerms: [{ term: 'Information gain', definition: 'Impurity of the parent minus the weighted impurity of the children.' }] },
            ),

            interactive(
              'Build a tree by hand',
              'decision-tree',
              'Choose a feature and threshold at each node and watch Gini impurity and information gain update. Try to reach pure leaves in as few splits as possible — then notice how easy it is to keep splitting until every leaf holds one point.',
            ),

            interactive(
              'Measure impurity directly',
              'entropy-explorer',
              'Slide the class proportions and watch entropy and Gini move together. Both peak at a perfectly even split — maximum uncertainty — and fall to zero when one class takes everything.',
            ),

            numeric(
              'A node holds 8 positives and 2 negatives. What is its Gini impurity, to two decimals?',
              0.32,
              ['sk-decision-trees'],
              'Gini = 1 − (0.8² + 0.2²) = 1 − (0.64 + 0.04) = 0.32. A pure node would be 0; a 50/50 node would be 0.5.',
              { tolerance: 0.01, hint: '1 minus the sum of squared class proportions.' },
            ),

            mcq(
              'Which stopping rule most directly prevents a tree from memorising the training set?',
              [
                'Using entropy instead of Gini',
                'Limiting max depth and requiring a minimum number of samples per leaf',
                'Using more features',
                'Increasing the learning rate',
              ],
              1,
              ['sk-decision-trees', 'sk-overfitting'],
              'Unconstrained, a tree keeps splitting until every leaf is one example. Depth limits and minimum leaf sizes are the direct structural constraints; post-pruning is the other standard approach.',
            ),

            codeOutput(
              'What does this print?',
              'python',
              `def gini(pos, neg):
    total = pos + neg
    p = pos / total
    q = neg / total
    return round(1 - (p**2 + q**2), 3)

# A perfectly balanced node
print(gini(50, 50))`,
              ['0.0', '0.25', '0.5', '1.0'],
              2,
              ['sk-decision-trees'],
              '1 − (0.5² + 0.5²) = 1 − 0.5 = 0.5. That is the maximum Gini impurity for a binary problem — total uncertainty.',
            ),
          ],
        }),

        lesson({
          id: 'lesson-ensembles-interactive',
          title: 'Ensembles: Many Weak Models',
          summary: 'Why a committee of poor models beats one good one.',
          level: 'intermediate',
          domain: 'machine-learning',
          steps: [
            concept(
              'Averaging away the errors',
              'A single deep tree is high-variance: retrain it on a slightly different sample and you get a structurally different tree. Ensembles exploit that instability rather than fighting it.\n\n**Bagging (Random Forest).** Train hundreds of trees, each on a bootstrap resample of the rows *and* a random subset of features at each split. Average their votes.\n\nThe double randomness is the point: it **decorrelates** the trees. Correlated models make the same mistakes, and averaging correlated mistakes does not cancel them. Feature subsampling is what forces the trees to disagree, and disagreement is what makes averaging work.\n\nRandom Forest also gives you **out-of-bag error** for free: each tree omitted about a third of the rows, so those rows serve as its private validation set. You get a generalisation estimate with no separate holdout.\n\n**Boosting.** Train trees *sequentially*, each fitting the residual errors of the ensemble so far. Every tree is deliberately weak — often only 3–6 levels deep — and the sum of hundreds is extremely strong.',
              { figure: 'ensemble-tree' },
            ),

            interactive(
              'Combine weak learners',
              'ensemble-vote',
              'Add weak models one at a time and watch ensemble accuracy climb above any individual member. Then use the correlation slider: as the models become more similar, the benefit of averaging collapses. Diversity is the whole mechanism.',
            ),

            concept(
              'Gradient boosting, precisely',
              'Boosting is often described vaguely. The actual procedure is short:\n\n1. Start with a constant prediction — usually the mean of the target.\n2. Compute the **residuals**: how wrong the current ensemble is on each example.\n3. Fit a small tree to predict those residuals.\n4. Add that tree to the ensemble, scaled by a **learning rate** (typically 0.01–0.1).\n5. Repeat for hundreds or thousands of rounds.\n\nThe learning rate is why it works. Each tree corrects only a small fraction of the remaining error, so no single tree can overfit — but hundreds of small corrections converge precisely.\n\nThis creates the central tradeoff: **lower learning rate needs more trees**. A rate of 0.01 with 2,000 trees typically beats 0.1 with 200, and takes ten times longer.\n\nBecause boosting drives training error toward zero, it **will** overfit if left running. Early stopping on a validation set is not optional — it is the main hyperparameter.\n\nXGBoost, LightGBM, and CatBoost are the standard implementations. They remain the default choice for tabular data and win a large share of competitions on it.',
              {
                keyTerms: [
                  { term: 'Residual', definition: 'The remaining error of the ensemble so far — what the next tree is fitted to.' },
                  { term: 'Shrinkage', definition: 'The learning rate that scales each tree\'s contribution.' },
                ],
              },
            ),

            order(
              'Order one round of gradient boosting.',
              [
                'Compute the residual errors of the current ensemble',
                'Fit a shallow tree to predict those residuals',
                'Scale the new tree by the learning rate',
                'Add it to the ensemble and re-evaluate on validation',
              ],
              ['sk-gradient-boosting'],
              'Each round chips away at what remains wrong. The learning rate ensures no single round overcorrects.',
            ),

            mcq(
              'Random Forest rarely overfits with more trees; gradient boosting does. Why the difference?',
              [
                'Random Forest uses fewer features',
                'Bagging averages independent models, so more only reduces variance; boosting fits residuals sequentially, so more keeps reducing training error toward zero',
                'Gradient boosting uses deeper trees',
                'Random Forest has a learning rate',
              ],
              1,
              ['sk-ensembles', 'sk-gradient-boosting'],
              'Adding a bagged tree averages in another independent opinion — strictly variance reduction. Adding a boosted tree explicitly targets remaining training error, which eventually means fitting noise. Hence early stopping.',
            ),

            mcq(
              'You lower gradient boosting\'s learning rate from 0.1 to 0.01. What else must change?',
              [
                'Nothing',
                'Increase the number of trees, roughly ten-fold',
                'Decrease max depth',
                'Remove regularization',
              ],
              1,
              ['sk-gradient-boosting'],
              'Each tree now contributes a tenth as much, so roughly ten times as many rounds are needed to reach the same fit. The payoff is usually a slightly better final model.',
            ),

            categorize(
              'Sort each property to the ensemble method it belongs to.',
              ['Random Forest', 'Gradient Boosting'],
              [
                { item: 'Trees train in parallel', category: 'Random Forest' },
                { item: 'Each tree fits the previous ensemble’s residuals', category: 'Gradient Boosting' },
                { item: 'Primarily reduces variance', category: 'Random Forest' },
                { item: 'Primarily reduces bias', category: 'Gradient Boosting' },
                { item: 'Out-of-bag error estimate for free', category: 'Random Forest' },
                { item: 'Requires early stopping', category: 'Gradient Boosting' },
                { item: 'Very hard to misuse', category: 'Random Forest' },
                { item: 'Usually wins on tabular data when tuned', category: 'Gradient Boosting' },
              ],
              ['sk-ensembles', 'sk-gradient-boosting'],
              'Parallel and variance-reducing versus sequential and bias-reducing. That single distinction predicts almost every practical difference between them.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-cml-2',
        title: 'Boundaries & Ensembles Checkpoint',
        passingScore: 0.75,
        exercises: [
          mcq(
            'Which points determine an SVM\'s decision boundary?',
            ['All training points', 'Only the support vectors', 'The class centroids', 'A random subset'],
            1,
            ['sk-svm'],
            'Only points on or inside the margin. Everything else could be deleted without changing the boundary.',
          ),
          numeric(
            'A node has 6 positives and 6 negatives. What is its Gini impurity?',
            0.5,
            ['sk-decision-trees'],
            '1 − (0.5² + 0.5²) = 0.5, the maximum for a binary node.',
            { tolerance: 0.01 },
          ),
          trueFalse(
            'Random Forest trees are trained sequentially.',
            false,
            ['sk-ensembles'],
            'Bagged trees are independent and train in parallel. Boosting is the sequential one.',
          ),
        ],
      },
    },

    // =======================================================================
    {
      id: 'unit-cml-3',
      title: 'Choosing and Tuning',
      description: 'Model selection, hyperparameter search, and reading the curves.',
      lessons: [
        lesson({
          id: 'lesson-model-selection',
          title: 'Which Algorithm Should I Use?',
          summary: 'A decision procedure, not a preference.',
          level: 'intermediate',
          domain: 'machine-learning',
          steps: [
            concept(
              'Let the constraints choose',
              'Algorithm choice is mostly determined by the problem, not by taste. Work through these in order:\n\n**1. What shape is the data?**\n- Tabular (rows and columns) → **gradient-boosted trees**, near-universally.\n- Images → **CNNs**, or a fine-tuned pretrained vision model.\n- Text → a **fine-tuned transformer**; Naive Bayes or linear models as a fast baseline.\n- Sequences and time series → gradient boosting on lag features is a strong and underrated baseline.\n\n**2. How much data?**\n- Under ~1,000 rows → linear or logistic regression, Naive Bayes, small trees. Deep learning will overfit.\n- 1k–100k → gradient boosting is the sweet spot.\n- Millions, unstructured → deep learning starts to pay for itself.\n\n**3. Do you have to explain the decision?**\n- Legally required → linear/logistic regression or a shallow tree. The coefficients *are* the explanation.\n- Helpful but not required → gradient boosting plus SHAP.\n\n**4. What are the latency and memory limits?**\n- Microseconds on an embedded device → linear model or a small tree.\n- Server-side with room → anything.\n\n**Always start with the simplest thing that could work, and make it a real baseline.** A tuned logistic regression that ships beats an untuned neural network that does not.',
              { figure: 'algorithm-map' },
            ),

            categorize(
              'Pick the first algorithm you would reach for.',
              ['Logistic regression', 'Gradient boosting', 'CNN / pretrained vision', 'k-means'],
              [
                { item: '800 rows, need a legally explainable credit decision', category: 'Logistic regression' },
                { item: '50,000 rows of tabular customer data', category: 'Gradient boosting' },
                { item: '100,000 labelled product photos', category: 'CNN / pretrained vision' },
                { item: 'Segment 1M users with no labels', category: 'k-means' },
                { item: '20,000 rows, 40 columns, maximum accuracy', category: 'Gradient boosting' },
                { item: 'Group similar support tickets, no categories defined', category: 'k-means' },
              ],
              ['sk-model-selection'],
              'Data shape, size, and the explainability requirement decide it. Tabular data of any moderate size goes to gradient boosting; unlabelled grouping goes to clustering.',
            ),

            mcq(
              'A team replaces gradient boosting with a deep neural network on 6,000 rows of tabular data. Accuracy drops. Why is this unsurprising?',
              [
                'Neural networks cannot do tabular data at all',
                'Deep learning needs far more data to beat tree ensembles, which have inductive biases well-suited to tabular features',
                'The learning rate was wrong',
                'Gradient boosting always wins',
              ],
              1,
              ['sk-model-selection', 'sk-inductive-bias'],
              'Trees natively handle mixed types, missing values, monotone relationships, and feature interactions. A network must learn all of that from data — and 6,000 rows is nowhere near enough.',
            ),

            concept(
              'Tuning what actually matters',
              'Most hyperparameters do very little. A handful do almost everything.\n\n**Gradient boosting:** learning rate, number of trees (via early stopping), max depth. Tune those three and you have captured most of the available gain.\n**Random Forest:** number of trees (more is fine), max features per split. Genuinely hard to misconfigure.\n**SVM:** C and gamma. Search both on a log scale.\n**k-NN:** k, and the distance metric.\n**Neural networks:** learning rate first, and by a wide margin. Then architecture size, then regularisation.\n\nHow to search:\n\n**Grid search** — exhaustive over a grid. Wasteful, because most parameters do not matter and you spend equal budget on all of them.\n**Random search** — usually better for the same budget, for exactly that reason: it explores more distinct values of the parameters that *do* matter.\n**Bayesian optimisation** — models the objective and samples where improvement is likely. Best when each evaluation is expensive.\n\nAnd the discipline that makes any of it valid: **tune on validation folds, never on the test set.** Nested cross-validation exists for when you need an unbiased estimate of a tuned model\'s performance.',
            ),

            interactive(
              'See the folds',
              'cross-validation',
              'Step through k-fold cross-validation and watch which slice is held out each round. Change k and watch the variance of the estimate change with it.',
            ),

            mcq(
              'Why does random search usually beat grid search for the same compute budget?',
              [
                'It is faster per evaluation',
                'Most hyperparameters barely matter — random search explores more distinct values of the few that do',
                'It always finds the global optimum',
                'It needs no validation set',
              ],
              1,
              ['sk-hyperparameter-tuning'],
              'A grid over 4 parameters × 5 values spends 625 runs, but only 5 distinct values of the one parameter that matters. Random search of 625 samples tries ~625 distinct values of it.',
            ),

            trueFalse(
              'It is acceptable to pick the best hyperparameters using the test set as long as you report that number honestly.',
              false,
              ['sk-hyperparameter-tuning', 'sk-train-val-test'],
              'Selecting on the test set makes it a validation set, and the reported number becomes optimistic — the more configurations you try, the more the winner is partly luck. Tune on validation, touch test once.',
            ),
          ],
        }),

        lesson({
          id: 'lesson-roc-thresholds',
          title: 'ROC, PR Curves, and Thresholds',
          summary: 'A classifier is not one model — it is a family of them.',
          level: 'intermediate',
          domain: 'machine-learning',
          steps: [
            concept(
              'The threshold is a product decision',
              'A classifier outputs a **score**, not a class. Turning that score into a decision requires a threshold, and that threshold is a business choice, not a technical one.\n\nSlide the threshold and you trace out an entire family of classifiers from a single trained model. Two curves summarise that family.\n\n**ROC curve** plots true positive rate against false positive rate at every threshold. **AUC** is the area under it, interpretable as: *the probability that a randomly chosen positive scores higher than a randomly chosen negative.* 0.5 is random, 1.0 is perfect.\n\n**PR curve** plots precision against recall. On heavily imbalanced data this is the one to look at.\n\nThe reason matters. ROC uses false positive rate, whose denominator is the count of *actual negatives*. When negatives outnumber positives 1000:1, thousands of false positives barely move that rate — so ROC-AUC can look excellent while the model is nearly unusable. Precision has the flagged count as its denominator and stays honest.',
              {
                keyTerms: [
                  { term: 'ROC-AUC', definition: 'Probability that a random positive outranks a random negative.' },
                  { term: 'Operating point', definition: 'The threshold you actually deploy, chosen from the curve.' },
                ],
              },
            ),

            interactive(
              'Trace the ROC curve',
              'roc-curve',
              'Drag the threshold and watch the operating point travel along the curve while the confusion matrix updates beside it. Then switch to the imbalanced dataset and watch ROC stay flattering while precision collapses.',
            ),

            mcq(
              'A fraud model has ROC-AUC 0.97 but precision of 3% at the deployed threshold. What is going on?',
              [
                'The AUC calculation is wrong',
                'Extreme class imbalance — false positives barely affect FPR but destroy precision',
                'The model is overfitting',
                'Precision and AUC always agree',
              ],
              1,
              ['sk-roc-pr-curves', 'sk-class-imbalance'],
              'With 0.1% fraud, flagging 10,000 legitimate transactions moves FPR by 1% while dropping precision to almost nothing. On imbalanced problems, report PR-AUC and precision at the operating point.',
            ),

            mcq(
              'A screening test is followed by a cheap confirmatory check, and a missed case is catastrophic. Where do you set the threshold?',
              [
                'High — maximise precision',
                'Low — maximise recall, accepting more false positives',
                'At 0.5, always',
                'Threshold makes no difference',
              ],
              1,
              ['sk-roc-pr-curves', 'sk-classification-metrics'],
              'When the follow-up is cheap and the miss is catastrophic, you buy recall with false positives. Reverse the costs — an invasive follow-up — and you would move the other way. The metric follows from the consequences.',
            ),

            numeric(
              'A model scores AUC 0.5. What does that mean about its ranking ability, as a percentage chance a positive outranks a negative?',
              50,
              ['sk-roc-pr-curves'],
              'AUC 0.5 means a coin flip — the model ranks positives above negatives exactly half the time, which is no ranking ability at all.',
              { unit: '%' },
            ),

            shortAnswer(
              'Why should you report PR-AUC instead of ROC-AUC for a rare-event problem?',
              ['imbalance', 'false positives', 'precision', 'negatives', 'denominator'],
              'ROC uses false positive rate, whose denominator is the huge number of true negatives, so many false positives barely register. Precision has the flagged set as its denominator, so it reflects what a user of the alerts actually experiences.',
              ['sk-roc-pr-curves', 'sk-class-imbalance'],
              'The denominator is the whole story. On rare events, the negative class is so large that it hides the model\'s real failure rate from ROC.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-cml-3',
        title: 'Selection & Evaluation Checkpoint',
        passingScore: 0.75,
        exercises: [
          mcq(
            'Default first choice for 30,000 rows of tabular data?',
            ['A deep neural network', 'Gradient-boosted trees', 'k-means', 'An SVM with RBF kernel'],
            1,
            ['sk-model-selection'],
            'Gradient boosting is the reliable default on tabular data of this size — strong out of the box and fast to iterate on.',
          ),
          mcq(
            'Which metric should you report for a problem with 0.2% positives?',
            ['Accuracy', 'ROC-AUC', 'PR-AUC and precision at the operating threshold', 'Training loss'],
            2,
            ['sk-roc-pr-curves', 'sk-class-imbalance'],
            'Accuracy is dominated by the majority class and ROC-AUC is flattered by the huge negative count. PR-AUC reflects what actually happens to the alerts.',
          ),
          trueFalse(
            'Lowering a gradient booster’s learning rate generally requires more trees.',
            true,
            ['sk-gradient-boosting'],
            'Each tree contributes proportionally less, so more rounds are needed to reach the same fit.',
          ),
        ],
      },
    },
  ],
};
