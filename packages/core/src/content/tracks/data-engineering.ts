/**
 * Track — Data & Feature Engineering.
 *
 * Surveys consistently put this at 60–80% of a practitioner's time, and it is
 * the part almost every course skips. A model is a function of its features;
 * everything upstream of the algorithm decides what is possible downstream.
 */

import type { Track } from '../../domain/types';
import { categorize, codeOutput, concept, interactive, lesson, mcq, multi, numeric, order, shortAnswer, trueFalse } from '../builders';

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
    'Choose augmentations that preserve the label in your domain',
    'Pick the right lever for class imbalance, starting with the threshold',
    'Name the four kinds of leakage and catch each one',
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
    // -----------------------------------------------------------------------
    {
      id: 'unit-data-2',
      title: 'Getting Data At All',
      description: 'Before you engineer a feature, something has to produce the rows.',
      lessons: [
        lesson({
          id: 'lesson-data-sourcing',
          title: 'Where Training Data Comes From',
          summary: 'Five sources, each with a different failure mode attached.',
          level: 'intro',
          domain: 'data',
          steps: [
            concept(
              'Five sources, five kinds of trouble',
              'Almost every dataset comes from one of five places, and each carries a characteristic problem.\n\n**Product logs.** Free, huge, and exactly matched to your distribution — but only records what users did *given the product you already had*. A recommender trained on click logs learns what your current ranking showed people, not what they would have liked. This is the feedback loop problem and it is the most common one.\n\n**Human annotation.** Precise and expensive, and only as good as the guideline. Two annotators reading the same instruction differently is not noise you can average away; it is a specification bug.\n\n**Purchased or licensed data.** Fast, and someone else owns the provenance. If you cannot say where a row originated, you cannot answer a deletion request or a rights claim about it.\n\n**Public and scraped data.** Cheap and legally fraught. Robots.txt, terms of service, copyright, and personal data all apply, and "it was on the internet" is not a licence.\n\n**Synthetic data.** Unlimited and unreal, covered in the next lesson.\n\nThe unglamorous discipline that makes all of these workable is **provenance**: for every row, where it came from, when, under what licence, and with whose consent. Retrofit it after a year of collection and you will find you cannot.',
              {
                figure: 'feature-pipeline',
                keyTerms: [
                  { term: 'Provenance', definition: 'The recorded origin, licence, and consent basis of each piece of data.' },
                  { term: 'Feedback loop', definition: 'When a model’s outputs shape the data used to train its successor.' },
                ],
              },
            ),
            mcq(
              'A recommender is retrained on clicks it generated. What goes wrong over successive versions?',
              [
                'Nothing — click data is the most honest signal available',
                'It narrows: items the model never showed get no clicks, so they look bad and stay hidden',
                'The model overfits to the loss function',
                'Latency grows with each retrain',
              ],
              1,
              ['sk-data-sourcing'],
              'The model only ever sees feedback on what it chose to show. Unshown items accumulate no evidence, look unpopular by omission, and stay unshown. The standard mitigations are explicit exploration — show some random or uncertain items on purpose — and logging the propensity of each impression so you can correct for it later.',
            ),
            categorize(
              'Sort each dataset problem by the source it most characteristically comes from.',
              ['Product logs', 'Human annotation', 'Scraped data'],
              [
                { item: 'Only reflects options the old system chose to show', category: 'Product logs' },
                { item: 'Two labellers disagree because the guideline was ambiguous', category: 'Human annotation' },
                { item: 'Unclear whether you have the right to use it commercially', category: 'Scraped data' },
                { item: 'Contains personal data nobody consented to share', category: 'Scraped data' },
                { item: 'Expensive enough that the set stays small', category: 'Human annotation' },
              ],
              ['sk-data-sourcing', 'sk-data-labelling'],
              'Knowing the source tells you which failure to go looking for first — and which one your evaluation is least likely to reveal on its own.',
            ),
            trueFalse(
              'Data that is publicly accessible on the web is legally free to use for training.',
              false,
              ['sk-data-sourcing'],
              'Accessible is not the same as licensed. Copyright, site terms, database rights, and data-protection law all continue to apply, and they vary by jurisdiction. Record the licence at collection time — reconstructing it later across millions of rows is not realistic.',
            ),
            shortAnswer(
              'Why must provenance be recorded at collection time rather than reconstructed later?',
              ['deletion', 'licence', 'consent', 'origin', 'audit', 'cannot'],
              'Because the information only exists at the moment of collection. Once rows are merged, deduplicated and transformed, there is no way to recover which source, licence or consent basis each one came under — so you cannot honour a deletion request, answer a rights claim, or prove your training set is clean.',
              ['sk-data-sourcing'],
              'This is the single cheapest thing to do early and the most expensive to fix late.',
            ),
          ],
        }),

        lesson({
          id: 'lesson-synthetic-data',
          title: 'Synthetic and Augmented Data',
          summary: 'Manufacturing examples — and the trap of training on your own output.',
          level: 'intermediate',
          domain: 'data',
          steps: [
            concept(
              'Augmentation teaches invariance',
              'Augmentation is not "more data". It is a way of **telling the model which changes should not change the answer.**\n\nFlip a photo of a cat horizontally and it is still a cat, so a flipped copy teaches horizontal invariance. Crop it, shift the colours slightly, add noise — each transformation encodes a belief about what is irrelevant.\n\nWhich makes the choice a domain decision, not a default recipe. Flip a photo of a cat: fine. Flip a photo of a road sign: you have invented a mirrored sign that does not exist. Flip an X-ray: you have moved the heart to the wrong side, and a model trained that way will happily accept situs inversus as normal.\n\nThe same logic runs through every modality. Text augmentation by synonym swap assumes meaning survives the swap, which fails on legal and medical text where terms are precise. Time-series augmentation by jitter assumes small perturbations are plausible, which is false for step-change sensors.\n\n**The question is never "what augmentations are standard". It is "what changes leave the label intact in my domain".**',
              { keyTerms: [{ term: 'Augmentation', definition: 'Transforming existing examples in ways that preserve the label, to teach invariance.' }] },
            ),
            multi(
              'Which augmentations preserve the label? (Select all)',
              [
                'Horizontally flipping a photo for animal classification',
                'Horizontally flipping a chest X-ray for pathology detection',
                'Adding small Gaussian noise to an audio clip for speech recognition',
                'Rotating a handwritten digit by 180° for digit recognition',
              ],
              [0, 2],
              ['sk-data-augmentation'],
              'Animals and background noise are genuinely invariant. A mirrored X-ray implies reversed organ placement, and a digit rotated 180° turns 6 into 9 — both change the correct answer, so both teach the model something false.',
            ),
            concept(
              'Synthetic data and model collapse',
              'Synthetic data — generated by a simulator or by another model — is genuinely useful where real data is scarce, dangerous to collect, or privacy-constrained. Autonomous-driving teams train on simulated crashes for obvious reasons. Fraud teams generate rare attack patterns because they cannot wait for enough real ones.\n\nIt has two characteristic failure modes.\n\n**The reality gap.** The simulator encodes your assumptions, so the model learns to solve the simulation. It excels on synthetic test data and fails on the real distribution in exactly the places your assumptions were wrong — which are, by construction, the places you did not think to check.\n\n**Model collapse.** Train a model on another model\'s output and you inherit its distribution, not the world\'s. Repeat over generations and the tails disappear first: rare phrasings, minority dialects, unusual cases. Each generation is trained on a slightly narrower sample than the last, and variance shrinks monotonically. The output stays fluent, which is what makes it hard to notice — it gets blander rather than obviously broken.\n\nThe practical rule: synthetic data is a supplement anchored to real data, never a replacement for it. Keep a real held-out set that no synthetic example ever touched, and judge everything on that.',
              {
                keyTerms: [
                  { term: 'Reality gap', definition: 'The distance between a simulator’s distribution and the real world’s.' },
                  { term: 'Model collapse', definition: 'Progressive loss of tail diversity when models train on model-generated data.' },
                ],
              },
            ),
            mcq(
              'What is the first thing to disappear when successive models train on their predecessors’ output?',
              [
                'Fluency and grammar',
                'The rare cases in the tails of the distribution',
                'The ability to follow instructions',
                'The most common patterns',
              ],
              1,
              ['sk-synthetic-data'],
              'Sampling under-represents the tails, and each generation samples from the last. Common patterns are reinforced while rare ones thin out and vanish. The output stays fluent throughout, which is precisely why collapse is easy to miss until the model fails on something unusual.',
            ),
            interactive(
              'Skew the sample, watch the model follow',
              'data-bias',
              'Change the composition of the training sample and watch per-group accuracy pull apart. Synthetic data skews a sample the same way — it just does it invisibly, because the rows look real.',
            ),
            trueFalse(
              'A held-out evaluation set may include synthetic examples as long as they were generated the same way as the training data.',
              false,
              ['sk-synthetic-data'],
              'That would measure how well the model learned the generator, which is the one thing you already know it can do. The held-out set has to be real data, or it cannot detect the reality gap at all.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-data-2',
        title: 'Data Sourcing Checkpoint',
        passingScore: 0.7,
        exercises: [
          mcq(
            'A recommender is retrained on the clicks it generated. What happens over successive versions?',
            [
              'Nothing — clicks are the most honest signal',
              'The catalogue narrows: unshown items gather no evidence and stay unshown',
              'It overfits the loss function',
              'Latency grows',
            ],
            1,
            ['sk-data-sourcing'],
            'The feedback loop closes on itself. Deliberate exploration and logged propensities are the standard mitigations.',
          ),
          trueFalse(
            'Flipping an X-ray horizontally is a safe augmentation for pathology detection.',
            false,
            ['sk-data-augmentation'],
            'It implies reversed organ placement. Augmentation encodes a claim about what should not change the label, and that claim is domain-specific.',
          ),
          mcq(
            'What disappears first when models are repeatedly trained on model-generated data?',
            [
              'Fluency and grammar',
              'The rare cases in the tails of the distribution',
              'Instruction following',
              'The most common patterns',
            ],
            1,
            ['sk-synthetic-data'],
            'Model collapse thins the tails while fluency holds throughout — which is exactly what makes it hard to notice.',
          ),
        ],
      },
    },

    // -----------------------------------------------------------------------
    {
      id: 'unit-data-3',
      title: 'Data That Moves',
      description: 'Imbalance and leakage — the two failures that make a good score meaningless.',
      lessons: [
        lesson({
          id: 'lesson-class-imbalance',
          title: 'Class Imbalance',
          summary: '99.9% accuracy on a 1-in-1000 problem is what "always say no" scores.',
          level: 'intermediate',
          domain: 'data',
          steps: [
            concept(
              'The majority-class baseline',
              'Fraud is 0.1% of transactions. A model that predicts "not fraud" for every single transaction is **99.9% accurate** and completely worthless.\n\nThis is the first thing to compute on any imbalanced problem: the **majority-class baseline**. If your model is not comfortably beating it on a metric that cares about the rare class, it has learned nothing.\n\nAccuracy is the wrong metric here, and so is ROC-AUC — it can look excellent on severely imbalanced data because the enormous negative class makes the false-positive rate tiny almost by default. Use **precision-recall AUC**, which ignores true negatives entirely, or fix the operating point you actually need and report precision and recall there.\n\nThe deeper issue is that the loss function does not know the classes have different costs. Cross-entropy averaged over a 1000:1 dataset is dominated by the majority class, so the gradient that would improve fraud detection is a rounding error in the update.',
              {
                figure: 'confusion-matrix',
                keyTerms: [
                  { term: 'Majority-class baseline', definition: 'The score from always predicting the most common class. The floor any model must beat.' },
                  { term: 'PR-AUC', definition: 'Area under the precision–recall curve. Unlike ROC-AUC it ignores true negatives.' },
                ],
              },
            ),
            numeric(
              'In a dataset that is 2% positive, what accuracy does a model that always predicts "negative" achieve, as a percentage?',
              98,
              ['sk-class-imbalance'],
              '98% — it is right on every negative, which is 98% of the data. Any reported accuracy below this is worse than a constant, and anything just above it is probably a constant with noise.',
              { unit: '%' },
            ),
            concept(
              'Four levers, and when each is right',
              '**Resample the data.** Oversample the minority (SMOTE and friends synthesise new minority points between existing ones) or undersample the majority. Oversampling risks overfitting the few real positives; undersampling throws away real information. Both change the base rate, so the model\'s output probabilities are no longer calibrated to reality — fine for ranking, wrong for anything that consumes the probability.\n\n**Weight the loss.** Multiply the minority class\'s contribution by its inverse frequency. One line of config, keeps every row, and in practice usually the first thing to try.\n\n**Move the threshold.** Train normally, then pick the decision threshold from the precision–recall curve at the operating point the business actually wants. Vastly underused: the model was often fine and the default 0.5 was the problem.\n\n**Reframe it.** At extreme ratios — 1 in 100,000 — stop treating it as classification. Anomaly detection models the normal class and flags departures, which needs no positive examples at all.\n\nThe order matters: check the threshold before rebuilding the dataset. It is the cheapest lever and it is right more often than it should be.',
            ),
            interactive(
              'Move the threshold, watch the trade',
              'confusion-matrix',
              'Slide the decision threshold and watch precision and recall move against each other. Then ask which errors your product can actually absorb — that question, not the curve, is what picks the point.',
            ),
            mcq(
              'A fraud model has ROC-AUC of 0.97 but catches almost nothing in production. What is the likely explanation?',
              [
                'The model is overfitting',
                'ROC-AUC flatters imbalanced problems; PR-AUC at the real operating point would look far worse',
                'The training data was too small',
                'The threshold is too low',
              ],
              1,
              ['sk-class-imbalance', 'sk-roc-pr-curves'],
              'ROC-AUC uses the false-positive *rate*, whose denominator is the huge negative class — so even thousands of false alarms barely move it. PR-AUC drops true negatives from the calculation and shows the precision you would really get, which on a 1-in-1000 problem is usually sobering.',
            ),
            categorize(
              'Sort each lever by what it changes.',
              ['Changes the training data', 'Changes the objective', 'Changes only the decision rule'],
              [
                { item: 'SMOTE oversampling of the minority class', category: 'Changes the training data' },
                { item: 'Undersampling the majority class', category: 'Changes the training data' },
                { item: 'Inverse-frequency class weights in the loss', category: 'Changes the objective' },
                { item: 'Focal loss down-weighting easy examples', category: 'Changes the objective' },
                { item: 'Picking the threshold from the PR curve', category: 'Changes only the decision rule' },
              ],
              ['sk-class-imbalance'],
              'Only the last one leaves the trained model untouched, which is why it is both the cheapest to try and the easiest to revisit when the business cost of an error changes.',
            ),
          ],
        }),

        lesson({
          id: 'lesson-leakage-in-the-wild',
          title: 'Leakage in the Wild',
          summary: 'Four ways the answer sneaks into the features, and how each is caught.',
          level: 'intermediate',
          domain: 'data',
          steps: [
            concept(
              'Leakage is information from the future or the answer',
              '**Data leakage** is any case where the model sees, at training time, information it will not have at prediction time. The symptom is always the same — validation performance that is too good — and the cause is always one of four things.\n\n**Target leakage.** A feature that is a consequence of the label. `days_in_intensive_care` predicts mortality superbly and is only populated for patients who were admitted to the ICU. In production, at the moment you need the prediction, it is empty.\n\n**Temporal leakage.** Training on rows from after the prediction point. Shuffling a time series before splitting is the classic: the model learns from Tuesday to predict Monday, which it will never get to do again.\n\n**Group leakage.** The same entity appearing in both train and test — the same patient, the same customer, the same document under a different id. The model memorises the entity rather than the pattern, and the test set applauds.\n\n**Preprocessing leakage.** Fitting the scaler, the imputer, or the feature selector on the full dataset before splitting. The training set has now been told the test set\'s mean. Subtle, common, and the reason `fit` belongs inside the fold and `transform` outside it.',
              {
                figure: 'train-val-test-split',
                keyTerms: [
                  { term: 'Target leakage', definition: 'A feature that is caused by the label rather than predictive of it.' },
                  { term: 'Group leakage', definition: 'The same entity appearing on both sides of a split.' },
                ],
              },
            ),
            categorize(
              'Sort each scenario by the kind of leakage it is.',
              ['Target leakage', 'Temporal leakage', 'Group leakage', 'Preprocessing leakage'],
              [
                { item: 'Using total_refund_amount to predict whether an order will be refunded', category: 'Target leakage' },
                { item: 'Randomly shuffling daily sales data before splitting', category: 'Temporal leakage' },
                { item: 'The same patient contributing scans to both train and test', category: 'Group leakage' },
                { item: 'Standardising all features before the train/test split', category: 'Preprocessing leakage' },
                { item: 'Selecting the top 50 features by correlation on the full dataset', category: 'Preprocessing leakage' },
              ],
              ['sk-data-leakage'],
              'The last one catches people who already know about scaler leakage: feature selection is a fit step too, and doing it on all the data leaks the test set into which columns you kept.',
            ),
            interactive(
              'Split it yourself',
              'train-test-split',
              'Resize the splits and then deliberately peek at the test set. Watch the reported score climb while the model gets no better — that gap is exactly what leakage manufactures.',
            ),
            mcq(
              'A churn model scores 0.99 AUC in validation and 0.61 in production. What should you check first?',
              [
                'Whether the model is too small',
                'Whether any feature is only populated after churn has already happened',
                'Whether the learning rate was too high',
                'Whether the production data is corrupted',
              ],
              1,
              ['sk-data-leakage'],
              'A gap that large is leakage until proven otherwise, and target leakage is the most common form. Walk each feature and ask: at the moment of prediction, would this value exist yet? Cancellation reason codes and final invoice totals are the usual culprits.',
            ),
            order(
              'Order the steps of a leakage-free cross-validation fold.',
              [
                'Split into train and validation, grouping by entity and respecting time order',
                'Fit the imputer, scaler, and feature selector on the training portion only',
                'Transform both portions with the fitted objects',
                'Train the model and score it on the untouched validation portion',
              ],
              ['sk-data-leakage', 'sk-cross-validation'],
              'Split first, always. Every `fit` happens inside the fold on training rows only; the validation portion is only ever transformed. Reverse any two of these and you have leaked.',
            ),
            shortAnswer(
              'Why is validation accuracy that seems too good to be true a signal to investigate rather than celebrate?',
              ['leakage', 'future', 'information', 'production', 'not available', 'label'],
              'Because the most common cause is leakage — the model is seeing information at training time that it will not have in production, whether from the label, from the future, from a repeated entity, or from preprocessing fitted on the whole dataset. The score is real; it is just measuring an easier problem than the one you will deploy into.',
              ['sk-data-leakage'],
              'The instinct worth building: an unexpectedly good result is a hypothesis to test, not a result to ship.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-data-3',
        title: 'Data Checkpoint',
        passingScore: 0.7,
        exercises: [
          mcq(
            'Which metric is least informative on a dataset that is 0.1% positive?',
            ['Precision at the operating threshold', 'Recall', 'Overall accuracy', 'PR-AUC'],
            2,
            ['sk-class-imbalance'],
            'Accuracy is dominated by the negative class — 99.9% is achievable by predicting "no" every time.',
          ),
          trueFalse(
            'Fitting a StandardScaler on the full dataset before splitting is a form of leakage.',
            true,
            ['sk-data-leakage'],
            'The scaler’s mean and variance carry information from the test rows into training. Fit inside the fold, transform outside it.',
          ),
          mcq(
            'What is the main risk of training successive models on their predecessors’ generated data?',
            [
              'Training becomes slower',
              'Tail diversity shrinks each generation while the output stays fluent',
              'The model loses its grammar',
              'Licences become unclear',
            ],
            1,
            ['sk-synthetic-data'],
            'Model collapse. The blandness arrives gradually and the fluency never breaks, which is what makes it hard to catch.',
          ),
        ],
      },
    },
  ],
};
