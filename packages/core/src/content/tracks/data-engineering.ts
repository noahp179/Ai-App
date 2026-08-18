/**
 * Track — Data & Feature Engineering.
 *
 * Surveys consistently put this at 60–80% of a practitioner's time, and it is
 * the part almost every course skips. A model is a function of its features;
 * everything upstream of the algorithm decides what is possible downstream.
 */

import type { Track } from '../../domain/types.js';
import { categorize, codeOutput, concept, fill, interactive, lesson, match, mcq, multi, numeric, order, shortAnswer, trueFalse } from '../builders.js';

export const dataEngineeringTrack: Track = {
  id: 'track-data',
  title: 'Data & Feature Engineering',
  tagline: 'Where most of the work actually is',
  description:
    'Encoding, missing values, outliers, feature selection, and labelling quality. The unglamorous work that decides whether any of the modelling matters.',
  domain: 'data',
  level: 'intermediate',
  icon: '🧱',
  gradient: ['#22C55E', '#0EA5E9'],
  prerequisites: ['track-types-of-ml'],
  outcomes: [
    'Encode categorical features without leaking or exploding dimensionality',
    'Handle missing data based on why it is missing',
    'Detect and treat outliers appropriately',
    'Judge labelling quality and measure annotator agreement',
  ],
  units: [
    {
      id: 'unit-data-1',
      title: 'Getting Features Right',
      description: 'Encoding, scaling, missing values, and outliers.',
      lessons: [
        lesson({
          id: 'lesson-categorical-encoding',
          title: 'Encoding Categories',
          summary: 'Turning "London" into a number the model can use.',
          level: 'intermediate',
          domain: 'data',
          free: true,
          steps: [
            concept(
              'Four ways, and when each is wrong',
              'Models consume numbers. Categories have to be converted, and the conversion carries assumptions.\n\n**Label encoding** — map each category to an integer. London→0, Paris→1, Tokyo→2.\n\nThis invents an ordering that does not exist. A linear model now believes Tokyo > Paris > London, and that Paris is the midpoint of London and Tokyo. **Only use this for genuinely ordinal categories** (small/medium/large) — or for tree models, which split on thresholds and are largely indifferent.\n\n**One-hot encoding** — one binary column per category. No false ordering, and it is the correct default for low-cardinality features. Its cost is dimensionality: 10,000 postcodes become 10,000 columns, which is fatal for linear and distance-based models.\n\n**Target encoding** — replace each category with the mean target value for that category. Compact and often very powerful. It is also **the single most common source of leakage in applied ML**: computing the mean using the row you are about to predict leaks the answer directly. Always compute it out-of-fold.\n\n**Embeddings** — learn a dense vector per category. Handles high cardinality, and captures similarity between categories. The standard approach for very high-cardinality features in neural models.',
              {
                figure: 'feature-pipeline',
                keyTerms: [
                  { term: 'Cardinality', definition: 'How many distinct values a categorical feature takes.' },
                  { term: 'Target leakage', definition: 'Using information from the target that would not exist at prediction time.' },
                ],
              },
            ),

            categorize(
              'Choose an encoding for each feature.',
              ['One-hot', 'Ordinal / label', 'Target encoding', 'Embedding'],
              [
                { item: 'Payment method: card, cash, transfer', category: 'One-hot' },
                { item: 'Shirt size: S, M, L, XL', category: 'Ordinal / label' },
                { item: '50,000 product IDs in a neural model', category: 'Embedding' },
                { item: '3,000 postcodes for a gradient-boosted model', category: 'Target encoding' },
                { item: 'Satisfaction: poor, fair, good, excellent', category: 'Ordinal / label' },
                { item: 'Country, from a list of 12', category: 'One-hot' },
              ],
              ['sk-categorical-encoding'],
              'Low cardinality and unordered → one-hot. Genuinely ordered → ordinal. High cardinality with a tree model → target encoding, computed out-of-fold. High cardinality in a neural model → embeddings.',
            ),

            mcq(
              'A team target-encodes a high-cardinality feature and validation accuracy jumps to 0.99. What should they check first?',
              [
                'Nothing — target encoding is powerful',
                'Whether the encoding was computed using the target values of the rows being predicted — classic leakage',
                'Whether they used enough trees',
                'Whether the learning rate is too low',
              ],
              1,
              ['sk-categorical-encoding', 'sk-data-leakage'],
              'Target encoding computed on the full dataset embeds each row\'s own label into its feature. The score is spectacular and completely fake. Out-of-fold encoding — computing each fold\'s means from the other folds only — is mandatory.',
            ),

            mcq(
              'Why is label encoding usually harmless for gradient-boosted trees but harmful for linear regression?',
              [
                'Trees are more accurate',
                'Trees split on thresholds and can isolate any category with enough splits; linear models multiply the integer by a coefficient, imposing a false ordering',
                'Linear models cannot handle categories at all',
                'Trees automatically one-hot encode internally',
              ],
              1,
              ['sk-categorical-encoding'],
              'A tree can carve out category 7 with two threshold splits. A linear model computes `w × 7`, which asserts that category 7 is seven times category 1 — a claim nobody intended.',
            ),

            trueFalse(
              'One-hot encoding is always the safest default regardless of cardinality.',
              false,
              ['sk-categorical-encoding'],
              'It is safe with respect to false ordering, but at high cardinality it creates a very wide sparse matrix that hurts distance-based and linear models and slows everything down.',
            ),
          ],
        }),

        lesson({
          id: 'lesson-missing-outliers',
          title: 'Missing Data and Outliers',
          summary: 'Why something is missing matters more than how you fill it.',
          level: 'intermediate',
          domain: 'data',
          steps: [
            concept(
              'Three kinds of missing',
              'Before choosing an imputation method, ask **why** the value is absent. Statisticians distinguish three cases and they demand different treatment.\n\n**MCAR — missing completely at random.** The absence is unrelated to anything. A sensor dropped a reading. Dropping those rows is unbiased, just wasteful.\n\n**MAR — missing at random.** The absence depends on *other observed* features. Older patients skip a particular test more often — so given age, the missingness is random. Imputation using the other features works here.\n\n**MNAR — missing not at random.** The absence depends on the *missing value itself*. High earners decline to state income; failing students skip the exam. Imputing from other features is systematically biased, and the fact of missingness is itself informative.\n\nFor MNAR, the right move is usually to **add an explicit `was_missing` indicator column** and let the model use it. The missingness is signal, not noise — throwing it away discards real information.\n\nWhat to avoid: silently imputing the mean everywhere. It shrinks variance, weakens correlations, and hides a data-quality problem you needed to see.',
              {
                keyTerms: [
                  { term: 'MNAR', definition: 'Missingness that depends on the unobserved value itself — the hard case.' },
                  { term: 'Missingness indicator', definition: 'A binary column recording that a value was absent.' },
                ],
              },
            ),

            categorize(
              'Classify each pattern of missing data.',
              ['MCAR', 'MAR', 'MNAR'],
              [
                { item: 'A sensor randomly drops 2% of readings', category: 'MCAR' },
                { item: 'High earners decline to report income', category: 'MNAR' },
                { item: 'Older patients skip an optional test more often', category: 'MAR' },
                { item: 'Failing students skip the final survey', category: 'MNAR' },
                { item: 'A form field was lost in a random batch upload error', category: 'MCAR' },
              ],
              ['sk-missing-data'],
              'MCAR is unrelated to anything; MAR depends on other observed columns; MNAR depends on the hidden value itself. Only MNAR makes the missingness itself informative.',
            ),

            mcq(
              'Income is missing mostly for high earners. What is the best treatment?',
              [
                'Impute the mean income',
                'Drop those rows',
                'Impute, and add a `income_was_missing` indicator so the model can use the missingness itself',
                'Impute zero',
              ],
              2,
              ['sk-missing-data'],
              'This is MNAR — the absence carries information about the value. Imputing alone biases the distribution downward; the indicator lets the model learn that "declined to state" predicts high income.',
            ),

            concept(
              'Outliers: error or signal?',
              'An outlier is a point far from the rest. Before removing it, decide which of two things it is.\n\n**A data error.** A recorded age of 999, a negative price, a temperature of 10,000°C. Remove or correct these — they are noise with no informational content.\n\n**A genuine extreme.** The actual fraud case. The one machine that really did fail. **These are frequently the most important rows in the dataset**, and deleting them for tidiness is how anomaly-detection projects fail before they start.\n\nDetection methods:\n\n**Z-score** — flag points more than 3 standard deviations out. Assumes roughly normal data, and is itself distorted by the outliers you are hunting.\n**IQR** — flag beyond `Q1 − 1.5×IQR` or `Q3 + 1.5×IQR`. Distribution-free and far more robust.\n**Isolation Forest** — outliers are easier to isolate with random splits. Works in many dimensions at once.\n\nTreatment options: remove (only if it is an error), **winsorize** (cap at a percentile, keeping the row), transform (a log transform tames right-skewed data), or use robust methods that tolerate them — mean absolute error instead of MSE, median instead of mean, tree models instead of linear ones.',
            ),

            mcq(
              'A fraud dataset\'s largest transactions are flagged as outliers. Should you remove them?',
              [
                'Yes — outliers always hurt model quality',
                'No — in fraud detection the extremes are very likely the signal you are trying to detect',
                'Yes, but only the top 1%',
                'Only if the model is linear',
              ],
              1,
              ['sk-outliers'],
              'Removing extreme values from a fraud dataset deletes the positive class. "Outlier" is a statistical description, not a verdict — always ask whether the point is an error or the phenomenon.',
            ),

            numeric(
              'Q1 = 20, Q3 = 40. Using the 1.5×IQR rule, above what value is a point flagged as a high outlier?',
              70,
              ['sk-outliers'],
              'IQR = 40 − 20 = 20. Upper fence = Q3 + 1.5 × IQR = 40 + 30 = 70. The lower fence would be 20 − 30 = −10.',
              { hint: 'IQR is Q3 minus Q1; the fence sits 1.5 IQRs beyond Q3.' },
            ),

            mcq(
              'Why is the IQR method more robust than the z-score method for detecting outliers?',
              [
                'It is faster to compute',
                'Quartiles are barely affected by extreme values, while the mean and standard deviation are pulled by the very outliers you are looking for',
                'It works only on normal distributions',
                'It requires no data',
              ],
              1,
              ['sk-outliers'],
              'A single extreme value inflates the standard deviation enough to hide itself inside 3σ — the masking effect. Quartiles are order statistics and barely move.',
            ),
          ],
        }),

        lesson({
          id: 'lesson-feature-selection',
          title: 'Feature Selection and Creation',
          summary: 'More features is not more information.',
          level: 'intermediate',
          domain: 'data',
          steps: [
            concept(
              'Why fewer features can be better',
              'Adding features feels free. It is not.\n\nEach one adds a dimension for the model to overfit in, adds noise if it is irrelevant, adds a pipeline component that can break in production, and worsens the curse of dimensionality for any distance-based method.\n\nThree families of selection:\n\n**Filter methods** — score each feature independently of any model. Correlation with the target, mutual information, chi-squared. Fast, and blind to interactions: two features that are useless alone but powerful together will both be dropped.\n\n**Wrapper methods** — train models on subsets and compare. Recursive feature elimination repeatedly drops the weakest. Accurate, and expensive.\n\n**Embedded methods** — selection happens during training. **L1 regularisation** drives weak coefficients exactly to zero; tree ensembles report feature importances. Usually the best value for effort.\n\nA caution on tree importances: they are biased toward high-cardinality features, and they split credit arbitrarily between correlated ones. **Permutation importance** — shuffle a column and measure the drop in validation score — is more trustworthy and directly answers "does the model actually rely on this?"',
            ),

            interactive(
              'Watch L1 zero out weights',
              'regularization',
              'Increase the L1 penalty and watch individual coefficients hit exactly zero one by one — the model selecting features for you. Switch to L2 and watch every coefficient shrink smoothly toward zero without any of them arriving.',
            ),

            mcq(
              'A model has two nearly identical features. Tree feature importance shows both as moderately important. What is happening?',
              [
                'Both are genuinely important',
                'The importance is split between them, so each looks less important than the underlying signal really is',
                'The model is broken',
                'Tree importances are always correct',
              ],
              1,
              ['sk-feature-selection'],
              'Correlated features share credit arbitrarily — each tree picks one at random. Drop either and performance barely changes, which permutation importance would reveal and split-based importance hides.',
            ),

            concept(
              'Creating features that carry signal',
              'The highest-leverage work in tabular ML is usually creating a feature, not tuning a model.\n\n**Domain ratios.** Debt-to-income beats debt and income as separate columns, because the ratio is what the decision actually depends on.\n\n**Time-derived features.** From a timestamp: hour of day, day of week, is-weekend, is-holiday, days-since-last-event. A raw epoch integer carries almost none of this.\n\n**Cyclical encoding.** Hour 23 and hour 0 are adjacent, but as integers they are maximally far apart. Encode as `sin(2π·h/24)` and `cos(2π·h/24)` so the model sees the wrap-around.\n\n**Aggregations.** Per-user mean, count, and standard deviation of past behaviour. Enormously predictive, and enormously easy to leak with — every aggregate must use only data available *before* the prediction moment.\n\n**Interactions.** Explicit products of features. Trees find these automatically; linear models need them handed over.\n\nThe rule that keeps all of this honest: **every feature must be computable at prediction time with only the information you will actually have.** A feature built from the future is a leak, however good it looks in validation.',
              { keyTerms: [{ term: 'Cyclical encoding', definition: 'Sine/cosine transform so periodic values wrap correctly.' }] },
            ),

            mcq(
              'Why encode hour-of-day as sine and cosine rather than as an integer 0–23?',
              [
                'To reduce memory usage',
                'So 23:00 and 00:00 are represented as adjacent, which the integer encoding gets maximally wrong',
                'Because models cannot handle integers',
                'To normalise the range',
              ],
              1,
              ['sk-feature-crosses'],
              'As integers, 23 and 0 are the two furthest-apart values, when in reality they are one hour apart. The sine/cosine pair places them next to each other on a circle.',
            ),

            codeOutput(
              'What does this print?',
              'python',
              `import numpy as np

def cyclical(hour, period=24):
    angle = 2 * np.pi * hour / period
    return round(float(np.cos(angle)), 2)

# Midnight and 11pm should be close
print(cyclical(0), cyclical(23))`,
              ['1.0 0.97', '0.0 1.0', '1.0 -1.0', '0.0 0.96'],
              0,
              ['sk-feature-crosses'],
              'cos(0) = 1.0 and cos(2π·23/24) ≈ 0.97 — nearly identical, correctly reflecting that midnight and 11pm are adjacent. As raw integers they would be 23 apart.',
            ),

            multi(
              'Which features would leak information into a churn model? (Select all)',
              [
                'Number of support tickets in the last 90 days',
                'Account cancellation reason code',
                'Date the refund was issued',
                'Average monthly spend over the past year',
              ],
              [1, 2],
              ['sk-feature-crosses', 'sk-data-leakage'],
              'Cancellation reason and refund date only exist *after* churn has happened — they are consequences of the label. Ticket counts and past spend exist before the prediction moment and are legitimate.',
            ),
          ],
        }),

        lesson({
          id: 'lesson-labelling-quality',
          title: 'Labelling Quality',
          summary: 'Your model can only be as good as your labels.',
          level: 'intermediate',
          domain: 'data',
          steps: [
            concept(
              'The ceiling nobody measures',
              'Every supervised model is bounded by the quality of its labels. If two expert annotators disagree 20% of the time, no model can meaningfully exceed 80% agreement with either — you have hit the **irreducible ceiling of the labelling process itself**.\n\nWidely-used benchmark datasets have been found to contain label errors at rates of several percent, and correcting them can change which model ranks best. If that is true of the most scrutinised datasets in the field, it is true of yours.\n\nMeasure it. **Inter-annotator agreement** is the key statistic, and **Cohen\'s kappa** is the standard measure because it corrects for agreement that would happen by chance:\n\n- κ > 0.8 — strong agreement; the task is well-defined.\n- κ 0.6–0.8 — acceptable; the guidelines need work.\n- κ < 0.6 — the task itself is ambiguous. Fix the definition before labelling more.\n\nA low kappa is not an annotator problem. It is a **specification** problem, and no amount of additional labelling fixes it.',
              { keyTerms: [{ term: "Cohen's kappa", definition: 'Agreement between annotators, corrected for chance agreement.' }] },
            ),

            mcq(
              'Two annotators reach a kappa of 0.45 on a sentiment task. What is the right response?',
              [
                'Hire better annotators',
                'Fix the labelling guidelines — the task definition is ambiguous',
                'Train the model anyway; it will average out the noise',
                'Collect ten times more labels',
              ],
              1,
              ['sk-data-labelling'],
              'Low kappa means the annotators do not share a definition of the classes. More labels at the same ambiguity produces more noise, not more signal. Sharpen the guidelines, add worked edge cases, and re-measure.',
            ),

            multi(
              'Which practices improve labelling quality? (Select all)',
              [
                'Written guidelines with worked examples of edge cases',
                'Multiple annotators on an overlapping sample, with agreement measured',
                'An adjudication step for disagreements',
                'Paying per label to maximise throughput',
              ],
              [0, 1, 2],
              ['sk-data-labelling'],
              'Clear definitions, measured overlap, and adjudication all raise quality. Paying purely per label rewards speed over care and reliably degrades it.',
            ),

            trueFalse(
              'A model can reliably exceed the accuracy of the labels it was trained on.',
              false,
              ['sk-data-labelling'],
              'The labels define what "correct" means during training and evaluation. Systematic label error sets a ceiling — and worse, it means your test set is also wrong, so you cannot even measure the shortfall.',
            ),

            shortAnswer(
              'Your model is stuck at 82% and you have tried every algorithm. What should you check before trying more models?',
              ['labels', 'agreement', 'annotator', 'ceiling', 'errors'],
              'Whether 82% is the ceiling imposed by the labels. Sample some errors and re-adjudicate them — if a large fraction of the "mistakes" are actually label errors, the model is already at the limit of the data and the fix is upstream in the labelling process.',
              ['sk-data-labelling'],
              'Auditing the errors is nearly always more informative than the next algorithm. It tells you whether you have a modelling problem or a data problem.',
            ),
          ],
        }),

        lesson({
          id: 'lesson-text-and-shift',
          title: 'Text Features and Dataset Shift',
          summary: 'Turning language into columns, and noticing when the world moves.',
          level: 'intermediate',
          domain: 'data',
          steps: [
            concept(
              'Text as features',
              'Text is not a column of numbers, so it has to be converted. The methods form a ladder, and higher is not automatically better.\n\n**Bag of words.** Count how often each word appears. Order is discarded entirely — "dog bites man" and "man bites dog" become identical. Crude, fast, and a surprisingly strong baseline for topic classification.\n\n**TF-IDF.** Weight each word by how often it appears in this document, divided by how many documents contain it at all. Common words like "the" get crushed; distinctive words get amplified. Still the right first move for search and document classification.\n\n**N-grams.** Count short sequences instead of single words, which recovers a little local order. "not good" survives as a unit where bag-of-words would see "not" and "good" separately — a real problem for sentiment.\n\n**Embeddings.** Dense learned vectors that place similar meanings near each other. Handles synonyms and paraphrase, which none of the above can.\n\nThe honest guidance: **TF-IDF plus a linear model is a genuinely competitive baseline** for many classification tasks and trains in seconds. Reach for embeddings when synonymy and paraphrase actually matter to your problem, not by default.',
              {
                keyTerms: [
                  { term: 'TF-IDF', definition: 'Term frequency weighted down by how many documents contain the term.' },
                  { term: 'N-gram', definition: 'A contiguous run of n tokens, capturing local word order.' },
                ],
              },
            ),

            mcq(
              'A sentiment model using bag-of-words scores "not good at all" as positive. What is the cheapest fix?',
              [
                'Collect more data',
                'Add bigrams, so "not good" is counted as its own feature',
                'Switch to a larger model',
                'Remove stopwords',
              ],
              1,
              ['sk-text-features'],
              'Bag-of-words sees "not" and "good" as independent counts, and "good" carries positive weight. Bigrams capture the negation as a single feature. Removing stopwords would make it worse — "not" is usually on the stopword list.',
            ),

            mcq(
              'Why does TF-IDF divide by document frequency?',
              [
                'To normalise document length',
                'To down-weight words that appear everywhere and carry little distinguishing information',
                'To remove misspellings',
                'To speed up training',
              ],
              1,
              ['sk-text-features'],
              'A word appearing in every document cannot distinguish between them. The inverse-document-frequency term suppresses those and amplifies the words that actually characterise a document.',
            ),

            concept(
              'Dataset shift in practice',
              'Models assume tomorrow resembles the training data. When it stops, performance decays — usually silently, because nothing errors.\n\nThree kinds, each needing a different response:\n\n**Covariate shift** — the inputs change but the input-to-output relationship holds. A new camera sensor; a new customer demographic. Often fixable by reweighting the training data or simply retraining on recent examples.\n\n**Prior probability shift** — the class balance changes. Fraud rises from 0.1% to 2%. The features still mean the same thing, so you can often just recalibrate the decision threshold rather than retrain.\n\n**Concept drift** — the relationship itself changes. What predicted churn in 2024 no longer does in 2026, because the market changed. This is the serious one, and only retraining on new labels fixes it.\n\nHow to catch it: monitor input feature distributions (PSI, KS tests) and the output distribution continuously — both are available immediately, without labels. Ground-truth accuracy arrives late, sometimes months late, so **drift monitoring is the early warning and accuracy is the confirmation.**\n\nAnd keep a fixed reference dataset that never changes, so "the distribution shifted" is measured against something stable rather than against last week, which may itself have already drifted.',
              { figure: 'mlops-lifecycle' },
            ),

            categorize(
              'Classify each change in the world.',
              ['Covariate shift', 'Prior probability shift', 'Concept drift'],
              [
                { item: 'A new phone camera changes image quality', category: 'Covariate shift' },
                { item: 'Fraud rate rises from 0.1% to 2% after a breach', category: 'Prior probability shift' },
                { item: 'Fraudsters adapt their tactics to evade the detector', category: 'Concept drift' },
                { item: 'The product launches in a new country with different users', category: 'Covariate shift' },
                { item: 'What predicted churn two years ago no longer does', category: 'Concept drift' },
                { item: 'A marketing push shifts the mix of incoming customers', category: 'Prior probability shift' },
              ],
              ['sk-dataset-shift'],
              'Inputs changed, class balance changed, or the input-output relationship changed. The third needs new labels; the first two often do not.',
            ),

            mcq(
              'Accuracy is unavailable for 90 days because labels lag. What do you monitor in the meantime?',
              [
                'Nothing useful is available',
                'Input feature drift and the prediction distribution — both measurable immediately',
                'Training loss',
                'Model file size',
              ],
              1,
              ['sk-dataset-shift', 'sk-model-monitoring'],
              'Inputs and outputs are observable the moment a request arrives. A fraud model suddenly flagging three times as many transactions is actionable long before the chargebacks confirm it.',
            ),

            trueFalse(
              'A model can degrade badly in production while every system-health dashboard stays green.',
              true,
              ['sk-dataset-shift'],
              'Latency, error rate, and throughput say nothing about whether the predictions are any good. This is exactly why prediction quality needs its own monitoring layer.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-data-1',
        title: 'Data Engineering Checkpoint',
        passingScore: 0.75,
        exercises: [
          mcq(
            'Target encoding computed over the whole dataset before splitting causes what?',
            ['Slower training', 'Target leakage and an inflated validation score', 'Higher dimensionality', 'Nothing'],
            1,
            ['sk-categorical-encoding', 'sk-data-leakage'],
            'Each row\'s encoded value includes its own target. Out-of-fold encoding is the required fix.',
          ),
          categorize(
            'Sort each into the right treatment.',
            ['Remove it', 'Keep and flag it'],
            [
              { item: 'A recorded age of 999', category: 'Remove it' },
              { item: 'The largest genuine fraudulent transaction', category: 'Keep and flag it' },
              { item: 'A negative price', category: 'Remove it' },
              { item: 'The one machine that really did fail', category: 'Keep and flag it' },
            ],
            ['sk-outliers'],
            'Data errors go; genuine extremes stay — in anomaly problems they are the entire point.',
          ),
          numeric(
            'Q1 = 10, Q3 = 30. What is the lower outlier fence under the 1.5×IQR rule?',
            -20,
            ['sk-outliers'],
            'IQR = 20. Lower fence = 10 − 1.5 × 20 = −20.',
          ),
        ],
      },
    },
  ],
};
