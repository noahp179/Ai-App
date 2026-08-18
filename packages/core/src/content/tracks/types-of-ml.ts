/**
 * Track — Types of Machine Learning.
 *
 * The map of the territory. Most people meet machine learning as a pile of
 * algorithm names with no organising structure, and then cannot tell which one
 * their problem needs. This track builds the taxonomy first: what kind of
 * feedback the model gets, when it learns, and what it keeps.
 *
 * Heavily interactive by design — a taxonomy learned by sorting real scenarios
 * sticks in a way that a table of definitions does not.
 */

import type { Track } from '../../domain/types.js';
import { categorize, concept, fill, interactive, lesson, match, mcq, multi, numeric, order, shortAnswer, trueFalse } from '../builders.js';

export const typesOfMlTrack: Track = {
  id: 'track-types-of-ml',
  title: 'Types of Machine Learning',
  tagline: 'The map before the territory',
  description:
    'Every ML method answers three questions: what feedback does it get, when does it learn, and what does it keep? Learn the taxonomy and you can place any new technique the first time you meet it.',
  domain: 'machine-learning',
  level: 'intro',
  icon: '🗺️',
  gradient: ['#06B6D4', '#3B82F6'],
  prerequisites: ['track-foundations'],
  outcomes: [
    'Classify any ML problem into the right learning paradigm',
    'Explain supervised, unsupervised, semi-supervised, self-supervised, and reinforcement learning',
    'Choose between online and batch learning for a real system',
    'Recognise anomaly detection, recommenders, ranking, and forecasting as problem shapes',
  ],
  units: [
    // =======================================================================
    {
      id: 'unit-tml-1',
      title: 'The Four Paradigms',
      description: 'Sorted by one question: what feedback does the model get?',
      lessons: [
        lesson({
          id: 'lesson-four-paradigms',
          title: 'The Four Paradigms',
          summary: 'One question organises the entire field.',
          level: 'intro',
          domain: 'machine-learning',
          free: true,
          steps: [
            concept(
              'One question sorts everything',
              'Machine learning looks like a hundred unrelated algorithms until you notice they answer one question differently:\n\n**What feedback does the model get?**\n\n**Supervised** — every example comes with the right answer. "This email is spam." The model learns the mapping from input to answer.\n\n**Unsupervised** — no answers at all. The model finds structure on its own: which customers behave alike, which transactions look unusual.\n\n**Reinforcement** — no answers, but a *reward signal* after acting. Not "this move was correct" but "you eventually won". The model must work out which of its hundred moves deserved the credit.\n\n**Self-supervised** — the answers are generated from the data itself. Hide a word in a sentence and predict it. No human labels a thing, and suddenly the entire internet is training data.\n\nThat fourth one is why the last decade happened. Human labelling was the bottleneck for thirty years; self-supervision removed it.',
              {
                figure: 'ml-paradigms',
                keyTerms: [
                  { term: 'Label', definition: 'The correct answer attached to a training example.' },
                  { term: 'Reward', definition: 'A scalar score after an action, with no indication of what the right action was.' },
                  { term: 'Pretext task', definition: 'An artificial task used to generate labels from unlabelled data.' },
                ],
              },
            ),

            interactive(
              'Sort real problems',
              'ml-type-sorter',
              'Twelve real scenarios. Drag each into the paradigm it belongs to. Some are genuinely ambiguous — the feedback tells you why, and the ambiguity is the point.',
            ),

            categorize(
              'Sort each scenario into its learning paradigm.',
              ['Supervised', 'Unsupervised', 'Reinforcement', 'Self-supervised'],
              [
                { item: 'Predict house price from 50,000 past sales', category: 'Supervised' },
                { item: 'Group 2M customers into behavioural segments', category: 'Unsupervised' },
                { item: 'Teach a robot to walk by rewarding distance travelled', category: 'Reinforcement' },
                { item: 'Predict the next word across a trillion tokens of text', category: 'Self-supervised' },
                { item: 'Flag fraudulent transactions from labelled fraud cases', category: 'Supervised' },
                { item: 'Find unusual server logs with no examples of "unusual"', category: 'Unsupervised' },
                { item: 'Learn chess by playing millions of games against itself', category: 'Reinforcement' },
                { item: 'Reconstruct a masked patch of an image', category: 'Self-supervised' },
              ],
              ['sk-ml-paradigms'],
              'The test is always where the training signal comes from: a human annotator (supervised), nowhere (unsupervised), the consequences of acting (reinforcement), or the data itself (self-supervised).',
              'Ask: who or what tells the model it was right?',
            ),

            concept(
              'Why the boundaries blur',
              'Real systems mix paradigms constantly, and that is a feature of the taxonomy rather than a flaw in it.\n\nA modern language assistant uses **all four**:\n\n1. **Self-supervised** pretraining on next-token prediction — where essentially all the knowledge comes from.\n2. **Supervised** fine-tuning on human-written instruction/response pairs — where it learns the format of being helpful.\n3. **Reinforcement** learning from human preferences — where it learns which of two good answers is better.\n4. **Unsupervised** clustering behind the scenes, for deduplicating training data.\n\nSo "which paradigm is this?" is often the wrong question at system level. The right one is **"which paradigm is this *stage*?"** Every training stage has exactly one answer, and knowing which tells you what data you need and what can go wrong.',
            ),

            mcq(
              'A team has 3 million images and the budget to label 5,000. Which paradigm should shape their approach?',
              [
                'Purely supervised on the 5,000 labelled images',
                'Self-supervised pretraining on all 3M, then supervised fine-tuning on the 5,000',
                'Reinforcement learning',
                'They cannot train anything useful',
              ],
              1,
              ['sk-ml-paradigms', 'sk-self-supervised'],
              'This is the defining pattern of modern ML. Self-supervision extracts structure from all 3M images without labels; the 5,000 labels then only have to teach the specific task, not visual understanding from scratch. Training only on 5,000 images wastes 99.8% of the data.',
            ),

            trueFalse(
              'Reinforcement learning is told the correct action after each step.',
              false,
              ['sk-ml-paradigms'],
              'It receives a reward, not a correction. "You scored 3 points" does not say which of your actions earned them — untangling that is the credit assignment problem, and it is what makes RL fundamentally harder than supervised learning.',
            ),

            shortAnswer(
              'Explain why self-supervised learning changed what was possible in AI.',
              ['labels', 'human', 'unlabelled', 'scale', 'bottleneck'],
              'Supervised learning needs human-labelled examples, and human labelling is slow and expensive — it was the bottleneck on scale. Self-supervision generates its training signal from the raw data itself, so unlabelled text and images become usable at internet scale with no annotation.',
              ['sk-self-supervised'],
              'The constraint was never compute or algorithms alone. It was labelled data, and self-supervision removed that ceiling.',
            ),
          ],
        }),

        lesson({
          id: 'lesson-supervised-deep',
          title: 'Supervised Learning in Depth',
          summary: 'The workhorse — and the two shapes it comes in.',
          level: 'intro',
          domain: 'machine-learning',
          free: true,
          steps: [
            concept(
              'Learning a mapping',
              'Supervised learning learns a function from inputs to outputs, using examples where both are known.\n\nThe entire setup is three things:\n\n- **X** — the features. What the model sees.\n- **y** — the labels. What it should output.\n- **f** — the function it learns, so that `f(X) ≈ y` on data it has never seen.\n\nThat last clause is the whole difficulty. Memorising the training pairs is trivial and worthless. The goal is a function that **generalises**.\n\nWithin supervised learning, the *type* of y splits everything in two, and that split determines your loss function, your metrics, and what a good model even looks like.',
              { figure: 'supervised-flow' },
            ),

            concept(
              'Classification vs regression',
              '**Classification** predicts a category. Output is discrete.\n\n- *Binary* — spam / not spam.\n- *Multi-class* — which of ten digits. Exactly one answer.\n- *Multi-label* — which tags apply to this article. Any number of answers, and this is genuinely different: you predict each label independently rather than picking one.\n\n**Regression** predicts a number on a continuous scale. Price, temperature, days until failure.\n\nThe distinction is not academic. Accuracy is meaningless for regression; mean squared error is meaningless for classification. Get the shape wrong and every downstream choice is wrong with it.\n\nA trap worth naming: **ordinal** targets — a 1-to-5 star rating — are neither cleanly. Treat them as classification and you throw away the ordering (predicting 1 when the truth is 5 scores the same as predicting 4). Treat them as regression and you predict 3.7 stars, which does not exist. Ordinal regression exists precisely for this.',
              {
                keyTerms: [
                  { term: 'Multi-label', definition: 'Several labels can apply at once; each is predicted independently.' },
                  { term: 'Ordinal', definition: 'Ordered categories, where the distance between them is not meaningful.' },
                ],
              },
            ),

            categorize(
              'Sort each target into its supervised problem type.',
              ['Binary classification', 'Multi-class', 'Multi-label', 'Regression'],
              [
                { item: 'Will this customer churn?', category: 'Binary classification' },
                { item: 'Which of 200 dog breeds is in this photo?', category: 'Multi-class' },
                { item: 'Which topics does this article cover?', category: 'Multi-label' },
                { item: 'How many units will we sell next month?', category: 'Regression' },
                { item: 'Is this transaction fraudulent?', category: 'Binary classification' },
                { item: 'What is this house worth?', category: 'Regression' },
                { item: 'Which allergens are in this recipe?', category: 'Multi-label' },
                { item: 'Which language is this text?', category: 'Multi-class' },
              ],
              ['sk-classification-regression'],
              'Multi-class picks exactly one from N. Multi-label picks any subset — an article can be about both politics and economics, and a recipe can contain both nuts and dairy.',
            ),

            interactive(
              'Fit a line by hand',
              'linear-regression',
              'Drag the slope and intercept to fit the points, and watch mean squared error update live. Then hit "solve" to see the least-squares optimum — and notice how much one outlier drags the fitted line.',
            ),

            mcq(
              'You are predicting a 1–5 star rating. Why is plain multi-class classification a poor fit?',
              [
                'It is too slow to train',
                'It discards the ordering — predicting 1 when the truth is 5 is penalised the same as predicting 4',
                'It cannot handle five classes',
                'Ratings are not supervised learning',
              ],
              1,
              ['sk-classification-regression'],
              'Multi-class treats the five stars as unrelated labels. A model that is "off by one" should be scored far better than one that is off by four, and only an ordinal-aware setup captures that.',
            ),

            numeric(
              'A model predicts [4, 7] where the truth is [5, 3]. What is the mean squared error?',
              8.5,
              ['sk-loss-functions'],
              'Errors are −1 and +4. Squared: 1 and 16. Mean: 17/2 = 8.5. Notice the error of 4 contributes sixteen times what the error of 1 does — squaring makes MSE very sensitive to large misses.',
              { tolerance: 0.01, hint: 'Square each error, then average.' },
            ),
          ],
        }),

        lesson({
          id: 'lesson-unsupervised-deep',
          title: 'Unsupervised Learning in Depth',
          summary: 'Finding structure when nobody wrote down the answers.',
          level: 'intermediate',
          domain: 'machine-learning',
          steps: [
            concept(
              'Four things you can do without labels',
              'Unsupervised learning is not one task. It is four distinct jobs that happen to share the property of having no labels.\n\n**Clustering.** Group similar things. Customer segments, document topics, gene expression profiles.\n\n**Dimensionality reduction.** Compress many features into few while keeping what matters. PCA, t-SNE, UMAP, autoencoders.\n\n**Density estimation.** Model where the data lives, so you can ask "how likely is this point?" — the foundation of anomaly detection.\n\n**Association rules.** Find things that co-occur. "People who bought X also bought Y."\n\nThe hard part all four share: **there is no ground truth to check against.** With supervised learning you have a test set and a number. Here, evaluating whether the answer is good is often as hard as producing it, and usually requires a human who knows the domain to look at it.',
            ),

            interactive(
              'Run k-means yourself',
              'kmeans',
              'Tap the canvas to place points, choose k, and step through the algorithm one iteration at a time. Watch centroids move to the mean of their assignments. Then re-initialise a few times and notice you do not always get the same answer — k-means finds a local optimum, not the global one.',
            ),

            order(
              'Order one iteration of k-means.',
              [
                'Place k initial centroids',
                'Assign every point to its nearest centroid',
                'Move each centroid to the mean of the points assigned to it',
                'Repeat assign-and-move until assignments stop changing',
              ],
              ['sk-clustering'],
              'Assign, update, repeat. Each iteration provably does not increase within-cluster variance, which is why it always converges — though only to a local minimum, so initialisation matters.',
            ),

            concept(
              'When k-means is the wrong tool',
              'k-means assumes clusters are roughly **spherical, similarly sized, and similarly dense**. Real data often violates all three.\n\n**DBSCAN** clusters by density instead. It finds arbitrarily-shaped clusters, decides the number of clusters itself, and explicitly labels sparse points as **noise** rather than forcing them into a group. Two crescent shapes interleaved defeat k-means completely and are trivial for DBSCAN.\n\nIts cost is two parameters that matter a great deal: `eps` (how close counts as neighbouring) and `minPts` (how many neighbours make a dense region). Get them wrong and you get either one giant cluster or all noise.\n\n**Hierarchical clustering** builds a tree by repeatedly merging the closest pair. You pick the number of clusters *afterwards* by cutting the tree at a chosen height, and the dendrogram itself is informative — it shows which groups are nested inside which.\n\nRule of thumb: **k-means for speed and scale, DBSCAN for odd shapes and noise, hierarchical when the structure is genuinely nested.**',
              {
                keyTerms: [
                  { term: 'DBSCAN', definition: 'Density-based clustering. Finds arbitrary shapes and identifies noise points.' },
                  { term: 'Dendrogram', definition: 'The merge tree produced by hierarchical clustering.' },
                ],
              },
            ),

            match(
              'Match each situation to the clustering method that fits.',
              [
                { left: 'Two interleaved crescent shapes', right: 'DBSCAN' },
                { left: '10M points, need speed, roughly round groups', right: 'k-means' },
                { left: 'Want to see which groups nest inside which', right: 'Hierarchical' },
                { left: 'Data has genuine outliers that should not be clustered', right: 'DBSCAN' },
              ],
              ['sk-clustering', 'sk-dbscan', 'sk-hierarchical-clustering'],
              'Shape assumptions drive the choice. k-means draws spherical boundaries; DBSCAN follows density wherever it goes; hierarchical exposes nested structure.',
            ),

            interactive(
              'Project down with PCA',
              'pca-projection',
              'Rotate the projection axis over a 2-D cloud and watch how much variance each direction captures. The first principal component is simply the direction of maximum spread — that is the entire idea.',
            ),

            mcq(
              'You reduce 300 features to 20 with PCA and keep 95% of the variance. What have you lost?',
              [
                'Nothing of any importance',
                'Interpretability — each component is a blend of all 300 original features',
                '95% of the information',
                'The ability to use the data for supervised learning',
              ],
              1,
              ['sk-dimensionality-reduction'],
              'Variance is preserved; meaning is not. "Component 7" is a weighted combination of 300 features and has no natural interpretation, which is a real cost in any setting where you must explain a decision.',
            ),

            interactive(
              'Detect anomalies',
              'anomaly-detection',
              'Move the threshold across a distribution of normal behaviour and watch true anomalies and false alarms trade off. Notice you can never have both — the distributions overlap.',
            ),

            multi(
              'Which are genuine difficulties of unsupervised learning? (Select all)',
              [
                'There is no ground truth to evaluate against',
                'The number of clusters usually has to be chosen by you',
                'Results often need a domain expert to judge',
                'It requires more labelled data than supervised learning',
              ],
              [0, 1, 2],
              ['sk-unsupervised-learning'],
              'The first three are the real problems, and they are why unsupervised results are so often argued about. The last is backwards — needing no labels is the entire point.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-tml-1',
        title: 'Paradigms Checkpoint',
        passingScore: 0.7,
        exercises: [
          categorize(
            'Sort these into their learning paradigm.',
            ['Supervised', 'Unsupervised', 'Reinforcement'],
            [
              { item: 'Spam filter trained on labelled email', category: 'Supervised' },
              { item: 'Segmenting users with no predefined groups', category: 'Unsupervised' },
              { item: 'A game agent rewarded for winning', category: 'Reinforcement' },
              { item: 'Predicting delivery time from past deliveries', category: 'Supervised' },
              { item: 'Finding unusual network traffic', category: 'Unsupervised' },
              { item: 'A trading agent rewarded for profit', category: 'Reinforcement' },
            ],
            ['sk-ml-paradigms'],
            'Labelled answers, no answers, or delayed reward — that is the whole taxonomy.',
          ),
          mcq(
            'Which is NOT a form of unsupervised learning?',
            ['Clustering', 'Dimensionality reduction', 'Logistic regression', 'Density estimation'],
            2,
            ['sk-unsupervised-learning'],
            'Logistic regression trains on labelled examples, which makes it supervised. The other three all find structure without labels.',
          ),
          trueFalse(
            'k-means always finds the globally optimal clustering.',
            false,
            ['sk-clustering'],
            'It converges to a local optimum that depends on initialisation. Running it several times with different seeds and keeping the best result is standard practice; k-means++ initialisation reduces the problem but does not eliminate it.',
          ),
        ],
      },
    },

    // =======================================================================
    {
      id: 'unit-tml-2',
      title: 'Between the Paradigms',
      description: 'Semi-supervised, self-supervised, and learning from few examples.',
      lessons: [
        lesson({
          id: 'lesson-semi-supervised',
          title: 'Semi-Supervised Learning',
          summary: 'A few labels, a lot of unlabelled data.',
          level: 'intermediate',
          domain: 'machine-learning',
          steps: [
            concept(
              'The realistic situation',
              'The textbook setup — a clean labelled dataset — is rare. The real situation is almost always: **a mountain of unlabelled data, and a small budget for labelling.**\n\nA hospital has 500,000 scans and a radiologist who can annotate 2,000. A company has 10 million support tickets and an analyst who can categorise 1,500.\n\nSemi-supervised learning uses both. The insight is that unlabelled data still tells you something real: it shows you **where the data lives**. If you can see that the points form two dense blobs, then a handful of labels is enough to work out which blob is which — the unlabelled data did the hard part.',
              {
                keyTerms: [
                  { term: 'Cluster assumption', definition: 'Points in the same dense region probably share a label.' },
                  { term: 'Manifold assumption', definition: 'High-dimensional data lies on a lower-dimensional surface; labels vary smoothly along it.' },
                ],
              },
            ),

            concept(
              'Three techniques that work',
              '**Self-training (pseudo-labelling).** Train on your labelled data. Predict on the unlabelled data. Take the predictions the model is most confident about, treat them as labels, retrain. Repeat.\n\nThe danger is obvious and real: **confidently wrong predictions get promoted to labels and the error compounds.** Confidence thresholds and only adding a small batch per round are the standard defences.\n\n**Consistency regularisation.** Add noise or an augmentation to an unlabelled example and require the model to give the same answer to both versions. No label needed — you are teaching the model that irrelevant variation should not change the output. This is what powers FixMatch and its descendants.\n\n**Label propagation.** Build a graph connecting similar examples, then spread the known labels along the edges. Works well when the cluster assumption genuinely holds.\n\nWhen it fails: if the cluster assumption is false — the classes overlap heavily and are not separated by low-density regions — semi-supervised learning can be *worse* than just using the labels you have.',
            ),

            mcq(
              'A self-training loop makes the model steadily worse over rounds. What is the most likely cause?',
              [
                'Too much labelled data',
                'Confidently wrong pseudo-labels are being added and the error is compounding',
                'The learning rate is too low',
                'Self-training never works',
              ],
              1,
              ['sk-semi-supervised'],
              'This is the characteristic failure. Each round the model trains on its own mistakes as if they were truth, and becomes more confident in them. Raise the confidence threshold, add fewer pseudo-labels per round, and check accuracy on a held-out labelled set every round.',
            ),

            mcq(
              'Why can unlabelled data help even though it contains no answers?',
              [
                'It increases the dataset size, which always helps',
                'It reveals the shape of the data distribution — where the dense regions and gaps are',
                'It can be labelled automatically with perfect accuracy',
                'It reduces overfitting by adding noise',
              ],
              1,
              ['sk-semi-supervised'],
              'Knowing where the data lives is genuinely informative. If the classes sit in separate dense regions, a handful of labels is enough to identify which region is which — the unlabelled data supplied the structure.',
            ),

            trueFalse(
              'Semi-supervised learning always beats training on the labelled data alone.',
              false,
              ['sk-semi-supervised'],
              'It relies on assumptions — that similar points share labels, that classes are separated by low-density regions. When those are false, it can actively hurt. Always compare against the labelled-only baseline.',
            ),
          ],
        }),

        lesson({
          id: 'lesson-self-supervised',
          title: 'Self-Supervised Learning',
          summary: 'Manufacturing labels out of thin air.',
          level: 'intermediate',
          domain: 'machine-learning',
          steps: [
            concept(
              'Hide part of the data and predict it',
              'Self-supervised learning invents a task whose answer is already in the data. That task is called a **pretext task**, and the point of it is never the task itself — it is the representation the model builds while solving it.\n\n**Text.** Mask a word and predict it (BERT). Or predict the next token given all previous ones (GPT-family). The label is just the word you hid.\n\n**Images.** Mask patches and reconstruct them (MAE). Predict the rotation applied. Predict the relative position of two crops.\n\n**Contrastive.** Take two augmented views of the same image and require their representations to be close, while pushing apart views of different images (SimCLR). This requires no reconstruction at all — only a notion of "same thing" versus "different thing".\n\n**Audio, video, multimodal.** Predict masked audio spans. Predict which caption matches which image (CLIP).\n\nThe unifying trick: **the supervision was always in the data — you just had to hide part of it from the model.**',
            ),

            order(
              'Order the modern training pipeline for a large model.',
              [
                'Collect a very large unlabelled corpus',
                'Self-supervised pretraining on a pretext task',
                'Supervised fine-tuning on a small labelled dataset for the actual task',
                'Evaluate on held-out data for that task',
              ],
              ['sk-self-supervised', 'sk-transfer-learning'],
              'Pretrain broadly on cheap unlabelled data, then specialise narrowly on expensive labelled data. This ordering is why modern models need so few task-specific labels.',
            ),

            mcq(
              'What is the actual goal of a pretext task?',
              [
                'To solve the pretext task well — that is the deliverable',
                'To force the model to build useful general representations while solving it',
                'To reduce the size of the training data',
                'To replace the need for any labelled data ever',
              ],
              1,
              ['sk-self-supervised'],
              'Nobody wants a model that fills in masked words for its own sake. Doing it well *requires* modelling syntax, semantics, and world knowledge — and those representations are what transfers to the task you actually care about.',
            ),

            numeric(
              'A 1-billion-token corpus is used for next-token pretraining. Roughly how many training signals does that yield?',
              1000000000,
              ['sk-self-supervised'],
              'Roughly one per token — every position predicts its own successor. That is the leverage of self-supervision: a billion labels from a corpus nobody annotated.',
              { tolerance: 1, hint: 'Each token position is its own prediction target.' },
            ),

            shortAnswer(
              'A colleague says self-supervised learning is "just unsupervised learning with a new name". What is the distinction?',
              ['labels', 'generated', 'prediction', 'supervised', 'data itself'],
              'Unsupervised learning has no prediction target at all — it finds structure like clusters or components. Self-supervised learning creates genuine labels from the data and then trains with a standard supervised objective against them. The mechanism is supervised; only the source of the labels is different.',
              ['sk-self-supervised', 'sk-unsupervised-learning'],
              'Self-supervision is supervised learning where the labels are manufactured rather than annotated. The training loop is identical to supervised learning; the labelling step is automated.',
            ),
          ],
        }),

        lesson({
          id: 'lesson-transfer-meta',
          title: 'Transfer, Multi-Task, and Meta-Learning',
          summary: 'Reusing what a model already knows.',
          level: 'expert',
          domain: 'machine-learning',
          steps: [
            concept(
              'Three ways to reuse knowledge',
              '**Transfer learning** — train on task A, reuse for task B. Sequential. A model pretrained on ImageNet, fine-tuned for skin lesion detection. This is the default in practice.\n\n**Multi-task learning** — train on several tasks *at once* with a shared backbone and per-task heads. The tasks regularise each other: features useful for detecting pedestrians are also useful for detecting cyclists, and being forced to serve both prevents overfitting to either.\n\nIts failure mode is **negative transfer** — when tasks conflict, learning one actively hurts another, and both end up worse than separate models. This is a real risk, not a theoretical one, and is why task weighting matters.\n\n**Meta-learning** — "learning to learn". Rather than learning one task, learn a *procedure* that adapts to new tasks from a handful of examples. MAML finds an initialisation from which any new task is a few gradient steps away.\n\nMeta-learning is what makes **few-shot learning** work: classify a new species from five photos, because the model already learned how to learn visual categories.',
              {
                keyTerms: [
                  { term: 'Negative transfer', definition: 'When training on an extra task degrades performance on the one you care about.' },
                  { term: 'Few-shot learning', definition: 'Learning a new task from a handful of labelled examples.' },
                ],
              },
            ),

            match(
              'Match each scenario to the right approach.',
              [
                { left: 'Fine-tune an ImageNet model for medical scans', right: 'Transfer learning' },
                { left: 'One model detecting cars, pedestrians, and signs together', right: 'Multi-task learning' },
                { left: 'Classify a new species from five photos', right: 'Meta-learning' },
                { left: 'A model that gets worse when a second task is added', right: 'Negative transfer' },
              ],
              ['sk-transfer-learning', 'sk-multitask-learning', 'sk-meta-learning'],
              'Sequential reuse is transfer; simultaneous training is multi-task; learning the adaptation procedure itself is meta-learning.',
            ),

            mcq(
              'In-context learning — an LLM adapting from examples in the prompt — is closest to which idea?',
              [
                'Transfer learning',
                'Meta-learning: the model learned during pretraining how to adapt from examples',
                'Reinforcement learning',
                'Unsupervised clustering',
              ],
              1,
              ['sk-meta-learning'],
              'No weights change when you show an LLM few-shot examples. The ability to adapt from examples was itself learned during pretraining, which is exactly the meta-learning framing.',
            ),

            trueFalse(
              'Adding more tasks to a multi-task model always improves every task.',
              false,
              ['sk-multitask-learning'],
              'Conflicting tasks produce negative transfer, and both tasks can end up worse than separately-trained models. Related tasks help; unrelated ones compete for capacity.',
            ),
          ],
        }),

        lesson({
          id: 'lesson-active-federated',
          title: 'Active and Federated Learning',
          summary: 'Choosing what to label, and learning without collecting data.',
          level: 'expert',
          domain: 'machine-learning',
          steps: [
            concept(
              'Active learning: label the examples that matter',
              'If you can only afford 1,000 labels out of a million examples, choosing *which* 1,000 matters enormously. Random sampling is the baseline. Active learning does far better.\n\nThe model picks what to label next:\n\n**Uncertainty sampling.** Label the examples the model is least sure about — the ones near the decision boundary. Simple and effective.\n\n**Query by committee.** Train several models; label the examples they disagree about most.\n\n**Expected model change.** Label the example that would shift the model most if you knew its answer.\n\nActive learning routinely reaches the same accuracy with **2–10× fewer labels** than random sampling.\n\nThe honest caveats: uncertainty sampling has a bias toward outliers and mislabelled data, which are also "uncertain". And your labelled set is no longer a random sample of the population, so you cannot use it to estimate real-world accuracy — you need a separate randomly-sampled test set for that.',
            ),

            concept(
              'Federated learning: bring the model to the data',
              'Some data cannot be centralised. Not because of engineering, but because of law, contract, or basic decency — hospital records, personal messages, keyboard typing history.\n\nFederated learning inverts the usual flow:\n\n1. The server sends the current model to each device or institution.\n2. Each trains locally on data that never leaves.\n3. Each sends back only the **weight updates**.\n4. The server averages the updates into a new global model.\n5. Repeat.\n\nThis is how phone keyboards learn from typing without uploading what you typed.\n\nWhat it does *not* automatically give you is privacy. **Gradients leak information** — under some conditions training examples can be reconstructed from updates alone. Real deployments add **secure aggregation** (the server only ever sees the sum, never one participant\'s update) and **differential privacy** (calibrated noise, with a formal guarantee).\n\nThe other hard part is that federated data is not identically distributed. Every hospital has a different patient mix, and naive averaging across very different local distributions converges badly.',
              {
                keyTerms: [
                  { term: 'Secure aggregation', definition: 'Cryptography that lets a server see only the sum of updates, never an individual one.' },
                  { term: 'Non-IID data', definition: 'Participants hold systematically different data distributions.' },
                ],
              },
            ),

            mcq(
              'A team uses uncertainty sampling and finds many selected examples are mislabelled junk. Why does this happen?',
              [
                'Uncertainty sampling is broken',
                'Mislabelled and anomalous examples also produce high uncertainty, so they get selected',
                'The model is overfitting',
                'They should label randomly instead',
              ],
              1,
              ['sk-active-learning'],
              'Uncertainty does not distinguish "genuinely near the boundary" from "corrupted". Density-weighted sampling — preferring uncertain examples that are also *representative* of many other points — is the usual fix.',
            ),

            multi(
              'Which are true of federated learning? (Select all)',
              [
                'Raw data never leaves the device or institution',
                'Only model updates are transmitted',
                'It provides formal privacy guarantees on its own',
                'Non-identical data across participants makes convergence harder',
              ],
              [0, 1, 3],
              ['sk-federated-learning', 'sk-privacy'],
              'Data locality and update-only transmission are the design. Non-IID data is the main practical difficulty. Formal privacy is *not* automatic — gradients leak, so differential privacy and secure aggregation have to be added deliberately.',
            ),

            shortAnswer(
              'Why does federated learning alone not guarantee privacy?',
              ['gradients', 'leak', 'reconstruct', 'updates', 'information'],
              'The weight updates themselves carry information about the training data, and under some conditions individual examples can be reconstructed from them. Real privacy requires adding secure aggregation and differential privacy on top.',
              ['sk-federated-learning', 'sk-privacy'],
              '"The data stayed on the device" is a statement about data movement, not about information leakage. Those are different things.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-tml-2',
        title: 'Beyond the Basics Checkpoint',
        passingScore: 0.75,
        exercises: [
          mcq(
            'You have 2M unlabelled images and budget for 3,000 labels. Best strategy?',
            [
              'Label 3,000 at random and train supervised',
              'Self-supervised pretraining on all 2M, then fine-tune on actively-selected labels',
              'Cluster the 2M and skip labelling',
              'Wait for more budget',
            ],
            1,
            ['sk-self-supervised', 'sk-active-learning'],
            'Self-supervision extracts representations from all 2M without labels; active learning spends the 3,000-label budget where it does the most good. Combining them is the modern default.',
          ),
          categorize(
            'Sort each technique by what it primarily solves.',
            ['Too few labels', 'Data cannot be centralised', 'Reusing knowledge'],
            [
              { item: 'Pseudo-labelling', category: 'Too few labels' },
              { item: 'Active learning', category: 'Too few labels' },
              { item: 'Federated learning', category: 'Data cannot be centralised' },
              { item: 'Fine-tuning a pretrained model', category: 'Reusing knowledge' },
              { item: 'Meta-learning', category: 'Reusing knowledge' },
              { item: 'Secure aggregation', category: 'Data cannot be centralised' },
            ],
            ['sk-semi-supervised', 'sk-federated-learning', 'sk-transfer-learning'],
            'Label scarcity, data locality, and knowledge reuse are three different problems with three different families of solution.',
          ),
        ],
      },
    },

    // =======================================================================
    {
      id: 'unit-tml-3',
      title: 'When and How a Model Learns',
      description: 'Batch vs online, instance-based vs model-based, and common problem shapes.',
      lessons: [
        lesson({
          id: 'lesson-online-batch',
          title: 'Batch vs Online Learning',
          summary: 'Train once, or keep learning forever?',
          level: 'intermediate',
          domain: 'machine-learning',
          steps: [
            concept(
              'When does learning happen?',
              '**Batch (offline) learning.** Train on the whole dataset at once, deploy a frozen model, retrain periodically from scratch. Stable, reproducible, easy to test and roll back. Almost everything in production works this way.\n\nIts limits: retraining on a huge dataset is expensive, and the model is always as stale as your last training run.\n\n**Online (incremental) learning.** Update the model as each example arrives. Adapts immediately, handles data too large to fit in memory, and works on genuinely unbounded streams.\n\nIts danger is the reason it is rare: **there is no safe rollback.** A burst of bad data corrupts the model in minutes, and there is no clean previous version to restore. Add an adversary deliberately feeding poisoned examples and it gets worse.\n\n**Mini-batch / periodic retraining** is the practical middle ground and what most teams actually run: retrain nightly or hourly on recent data, with a validation gate before the new model goes live.',
              {
                keyTerms: [
                  { term: 'Learning rate (online)', definition: 'Controls adaptation speed — high adapts fast but forgets and destabilises.' },
                  { term: 'Catastrophic forgetting', definition: 'New data overwriting previously learned patterns.' },
                ],
              },
            ),

            categorize(
              'Sort each system by the learning mode that fits best.',
              ['Batch', 'Online', 'Periodic retraining'],
              [
                { item: 'Medical diagnosis model requiring regulatory approval', category: 'Batch' },
                { item: 'Ad click predictor with second-by-second trends', category: 'Online' },
                { item: 'Product recommender refreshed nightly', category: 'Periodic retraining' },
                { item: 'Credit scoring model that must be auditable', category: 'Batch' },
                { item: 'Sensor anomaly detector on an unbounded stream', category: 'Online' },
                { item: 'Search ranking updated every few hours', category: 'Periodic retraining' },
              ],
              ['sk-online-vs-batch'],
              'The question is how fast the world changes versus how much stability and auditability the decision requires. Regulated, high-stakes decisions want frozen, testable models.',
            ),

            mcq(
              'An online-learning recommender degrades sharply over one afternoon. What is the most likely cause?',
              [
                'The learning rate is too low',
                'A burst of unusual or adversarial traffic was absorbed straight into the model',
                'The dataset is too small',
                'Online learning cannot work for recommenders',
              ],
              1,
              ['sk-online-vs-batch'],
              'Online models incorporate whatever arrives, immediately. Bot traffic, an outage skewing behaviour, or deliberate poisoning all corrupt the model with no rollback point. Anomaly gates on the input stream and frequent checkpoints are the standard defences.',
            ),

            trueFalse(
              'Online learning is generally the better default for production ML systems.',
              false,
              ['sk-online-vs-batch'],
              'The opposite. Batch or periodic retraining is the default because it is testable, reproducible, and rollback-able. Online learning is reserved for cases where adaptation speed genuinely justifies giving those up.',
            ),
          ],
        }),

        lesson({
          id: 'lesson-instance-vs-model',
          title: 'Instance-Based vs Model-Based',
          summary: 'Memorise the data, or compress it into parameters?',
          level: 'intermediate',
          domain: 'machine-learning',
          steps: [
            concept(
              'Two ways to "learn"',
              '**Model-based (eager) learning.** Training compresses the data into parameters. Linear regression keeps a handful of weights; a neural network keeps millions. The training data can then be thrown away. Training is slow, prediction is fast.\n\n**Instance-based (lazy) learning.** There is no training. The algorithm stores the examples and, at prediction time, compares the query against them. k-nearest neighbours is the archetype: to classify a point, find the k closest stored points and take a vote.\n\nThe tradeoff inverts completely. Training is instant (there is none), prediction is expensive (you search the dataset), and memory scales with the data forever.\n\nThe subtler difference: a model-based learner makes an **assumption about the shape** of the relationship — linear regression assumes a line. An instance-based learner assumes almost nothing except that **similar inputs have similar outputs**. That is a weak assumption, which is a strength on strange data and a weakness in high dimensions.',
              {
                keyTerms: [
                  { term: 'Lazy learning', definition: 'No training phase; all computation happens at prediction time.' },
                  { term: 'Curse of dimensionality', definition: 'In high dimensions all points become nearly equidistant, so "nearest" stops meaning anything.' },
                ],
              },
            ),

            interactive(
              'Run k-nearest neighbours',
              'knn',
              'Place a query point and vary k. At k=1 the boundary is jagged and follows every noisy point; at large k it smooths out and eventually ignores real structure. That is the bias–variance tradeoff, visible directly.',
            ),

            mcq(
              'Why does k-NN degrade badly as the number of features grows?',
              [
                'It runs out of memory',
                'In high dimensions all points become nearly equidistant, so "nearest" carries little information',
                'It can only handle two features',
                'The labels become noisy',
              ],
              1,
              ['sk-knn'],
              'The curse of dimensionality. Volume grows exponentially with dimensions, so data becomes sparse and the ratio between nearest and farthest distances approaches 1. Dimensionality reduction before k-NN is standard for this reason.',
            ),

            mcq(
              'Which is a genuine advantage of instance-based learning?',
              [
                'Predictions are very fast',
                'It uses little memory',
                'Adding new training data requires no retraining — just store it',
                'It works well with thousands of features',
              ],
              2,
              ['sk-instance-vs-model'],
              'Incorporating new data is free, which is genuinely useful for systems where the data changes constantly. The other three are all weaknesses of instance-based methods, not strengths.',
            ),

            categorize(
              'Sort each algorithm by how it learns.',
              ['Instance-based', 'Model-based'],
              [
                { item: 'k-nearest neighbours', category: 'Instance-based' },
                { item: 'Linear regression', category: 'Model-based' },
                { item: 'Neural network', category: 'Model-based' },
                { item: 'Kernel density estimation', category: 'Instance-based' },
                { item: 'Decision tree', category: 'Model-based' },
                { item: 'Naive Bayes', category: 'Model-based' },
              ],
              ['sk-instance-vs-model'],
              'If training produces parameters and the data can then be discarded, it is model-based. If prediction requires consulting the stored examples, it is instance-based.',
            ),
          ],
        }),

        lesson({
          id: 'lesson-problem-shapes',
          title: 'Common Problem Shapes',
          summary: 'Recommenders, ranking, forecasting, and anomaly detection.',
          level: 'intermediate',
          domain: 'machine-learning',
          steps: [
            concept(
              'Recognising the shape',
              'Beyond the paradigms, a handful of problem *shapes* come up constantly. Recognising one saves you from reinventing a solved problem badly.\n\n**Recommendation.** Predict what a user will like.\n- *Collaborative filtering* — "users like you also liked". Uses only the interaction matrix, needs no content features, and suffers the **cold-start problem**: a new user or item has no interactions to reason from.\n- *Content-based* — "similar to what you liked". Handles cold start, but tends to trap users in a narrow filter bubble.\n- *Hybrid* — what every real system actually ships.\n\n**Ranking.** Order a list — search results, feed items. Crucially **not** the same as predicting a score per item: what matters is relative order at the top, which is why ranking has its own metrics (NDCG, MRR) and its own losses (pairwise, listwise).\n\n**Forecasting.** Predict a time series forward. The distinguishing constraint is that **order matters and the future must never leak backwards.** Random train/test splits are invalid; you split chronologically. Seasonality, trend, and autocorrelation are all first-class concerns.\n\n**Anomaly detection.** Find the unusual. Almost always extremely imbalanced, often with no labelled anomalies at all — so it is usually framed as density estimation: model normal, flag the improbable.',
              {
                keyTerms: [
                  { term: 'Cold start', definition: 'A new user or item with no interaction history to learn from.' },
                  { term: 'NDCG', definition: 'A ranking metric that weights correctness at the top of the list far more heavily.' },
                ],
              },
            ),

            categorize(
              'Sort each task into its problem shape.',
              ['Recommendation', 'Ranking', 'Forecasting', 'Anomaly detection'],
              [
                { item: 'Order search results by relevance', category: 'Ranking' },
                { item: 'Suggest films this viewer might enjoy', category: 'Recommendation' },
                { item: 'Predict next quarter’s electricity demand', category: 'Forecasting' },
                { item: 'Flag unusual login behaviour', category: 'Anomaly detection' },
                { item: 'Detect a failing machine from vibration data', category: 'Anomaly detection' },
                { item: 'Predict tomorrow’s support ticket volume', category: 'Forecasting' },
                { item: 'Choose which feed post to show first', category: 'Ranking' },
                { item: 'Show products related to the one being viewed', category: 'Recommendation' },
              ],
              ['sk-recommender-systems', 'sk-ranking', 'sk-time-series', 'sk-anomaly-detection'],
              'Ranking cares about relative order; recommendation is personalised discovery; forecasting is ordered in time; anomaly detection is rarity.',
            ),

            mcq(
              'Why is a random train/test split invalid for forecasting?',
              [
                'Time series data is too large',
                'The model would train on future data and predict the past, which is impossible at deployment',
                'Forecasting is unsupervised',
                'Random splits reduce accuracy',
              ],
              1,
              ['sk-time-series', 'sk-data-leakage'],
              'Random splitting leaks the future into training. At deployment you only ever have the past, so a chronological split is the only honest evaluation.',
            ),

            mcq(
              'A new film is added to a streaming catalogue. Collaborative filtering cannot recommend it. Why?',
              [
                'The film is too long',
                'No one has interacted with it yet, so there is no signal to reason from',
                'Collaborative filtering only works for music',
                'The model needs retraining from scratch',
              ],
              1,
              ['sk-recommender-systems'],
              'Cold start. Collaborative filtering works purely from the interaction matrix, and a new item has an empty row. Content-based features — genre, cast, description — are the standard bridge until interactions accumulate.',
            ),

            multi(
              'Which are true of ranking problems? (Select all)',
              [
                'Correctness at the top of the list matters more than at the bottom',
                'They use specialised metrics like NDCG rather than plain accuracy',
                'They are the same as predicting an independent score for each item',
                'Pairwise and listwise losses exist because relative order is what matters',
              ],
              [0, 1, 3],
              ['sk-ranking'],
              'Ranking is about relative order, with heavy emphasis on the top. Scoring items independently and sorting is a common baseline but ignores the interactions between items in a list — which is exactly what listwise methods model.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-tml-3',
        title: 'Learning Modes Checkpoint',
        passingScore: 0.75,
        exercises: [
          mcq(
            'A fraud model must be auditable and is retrained monthly under review. Which learning mode?',
            ['Online learning', 'Batch learning', 'Federated learning', 'Active learning'],
            1,
            ['sk-online-vs-batch'],
            'Auditability and review require a frozen, reproducible artefact. Online learning cannot provide that.',
          ),
          trueFalse(
            'k-NN has no training phase.',
            true,
            ['sk-instance-vs-model', 'sk-knn'],
            'It stores the data and does all its work at prediction time — the definition of lazy, instance-based learning.',
          ),
          mcq(
            'Which metric suits a search-ranking system best?',
            ['Accuracy', 'Mean squared error', 'NDCG', 'Silhouette score'],
            2,
            ['sk-ranking'],
            'NDCG weights correctness at the top of the list most heavily, which matches what users actually experience.',
          ),
        ],
      },
    },
  ],
};
