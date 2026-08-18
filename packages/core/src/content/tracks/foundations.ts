/**
 * Track 1 — AI Foundations. Free forever.
 *
 * This is the track that has to do the persuading: someone who finishes it
 * should be able to hold an informed conversation about AI and should trust
 * that the paid tracks are worth the money. So it gets the most care, not the
 * least.
 */

import type { Track } from '../../domain/types.js';
import { concept, fill, interactive, lesson, match, mcq, multi, numeric, order, shortAnswer, trueFalse } from '../builders.js';

export const foundationsTrack: Track = {
  id: 'track-foundations',
  title: 'AI Foundations',
  tagline: 'What AI actually is — and is not',
  description:
    'Start here regardless of background. By the end you will know how the pieces fit together, speak the vocabulary accurately, and be able to tell a real capability from a marketing claim.',
  domain: 'foundations',
  level: 'intro',
  icon: '🧭',
  gradient: ['#6366F1', '#8B5CF6'],
  prerequisites: [],
  outcomes: [
    'Explain the relationship between AI, machine learning, and deep learning',
    'Describe how a model learns from data',
    'Read a confusion matrix and say what the model gets wrong',
    'Recognise where AI systems fail and why',
  ],
  units: [
    // -----------------------------------------------------------------------
    {
      id: 'unit-foundations-1',
      title: 'The Landscape',
      description: 'The words everyone uses, defined precisely.',
      lessons: [
        lesson({
          id: 'lesson-what-is-ai',
          title: 'What Is AI, Really?',
          summary: 'Cut through the hype with a definition that holds up.',
          level: 'intro',
          domain: 'foundations',
          free: true,
          steps: [
            concept(
              'A working definition',
              'Artificial intelligence is the field of building systems that perform tasks which normally require human intelligence — recognising a face, translating a sentence, planning a route.\n\nThat definition has a moving target built into it. Once a task is solved, we stop calling it AI. Optical character recognition was AI in 1970; today it is just "scanning". Researchers call this the **AI effect**: AI is whatever has not been done yet.\n\nSo when someone says "this product uses AI", the useful question is never *is it AI?* It is: **what task does it perform, and how well?**',
              {
                figure: 'ai-ml-dl-venn',
                keyTerms: [
                  { term: 'Artificial intelligence', definition: 'The broad field of building systems that perform tasks requiring intelligence.' },
                  { term: 'The AI effect', definition: 'The tendency to stop calling a capability "AI" once it works reliably.' },
                ],
              },
            ),
            mcq(
              'A company advertises "AI-powered spell check". What is the most useful follow-up question?',
              [
                'Is it really AI or just an algorithm?',
                'How accurately does it catch and correct errors compared to the alternative?',
                'Does it use a neural network?',
                'How many parameters does the model have?',
              ],
              1,
              ['sk-ai-definition'],
              'The AI/not-AI line is a labelling debate, not a useful one. Capability and accuracy on the actual task are what determine whether the product is any good. Parameter counts and architecture are means, not ends.',
              'Which question would change your decision about whether to use the product?',
            ),
            concept(
              'Narrow, general, and the gap between them',
              'Every AI system in production today is **narrow**: it does one class of task. A model that plays chess at superhuman level cannot make you a sandwich, and it does not know that it cannot.\n\n**Artificial general intelligence (AGI)** — a system that transfers competence across arbitrary domains the way a person does — does not exist. Modern large language models are genuinely broader than earlier systems, which is what makes them feel different, but breadth is not generality.\n\nThe practical consequence: a system\'s performance tells you almost nothing about how it will behave one step outside what it was trained on.',
              {
                keyTerms: [
                  { term: 'Narrow AI', definition: 'A system competent at a specific task or family of tasks.' },
                  { term: 'AGI', definition: 'A hypothetical system with human-level competence across arbitrary domains.' },
                ],
              },
            ),
            trueFalse(
              'A model that scores in the top 1% of humans on a coding benchmark can be assumed to handle any programming task at that level.',
              false,
              ['sk-narrow-vs-general'],
              'Benchmark performance describes the benchmark. Real tasks differ in context length, ambiguity, tooling, and stakes — all of which can move performance sharply. This gap between benchmark and deployment is one of the most common sources of disappointment in AI projects.',
            ),
            multi(
              'Which of these are currently narrow AI systems? (Select all)',
              [
                'A model that detects tumours in chest X-rays',
                'A spam filter',
                'A chatbot that answers questions across many topics',
                'A system with human-level competence at any task you give it',
              ],
              [0, 1, 2],
              ['sk-narrow-vs-general'],
              'All three real systems are narrow, including the broad chatbot — breadth within language tasks is still not generality. The fourth describes AGI, which does not exist.',
            ),
            shortAnswer(
              'In your own words: why is "is this really AI?" usually the wrong question?',
              ['task', 'accuracy', 'definition', 'changes', 'capability'],
              'Because the definition of AI keeps shifting as capabilities become routine. What matters is which task the system performs and how accurately it performs it — that is what determines whether it is useful.',
              ['sk-ai-definition'],
              'The label is a moving target; the capability is measurable. Anchoring on task and accuracy gives you something you can actually evaluate.',
            ),
          ],
        }),

        lesson({
          id: 'lesson-ai-ml-dl',
          title: 'AI vs ML vs Deep Learning',
          summary: 'Three nested circles that people constantly conflate.',
          level: 'intro',
          domain: 'foundations',
          free: true,
          steps: [
            concept(
              'Three nested circles',
              '**Artificial intelligence** is the outer circle: any technique for making machines behave intelligently. That includes hand-written rules — a thermostat with a decision table is, technically, AI.\n\n**Machine learning** sits inside it: techniques where the system\'s behaviour is *learned from data* rather than written by a programmer. Nobody codes the rule "an email containing this phrase is spam"; the model infers it from a million labelled examples.\n\n**Deep learning** sits inside that: machine learning using neural networks with many layers. Deep learning is what made image recognition, speech, and language generation work well enough to ship.\n\nEvery deep learning system is machine learning. Every machine learning system is AI. None of those implications run backwards.',
              { figure: 'ai-ml-dl-venn' },
            ),
            mcq(
              'A rules engine approves loans using thresholds written by an analyst. What is it?',
              [
                'Deep learning',
                'Machine learning but not deep learning',
                'AI but not machine learning',
                'None of the above',
              ],
              2,
              ['sk-ai-ml-dl-relationship'],
              'The rules were written by a human, not learned from data — so it is not machine learning. It is still a system automating an intelligent decision, so it falls in the outer AI circle.',
              'Ask: where did the rules come from — a person or the data?',
            ),
            match(
              'Match each system to its innermost category.',
              [
                { left: 'Chess engine using hand-coded evaluation', right: 'AI only' },
                { left: 'Spam filter trained on labelled email', right: 'Machine learning' },
                { left: 'Image classifier with 50 layers', right: 'Deep learning' },
                { left: 'Decision tree predicting churn', right: 'Machine learning' },
              ],
              ['sk-ai-ml-dl-relationship'],
              'Learned-from-data is the machine learning test. Many-layer neural network is the deep learning test. A decision tree learns from data but is not a neural network, so it stops at machine learning.',
            ),
            fill(
              'Every deep learning system is also ___ learning, and every machine learning system is also ___.',
              [['machine'], ['ai', 'artificial intelligence']],
              ['sk-ai-ml-dl-relationship'],
              'The circles nest inward: deep learning ⊂ machine learning ⊂ AI.',
            ),
            trueFalse(
              'Deep learning is always the best choice when you have a prediction problem.',
              false,
              ['sk-ai-ml-dl-relationship'],
              'Deep learning is data-hungry and hard to interpret. On small or tabular datasets, gradient-boosted trees routinely beat neural networks while training in seconds and being far easier to debug. Pick the method that fits the data you actually have.',
            ),
          ],
        }),

        lesson({
          id: 'lesson-how-models-learn',
          title: 'How a Model Learns',
          summary: 'The loop underneath every learning system, in plain terms.',
          level: 'intro',
          domain: 'foundations',
          free: true,
          steps: [
            concept(
              'Guess, measure, adjust',
              'Nearly every machine learning system runs the same loop:\n\n1. **Guess.** The model makes a prediction from its current settings, which start out random.\n2. **Measure.** A **loss function** scores how wrong the prediction was against the true answer.\n3. **Adjust.** The settings — the **parameters** — shift slightly in the direction that would have reduced the loss.\n\nRepeat a few million times. That is training.\n\nThe surprising part is that this works at all. There is no step where anyone tells the model *what a cat looks like*. It only ever learns "these settings scored lower loss than those settings".',
              {
                figure: 'supervised-flow',
                keyTerms: [
                  { term: 'Parameters', definition: 'The internal numbers a model adjusts during training. Also called weights.' },
                  { term: 'Loss function', definition: 'A formula scoring how wrong a prediction is. Lower is better.' },
                  { term: 'Training', definition: 'Repeating guess-measure-adjust until the loss stops improving.' },
                ],
              },
            ),
            order(
              'Put one training step in order.',
              [
                'The model makes a prediction from the current parameters',
                'The loss function scores the prediction against the true label',
                'The system computes which direction each parameter should move',
                'The parameters are updated by a small step',
              ],
              ['sk-supervised-learning'],
              'Predict, score, find the direction, take a small step. Every optimizer you will meet later is a variation on step four.',
            ),
            mcq(
              'During training the loss goes *up* over several epochs. What is the most likely cause?',
              [
                'The model has finished learning',
                'The learning rate is too high, so updates overshoot',
                'There is too much training data',
                'The model is too small',
              ],
              1,
              ['sk-supervised-learning', 'sk-learning-rate'],
              'A rising loss almost always means steps that are too large — the parameters leap past the minimum and land somewhere worse each time. Lowering the learning rate is the standard first response.',
              'Think about step size when walking downhill in fog.',
            ),
            concept(
              'Why data quality dominates',
              'The model has no access to the world — only to your data. Every bias, gap, and mislabelling in that data becomes a property of the model.\n\nIf a hiring model is trained on ten years of a company\'s decisions, it learns to reproduce those decisions, including the ones that were unfair. The model is not making a moral error. It is doing exactly what it was asked: predict what this data predicts.\n\nThis is why "garbage in, garbage out" understates the problem. It is closer to **"bias in, bias at scale out"** — the model applies the pattern consistently, to everyone, forever.',
              { keyTerms: [{ term: 'Training data', definition: 'The examples a model learns from. Its entire experience of the world.' }] },
            ),
            shortAnswer(
              'A resume screener trained on past hiring decisions rejects more candidates from one demographic. Explain what went wrong.',
              ['training data', 'bias', 'past', 'pattern', 'learned'],
              'The training data encoded past hiring decisions that were themselves biased. The model learned that pattern faithfully and now applies it at scale to every applicant.',
              ['sk-algorithmic-bias', 'sk-supervised-learning'],
              'The failure is upstream of the algorithm. The model reproduced a pattern that was already in the data — and by automating it, applied it more consistently and to more people than the original human process did.',
            ),
          ],
        }),
        lesson({
          id: 'lesson-ai-history',
          title: 'How AI Got Here',
          summary: 'Two competing traditions, and why one won.',
          level: 'intro',
          domain: 'foundations',
          steps: [
            concept(
              'Seventy years in five beats',
              '**1950s–60s: founding optimism.** Turing asks whether machines can think. The Dartmouth workshop names the field. Early programs prove theorems and play checkers, and researchers predict human-level AI within a generation.\n\n**1970s: the first AI winter.** The predictions fail. Funding collapses. The problems that looked easy — vision, common sense — turn out to be the hard ones.\n\n**1980s: expert systems.** Hand-coded rules capture specialists\' knowledge. They work in narrow domains, then prove impossible to maintain as rules multiply and contradict. Second winter follows.\n\n**1990s–2000s: statistics takes over.** Cheap compute and digitised data make learned models beat hand-written ones. Chess falls in 1997 — by search and evaluation, not insight.\n\n**2012 onward: deep learning.** AlexNet wins ImageNet by a wide margin and the field converges on neural networks. Transformers arrive in 2017; scaling them produces the language models of today.\n\nThe pattern worth taking from this: **progress came from learning from data, repeatedly, at the expense of hand-encoded knowledge.**',
            ),
            concept(
              'Symbolic versus statistical',
              'Two traditions have competed throughout.\n\n**Symbolic AI** (also "good old-fashioned AI") represents knowledge as explicit symbols and rules. `IF fever AND rash THEN consider measles`. Its virtues are real: you can read the reasoning, verify it, and correct one rule without disturbing the rest.\n\nIts weakness is that the world resists enumeration. Nobody can write down the rules for recognising a cat, and hand-built rule sets become unmaintainable long before they become complete.\n\n**Statistical AI** learns patterns from data instead. It handles noise and ambiguity gracefully and scales with data rather than with human effort. Its weakness is the mirror image: the knowledge is distributed across millions of opaque parameters, so you cannot read it, verify it, or surgically correct it.\n\nStatistical methods dominate today, but the symbolic critique has not gone away — it is exactly the interpretability problem, and **neurosymbolic** approaches attempt to combine both.',
              {
                keyTerms: [
                  { term: 'Symbolic AI', definition: 'Knowledge as explicit, human-readable symbols and rules.' },
                  { term: 'Statistical AI', definition: 'Knowledge learned from data as numerical parameters.' },
                ],
              },
            ),
            match(
              'Match each property to its tradition.',
              [
                { left: 'Reasoning can be read and audited directly', right: 'Symbolic' },
                { left: 'Handles noisy, ambiguous input well', right: 'Statistical' },
                { left: 'Requires experts to hand-write rules', right: 'Symbolic' },
                { left: 'Knowledge is spread across opaque parameters', right: 'Statistical' },
              ],
              ['sk-symbolic-vs-statistical'],
              'The tradeoff is transparency against scalability. Neither side is strictly better, which is why the debate persists.',
            ),
            mcq(
              'What ended the expert-systems era of the 1980s?',
              [
                'Computers became too slow',
                'Rule bases grew unmaintainable and could not cover real-world variety',
                'The internet made them unnecessary',
                'Neural networks were proven superior mathematically',
              ],
              1,
              ['sk-ai-history'],
              'They worked in narrow domains and then broke down: rules multiplied, contradicted each other, and never covered the long tail of real cases. The maintenance burden, not the hardware, is what killed them.',
            ),
            concept(
              'Inductive bias: assumptions are not optional',
              'A model that assumes nothing learns nothing. To generalise from finite examples, every learning algorithm must bring assumptions about what patterns are plausible. Those assumptions are its **inductive bias**.\n\nExamples you have already met:\n\n- **Linear regression** assumes the relationship is a straight line.\n- **CNNs** assume nearby pixels are related and a feature means the same thing anywhere in the image.\n- **Transformers** assume very little about structure — which is why they need enormous data, and why they surpass CNNs once they have it.\n\nThis is the practical content of the **no free lunch theorem**: no learner is best across all possible problems. A strong, correct bias means learning from little data. A weak bias means needing much more but being less constrained by wrong assumptions.\n\nChoosing an architecture *is* choosing an inductive bias.',
              { keyTerms: [{ term: 'Inductive bias', definition: 'The set of assumptions a learner uses to generalise beyond its training data.' }] },
            ),
            mcq(
              'Why do vision transformers need far more training data than CNNs?',
              [
                'They have a bug',
                'Their weaker inductive bias means locality and translation structure must be learned rather than assumed',
                'They cannot use GPUs efficiently',
                'They use larger images',
              ],
              1,
              ['sk-inductive-bias'],
              'A CNN gets locality and translation equivariance for free from its architecture. A transformer must learn both from examples — which costs data, and pays off at scale by not being locked into assumptions that are sometimes wrong.',
            ),
            trueFalse(
              'A model with no inductive bias would generalise better because it makes no assumptions.',
              false,
              ['sk-inductive-bias'],
              'It would not generalise at all. With no assumptions, every pattern consistent with the training data is equally plausible, including all the useless ones. Bias is what makes learning possible; the goal is a bias that matches the problem.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-foundations-1',
        title: 'Landscape Checkpoint',
        passingScore: 0.7,
        exercises: [
          mcq(
            'Which statement is accurate?',
            [
              'All AI is machine learning',
              'All machine learning is deep learning',
              'All deep learning is machine learning',
              'Machine learning and AI are synonyms',
            ],
            2,
            ['sk-ai-ml-dl-relationship'],
            'The circles nest inward: deep learning ⊂ machine learning ⊂ AI. Only the third statement runs in the correct direction.',
          ),
          trueFalse(
            'A model trained only on data from one hospital can be assumed to work at another.',
            false,
            ['sk-supervised-learning'],
            'Different equipment, populations, and labelling conventions all shift the data distribution. This failure — distribution shift — is one of the most common reasons clinical AI underperforms after deployment.',
          ),
          mcq(
            'What does a loss function do?',
            [
              'Removes bad training examples',
              'Scores how wrong a prediction is',
              'Decides the model architecture',
              'Compresses the model for deployment',
            ],
            1,
            ['sk-loss-functions'],
            'The loss is the single number training tries to minimise. Everything else in the loop exists to reduce it.',
          ),
          multi(
            'Which are learned from data rather than written by a programmer? (Select all)',
            [
              'The weights of a neural network',
              'The learning rate',
              'The split points in a trained decision tree',
              'The number of layers in the network',
            ],
            [0, 2],
            ['sk-supervised-learning'],
            'Weights and tree split points are learned. The learning rate and layer count are **hyperparameters** — chosen by the practitioner before training starts.',
          ),
        ],
      },
    },

    // -----------------------------------------------------------------------
    {
      id: 'unit-foundations-2',
      title: 'Learning From Data',
      description: 'Supervised, unsupervised, and how to know if it worked.',
      lessons: [
        lesson({
          id: 'lesson-supervised-unsupervised',
          title: 'Supervised vs Unsupervised',
          summary: 'The difference is whether anyone wrote down the answers.',
          level: 'intro',
          domain: 'machine-learning',
          steps: [
            concept(
              'With answers, or without',
              '**Supervised learning** trains on examples paired with correct answers. Ten thousand photos, each labelled *cat* or *dog*. The model learns the mapping from input to label.\n\n**Unsupervised learning** trains on data with no answers attached. The model finds structure on its own — grouping customers who behave similarly, or compressing data into fewer dimensions.\n\nA third mode matters enormously in practice: **self-supervised learning**, where the labels are generated from the data itself. Hide a word in a sentence and ask the model to predict it, and suddenly the entire internet is labelled training data with no human annotation at all. This is how large language models are trained.',
              {
                keyTerms: [
                  { term: 'Label', definition: 'The correct answer attached to a training example.' },
                  { term: 'Self-supervised', definition: 'Labels derived automatically from the data, e.g. predicting a hidden word.' },
                ],
              },
            ),
            match(
              'Match each task to its learning type.',
              [
                { left: 'Predict house price from labelled sales', right: 'Supervised' },
                { left: 'Group shoppers into segments, no labels', right: 'Unsupervised' },
                { left: 'Predict the next word in a sentence', right: 'Self-supervised' },
                { left: 'Detect fraud from labelled transactions', right: 'Supervised' },
              ],
              ['sk-supervised-learning', 'sk-unsupervised-learning'],
              'The test is where the target comes from: a human annotator (supervised), nowhere (unsupervised), or the data itself (self-supervised).',
            ),
            mcq(
              'Why is self-supervised learning so important for language models?',
              [
                'It needs less compute than supervised learning',
                'It turns unlabelled text into training data without human annotation',
                'It always produces more accurate models',
                'It removes the need for a loss function',
              ],
              1,
              ['sk-supervised-learning', 'sk-language-modeling'],
              'Human labelling is the bottleneck in supervised learning — it is slow and expensive. Self-supervision generates its targets from raw text, which is what makes training on trillions of tokens feasible.',
            ),
            concept(
              'Classification or regression?',
              'Within supervised learning, the output type splits the problem in two.\n\n**Classification** predicts a category: spam or not, which of ten digits, which of a thousand object classes. Output is discrete.\n\n**Regression** predicts a number on a continuous scale: price, temperature, time-to-failure. Output is continuous.\n\nThe distinction drives everything downstream — which loss function you use, which metrics mean anything, and what a "good" model even looks like. Accuracy is meaningless for regression; mean squared error is meaningless for classification.',
            ),
            multi(
              'Which of these are regression problems? (Select all)',
              [
                'Predicting tomorrow\'s temperature',
                'Deciding if a transaction is fraudulent',
                'Estimating how many days until a machine fails',
                'Identifying which language a document is written in',
              ],
              [0, 2],
              ['sk-classification-regression'],
              'Temperature and days-to-failure are continuous numbers — regression. Fraud (yes/no) and language identification (one of N) are categories — classification.',
            ),
          ],
        }),

        lesson({
          id: 'lesson-train-test-split',
          title: 'Why You Hold Data Back',
          summary: 'The single most important discipline in applied ML.',
          level: 'intro',
          domain: 'data',
          steps: [
            concept(
              'Testing on what you studied',
              'If you evaluate a model on the same data it trained on, you learn nothing. A model with enough capacity can memorise every training example and score 100% — while being useless on anything new.\n\nSo the data gets split three ways:\n\n- **Training set** (~70%): the model learns from this.\n- **Validation set** (~15%): used to tune choices like model size and learning rate.\n- **Test set** (~15%): touched **once**, at the very end, to estimate real-world performance.\n\nThe test set is not a scoreboard to iterate against. Every time you look at it and change something, you leak a little of it into your decisions, and your estimate gets optimistic.',
              {
                figure: 'train-val-test-split',
                keyTerms: [
                  { term: 'Validation set', definition: 'Held-out data used to compare model variants and tune hyperparameters.' },
                  { term: 'Test set', definition: 'Held-out data used once for a final unbiased performance estimate.' },
                ],
              },
            ),
            interactive(
              'Split the data yourself',
              'train-test-split',
              'Drag the split boundaries and watch the three sets resize. Then switch on "reuse the test set" and watch the reported score drift optimistically upward with every peek.',
            ),
            mcq(
              'A team tries 200 architectures, picks the best on the test set, and reports its score. What is wrong?',
              [
                'Nothing — picking the best model is correct',
                'The reported score is optimistic; the test set was used for selection, so it is really a validation set',
                'They should have used more architectures',
                'The training set was too small',
              ],
              1,
              ['sk-train-val-test'],
              'Selecting on the test set turns it into a validation set. With 200 tries, the winner is partly lucky on that specific sample, and the reported number will not hold up. Selection belongs on validation; the test set gets touched once.',
              'What happens if you pick the best of 200 coin-flippers and report their observed win rate?',
            ),
            concept(
              'Leakage: the bug that looks like success',
              '**Data leakage** is when information that would not exist at prediction time sneaks into training. It produces spectacular validation scores and a model that collapses in production.\n\nCommon forms:\n\n- **Target leakage.** A feature that is a consequence of the label. Predicting hospital readmission using a "discharge medication changed" flag that is only set after readmission is decided.\n- **Temporal leakage.** Random-splitting time series, so the model trains on the future and predicts the past.\n- **Group leakage.** The same patient appearing in both train and test with different scans. The model recognises the patient, not the disease.\n\nRule of thumb: **a suspiciously good result is a bug report until proven otherwise.**',
            ),
            mcq(
              'A model predicting customer churn scores 99.7% accuracy. Which feature is most likely leaking?',
              [
                'Months since signup',
                'Number of support tickets',
                'Account cancellation reason code',
                'Monthly spend',
              ],
              2,
              ['sk-data-leakage'],
              'A cancellation reason only exists once the customer has already churned. It is a consequence of the label, not a predictor of it — classic target leakage.',
            ),
            trueFalse(
              'For time-series forecasting, a random train/test split is appropriate.',
              false,
              ['sk-data-leakage', 'sk-train-val-test'],
              'Random splitting lets the model train on future data and predict the past, which is impossible at deployment. Time series require a chronological split: train on the earlier period, test on the later one.',
            ),
            numeric(
              'You have 20,000 labelled examples and use a 70/15/15 split. How many go in the test set?',
              3000,
              ['sk-train-val-test'],
              '15% of 20,000 is 3,000. Enough to give a stable estimate — with only a few hundred test examples, your accuracy estimate carries several points of noise.',
              { hint: 'Fifteen percent of twenty thousand.' },
            ),
          ],
        }),

        lesson({
          id: 'lesson-overfitting',
          title: 'Overfitting: Memorising vs Learning',
          summary: 'The failure mode you will meet in every project.',
          level: 'intro',
          domain: 'machine-learning',
          steps: [
            concept(
              'The student who memorised the answer key',
              'Two ways to fail an exam. **Underfitting** is not having studied — the model is too simple to capture the pattern, and it does badly on training *and* test data.\n\n**Overfitting** is memorising last year\'s answer key. Perfect on the training set, poor on anything new. The model has latched onto noise and coincidence specific to the examples it saw.\n\nYou diagnose it by watching two curves. Training loss falls steadily. Validation loss falls, bottoms out, then starts **rising** — and that turning point is where the model stopped learning the signal and began memorising the sample.',
              {
                figure: 'overfitting-curves',
                keyTerms: [
                  { term: 'Overfitting', definition: 'Fitting noise in the training data; good on train, bad on new data.' },
                  { term: 'Underfitting', definition: 'Model too simple to capture the pattern; bad on both.' },
                  { term: 'Generalization', definition: 'Performance on data the model has never seen. The only thing that counts.' },
                ],
              },
            ),
            mcq(
              'Training accuracy 99%, validation accuracy 71%. What is happening?',
              ['Underfitting', 'Overfitting', 'Data leakage', 'The learning rate is too low'],
              1,
              ['sk-overfitting'],
              'A large gap between training and validation performance is the signature of overfitting. Underfitting would show both numbers low; leakage typically shows both suspiciously high.',
            ),
            multi(
              'Which of these reduce overfitting? (Select all)',
              [
                'Collecting more training data',
                'Adding more layers and parameters',
                'Regularization such as L2 or dropout',
                'Stopping training when validation loss bottoms out',
              ],
              [0, 2, 3],
              ['sk-overfitting', 'sk-regularization'],
              'More data, regularization, and early stopping all constrain the model or give it more signal to fit. Adding capacity does the opposite — it makes memorisation easier.',
            ),
            interactive(
              'Watch it happen',
              'bias-variance',
              'Drag the model-complexity slider. Notice that training error falls monotonically while validation error is U-shaped — the bottom of that U is the model you want to ship.',
            ),
            concept(
              'Bias and variance',
              'The formal framing: prediction error decomposes into three parts.\n\n**Bias** — error from wrong assumptions. Fitting a straight line to a curve. High bias means underfitting.\n\n**Variance** — error from sensitivity to the particular training sample. Retrain on a slightly different dataset and get a wildly different model. High variance means overfitting.\n\n**Irreducible error** — genuine noise. No model removes it.\n\nSimple models sit high-bias, low-variance. Complex models sit low-bias, high-variance. Classically you trade one against the other — although very large modern networks complicate this picture, which is a story for the deep learning track.',
            ),
            match(
              'Match each symptom to its cause.',
              [
                { left: 'Poor on training and test data', right: 'High bias (underfitting)' },
                { left: 'Great on training, poor on test', right: 'High variance (overfitting)' },
                { left: 'Retraining gives very different models', right: 'High variance' },
                { left: 'Straight line fitted to curved data', right: 'High bias' },
              ],
              ['sk-bias-variance'],
              'Bias is systematic wrongness — consistently off in the same way. Variance is instability — the model changes character with the sample.',
            ),
          ],
        }),

        lesson({
          id: 'lesson-metrics',
          title: 'Accuracy Lies',
          summary: 'Why 99% accuracy can be a worthless model.',
          level: 'intro',
          domain: 'machine-learning',
          steps: [
            concept(
              'The 99% trap',
              'One in a thousand transactions is fraudulent. A model that predicts "not fraud" every single time is **99.9% accurate** and catches zero fraud.\n\nAccuracy is the fraction of predictions that are correct. On imbalanced data — which is most data worth modelling — it is dominated by the majority class and tells you nothing.\n\nWhat you need instead is to distinguish the *kinds* of mistake, because they have wildly different costs.',
              { figure: 'confusion-matrix' },
            ),
            concept(
              'The confusion matrix',
              'Every binary prediction lands in one of four boxes:\n\n- **True positive (TP)** — fraud, flagged. Correct.\n- **False positive (FP)** — legitimate, flagged. A false alarm.\n- **False negative (FN)** — fraud, missed. The expensive one.\n- **True negative (TN)** — legitimate, not flagged. Correct.\n\nFrom those four numbers:\n\n**Precision = TP / (TP + FP)** — of everything you flagged, how much was real? Precision answers *can I trust an alarm?*\n\n**Recall = TP / (TP + FN)** — of everything real, how much did you catch? Recall answers *how much am I missing?*\n\n**F1** is their harmonic mean, for when you need one number.',
              {
                keyTerms: [
                  { term: 'Precision', definition: 'Of the items flagged, the fraction that were genuinely positive.' },
                  { term: 'Recall', definition: 'Of the genuinely positive items, the fraction that were flagged.' },
                  { term: 'F1 score', definition: 'Harmonic mean of precision and recall.' },
                ],
              },
            ),
            interactive(
              'Move the threshold',
              'confusion-matrix',
              'Slide the decision threshold and watch precision and recall trade against each other. There is no setting that maximises both — choosing between them is a product decision, not a technical one.',
            ),
            numeric(
              'A model flags 200 transactions. 150 are truly fraudulent. What is its precision, as a percentage?',
              75,
              ['sk-classification-metrics'],
              'Precision = TP / (TP + FP) = 150 / 200 = 0.75. Three out of four alarms are real.',
              { unit: '%', hint: 'Of everything flagged, how much was genuinely positive?' },
            ),
            numeric(
              'There were 300 fraudulent transactions in total and the model caught 150. What is its recall, as a percentage?',
              50,
              ['sk-classification-metrics'],
              'Recall = TP / (TP + FN) = 150 / 300 = 0.5. Half the fraud went through undetected — the same model that looked strong on precision.',
              { unit: '%' },
            ),
            mcq(
              'A cancer screening test will be followed by a cheap confirmatory biopsy. Which do you optimise?',
              [
                'Precision — false alarms are costly',
                'Recall — a missed cancer is far worse than an extra biopsy',
                'Accuracy — it balances both',
                'It makes no difference',
              ],
              1,
              ['sk-classification-metrics'],
              'When the follow-up is cheap and the miss is catastrophic, you buy recall with false positives. Reverse the costs — say the follow-up is invasive surgery — and you would favour precision instead. The metric follows from the consequences.',
            ),
            shortAnswer(
              'Explain why a 99.9% accurate fraud detector might be worthless.',
              ['imbalance', 'majority', 'recall', 'rare', 'always predict'],
              'If fraud is 0.1% of transactions, always predicting "not fraud" scores 99.9% accuracy while catching nothing. On imbalanced data the majority class dominates accuracy, so recall on the rare class is the number that matters.',
              ['sk-classification-metrics'],
              'Class imbalance breaks accuracy as a metric. Always check the base rate before trusting an accuracy figure.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-foundations-2',
        title: 'Learning From Data Checkpoint',
        passingScore: 0.7,
        exercises: [
          mcq(
            'Validation loss has been rising for 5 epochs while training loss falls. What should you do?',
            [
              'Train longer',
              'Stop training and take the earlier checkpoint',
              'Increase the learning rate',
              'Add more layers',
            ],
            1,
            ['sk-overfitting'],
            'That divergence is overfitting. Early stopping — reverting to the checkpoint at the validation minimum — is the direct fix.',
          ),
          numeric(
            'TP = 40, FP = 10, FN = 50, TN = 900. What is the recall, as a percentage?',
            44.4,
            ['sk-classification-metrics'],
            'Recall = 40 / (40 + 50) = 0.444. The model misses more positives than it catches, despite a precision of 80%.',
            { tolerance: 0.5, unit: '%' },
          ),
          mcq(
            'Which is an example of data leakage?',
            [
              'Using 80% of data for training',
              'Normalising features using statistics computed over the full dataset before splitting',
              'Using a validation set to tune the learning rate',
              'Training for many epochs',
            ],
            1,
            ['sk-data-leakage'],
            'Computing the mean and standard deviation over all the data before splitting lets test-set information influence training. Fit the scaler on the training split only, then apply it to the others.',
          ),
          trueFalse(
            'Unsupervised learning requires labelled examples.',
            false,
            ['sk-unsupervised-learning'],
            'Unsupervised learning finds structure in unlabelled data — that is exactly what makes it unsupervised.',
          ),
        ],
      },
    },

    // -----------------------------------------------------------------------
    {
      id: 'unit-foundations-3',
      title: 'Where AI Breaks',
      description: 'Bias, opacity, and the limits worth knowing before you deploy anything.',
      lessons: [
        lesson({
          id: 'lesson-bias-fairness',
          title: 'Bias Is Not a Bug',
          summary: 'How unfair models get built by well-meaning teams.',
          level: 'intro',
          domain: 'ethics-safety',
          steps: [
            concept(
              'Where bias enters',
              'Bias rarely enters through a malicious line of code. It enters through ordinary decisions:\n\n**Historical bias.** The data faithfully records an unjust world. Recruiting data from an industry that hired mostly men teaches the model that pattern.\n\n**Representation bias.** Some groups are thin in the data. Early face recognition was trained on overwhelmingly light-skinned faces and performed dramatically worse on dark-skinned women — error rates differing by more than an order of magnitude.\n\n**Measurement bias.** The proxy you can measure is not the thing you care about. Healthcare algorithms have used *cost of care* as a proxy for *severity of illness*; because less money had historically been spent on Black patients, the model systematically underestimated their needs.\n\n**Aggregation bias.** One model for populations that genuinely differ, fitting the majority and failing the rest.',
            ),
            interactive(
              'Watch bias enter through the data',
              'data-bias',
              'Skew the training sample away from one group and watch per-group accuracy diverge — with no change to the algorithm at all. Then rebalance and watch the gap close.',
            ),
            mcq(
              'A model uses healthcare spending as a proxy for illness severity and under-serves a group. Which bias is this?',
              ['Representation bias', 'Measurement bias', 'Aggregation bias', 'No bias — the data was accurate'],
              1,
              ['sk-algorithmic-bias'],
              'The proxy (spending) does not faithfully measure the target (illness). Spending reflects access to care as much as need, so the proxy encodes existing inequity. This is a real documented case affecting millions of patients.',
            ),
            concept(
              'Fairness definitions conflict — provably',
              'There is no single "make it fair" switch, and this is a mathematical result rather than an engineering gap.\n\n- **Demographic parity** — equal positive rates across groups.\n- **Equal opportunity** — equal true-positive rates across groups.\n- **Predictive parity** — a given score means the same thing in every group.\n\nWhen base rates genuinely differ between groups, **you cannot satisfy all three at once**. This is an impossibility theorem, not a matter of trying harder.\n\nSo fairness is not something you verify at the end. It is a choice about which harm you are least willing to cause, made early, in the open, with the people affected.',
            ),
            multi(
              'A team removes race from the model\'s features. What remains true? (Select all)',
              [
                'The model can still be racially biased through correlated features like postcode',
                'Removing the attribute makes measuring bias harder',
                'The model is now guaranteed fair',
                'Correlated proxies can reconstruct the removed attribute',
              ],
              [0, 1, 3],
              ['sk-algorithmic-bias', 'sk-fairness-metrics'],
              '"Fairness through unawareness" does not work. Postcode, name, and school all carry the signal. Worse, removing the attribute leaves you unable to *audit* for disparate impact — you often need to collect it precisely so you can measure whether you are causing harm.',
            ),
            shortAnswer(
              'Why can removing a protected attribute fail to make a model fair?',
              ['proxy', 'correlated', 'reconstruct', 'postcode', 'audit'],
              'Other features correlate with the protected attribute and act as proxies — postcode, name, school — so the model reconstructs it indirectly. Removing it also makes bias harder to audit.',
              ['sk-algorithmic-bias'],
              'Real datasets are dense with proxies. Fairness needs measurement and intervention, not deletion.',
            ),
          ],
        }),

        lesson({
          id: 'lesson-limits',
          title: 'What AI Cannot Do',
          summary: 'The failure modes that survive every capability jump.',
          level: 'intro',
          domain: 'foundations',
          steps: [
            concept(
              'Correlation is all it has',
              'A model learns statistical association. It has no notion of cause.\n\nA classic result: a model predicting pneumonia mortality learned that **asthma patients had lower risk**, and would have recommended sending them home. The correlation was real — asthmatics were rushed to intensive care, so they survived more often. The model saw the association and drew exactly the wrong conclusion for action.\n\nAnything that changes when you *intervene* is beyond a purely correlational model. Which is most decisions worth automating.',
            ),
            mcq(
              'The pneumonia model learned asthma predicts lower mortality. Why is acting on this dangerous?',
              [
                'The correlation was a data error',
                'The correlation exists because asthmatics got aggressive treatment — acting on it removes the cause of the effect',
                'The model was overfitting',
                'Asthma is rare',
              ],
              1,
              ['sk-supervised-learning'],
              'The association held only *because* of an intervention that the model was blind to. Acting on the prediction would destroy the very mechanism producing it. Correlational models cannot see this.',
            ),
            concept(
              'Distribution shift',
              'Models assume the future resembles the training data. When it stops resembling it, performance decays — often silently.\n\n**Covariate shift** — the inputs change. A camera is replaced; lighting differs.\n\n**Concept drift** — the relationship changes. Fraud patterns evolve specifically because fraudsters adapt to your detector.\n\n**Feedback loops** — the model changes the world it predicts. Predictive policing sends officers to a neighbourhood, which produces more recorded crime there, which confirms the model. The loop is self-fulfilling and looks like accuracy.\n\nNone of these are caught by a test set drawn from the same period as training. They need production monitoring.',
            ),
            match(
              'Match each scenario to its failure mode.',
              [
                { left: 'Fraudsters adapt to evade the detector', right: 'Concept drift' },
                { left: 'A new phone camera changes image quality', right: 'Covariate shift' },
                { left: 'Policing model sends patrols, generating more arrests there', right: 'Feedback loop' },
                { left: 'Model trained pre-pandemic on shopping data', right: 'Concept drift' },
              ],
              ['sk-model-monitoring'],
              'Covariate shift is a change in inputs; concept drift is a change in the input-output relationship; feedback loops are the model altering the world it measures.',
            ),
            concept(
              'Confidence is not correctness',
              'Neural networks are famously **overconfident**. A classifier will assign 99% probability to a class for an input completely unlike anything it was trained on — because nothing in the training objective rewards it for saying "I have never seen this".\n\nSame for language models: fluency and confidence are properties of the generated text, not evidence about its truth. A confidently stated false citation is the single most common way LLM output causes real harm.\n\n**Calibration** — making a stated 70% actually correspond to being right 70% of the time — is a separate engineering task, and most deployed systems skip it.',
            ),
            trueFalse(
              'A language model that states an answer confidently and fluently is more likely to be correct.',
              false,
              ['sk-hallucination'],
              'Fluency and confidence are properties of the text, not evidence about the world. Models generate equally fluent text for correct and fabricated claims — which is exactly what makes fabrications hard to spot.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-foundations-3',
        title: 'Limits Checkpoint',
        passingScore: 0.7,
        exercises: [
          mcq(
            'A deployed model degrades over six months with no code change. Most likely cause?',
            ['The code has a bug', 'Distribution shift', 'The test set was too small', 'Overfitting'],
            1,
            ['sk-model-monitoring'],
            'Static code plus decaying performance means the world moved. That is distribution shift, and it is why production monitoring is not optional.',
          ),
          multi(
            'Which claims about fairness are accurate? (Select all)',
            [
              'Several common fairness definitions cannot be satisfied simultaneously when base rates differ',
              'Deleting the protected attribute guarantees fairness',
              'Fairness requires choosing which harm matters most',
              'Bias usually enters through the data and problem framing, not malicious code',
            ],
            [0, 2, 3],
            ['sk-fairness-metrics', 'sk-algorithmic-bias'],
            'The impossibility result is real, the choice is unavoidable, and the entry point is almost always data and framing. Only "deletion guarantees fairness" is false — proxies reconstruct the attribute.',
          ),
          trueFalse(
            'A model with 95% test accuracy will have roughly 95% accuracy in production.',
            false,
            ['sk-model-monitoring'],
            'Only if production data matches the test distribution. Shift, leakage, and feedback loops routinely open a large gap between the two.',
          ),
        ],
      },
    },
  ],
};
