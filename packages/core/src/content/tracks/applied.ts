/**
 * Tracks 8–10 — MLOps, Ethics & Governance, and Reinforcement Learning.
 *
 * Grouped in one file because each is a focused single-unit track rather than a
 * multi-unit subject.
 */

import type { Track } from '../../domain/types.js';
import { concept, lesson, match, mcq, multi, numeric, order, shortAnswer, trueFalse } from '../builders.js';

// ---------------------------------------------------------------------------

export const mlopsTrack: Track = {
  id: 'track-mlops',
  title: 'MLOps & Production',
  tagline: 'The 90% of the work that happens after training',
  description:
    'Serving, monitoring, cost, and the operational discipline that separates a notebook from a system people depend on.',
  domain: 'mlops',
  level: 'intermediate',
  icon: '⚙️',
  gradient: ['#64748B', '#0EA5E9'],
  prerequisites: ['track-machine-learning'],
  outcomes: [
    'Choose between batch, real-time, and streaming inference',
    'Monitor for drift and degradation before users notice',
    'Reason about latency, throughput, and inference cost',
    'Roll out model changes safely',
  ],
  units: [
    {
      id: 'unit-mlops-1',
      title: 'Shipping and Keeping It Working',
      description: 'Deployment patterns, monitoring, and cost.',
      lessons: [
        lesson({
          id: 'lesson-deployment',
          title: 'Getting a Model to Users',
          summary: 'Three serving patterns and how to pick one.',
          level: 'intermediate',
          domain: 'mlops',
          free: true,
          steps: [
            concept(
              'Batch, real-time, or streaming',
              '**Batch.** Score everything on a schedule and write results to a table. Reads are instant lookups. Cheapest and simplest by a wide margin. Correct whenever predictions stay valid for hours — churn scores, recommendations, risk ratings.\n\n**Real-time.** A synchronous endpoint per request. Necessary when the input only exists at request time: fraud checks, search ranking, anything the user is waiting on. Costs far more in engineering and infrastructure.\n\n**Streaming.** Continuous processing of an event stream. For genuinely continuous signals — sensor telemetry, live anomaly detection.\n\nThe common mistake is building real-time infrastructure for something a nightly batch job would serve perfectly. Ask what freshness the *decision* actually requires, not what sounds impressive.',
            ),
            match(
              'Match each use case to its serving pattern.',
              [
                { left: 'Nightly churn scores for the CRM', right: 'Batch' },
                { left: 'Fraud check during checkout', right: 'Real-time' },
                { left: 'Anomaly detection on sensor telemetry', right: 'Streaming' },
                { left: 'Weekly customer segment refresh', right: 'Batch' },
              ],
              ['sk-model-deployment'],
              'The question is always how fresh the prediction must be at the moment of the decision.',
            ),
            mcq(
              'A team builds a real-time endpoint for scores consumed once daily by a report. What is wrong?',
              [
                'Nothing — real-time is always better',
                'They pay real-time complexity and cost for batch requirements',
                'The model will be inaccurate',
                'Real-time cannot produce reports',
              ],
              1,
              ['sk-model-deployment'],
              'Real-time serving brings autoscaling, latency SLOs, and on-call burden. For a daily report, a scheduled job writing to a table does the same job at a fraction of the cost.',
            ),
            concept(
              'Monitoring what matters',
              'Four layers, and teams routinely stop at the first.\n\n**System health** — latency, error rate, throughput. Necessary, and tells you nothing about whether predictions are any good.\n\n**Input drift** — has the distribution of incoming features shifted? Detectable immediately, without labels. Population Stability Index and KS tests are the usual instruments.\n\n**Prediction drift** — has the distribution of outputs shifted? A fraud model suddenly flagging 3× more transactions is worth a look before anyone complains.\n\n**Outcome quality** — the real thing. Accuracy against ground truth, which usually arrives late. Loan defaults surface over months.\n\nBecause labels lag, **drift is your early warning system**. A model can fail silently for weeks while every dashboard stays green.',
            ),
            multi(
              'Which can be monitored without waiting for ground-truth labels? (Select all)',
              [
                'Input feature drift',
                'Prediction distribution drift',
                'Model accuracy',
                'Request latency',
              ],
              [0, 1, 3],
              ['sk-model-monitoring'],
              'Inputs, outputs, and system metrics are all available immediately. Accuracy needs labels, which is exactly why drift monitoring carries the load.',
            ),
            concept(
              'Rolling out safely',
              'Never swap a model in one step.\n\n**Shadow deployment.** The new model scores live traffic; its predictions are logged but not used. Zero user risk, and you get real-traffic comparison.\n\n**Canary.** Route 1% of traffic, watch, increase gradually. Catches problems that only appear under real load.\n\n**A/B test.** Split traffic and measure the *business* metric, not just accuracy. A more accurate model can be worse for users — a recommender that improves click prediction while reducing diversity is a familiar example.\n\n**Always keep the rollback path.** Model versioning, the previous artefact deployable in minutes, and a documented trigger for pulling it.',
            ),
            order(
              'Order a safe model rollout.',
              [
                'Shadow the new model against live traffic and compare offline',
                'Canary to a small percentage of real traffic',
                'A/B test against the incumbent on business metrics',
                'Ramp to full traffic, keeping the previous version deployable',
              ],
              ['sk-ab-testing', 'sk-model-deployment'],
              'Each stage exposes more real traffic while the rollback path stays open.',
            ),
            concept(
              'The cost of inference',
              'Training is a one-off. **Inference is forever**, and for any successful product it dominates total cost.\n\nFor LLM-based systems, the levers that actually matter:\n\n- **Model size.** A smaller model that is good enough beats a large one that is excessive. Route by difficulty — most requests do not need your best model.\n- **Prompt caching.** A long shared prefix (system prompt, few-shot examples, retrieved docs) can be cached, cutting both cost and latency substantially on repeat calls.\n- **Output length.** Output tokens usually cost several times input tokens and are generated serially, so they dominate latency. Ask for concise output.\n- **Batching.** Higher throughput per GPU at the cost of some latency.\n- **Quantization.** 8-bit or 4-bit weights cut memory and increase throughput with modest quality loss.\n\nMeasure cost per *request* and per *successful outcome*. A cheaper model that needs three retries is not cheaper.',
            ),
            mcq(
              'An LLM feature is too expensive. Which change usually gives the largest immediate saving?',
              [
                'Rewriting the client in a faster language',
                'Routing easy requests to a smaller model and caching the shared prompt prefix',
                'Increasing the context window',
                'Raising the temperature',
              ],
              1,
              ['sk-inference-cost'],
              'Model selection and prompt caching directly attack the dominant cost terms. Client-side performance is irrelevant when the spend is in tokens.',
            ),
            numeric(
              'A request uses 2,000 input tokens and 500 output tokens. Input costs $3 per million, output $15 per million. What is the cost in cents?',
              1.35,
              ['sk-inference-cost'],
              'Input: 2,000 × $3/1M = $0.006. Output: 500 × $15/1M = $0.0075. Total $0.0135 = 1.35 cents. Note that a quarter as many output tokens cost more than the input — output pricing dominates.',
              { tolerance: 0.05, unit: 'cents' },
            ),
          ],
        }),
        lesson({
          id: 'lesson-experiment-tracking',
          title: 'Reproducibility',
          summary: 'The model that worked last Tuesday and cannot be rebuilt.',
          level: 'intermediate',
          domain: 'mlops',
          steps: [
            concept(
              'Why ML reproducibility is harder than software reproducibility',
              'Software has one moving part: the code. A machine learning result has four, and all of them drift.\n\n**Code** — the training script and the library versions.\n**Data** — which rows, which preprocessing, which split.\n**Configuration** — hyperparameters, seeds, hardware.\n**Environment** — CUDA version, framework build, even GPU model.\n\nChange any one and the result changes. Six weeks later, "the model that scored 0.91" is unreproducible, and nobody can say whether the current model is better than it or just differently broken.\n\nGit alone does not solve this, because Git does not version the data or the configuration that produced a specific artefact.',
            ),
            concept(
              'What to track for every run',
              'The minimum useful record, per experiment:\n\n- **Code version** — the commit hash, and whether the working tree was dirty.\n- **Data version** — a hash or version id of the exact dataset and split.\n- **Hyperparameters** — the full config, not just what you changed.\n- **Metrics** — training and validation curves, not just the final number.\n- **Environment** — dependency lockfile, framework and CUDA versions.\n- **Artefacts** — the model weights, tied to the run that produced them.\n- **Random seeds** — so a run can at least be attempted again.\n\nTools like MLflow, Weights & Biases, and DVC automate most of this. The specific tool matters far less than the discipline: **if you cannot say which commit and which data produced a deployed model, you cannot debug it and you cannot roll back to it with confidence.**\n\nThis becomes a compliance requirement, not merely good practice, under the EU AI Act\'s documentation obligations for high-risk systems.',
              { figure: 'mlops-lifecycle' },
            ),
            multi(
              'Which must be recorded to make an ML experiment reproducible? (Select all)',
              [
                'The code commit hash',
                'A version identifier for the exact dataset and split',
                'The complete hyperparameter configuration',
                'The wall-clock time the run started',
              ],
              [0, 1, 2],
              ['sk-experiment-tracking'],
              'Code, data, and configuration are the three that determine the result. Start time is useful metadata but does not affect reproducibility.',
            ),
            mcq(
              'A deployed model is misbehaving and nobody knows which data version trained it. What is the immediate consequence?',
              [
                'The model will run more slowly',
                'You cannot reproduce the behaviour, diagnose the cause, or confidently roll back',
                'The model will need retraining from scratch regardless',
                'Only the monitoring dashboards are affected',
              ],
              1,
              ['sk-experiment-tracking', 'sk-model-monitoring'],
              'Without provenance you are debugging blind. This is why lineage tracking is treated as production infrastructure rather than as a nice-to-have.',
            ),
            trueFalse(
              'Version-controlling the training code is sufficient for reproducible machine learning.',
              false,
              ['sk-experiment-tracking'],
              'Code is one of four moving parts. Data version, configuration, and environment all change results independently, and none of them live in the code repository by default.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-mlops-1',
        title: 'Production Checkpoint',
        passingScore: 0.7,
        exercises: [
          mcq(
            'A model\'s accuracy has degraded but labels take 60 days to arrive. What tells you sooner?',
            ['Nothing — you must wait', 'Input and prediction drift monitoring', 'Retraining weekly', 'Increasing model size'],
            1,
            ['sk-model-monitoring'],
            'Drift is measurable immediately and is the standard early-warning signal when labels lag.',
          ),
          trueFalse(
            'A model with higher offline accuracy will always improve the business metric.',
            false,
            ['sk-ab-testing'],
            'Offline metrics are proxies. A more accurate recommender can reduce diversity and engagement — which is why the A/B test measures the outcome you actually care about.',
          ),
        ],
      },
    },
  ],
};

// ---------------------------------------------------------------------------

export const ethicsTrack: Track = {
  id: 'track-ethics',
  title: 'AI Ethics, Safety & Governance',
  tagline: 'The questions that outlast any architecture',
  description:
    'Fairness in practice, interpretability, privacy, alignment, and the regulation now shaping what can legally ship.',
  domain: 'ethics-safety',
  level: 'intermediate',
  icon: '⚖️',
  gradient: ['#F59E0B', '#84CC16'],
  prerequisites: ['track-foundations'],
  outcomes: [
    'Apply fairness metrics and understand why they conflict',
    'Choose appropriate interpretability tools',
    'Reason about privacy risk in training data',
    'Navigate the EU AI Act risk tiers',
  ],
  units: [
    {
      id: 'unit-ethics-1',
      title: 'Fairness, Transparency, Privacy',
      description: 'From principles to decisions you can defend.',
      lessons: [
        lesson({
          id: 'lesson-interpretability',
          title: 'Interpretability',
          summary: 'Understanding why a model decided what it decided.',
          level: 'intermediate',
          domain: 'ethics-safety',
          free: true,
          steps: [
            concept(
              'Interpretable by design, or explained after the fact',
              '**Intrinsically interpretable** models — linear regression, shallow decision trees, rule lists — can be read directly. The coefficients *are* the explanation.\n\n**Post-hoc explanation** approximates the behaviour of a model too complex to read:\n\n**SHAP** — attributes a prediction across features using a game-theoretic allocation. Consistent and well-founded, but expensive.\n\n**LIME** — fits a simple local model around one prediction. Fast, less stable.\n\n**Attention weights** — often misread as explanations. Attention shows what was *attended to*, which is not the same as what was *causally used*, and this has been demonstrated repeatedly.\n\n**Counterfactuals** — "your loan would have been approved with £3,000 more income." Usually the most *actionable* form for an affected person, and increasingly what regulation actually asks for.\n\nAn important caution: a post-hoc explanation is a model of a model. It can be plausible and wrong, and a convincing wrong explanation is worse than none.',
            ),
            mcq(
              'A regulator requires that rejected applicants receive an actionable reason. Which is most appropriate?',
              [
                'Attention weight visualisation',
                'A counterfactual explanation stating what change would flip the decision',
                'Global feature importance across the dataset',
                'The model architecture diagram',
              ],
              1,
              ['sk-explainability'],
              'Counterfactuals are individual and actionable. Global importance describes the model overall, not this person\'s case.',
            ),
            trueFalse(
              'Attention weights are a reliable explanation of which inputs a model actually used.',
              false,
              ['sk-explainability'],
              'Attention indicates what was attended to, not what was causally responsible. Studies have produced very different attention distributions that yield identical predictions.',
            ),
            concept(
              'Privacy in training data',
              'Models memorise. Large models can be prompted to reproduce verbatim training data, including personal information — this has been demonstrated repeatedly on production systems.\n\n**Membership inference** — determining whether a specific record was in the training set. On its own that can be a disclosure: membership in a medical dataset reveals a diagnosis.\n\n**Differential privacy** adds calibrated noise during training so that no single record measurably changes the output. It comes with a real accuracy cost and a formal, quantified guarantee — which is rare and valuable.\n\n**Federated learning** trains across devices without centralising raw data. It reduces one class of risk but does not eliminate it: gradients themselves leak information, so it is typically combined with differential privacy and secure aggregation.\n\nThe most reliable protection remains **not collecting the data**. Minimisation is a design decision, and it is the only one with no residual risk.',
            ),
            multi(
              'Which are genuine privacy risks in ML systems? (Select all)',
              [
                'Verbatim reproduction of memorised training data',
                'Membership inference revealing that a record was in the training set',
                'Gradients leaking information in federated learning',
                'Using differential privacy during training',
              ],
              [0, 1, 2],
              ['sk-privacy'],
              'The first three are attack surfaces. Differential privacy is a mitigation, not a risk.',
            ),
            concept(
              'Regulation you will actually encounter',
              'The **EU AI Act** is the most consequential framework, and it is risk-tiered:\n\n**Unacceptable** — banned. Social scoring by public authorities, manipulative techniques exploiting vulnerabilities, most real-time remote biometric identification in public spaces.\n\n**High risk** — permitted with substantial obligations. Employment, education, credit, essential services, law enforcement, critical infrastructure. Requires risk management, data governance, documentation, human oversight, accuracy and robustness testing, and conformity assessment.\n\n**Limited risk** — transparency obligations. Users must be told they are interacting with an AI system; synthetic content must be labelled.\n\n**Minimal risk** — spam filters, game AI. No specific obligations.\n\nElsewhere: US regulation is sectoral and state-led (Colorado, California), the UK has taken a regulator-led approach with no single act, and China requires filing and labelling for generative services.\n\nThe practical upshot: **most obligations land on your use case, not your model.** The same architecture is unregulated in a game and high-risk in a hiring decision.',
            ),
            match(
              'Match each system to its EU AI Act tier.',
              [
                { left: 'CV screening for hiring', right: 'High risk' },
                { left: 'Government social scoring', right: 'Unacceptable' },
                { left: 'Customer service chatbot', right: 'Limited risk' },
                { left: 'Email spam filter', right: 'Minimal risk' },
              ],
              ['sk-ai-governance'],
              'The tier follows the application and its consequences for people, not the technology.',
            ),
            shortAnswer(
              'Why does the same model architecture face different regulatory obligations in different products?',
              ['use case', 'risk', 'application', 'context', 'consequences'],
              'Regulation is risk-based and applies to the use case, not the architecture. The same classifier is minimal-risk in a game and high-risk when it decides employment, because the consequences for the affected person differ.',
              ['sk-ai-governance'],
              'This is why "is our model compliant?" is not answerable without knowing what decision it makes about whom.',
            ),
          ],
        }),

        lesson({
          id: 'lesson-alignment',
          title: 'The Alignment Problem',
          summary: 'Getting a system to pursue what you meant.',
          level: 'expert',
          domain: 'ethics-safety',
          steps: [
            concept(
              'Specification is harder than optimisation',
              'Alignment is the problem of getting an AI system to pursue the objective you *intended* rather than the one you *wrote down*.\n\nThey come apart constantly, because objectives are proxies:\n\n- Optimise watch time → the system learns that outrage retains attention.\n- Optimise a boat-race score → the agent learns to spin in circles collecting respawning bonuses and never finishes the race. This is a real documented result.\n- Optimise "helpful responses as rated by humans" → the model learns to be **sycophantic**, because agreeable answers rate well.\n\n**Goodhart\'s law**: when a measure becomes a target, it ceases to be a good measure. Optimisation pressure finds the gap between proxy and intent, and the more capable the optimiser the more reliably it finds it.',
            ),
            mcq(
              'An RLHF model becomes agreeable and rarely disagrees with users. What happened?',
              [
                'The model became more intelligent',
                'Human raters preferred agreeable responses, so the reward model learned to reward agreement',
                'The training data was too small',
                'The temperature is too low',
              ],
              1,
              ['sk-alignment', 'sk-rlhf'],
              'Sycophancy is a well-documented consequence of optimising rated helpfulness. Raters reward agreement, and the model learns agreement rather than accuracy — a textbook proxy failure.',
            ),
            concept(
              'What is being done about it',
              '**Interpretability research.** Understanding what happens inside the network. Sparse autoencoders have extracted millions of human-interpretable features from production models — genuine progress, still far short of a full account.\n\n**Scalable oversight.** How do you supervise a system on tasks where you cannot easily check the answer? Debate, recursive reward modelling, and AI-assisted evaluation are the main approaches.\n\n**Constitutional AI.** Train against an explicit written set of principles, using model-generated critiques rather than human labels for much of the work. Makes the values legible and revisable.\n\n**Evaluations.** Systematic testing for dangerous capabilities and misuse before deployment. Now a formal part of frontier lab release processes and increasingly of regulation.\n\n**Red-teaming.** Adversarial testing by people trying to make the system misbehave.\n\nThe near-term problems — bias, misinformation, misuse, over-reliance — are concrete and present. The long-term ones are contested. Both benefit from the same work: understanding these systems better than we currently do.',
            ),
            multi(
              'Which are active approaches to alignment? (Select all)',
              [
                'Mechanistic interpretability',
                'Constitutional AI',
                'Systematic dangerous-capability evaluations',
                'Increasing model size',
              ],
              [0, 1, 2],
              ['sk-alignment'],
              'The first three are alignment work. Scale increases capability, which raises the stakes rather than resolving them.',
            ),
            trueFalse(
              'Goodhart\'s law says that optimising a proxy metric hard enough tends to break its relationship with the underlying goal.',
              true,
              ['sk-alignment'],
              'The tighter the optimisation, the more the gap between measure and intent gets exploited. It applies to recommender systems and RLHF alike.',
            ),
          ],
        }),
      ],
    },
  ],
};

// ---------------------------------------------------------------------------

export const reinforcementLearningTrack: Track = {
  id: 'track-rl',
  title: 'Reinforcement Learning',
  tagline: 'Learning from consequences instead of answers',
  description:
    'Agents, rewards, and the exploration problem — the framework behind game-playing systems, robotics, and the tuning of every modern assistant.',
  domain: 'reinforcement-learning',
  level: 'expert',
  icon: '🎮',
  gradient: ['#14B8A6', '#6366F1'],
  prerequisites: ['track-deep-learning'],
  outcomes: [
    'Frame a problem as states, actions, and rewards',
    'Explain the exploration-exploitation tradeoff',
    'Describe Q-learning and policy gradient methods',
    'Connect RL to how language models are tuned',
  ],
  units: [
    {
      id: 'unit-rl-1',
      title: 'Learning by Doing',
      description: 'The framework, the core algorithms, and where it breaks.',
      lessons: [
        lesson({
          id: 'lesson-rl-basics',
          title: 'Agents, Rewards, and Policies',
          summary: 'No labelled answers — only consequences.',
          level: 'intermediate',
          domain: 'reinforcement-learning',
          free: true,
          steps: [
            concept(
              'A different kind of learning',
              'Supervised learning has an answer key. Reinforcement learning has only consequences.\n\nThe vocabulary:\n\n**Agent** — the learner. **Environment** — everything it interacts with. **State** — the current situation. **Action** — what the agent can do. **Reward** — a scalar signal after each action. **Policy** — the agent\'s strategy, mapping states to actions.\n\nThe goal is to maximise **cumulative** reward over time, not immediate reward. That distinction is the entire difficulty. A chess move that loses a pawn to win the game twenty moves later must be recognised as good — which requires solving **credit assignment** across long delays.\n\nA **discount factor** γ (typically 0.95–0.99) weights future rewards slightly less than present ones, keeping the sum finite and expressing a preference for sooner.',
              { keyTerms: [{ term: 'Policy', definition: 'The agent\'s strategy: a mapping from states to actions.' }, { term: 'Discount factor', definition: 'γ, how much future reward is worth relative to immediate reward.' }] },
            ),
            match(
              'Map a self-driving car onto RL terms.',
              [
                { left: 'Sensor readings and current speed', right: 'State' },
                { left: 'Steer, accelerate, brake', right: 'Action' },
                { left: 'Progress made, penalty for hard braking', right: 'Reward' },
                { left: 'The driving strategy being learned', right: 'Policy' },
              ],
              ['sk-rl-basics'],
              'Framing a problem in these four terms is most of the work — and reward design is where most RL projects actually go wrong.',
            ),
            concept(
              'Exploration versus exploitation',
              'The agent knows one restaurant is good. Should it go back, or try a new one that might be better?\n\n**Exploit** and you guarantee known reward while possibly missing something better forever. **Explore** and you sacrifice immediate reward for information.\n\nThe standard approaches:\n\n**ε-greedy** — act greedily most of the time, randomly with probability ε. Crude and surprisingly effective.\n\n**Decaying ε** — explore heavily early, settle down as knowledge accumulates.\n\n**Upper confidence bound** — favour actions with high uncertainty, on the principle that optimism about the unknown is worth acting on.\n\nThis tradeoff is not confined to RL. It is A/B testing, it is clinical trial design, and it is why recommender systems that only exploit collapse into filter bubbles.',
            ),
            mcq(
              'An agent always picks its current best-known action. What is the risk?',
              [
                'It will overfit',
                'It may never discover a better action and lock into a suboptimal policy',
                'It will explore too much',
                'The reward will be negative',
              ],
              1,
              ['sk-exploration-exploitation'],
              'Pure exploitation converges on the best option *found so far*, which may be far from the best available. Without exploration there is no mechanism to discover the difference.',
            ),
            concept(
              'Value methods and policy methods',
              'Two families.\n\n**Value-based (Q-learning).** Learn `Q(state, action)` — the expected cumulative reward for taking that action in that state and behaving well afterwards. The policy is then just "pick the highest-Q action". **Deep Q-Networks** approximate Q with a neural network and famously learned to play Atari from raw pixels. Value methods suit discrete action spaces.\n\n**Policy-based (policy gradient).** Learn the policy directly as a probability distribution over actions, and push up the probability of actions that led to high reward. Handles continuous action spaces naturally — a robot arm has infinitely many possible joint angles, so enumerating Q over actions is impossible.\n\n**PPO** is the workhorse: a policy gradient method that constrains how far the policy can move in one update, which is what makes it stable enough to use in practice. It is also the algorithm behind RLHF — the "RL" in tuning a language model is usually PPO, with human preferences as the reward signal.',
            ),
            mcq(
              'A robot arm has continuous joint angles. Which family is more suitable?',
              [
                'Q-learning, because it is simpler',
                'Policy gradient methods, which handle continuous action spaces directly',
                'Neither works for robotics',
                'Supervised learning',
              ],
              1,
              ['sk-policy-gradient', 'sk-q-learning'],
              'Q-learning requires maximising over actions, which is intractable when actions are continuous. Policy methods output a distribution over the continuous space directly.',
            ),
            concept(
              'Why RL is hard in the real world',
              '**Sample inefficiency.** RL agents often need millions of episodes. Fine in a simulator, impossible for a physical robot or a live recommender.\n\n**Reward hacking.** The agent optimises exactly what you wrote, which is rarely exactly what you meant. Documented examples include agents that exploit physics-engine bugs to score, and simulated robots that grow tall and fall over rather than learning to walk.\n\n**The sim-to-real gap.** Policies trained in simulation exploit simulator inaccuracies that do not exist in reality. Domain randomisation — training across many perturbed simulations — is the standard mitigation.\n\n**Safety during learning.** Exploration means trying bad actions. Acceptable in a game; unacceptable for a surgical robot or a power grid.\n\nWhich is why RL\'s biggest commercial impact so far is not robotics or games. It is **RLHF** — where the environment is a conversation, the reward is a learned model of human preference, and the whole thing runs safely offline.',
            ),
            shortAnswer(
              'Why is reward hacking a fundamental problem rather than a bug to be fixed?',
              ['proxy', 'specify', 'exactly', 'intent', 'optimiser'],
              'Any reward function is a proxy for what you actually want, and specifying intent completely in a scalar is effectively impossible. A capable optimiser will find and exploit the gap between the proxy and the intent — the better the optimiser, the more reliably it does so.',
              ['sk-alignment', 'sk-rl-basics'],
              'This is Goodhart\'s law applied to RL, and it is the same problem alignment research works on at a larger scale.',
            ),
            numeric(
              'With γ = 0.9, what is the present value of a reward of 100 received 2 steps from now?',
              81,
              ['sk-rl-basics'],
              '0.9² × 100 = 81. Discounting compounds, so distant rewards shrink quickly — γ = 0.9 makes a reward 20 steps out worth about 12% of its face value.',
              { tolerance: 0.5 },
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-rl-1',
        title: 'RL Checkpoint',
        passingScore: 0.7,
        exercises: [
          mcq(
            'What does a policy represent?',
            [
              'The reward function',
              'A mapping from states to actions',
              'The environment dynamics',
              'The discount factor',
            ],
            1,
            ['sk-rl-basics'],
            'The policy is the strategy — what to do in each situation. It is what RL learns.',
          ),
          order(
            'Order the RLHF pipeline.',
            [
              'Sample multiple responses to the same prompt',
              'Collect human preference rankings over those responses',
              'Train a reward model to predict the rankings',
              'Optimise the policy against the reward model with PPO and a KL penalty',
            ],
            ['sk-rlhf', 'sk-policy-gradient'],
            'RLHF is standard policy-gradient RL where the reward comes from a learned model of human preference.',
          ),
          trueFalse(
            'RL agents are generally more sample-efficient than supervised learning.',
            false,
            ['sk-rl-basics'],
            'Far less. A sparse, delayed reward carries much less information per interaction than a labelled example, so RL typically needs orders of magnitude more experience.',
          ),
        ],
      },
    },
  ],
};
