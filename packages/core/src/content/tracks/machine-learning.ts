/** Track 2 — Machine Learning Mechanics. Intro → intermediate. */

import type { Track } from '../../domain/types';
import { codeOutput, concept, fill, interactive, lesson, match, mcq, multi, numeric, order, shortAnswer, trueFalse } from '../builders';

export const machineLearningTrack: Track = {
  id: 'track-machine-learning',
  title: 'Machine Learning Mechanics',
  tagline: 'From linear regression to gradient descent',
  description:
    'Open up the box. You will fit a line by hand, watch gradient descent find a minimum, and learn why the classic algorithms still win on most real datasets.',
  domain: 'machine-learning',
  level: 'intermediate',
  icon: '📈',
  gradient: ['#0EA5E9', '#22D3EE'],
  prerequisites: ['track-foundations'],
  outcomes: [
    'Fit and interpret linear and logistic regression',
    'Explain gradient descent and the role of the learning rate',
    'Choose between trees, ensembles, and linear models',
    'Diagnose a model from its learning curves',
  ],
  units: [
    {
      id: 'unit-ml-1',
      title: 'Fitting a Line',
      description: 'The simplest model there is, and everything it teaches.',
      lessons: [
        lesson({
          id: 'lesson-linear-regression',
          title: 'Linear Regression',
          summary: 'y = wx + b, and why it is the whole game in miniature.',
          level: 'intro',
          domain: 'machine-learning',
          free: true,
          steps: [
            concept(
              'A line with two knobs',
              'Predict house price from floor area. The simplest usable model:\n\n`price = w × area + b`\n\nTwo parameters. **w** (the weight, or slope) says how much price moves per extra square metre. **b** (the bias, or intercept) is the baseline — the predicted price of a zero-area house, which is meaningless on its own but shifts the line to where the data lives.\n\nTraining means finding the w and b that make the line pass as close as possible to the points. With more features you get one weight each:\n\n`price = w₁×area + w₂×bedrooms + w₃×age + b`\n\nThat is still linear regression. "Linear" refers to being linear *in the parameters*, not to drawing a straight line in the original space.',
              {
                keyTerms: [
                  { term: 'Weight', definition: 'A parameter scaling one input feature. How much that feature moves the prediction.' },
                  { term: 'Bias / intercept', definition: 'A parameter added regardless of input, shifting the whole prediction.' },
                ],
              },
            ),
            numeric(
              'A model predicts `price = 3200 × area + 45000`. What does it predict for 80 m²?',
              301000,
              ['sk-linear-regression'],
              '3200 × 80 = 256,000, plus the 45,000 intercept = 301,000. The weight is the per-unit effect; the intercept sets the baseline.',
              { hint: 'Multiply, then add the intercept.' },
            ),
            mcq(
              'In `price = 3200 × area + 45000`, what does 3200 mean?',
              [
                'The cheapest house in the dataset',
                'Predicted price increase per additional square metre',
                'The model\'s error',
                'The number of training examples',
              ],
              1,
              ['sk-linear-regression'],
              'A weight is a rate: holding everything else fixed, one more unit of this feature moves the prediction by this much. That interpretability is why linear models remain popular in regulated settings.',
            ),
            concept(
              'Measuring wrongness',
              'To fit the line you need a score. **Mean squared error** is the standard choice:\n\n`MSE = (1/n) Σ (prediction − actual)²`\n\nSquaring does two things. It makes errors positive so overshoots and undershoots do not cancel. And it penalises large errors disproportionately — being off by 10 is *100 times* worse than being off by 1, not 10 times.\n\nThat second property is a design decision with consequences. MSE is very sensitive to outliers. When your data has genuine extreme values you do not want the model chasing, **mean absolute error** (no squaring) or **Huber loss** (quadratic near zero, linear in the tails) are the usual alternatives.',
              { keyTerms: [{ term: 'MSE', definition: 'Mean squared error — average of squared prediction errors.' }] },
            ),
            numeric(
              'Predictions [3, 5] with actuals [2, 8]. What is the MSE?',
              5,
              ['sk-loss-functions'],
              'Errors are 1 and −3. Squared: 1 and 9. Mean: (1 + 9) / 2 = 5. Notice the single error of 3 contributes nine times as much as the error of 1.',
              { hint: 'Square each error, then average.' },
            ),
            mcq(
              'Your dataset has a few genuine extreme values you do not want dominating the fit. What should you consider?',
              [
                'Mean squared error, since it is standard',
                'Mean absolute error or Huber loss',
                'Increasing the learning rate',
                'Adding more parameters',
              ],
              1,
              ['sk-loss-functions'],
              'Squaring gives outliers enormous leverage. MAE weights every error linearly; Huber is quadratic for small errors and linear for large ones, keeping smooth gradients near the optimum without letting the tails take over.',
            ),
          ],
        }),

        lesson({
          id: 'lesson-gradient-descent',
          title: 'Gradient Descent',
          summary: 'Walking downhill in the dark, one step at a time.',
          level: 'intermediate',
          domain: 'machine-learning',
          free: true,
          steps: [
            concept(
              'Downhill in fog',
              'You are on a hillside in thick fog and want to reach the valley. You cannot see the bottom, but you can feel the slope under your feet. So: feel which way is downhill, take a step, repeat.\n\nThat is gradient descent. The hillside is the **loss landscape** — loss plotted against every parameter. The slope is the **gradient**, the vector of partial derivatives of the loss with respect to each parameter. The update rule:\n\n`w ← w − η × ∂L/∂w`\n\nSubtract, because the gradient points *uphill* and you want the opposite. **η** (eta) is the **learning rate** — your step size.',
              {
                figure: 'loss-landscape',
                keyTerms: [
                  { term: 'Gradient', definition: 'The vector of partial derivatives — the direction of steepest increase.' },
                  { term: 'Learning rate', definition: 'How far to step each iteration. The most consequential hyperparameter.' },
                ],
              },
            ),
            mcq(
              'Why does the update rule *subtract* the gradient?',
              [
                'To make the numbers smaller',
                'The gradient points uphill; we want to descend',
                'To prevent overfitting',
                'Convention with no mathematical reason',
              ],
              1,
              ['sk-gradient-descent'],
              'The gradient points in the direction of steepest *increase* in loss. Moving against it is the fastest local decrease. To maximise something instead — as in policy gradient RL — you add.',
            ),
            interactive(
              'Tune the step size',
              'gradient-descent',
              'Set the learning rate and watch the descent path. Too small: slow crawl. Too large: the ball bounces out of the valley and diverges. There is a wide usable band in between — which is why log-scale search (0.1, 0.01, 0.001) is the standard way to find it.',
            ),
            match(
              'Match each learning rate symptom to its cause.',
              [
                { left: 'Loss decreases very slowly over many epochs', right: 'Learning rate too low' },
                { left: 'Loss oscillates wildly or becomes NaN', right: 'Learning rate too high' },
                { left: 'Loss drops then plateaus above a good value', right: 'Stuck — needs a schedule or restart' },
                { left: 'Loss decreases smoothly and converges', right: 'Learning rate well chosen' },
              ],
              ['sk-learning-rate'],
              'NaN loss almost always means divergence from too-large steps. A plateau above the achievable minimum usually calls for learning-rate decay so later steps can settle into a narrower basin.',
            ),
            concept(
              'Batch, stochastic, mini-batch',
              'How much data do you look at before each step?\n\n**Batch gradient descent** uses the entire dataset per step. Accurate direction, but one step per full pass — hopeless on millions of examples.\n\n**Stochastic gradient descent (SGD)** uses a single example. Very fast steps, very noisy direction.\n\n**Mini-batch** uses 32–512 examples. This is what everyone actually does. It gets most of the accuracy of full batch, matches how GPUs like to work, and the residual noise is genuinely useful — it helps knock the model out of sharp local minima.\n\nOne **epoch** is one full pass through the training data. A 50,000-example dataset with batch size 100 gives 500 updates per epoch.',
              { keyTerms: [{ term: 'Epoch', definition: 'One complete pass through the training set.' }, { term: 'Mini-batch', definition: 'A small subset of examples used for one gradient step.' }] },
            ),
            numeric(
              '50,000 training examples, batch size 250. How many parameter updates happen in one epoch?',
              200,
              ['sk-batch-size'],
              '50,000 / 250 = 200 updates per epoch. Smaller batches mean more updates per epoch but a noisier gradient in each.',
            ),
            trueFalse(
              'Noise in mini-batch gradients is purely harmful and should be minimised.',
              false,
              ['sk-batch-size'],
              'The noise acts as a mild regulariser and helps escape sharp minima. Very large batches produce cleaner gradients but often generalise slightly worse — an active area of research, and a reason batch size is tuned, not maximised.',
            ),
          ],
        }),

        lesson({
          id: 'lesson-logistic-regression',
          title: 'Logistic Regression',
          summary: 'How to turn a line into a probability.',
          level: 'intermediate',
          domain: 'machine-learning',
          steps: [
            concept(
              'Squashing a line into [0, 1]',
              'Linear regression outputs any real number — useless for "is this spam?", where you need a probability.\n\nThe fix is to run the linear output through the **sigmoid** function:\n\n`σ(z) = 1 / (1 + e^(−z))`\n\nSigmoid maps every real number into (0, 1). Large positive z → near 1. Large negative z → near 0. z = 0 → exactly 0.5.\n\nSo `P(spam) = σ(w·x + b)`. The linear part still does the work; sigmoid just reinterprets its output as a probability. Despite the name, logistic regression is a **classifier**.',
              { keyTerms: [{ term: 'Sigmoid', definition: 'A squashing function mapping ℝ to (0, 1).' }, { term: 'Logit', definition: 'The pre-sigmoid linear output, z.' }] },
            ),
            numeric(
              'A logistic model outputs logit z = 0. What probability does it assign?',
              0.5,
              ['sk-logistic-regression'],
              'σ(0) = 1 / (1 + e⁰) = 1 / 2 = 0.5. A logit of zero is maximum uncertainty — the point exactly on the decision boundary.',
              { tolerance: 0.01 },
            ),
            mcq(
              'Why is MSE a poor loss for logistic regression?',
              [
                'It produces a non-convex loss surface and weak gradients when badly wrong',
                'It is too slow to compute',
                'It only works with more than two classes',
                'It requires normalised inputs',
              ],
              0,
              ['sk-loss-functions', 'sk-logistic-regression'],
              'Pairing MSE with sigmoid gives a non-convex surface and, worse, a nearly flat gradient when the model is confidently wrong — exactly when you need the largest correction. **Cross-entropy** loss fixes both: it is convex here and its gradient grows with the error.',
            ),
            concept(
              'Cross-entropy',
              'The right loss for classification:\n\n`L = −[y·log(p) + (1−y)·log(1−p)]`\n\nRead it as two cases. If the true label y = 1, the loss is `−log(p)`: predict 0.99 and you pay almost nothing; predict 0.01 and you pay a lot. If y = 0, it mirrors.\n\nThe key property is what happens at the extremes. As p → 0 when the truth is 1, `−log(p) → ∞`. **Cross-entropy punishes confident wrongness without limit.** That is the behaviour you want — a model should be far more sorry for a confident error than a hedged one.',
            ),
            mcq(
              'True label is 1. Which prediction incurs the largest cross-entropy loss?',
              ['0.9', '0.5', '0.1', '0.01'],
              3,
              ['sk-loss-functions'],
              '−log(0.01) ≈ 4.6, versus −log(0.1) ≈ 2.3 and −log(0.5) ≈ 0.69. Confident wrongness is penalised steeply — and the penalty is unbounded as the prediction approaches 0.',
            ),
            codeOutput(
              'What does this print?',
              'python',
              `import numpy as np

def sigmoid(z):
    return 1 / (1 + np.exp(-z))

w = np.array([0.5, -0.25])
x = np.array([4.0, 8.0])
b = 0.0

z = w @ x + b
print(round(sigmoid(z), 2))`,
              ['0.50', '0.73', '0.27', '1.00'],
              0,
              ['sk-logistic-regression', 'sk-vectors'],
              'The dot product is (0.5 × 4) + (−0.25 × 8) = 2 − 2 = 0. Adding b = 0 leaves z = 0, and σ(0) = 0.5. The two features cancel exactly.',
            ),
          ],
        }),
        lesson({
          id: 'lesson-preparing-data',
          title: 'Preparing Data',
          summary: 'The unglamorous work that decides whether anything else matters.',
          level: 'intermediate',
          domain: 'data',
          steps: [
            concept(
              'Features and labels',
              'A **feature** is an input the model sees. A **label** is the answer it is trying to predict. One row of a dataset is a set of features plus, in supervised learning, its label.\n\n**Feature engineering** is constructing better inputs from raw data. A raw timestamp is nearly useless; `hour_of_day`, `day_of_week`, and `is_holiday` derived from it can be highly predictive. Deep learning reduced this work on images and text — the network learns its own features — but on tabular data it remains the highest-leverage activity available to you.\n\nThe rule of thumb still holds: **a better feature usually beats a better model.**',
              { figure: 'supervised-flow' },
            ),
            mcq(
              'You have a raw `signup_timestamp` column. What is likely most useful to the model?',
              [
                'The raw epoch milliseconds',
                'Derived features like day-of-week, hour, and days-since-signup',
                'Dropping the column',
                'The timestamp as a text string',
              ],
              1,
              ['sk-features-labels'],
              'Raw epoch time is a huge monotonic number carrying no usable structure. Derived cyclical and duration features expose the patterns that actually predict behaviour.',
            ),
            concept(
              'Scaling: putting features on comparable footing',
              'Consider two features: age (18–90) and income (20,000–500,000). Any distance-based or gradient-based method will be dominated by income purely because its numbers are larger, not because it matters more.\n\n**Standardization** (z-score) subtracts the mean and divides by the standard deviation, giving mean 0 and standard deviation 1. The usual default.\n\n**Normalization** (min-max) rescales to [0, 1]. Preserves the shape of the distribution; sensitive to outliers.\n\nWhen it matters: neural networks, k-NN, SVMs, k-means, and anything regularised — L2 penalises large weights, and unscaled features force compensating weights. When it does not: decision trees and their ensembles, which split on thresholds and are indifferent to scale.\n\n**Critical detail:** fit the scaler on the *training set only*, then apply those same statistics to validation and test. Fitting on everything leaks test-set information into training.',
            ),
            multi(
              'Which methods genuinely require feature scaling? (Select all)',
              [
                'k-nearest neighbours',
                'Neural networks',
                'Random forests',
                'k-means clustering',
              ],
              [0, 1, 3],
              ['sk-feature-scaling'],
              'Anything using distances or gradients needs scaling. Tree-based methods split on thresholds within a single feature at a time and are entirely scale-invariant.',
            ),
            trueFalse(
              'You should compute scaling statistics over the full dataset before splitting into train and test.',
              false,
              ['sk-feature-scaling', 'sk-data-leakage'],
              'That leaks test-set distribution information into training. Fit on train, then transform the others with those same parameters.',
            ),
            concept(
              'Class imbalance',
              'When 99.9% of examples are one class, a model can score 99.9% accuracy by ignoring the minority entirely. Worse, the gradient signal from the rare class is drowned out during training.\n\nWhat actually helps:\n\n**Class weights.** Weight the loss so minority errors cost more. Usually the first thing to try — one parameter, no data changes.\n\n**Resampling.** Oversample the minority (SMOTE synthesises interpolated examples) or undersample the majority. Resample the *training split only* — resampling before splitting duplicates examples across train and test, which is leakage.\n\n**Threshold tuning.** Train normally, then move the decision threshold to trade precision against recall. Often the simplest effective fix.\n\n**Better metrics.** Precision, recall, F1, and PR-AUC. ROC-AUC looks deceptively good under heavy imbalance because the enormous true-negative count flatters it.',
            ),
            mcq(
              'Fraud is 0.2% of transactions. Which metric is most informative?',
              [
                'Accuracy',
                'Precision and recall on the fraud class',
                'Mean squared error',
                'Training loss',
              ],
              1,
              ['sk-class-imbalance', 'sk-classification-metrics'],
              'Accuracy is dominated by the 99.8% majority. Precision and recall on the minority class describe what the model actually does about fraud.',
            ),
            mcq(
              'When should you apply SMOTE oversampling?',
              [
                'To the whole dataset before splitting',
                'To the training split only, after splitting',
                'To the test set only',
                'It never helps',
              ],
              1,
              ['sk-class-imbalance', 'sk-data-leakage'],
              'Oversampling before the split places synthetic relatives of test examples into training, producing an inflated score that will not survive deployment.',
            ),
            concept(
              'Data augmentation',
              'When labelled data is scarce, generate more of it by applying **label-preserving transformations**.\n\n**Images** — flip, rotate, crop, adjust brightness, add noise. A cat rotated 10° is still a cat, and the model learns to stop caring about orientation.\n\n**Text** — synonym replacement, back-translation (translate out and back), paraphrasing.\n\n**Audio** — time stretch, pitch shift, background noise.\n\nAugmentation is a regulariser: it enlarges the effective dataset and forces invariance to variations you know are irrelevant.\n\nThe discipline is that the transformation must genuinely preserve the label. Horizontally flipping a photo of a dog is fine. Horizontally flipping a photo of the digit "2" produces something that is not a 2 — and flipping a chest X-ray creates an anatomically impossible image that teaches the model something false.',
            ),
            mcq(
              'Which augmentation is inappropriate for handwritten digit recognition?',
              [
                'Small rotations of ±10°',
                'Horizontal mirroring',
                'Slight elastic distortion',
                'Small random translations',
              ],
              1,
              ['sk-data-augmentation'],
              'Mirroring changes the identity of most digits — a flipped 2 is not a 2. The others preserve the label. The test for any augmentation is whether a human would still assign the same label.',
            ),
            concept(
              'Cross-validation',
              'A single train/validation split gives one estimate, and on a small dataset that estimate is noisy — you might have got a lucky split.\n\n**k-fold cross-validation** splits the data into k parts, trains k times with each part held out once, and averages. You use every example for both training and validation, and you get a variance estimate for free. If the k scores vary by ten points, your single-split number was meaningless.\n\nk = 5 or 10 is standard. Cost is k× the training time, so it is used for small data and model selection rather than for large-scale deep learning.\n\nTwo variants that matter: **stratified** k-fold preserves class proportions in each fold, which is essential under imbalance. **Time-series** cross-validation always trains on earlier data and validates on later, since random folds would train on the future.',
            ),
            numeric(
              'How many models are trained during 5-fold cross-validation?',
              5,
              ['sk-cross-validation'],
              'One per fold — each fold is held out for validation exactly once. That is why it costs 5× a single split.',
            ),
            mcq(
              'Your 10-fold cross-validation scores range from 0.62 to 0.91. What does that tell you?',
              [
                'The model is excellent',
                'The estimate is unstable — likely too little data or high variance, so a single split would have been misleading',
                'There is a bug in the fold splitting',
                'You should report the highest fold',
              ],
              1,
              ['sk-cross-validation'],
              'Wide spread across folds means the result depends heavily on which examples landed where. Report the mean and the spread; reporting the best fold is how people fool themselves.',
            ),
            concept(
              'Reading a confusion matrix',
              'The confusion matrix is the most information-dense summary of a classifier, and it is worth reading carefully rather than collapsing to one number.\n\nFor binary classification the four cells are true positives, false positives, false negatives, and true negatives. Which cell is expensive depends entirely on the application — a false negative in cancer screening and a false positive in spam filtering are not comparable harms.\n\nFor multi-class problems it becomes a grid, and the **off-diagonal entries tell you what the model confuses with what**. That is diagnostic in a way an accuracy score never is: if a digit classifier mixes up 4 and 9 but nothing else, you know exactly where to look and what data to collect.\n\nAlways look at the matrix before tuning anything. It usually tells you what the actual problem is.',
              { figure: 'confusion-matrix' },
            ),
            numeric(
              'TP = 80, FP = 20, FN = 40, TN = 860. What is the F1 score, to two decimal places?',
              0.73,
              ['sk-confusion-matrix', 'sk-classification-metrics'],
              'Precision = 80/100 = 0.8. Recall = 80/120 = 0.667. F1 = 2 × (0.8 × 0.667) / (0.8 + 0.667) = 0.727 ≈ 0.73. The harmonic mean sits nearer the lower of the two, which is the point of using it.',
              { tolerance: 0.02 },
            ),
            mcq(
              'A 10-class model has high accuracy but the confusion matrix shows one cluster of persistent off-diagonal errors. What is the most useful response?',
              [
                'Report the accuracy and ship it',
                'Investigate that specific confusion — those classes likely need more or better-labelled examples',
                'Increase the learning rate',
                'Switch to a regression model',
              ],
              1,
              ['sk-confusion-matrix'],
              'A concentrated error pattern is a lead, not noise. Targeted data collection or a relabelling audit on those specific classes is far more effective than blind retuning.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-ml-1',
        title: 'Fitting Checkpoint',
        passingScore: 0.7,
        exercises: [
          numeric(
            'Loss gradient with respect to w is +4 and the learning rate is 0.1. If w = 2.0, what is w after one update?',
            1.6,
            ['sk-gradient-descent'],
            'w ← w − η × gradient = 2.0 − 0.1 × 4 = 1.6. A positive gradient means increasing w increases loss, so w decreases.',
            { tolerance: 0.001 },
          ),
          mcq(
            'Which loss belongs with binary classification?',
            ['Mean squared error', 'Binary cross-entropy', 'Mean absolute error', 'Huber loss'],
            1,
            ['sk-loss-functions'],
            'Cross-entropy is convex with sigmoid outputs and penalises confident errors sharply. The other three are regression losses.',
          ),
          trueFalse(
            'Logistic regression is a regression algorithm that predicts continuous values.',
            false,
            ['sk-logistic-regression'],
            'The name is historical. It predicts class probabilities and is used as a classifier.',
          ),
        ],
      },
    },

    {
      id: 'unit-ml-2',
      title: 'Trees, Forests, and Boosting',
      description: 'The algorithms that quietly win most tabular competitions.',
      lessons: [
        lesson({
          id: 'lesson-decision-trees',
          title: 'Decision Trees',
          summary: 'Twenty questions, learned automatically.',
          level: 'intermediate',
          domain: 'machine-learning',
          steps: [
            concept(
              'Learning the questions',
              'A decision tree is a flowchart the algorithm writes itself. At each node it asks a yes/no question about one feature — `age < 30?` — and splits the data accordingly. Follow the branches to a leaf, and the leaf holds the prediction.\n\nThe learning is in choosing the questions. At every node the algorithm tries every feature and every threshold, and keeps the split that most reduces impurity — how mixed the classes are within each resulting group. **Gini impurity** and **entropy** are the two standard measures; they rarely disagree much in practice.\n\nThen it recurses on each side until a stopping rule fires: max depth, minimum samples per leaf, or a pure node.',
              { keyTerms: [{ term: 'Impurity', definition: 'How mixed the classes are in a node. Zero means perfectly pure.' }, { term: 'Leaf', definition: 'A terminal node holding a prediction.' }] },
            ),
            mcq(
              'Why do unconstrained decision trees overfit so badly?',
              [
                'They cannot represent complex functions',
                'They can keep splitting until every leaf holds one example, memorising the training set',
                'They require too much data',
                'They only work on numeric features',
              ],
              1,
              ['sk-decision-trees', 'sk-overfitting'],
              'Given enough depth a tree can isolate every training point in its own leaf — 100% training accuracy, no generalisation. Depth limits, minimum leaf sizes, and pruning exist to stop this.',
            ),
            multi(
              'Genuine advantages of decision trees? (Select all)',
              [
                'The decision path is human-readable',
                'They handle numeric and categorical features without scaling',
                'They capture feature interactions automatically',
                'They are highly stable across resampled training data',
              ],
              [0, 1, 2],
              ['sk-decision-trees'],
              'Interpretability, no need for feature scaling, and automatic interactions are all real strengths. Stability is not — a single tree can change shape completely from a small data change, which is exactly the weakness ensembles fix.',
            ),
            concept(
              'Many trees beat one tree',
              'A single tree is high-variance. Averaging many of them fixes that, in two different ways.\n\n**Bagging / Random Forest.** Train hundreds of trees, each on a bootstrap resample of the rows *and* a random subset of the features at each split. Average their predictions. The randomness decorrelates the trees, so their individual errors cancel. Trees train in parallel and the method is very hard to misuse.\n\n**Boosting.** Train trees *sequentially*, each one fitting the residual errors of the ensemble so far. Every tree is shallow and weak; together they are extremely strong. XGBoost, LightGBM, and CatBoost are the standard implementations, and they remain the default choice on tabular data.\n\nThe tradeoff: bagging reduces variance and is robust; boosting reduces bias and wins competitions, but will overfit if you let it run too long.',
              { keyTerms: [{ term: 'Bagging', definition: 'Bootstrap aggregating — parallel models on resampled data, averaged.' }, { term: 'Boosting', definition: 'Sequential models, each correcting the previous ensemble\'s errors.' }] },
            ),
            match(
              'Match each property to the method.',
              [
                { left: 'Trees trained in parallel on bootstrap samples', right: 'Random Forest' },
                { left: 'Each tree fits the previous ensemble\'s residuals', right: 'Gradient Boosting' },
                { left: 'Primarily reduces variance', right: 'Random Forest' },
                { left: 'Primarily reduces bias', right: 'Gradient Boosting' },
              ],
              ['sk-ensembles'],
              'Bagging averages away variance; boosting chips away at bias. That is why boosting needs early stopping and bagging mostly does not.',
            ),
            mcq(
              'You have 8,000 rows of tabular customer data and need a strong baseline by tomorrow. What do you reach for?',
              [
                'A deep neural network',
                'Gradient-boosted trees',
                'A transformer',
                'k-means clustering',
              ],
              1,
              ['sk-ensembles'],
              'On small-to-medium tabular data, gradient boosting typically matches or beats deep learning while training in seconds and needing almost no tuning. Neural networks earn their keep on images, audio, and text — not on 8,000 rows of spreadsheet.',
            ),
          ],
        }),

        lesson({
          id: 'lesson-regularization',
          title: 'Regularization',
          summary: 'Deliberately handicapping the model so it generalises.',
          level: 'intermediate',
          domain: 'machine-learning',
          steps: [
            concept(
              'Penalising complexity',
              'Regularization adds a penalty for large weights to the loss, so the optimizer must trade fitting the data against staying simple.\n\n**L2 (Ridge)** adds `λ Σ wᵢ²`. Squaring means large weights are punished hardest, so L2 shrinks everything smoothly toward zero without quite reaching it. Correlated features end up sharing the weight between them.\n\n**L1 (Lasso)** adds `λ Σ |wᵢ|`. The absolute value has a constant gradient all the way to zero, which drives weak weights **exactly** to zero. That makes L1 a feature selector — it produces sparse models you can read.\n\n**λ** controls the strength. Zero means no regularization. Too high and everything is crushed to zero and you underfit.',
              { keyTerms: [{ term: 'L1 / Lasso', definition: 'Absolute-value penalty. Produces sparse models.' }, { term: 'L2 / Ridge', definition: 'Squared penalty. Shrinks weights smoothly.' }] },
            ),
            mcq(
              'You have 5,000 features, suspect most are irrelevant, and want a model you can explain. Which penalty?',
              ['L2', 'L1', 'Neither', 'Both at maximum strength'],
              1,
              ['sk-regularization'],
              'L1 zeroes out weak weights entirely, leaving a short list of features that actually matter. L2 would shrink all 5,000 without eliminating any. Elastic Net — L1 and L2 combined — is a common compromise when features are also correlated.',
            ),
            interactive(
              'Compare L1 and L2',
              'regularization',
              'Raise each penalty and watch the coefficient bars respond. L1 snaps weights to exactly zero one at a time; L2 shrinks them all together but never quite reaches zero.',
            ),
            fill(
              '___ regularization drives weights exactly to zero, while ___ shrinks them smoothly toward zero.',
              [['l1', 'lasso'], ['l2', 'ridge']],
              ['sk-regularization'],
              'L1\'s constant gradient reaches zero; L2\'s gradient shrinks as the weight does, so it approaches zero asymptotically without arriving.',
            ),
            concept(
              'Early stopping is regularization too',
              'The cheapest regulariser costs nothing: stop training when validation loss stops improving.\n\nTrack validation loss each epoch. Keep a copy of the best weights. If validation loss has not improved for **N** epochs (the *patience*, typically 5–20), stop and restore the best checkpoint.\n\nThis works because networks tend to learn broad structure first and memorise specifics later. Stopping early catches the model in the window where it has the signal but not yet the noise — and it requires no extra hyperparameter tuning, which is why it is in essentially every training loop.',
            ),
            interactive(
              'Tune the learning-rate schedule',
              'learning-rate-schedule',
              'Compare constant, step decay, cosine annealing, and warmup-then-cosine on the same run. Notice that warmup barely matters for a small model and becomes essential for a large one.',
            ),
            order(
              'Put the early-stopping loop in order.',
              [
                'Train one epoch on the training set',
                'Evaluate loss on the validation set',
                'If it improved, save the weights as the new best',
                'If it has not improved for `patience` epochs, stop and restore the best weights',
              ],
              ['sk-overfitting'],
              'Train, evaluate, checkpoint on improvement, stop on stagnation. Restoring the best checkpoint matters — the final epoch is rarely the best one.',
            ),
            shortAnswer(
              'A model has 96% training accuracy and 78% validation accuracy. Name three things you would try.',
              ['regularization', 'more data', 'early stopping', 'dropout', 'simpler'],
              'That gap is overfitting. I would add L2 regularization or dropout, apply early stopping on validation loss, gather or augment more training data, and try a smaller model.',
              ['sk-overfitting', 'sk-regularization'],
              'All the standard levers pull in the same direction: constrain the model, or give it more signal to fit.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-ml-2',
        title: 'Ensembles Checkpoint',
        passingScore: 0.7,
        exercises: [
          mcq(
            'Random Forest reduces error primarily by reducing which component?',
            ['Bias', 'Variance', 'Irreducible error', 'Learning rate'],
            1,
            ['sk-ensembles', 'sk-bias-variance'],
            'Averaging decorrelated trees cancels their individual idiosyncrasies. Bias stays roughly that of a single tree.',
          ),
          multi(
            'Which are regularization techniques? (Select all)',
            ['L2 weight penalty', 'Dropout', 'Early stopping', 'Increasing model width'],
            [0, 1, 2],
            ['sk-regularization'],
            'The first three all constrain effective capacity. Widening the model increases it.',
          ),
          trueFalse(
            'Gradient boosting trains its trees in parallel.',
            false,
            ['sk-ensembles'],
            'Each boosting tree fits the residuals of the ensemble so far, so they must be trained in sequence. Random Forest is the parallel one.',
          ),
        ],
      },
    },

    {
      id: 'unit-ml-3',
      title: 'Unsupervised Learning',
      description: 'Finding structure when nobody labelled anything.',
      lessons: [
        lesson({
          id: 'lesson-clustering',
          title: 'Clustering',
          summary: 'Grouping without being told the groups.',
          level: 'intermediate',
          domain: 'machine-learning',
          steps: [
            concept(
              'k-means',
              'Given points and a chosen number of clusters k, k-means alternates two steps until nothing changes:\n\n1. **Assign** each point to the nearest centroid.\n2. **Move** each centroid to the mean of its assigned points.\n\nSimple, fast, and it always converges — though only to a *local* optimum, so the initialisation matters. `k-means++` seeds centroids far apart and is the sensible default.\n\nThe real difficulty is choosing k. The **elbow method** plots within-cluster variance against k and looks for the bend. The **silhouette score** measures how much better each point fits its own cluster than the next-best one. Neither is decisive — clustering has no ground truth to check against, which is the defining awkwardness of unsupervised learning.',
              { keyTerms: [{ term: 'Centroid', definition: 'The mean position of the points in a cluster.' }] },
            ),
            order(
              'Put one k-means iteration in order.',
              [
                'Place k initial centroids',
                'Assign every point to its nearest centroid',
                'Recompute each centroid as the mean of its points',
                'Repeat assignment and update until assignments stop changing',
              ],
              ['sk-clustering'],
              'Assign, update, repeat. Each iteration is guaranteed not to increase within-cluster variance, which is why it always converges.',
            ),
            multi(
              'Known limitations of k-means? (Select all)',
              [
                'You must choose k in advance',
                'It assumes roughly spherical, similarly-sized clusters',
                'Results depend on initialisation',
                'It cannot handle numeric features',
              ],
              [0, 1, 2],
              ['sk-clustering'],
              'The first three are real. Numeric features are exactly what k-means handles — it is *categorical* features that need a different distance metric or a different algorithm entirely (k-modes, DBSCAN, hierarchical).',
            ),
            concept(
              'Reducing dimensions',
              'High-dimensional data is hard to visualise, slow to model, and prone to overfitting. **Principal component analysis (PCA)** finds the directions along which the data varies most and projects onto the first few.\n\nEach principal component is a linear combination of the original features, and they are ordered by how much variance they explain. Keeping components that cover 95% of the variance often cuts hundreds of features to a couple of dozen with little loss.\n\nPCA is linear, which is both its strength (fast, deterministic, invertible) and its limit. For *visualising* nonlinear structure, **t-SNE** and **UMAP** are the tools — but treat their output as a picture, not a measurement: distances between clusters in a t-SNE plot are not meaningful.',
            ),
            mcq(
              'Two clusters appear far apart in a t-SNE plot. What can you conclude?',
              [
                'They are very different in the original space',
                'Little — t-SNE preserves local neighbourhoods, not global distances',
                'One cluster is larger',
                'The data has exactly two clusters',
              ],
              1,
              ['sk-dimensionality-reduction'],
              't-SNE optimises for keeping near neighbours near. Distances *between* clusters, and cluster sizes, are artefacts of the layout. Reading global structure off a t-SNE plot is one of the most common mistakes in exploratory analysis.',
            ),
          ],
        }),
      ],
    },
  ],
};
