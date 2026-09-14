/**
 * Tracks 8–10 — MLOps, Ethics & Governance, and Reinforcement Learning.
 *
 * Grouped in one file because each is a focused single-unit track rather than a
 * multi-unit subject.
 */

import type { Track } from '../../domain/types';
import { categorize, concept, interactive, lesson, match, mcq, multi, numeric, order, shortAnswer, trueFalse } from '../builders';

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
            interactive(
              'Watch a model degrade silently',
              'drift-monitor',
              'Advance the weeks and watch the input distribution drift away from training while every system-health metric stays green. Accuracy only confirms it months later — drift is the early warning.',
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
    // -----------------------------------------------------------------------
    {
      id: 'unit-mlops-2',
      title: 'Serving at Scale',
      description: 'What a prediction costs, and how to ship a new model without an outage.',
      lessons: [
        lesson({
          id: 'lesson-inference-cost',
          title: 'Latency, Throughput, and Cost',
          summary: 'The three numbers that decide whether a model can ship.',
          level: 'expert',
          domain: 'mlops',
          steps: [
            concept(
              'Three numbers that trade against each other',
              '**Latency** is how long one request takes. **Throughput** is how many requests per second the system handles. **Cost** is what that hardware bills. Improving any one usually worsens another.\n\nThe clearest example is **batching**. Hold requests for 50ms and serve them together and GPU utilisation jumps — throughput may double or triple, cost per request falls accordingly, and every single request got 50ms slower. Whether that is a win depends entirely on the product.\n\nTwo distinctions worth getting right early:\n\n**Measure p95 and p99, not the mean.** The mean hides the tail, and the tail is what users experience as "it is broken". A mean of 200ms with a p99 of 8 seconds means 1 in 100 requests is unusable — and a user making ten calls hits it most sessions.\n\n**Separate the two latencies that LLM serving has.** *Time to first token* is what feels like responsiveness, and streaming lets you optimise it almost independently. *Tokens per second* is what determines how long the full answer takes. A model with a slow TTFT feels broken even if it finishes quickly; a model with a fast TTFT and slow generation feels alive while it works.\n\nThe standard levers, roughly in order of return: **quantization** (8-bit or 4-bit weights — smaller, faster, usually near-lossless), **distillation** (train a small model to imitate a big one), **caching** (identical inputs, and KV-cache reuse for shared prefixes), **batching**, and **routing** (send the easy 80% to a cheap model, escalate the rest).',
              {
                keyTerms: [
                  { term: 'p99 latency', definition: 'The latency the slowest 1% of requests exceed. What users call "broken".' },
                  { term: 'Time to first token', definition: 'How long before a streaming response starts. The main driver of perceived speed.' },
                ],
              },
            ),
            mcq(
              'A service reports 180ms mean latency and users complain it hangs. What should you look at?',
              [
                'The throughput figure',
                'The p95 and p99 latencies — the mean is hiding a long tail',
                'The model’s accuracy',
                'The total monthly cost',
              ],
              1,
              ['sk-inference-cost'],
              'A long tail barely moves the mean but is exactly what users notice. If p99 is several seconds, one request in a hundred is a visible hang — and a session making ten requests hits it about 10% of the time.',
            ),
            mcq(
              'Batching requests for 50ms before serving them mainly trades what for what?',
              [
                'Accuracy for cost',
                'Per-request latency for throughput and cost efficiency',
                'Memory for accuracy',
                'Throughput for reliability',
              ],
              1,
              ['sk-inference-cost'],
              'Every request waits up to the batch window, while the GPU does far more useful work per unit of time. A background pipeline should batch aggressively; an interactive autocomplete should barely batch at all.',
            ),
            interactive(
              'Drop the precision',
              'quantization',
              'Move from 32-bit to 8-bit to 4-bit and watch memory and speed improve while error creeps up. Find the point where the quality cost starts to show — that point is the whole engineering decision.',
            ),
            categorize(
              'Sort each technique by what it primarily improves.',
              ['Mainly latency', 'Mainly throughput', 'Mainly cost'],
              [
                { item: 'Quantizing weights to 8-bit', category: 'Mainly latency' },
                { item: 'Streaming the response token by token', category: 'Mainly latency' },
                { item: 'Dynamic batching with a 50ms window', category: 'Mainly throughput' },
                { item: 'KV-cache reuse across requests sharing a prefix', category: 'Mainly throughput' },
                { item: 'Routing easy requests to a smaller model', category: 'Mainly cost' },
                { item: 'Caching responses to identical inputs', category: 'Mainly cost' },
              ],
              ['sk-inference-cost'],
              'Streaming is the interesting one: it does not make anything faster, it makes the wait *visible and progressive*, which is most of what users mean by responsive.',
            ),
            numeric(
              'A model costs £0.004 per request. At 2 million requests per month, what is the monthly bill in pounds?',
              8000,
              ['sk-inference-cost'],
              '£8,000 a month. This is the arithmetic that decides architectures: routing 80% of that traffic to a model costing a tenth as much saves over £5,700 a month, which is usually worth more engineering than a small accuracy gain.',
              { unit: '£' },
            ),
          ],
        }),

        lesson({
          id: 'lesson-rollouts',
          title: 'Shipping a Model Without Breaking Things',
          summary: 'Shadow, canary, A/B — four ways to be wrong in front of fewer people.',
          level: 'intermediate',
          domain: 'mlops',
          steps: [
            concept(
              'Offline metrics do not predict online behaviour',
              'Your new model beats the old one on every offline metric. This tells you less than it feels like it does.\n\nOffline evaluation uses historical data collected under the *old* model\'s behaviour, scores a metric that is a proxy for what you care about, and cannot observe how users respond to the change. Models that win offline and lose online are ordinary, not exotic.\n\nSo the deployment itself is an experiment, and there is a ladder of increasingly committed steps:\n\n**Shadow mode.** Send real traffic to the new model, log its predictions, serve the old model\'s. Zero user risk, real production inputs, and it catches the whole class of bugs that only appear on live data — schema drift, missing features, latency under real load. Always worth doing.\n\n**Canary.** Route a small slice — 1%, then 5% — to the new model and watch error rates and latency. Catches operational failures fast with bounded blast radius.\n\n**A/B test.** Route a proper proportion and compare *business* outcomes with statistics. The only step that actually answers "is this better", and the only one that needs a pre-registered metric and enough traffic for power.\n\n**Full rollout,** with the previous version still deployed and a rollback that takes seconds.\n\nThe discipline that makes this work is boring: **decide the success metric and the rollback trigger before you start.** Choosing the metric after seeing the numbers is how every inconclusive experiment gets declared a win.',
              { figure: 'mlops-lifecycle' },
            ),
            order(
              'Order the stages of a careful model rollout.',
              [
                'Shadow: mirror live traffic to the new model, serve the old one’s predictions',
                'Canary: route 1–5% of real traffic and watch error rates and latency',
                'A/B test: route a measured share and compare business metrics with statistics',
                'Full rollout, keeping the previous version warm for instant rollback',
              ],
              ['sk-rollout-strategy'],
              'Each step increases exposure and answers a different question — does it run, does it break, is it better, can it take the load. Skipping shadow mode is the most common shortcut and the one that surfaces as a 3am incident.',
            ),
            mcq(
              'What does shadow mode catch that an offline evaluation cannot?',
              [
                'Whether the model is more accurate',
                'Production-only failures: missing features, schema mismatches, latency under real load',
                'Whether users prefer the new model',
                'Whether the training data was biased',
              ],
              1,
              ['sk-rollout-strategy'],
              'Shadow mode runs the real serving path on real inputs, so it surfaces everything that differs between your notebook and production. It cannot tell you whether users prefer it — nobody sees its output — which is what the A/B test is for.',
            ),
            mcq(
              'An A/B test shows the new model lifts click-through by 0.3%, p = 0.31. What is the correct read?',
              [
                'Ship it — the direction is positive',
                'The result is not distinguishable from noise; either run longer for power or accept no evidence of improvement',
                'Reject the model permanently',
                'Switch to a different metric that shows significance',
              ],
              1,
              ['sk-ab-testing'],
              'p = 0.31 means an effect this size is unsurprising under no real difference. The honest options are more data or no conclusion. Hunting for a metric that happens to be significant is exactly how false positives get shipped.',
            ),
            trueFalse(
              'A model that wins on every offline metric will improve the product when deployed.',
              false,
              ['sk-rollout-strategy', 'sk-ab-testing'],
              'Offline metrics are proxies measured on data from the old system. Better ranking can reduce diversity, better precision can cut recall on the cases that mattered, and a slower model can lose more from latency than it gains from accuracy. Only an online test measures the thing you actually want.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-mlops-2',
        title: 'Serving Checkpoint',
        passingScore: 0.7,
        exercises: [
          mcq(
            'Users say a service hangs, but its mean latency is 180ms. What should you look at?',
            ['Throughput', 'The p95 and p99 latencies', 'Model accuracy', 'Monthly cost'],
            1,
            ['sk-inference-cost'],
            'A long tail barely moves the mean. If p99 is several seconds, one request in a hundred is a visible hang.',
          ),
          mcq(
            'Which rollout stage exposes a new model to real production inputs with no user risk?',
            ['Canary', 'Shadow mode', 'A/B test', 'Full rollout'],
            1,
            ['sk-rollout-strategy'],
            'Shadow mode mirrors live traffic and logs the new model’s predictions while still serving the old one’s.',
          ),
          trueFalse(
            'Batching requests trades per-request latency for throughput.',
            true,
            ['sk-inference-cost'],
            'Every request waits out the batch window while the hardware does far more work per second. Whether that is a win depends entirely on the product.',
          ),
        ],
      },
    },

    // -----------------------------------------------------------------------
    {
      id: 'unit-mlops-3',
      title: 'Keeping It Working',
      description: 'Models decay quietly. Monitoring is how you find out before users do.',
      lessons: [
        lesson({
          id: 'lesson-monitoring-retraining',
          title: 'Monitoring, Drift, and When to Retrain',
          summary: 'Every dashboard green, accuracy falling for six weeks.',
          level: 'intermediate',
          domain: 'mlops',
          steps: [
            concept(
              'Four layers, and only one of them is usually watched',
              'Software monitoring asks whether the service is up. Model monitoring has to ask whether it is still *right*, which is a much harder question because a decaying model returns perfectly well-formed answers at normal latency.\n\nFour layers, in increasing difficulty and increasing value:\n\n**Service health.** Latency, error rate, saturation. Necessary, and completely blind to model quality.\n\n**Input distribution.** Are the features arriving looking like the ones the model was trained on? Population stability index, KL divergence, or simply per-feature summary statistics against a training baseline. Catches **data drift** — and catches upstream pipeline breakage, which is more common than genuine drift and much easier to fix.\n\n**Prediction distribution.** Is the mix of outputs changing? A fraud model whose flag rate halves overnight is telling you something, and you learn it without waiting for labels.\n\n**Actual performance.** The real thing, and it needs ground-truth labels that usually arrive late — days for a delivery estimate, months for a loan default. That delay is the central difficulty: **by the time accuracy visibly drops you have been wrong for weeks.** The proxies above exist because of that lag.\n\nAnd distinguish the two kinds of drift, because the fix differs. **Data drift** is `P(x)` changing — the inputs move. **Concept drift** is `P(y | x)` changing — the same inputs now imply a different answer, which is what a pandemic, a new competitor, or a regulation change does. Data drift can sometimes be absorbed by retraining on recent data; concept drift usually invalidates the old data entirely.',
              {
                keyTerms: [
                  { term: 'Data drift', definition: 'The input distribution moves away from the training distribution.' },
                  { term: 'Concept drift', definition: 'The relationship between inputs and the correct output changes.' },
                  { term: 'Label lag', definition: 'The delay between a prediction and the ground truth arriving.' },
                ],
              },
            ),
            interactive(
              'Watch it decay while everything looks fine',
              'drift-monitor',
              'Let the model run and watch accuracy slide while latency, error rate and uptime stay perfectly healthy. Then look at the input distribution panel — that is the signal that moved first, and it is the one worth alerting on.',
            ),
            mcq(
              'Delivery-time predictions degrade after a logistics provider changes its routing. Which kind of drift is this?',
              [
                'Data drift — the inputs changed',
                'Concept drift — the same inputs now map to different correct outputs',
                'Label drift',
                'No drift; the model overfitted',
              ],
              1,
              ['sk-dataset-shift', 'sk-model-monitoring'],
              'The orders look the same; what changed is how long they now take. The input–output relationship moved, which means historical data is no longer describing the current world — retraining on it would relearn the old routing.',
            ),
            categorize(
              'Sort each signal by the monitoring layer it belongs to.',
              ['Service health', 'Input monitoring', 'Prediction monitoring', 'Performance monitoring'],
              [
                { item: 'p99 latency and 5xx rate', category: 'Service health' },
                { item: 'Population stability index per feature', category: 'Input monitoring' },
                { item: 'Share of requests with a null in a required field', category: 'Input monitoring' },
                { item: 'Average predicted probability drifting upward', category: 'Prediction monitoring' },
                { item: 'Fraction of flagged transactions confirmed as fraud', category: 'Performance monitoring' },
              ],
              ['sk-model-monitoring'],
              'The first four are all available immediately. Only the last needs labels — which is exactly why teams that monitor only the last one find out last.',
            ),
            concept(
              'Retraining: what triggers it, and what could go wrong',
              'Three triggers, and they suit different problems.\n\n**Scheduled.** Retrain weekly or monthly regardless. Simple, predictable, and either wasteful or too slow depending on how fast your world actually moves.\n\n**Triggered.** Retrain when drift or performance crosses a threshold. Efficient and responsive, and it requires the monitoring above to exist and to be trusted.\n\n**Continuous.** Online learning, updating constantly. Necessary for genuinely fast-moving domains and the most dangerous: a bad hour of data can poison the model before anyone notices, so it needs tight guards.\n\nWhatever the trigger, retraining is a deployment and gets the full rollout treatment — a new model is not automatically better than the one in production. Three specific hazards deserve naming:\n\n- **Training on your own outputs.** If the model influenced the data it is about to learn from, you are closing a feedback loop. Log the propensity of each decision so you can correct for it.\n- **The evaluation set ageing out.** A fixed held-out set slowly stops representing current traffic, so the metric keeps looking fine as reality diverges. Refresh it.\n- **Silent pipeline drift.** The retraining pipeline and the serving pipeline computing a feature slightly differently is the classic training/serving skew, and it is invisible until accuracy sags.',
            ),
            multi(
              'Which are sound reasons to retrain? (Select all)',
              [
                'Input distribution has shifted measurably from the training baseline',
                'Measured performance has dropped past an agreed threshold',
                'A new model architecture was released',
                'A known change in the world has broken the input–output relationship',
              ],
              [0, 1, 3],
              ['sk-retraining'],
              'The first, second and fourth are evidence that the current model no longer matches reality. A new architecture is a reason to run an experiment, not a reason to replace a model that is working.',
            ),
            shortAnswer(
              'Why do teams monitor input distributions rather than waiting for accuracy to drop?',
              ['labels', 'lag', 'delay', 'ground truth', 'weeks', 'early'],
              'Because ground-truth labels arrive late — days or months after the prediction — so accuracy is a lagging indicator. By the time it visibly falls the model has been making bad decisions for weeks. Input and prediction distributions are available immediately and move first, which makes them the early warning.',
              ['sk-model-monitoring'],
              'They are proxies and they do produce false alarms. Getting the warning early and occasionally wrong beats getting it accurate and six weeks late.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-mlops-3',
        title: 'MLOps Checkpoint',
        passingScore: 0.7,
        exercises: [
          mcq(
            'Which stage of a rollout exposes the new model to real production inputs without any user risk?',
            ['Canary', 'Shadow mode', 'A/B test', 'Full rollout'],
            1,
            ['sk-rollout-strategy'],
            'Shadow mode mirrors live traffic and logs the results while still serving the old model’s predictions.',
          ),
          mcq(
            'Which signal moves first when a model starts to degrade?',
            [
              'Measured accuracy',
              'The input feature distribution',
              'Service error rate',
              'Monthly cost',
            ],
            1,
            ['sk-model-monitoring'],
            'Inputs are observable immediately; accuracy waits on labels that may be weeks away.',
          ),
          trueFalse(
            'Batching requests improves throughput at the cost of per-request latency.',
            true,
            ['sk-inference-cost'],
            'Every request waits for the batch window while the hardware does far more work per second.',
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
            interactive(
              'See a fairness gap open up',
              'data-bias',
              'Change nothing but who is in the training data, and watch per-group accuracy split apart while the headline number stays respectable. This is what an aggregate metric hides.',
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
      checkpoint: {
        id: 'checkpoint-ethics-1',
        title: 'Interpretability Checkpoint',
        passingScore: 0.7,
        exercises: [
          mcq(
            'What does a feature-importance explanation actually tell you?',
            [
              'Why the model is correct',
              'Which inputs moved this model’s output, not whether the reasoning is sound',
              'The causal effect of each feature',
              'That the model is unbiased',
            ],
            1,
            ['sk-explainability'],
            'Attribution describes the model, not the world. A confident explanation of a wrong prediction is still a wrong prediction.',
          ),
          trueFalse(
            'A model that scores well on its objective is aligned with what its designers wanted.',
            false,
            ['sk-alignment'],
            'Only if the objective captured the intent. The gap between the two is the alignment problem, and optimisation finds that gap reliably.',
          ),
          mcq(
            'Which model is inherently easier to interpret?',
            [
              'A gradient-boosted ensemble of 500 trees',
              'A shallow decision tree',
              'A deep neural network with attention',
              'A random forest',
            ],
            1,
            ['sk-explainability'],
            'A shallow tree is a readable set of rules. Everything else on the list needs post-hoc attribution, which is an approximation of the model rather than the model itself.',
          ),
        ],
      },
    },
    // -----------------------------------------------------------------------
    {
      id: 'unit-ethics-2',
      title: 'Fairness You Can Measure',
      description: 'Turning "is it fair" into numbers — and finding out they contradict each other.',
      lessons: [
        lesson({
          id: 'lesson-fairness-metrics',
          title: 'Fairness Metrics and Their Tradeoffs',
          summary: 'Three reasonable definitions of fair. You cannot have all three.',
          level: 'expert',
          domain: 'ethics-safety',
          steps: [
            concept(
              'Three definitions, all defensible',
              '"Is the model fair?" is not answerable until you say which fairness you mean. Three of the common definitions:\n\n**Demographic parity.** The model approves the same *proportion* of each group. Appealing, and it ignores whether the groups genuinely differ on the outcome — which can mean approving worse candidates from one group to hit the number.\n\n**Equalised odds.** The true positive rate and false positive rate match across groups. Among people who will actually repay, the model approves the same share regardless of group; among those who will not, it wrongly approves the same share. Conditions on the truth, which most people find more intuitive.\n\n**Calibration (predictive parity).** A score of 0.7 means a 70% chance for everyone. Among all applicants scored 0.7, the same fraction of each group repays. This is what "the score means the same thing" amounts to, and it is what most risk teams already do.\n\nEach is a reasonable reading of fairness. Each is what some stakeholder means by the word. And they measure different things — so before any of this is a technical question, someone has to decide which harm the system exists to avoid.',
              {
                keyTerms: [
                  { term: 'Demographic parity', definition: 'Equal positive-prediction rates across groups.' },
                  { term: 'Equalised odds', definition: 'Equal true-positive and false-positive rates across groups.' },
                  { term: 'Calibration', definition: 'A given score means the same probability for every group.' },
                ],
              },
            ),
            concept(
              'The impossibility result',
              'This is the part that changes how you approach the problem.\n\nKleinberg, Mullainathan and Raghavan (2016), and independently Chouldechova, proved that **calibration and equalised odds cannot both hold** when base rates differ between groups — unless the classifier is perfect. It is not an engineering limitation to be solved with a better model. It is arithmetic.\n\nThe COMPAS recidivism debate is the canonical demonstration. ProPublica showed the tool had a higher false-positive rate for Black defendants — an equalised-odds violation. Northpointe responded that the scores were calibrated: a given score meant the same reoffending probability regardless of race. **Both were right.** Base rates in the data differed, so no algorithm could satisfy both, and the argument was never really about the maths.\n\nWhat follows practically:\n\n- **Choose the criterion deliberately, in writing, with the people affected in the room.** The choice is a value judgement about which errors are worse, and it belongs to the domain, not to the data scientist.\n- **Report the metrics you did not optimise.** A model card should state the criterion chosen and show where the others land.\n- **Remember that "fair model, unfair system" is common.** Fixing a metric while the training labels encode historical discrimination fixes a number, not an outcome.\n\nAnd the obvious move — delete the protected attribute — does not work. Postcode, name, education and purchase history are all correlated with it, so the model reconstructs the attribute from proxies. Worse, you have removed the ability to *measure* disparity while leaving the disparity intact. **Fairness through unawareness is not fairness.**',
            ),
            mcq(
              'Why can a classifier not be both calibrated and satisfy equalised odds across two groups with different base rates?',
              [
                'Because the training data is always biased',
                'It is a mathematical impossibility except for a perfect classifier — the criteria are incompatible when base rates differ',
                'Because calibration requires more data',
                'Because equalised odds is not well defined for more than two groups',
              ],
              1,
              ['sk-fairness-metrics'],
              'It is a proved impossibility, not a data problem. More data, a better architecture, and more careful labelling all leave it exactly where it was — which is why the decision is about which criterion matters here, not about how to satisfy both.',
            ),
            interactive(
              'Skew the sample, watch the groups diverge',
              'data-bias',
              'Change the composition of the training sample and watch per-group accuracy pull apart. Then try to equalise one metric and notice what happens to the others — that interaction is the impossibility result, visible.',
            ),
            mcq(
              'A team removes race from a lending model’s features. What has this achieved?',
              [
                'The model is now fair',
                'Little — correlated proxies remain, and the team has lost the ability to measure disparity',
                'Legal compliance in all jurisdictions',
                'A small accuracy improvement',
              ],
              1,
              ['sk-fairness-metrics', 'sk-algorithmic-bias'],
              'Postcode, employer, education and transaction history reconstruct the attribute. The disparity survives; only the measurement dies. Many fairness regimes explicitly require collecting the attribute in order to audit for disparity.',
            ),
            match(
              'Match each fairness criterion to the question it answers.',
              [
                { left: 'Do we approve the same share of each group?', right: 'Demographic parity' },
                { left: 'Among people who would repay, do we approve equally?', right: 'Equalised odds' },
                { left: 'Does a score of 0.7 mean 70% for everyone?', right: 'Calibration' },
                { left: 'Would the decision change if this person were in another group?', right: 'Counterfactual fairness' },
              ],
              ['sk-fairness-metrics'],
              'Four different questions, four different answers, and stakeholders who each assume their one is what "fair" obviously means. Naming the criterion is most of the work.',
            ),
          ],
        }),

        lesson({
          id: 'lesson-privacy',
          title: 'Privacy, PII, and Differential Privacy',
          summary: 'Models remember. Sometimes verbatim, and sometimes about people who opted out.',
          level: 'intermediate',
          domain: 'ethics-safety',
          steps: [
            concept(
              'Models memorise, and it can be extracted',
              'A large model trained on scraped text does not only learn patterns. It **memorises**, particularly things that appear rarely but exactly — phone numbers, addresses, API keys, chunks of a specific document.\n\nThis is demonstrable, not hypothetical. Carlini and colleagues extracted verbatim training examples from production language models, including personal information, by prompting in ways that made the memorised continuation likely. Membership inference attacks go further and answer a narrower question: *was this particular record in the training set?* — which is itself disclosive when the dataset is, say, a clinic\'s patient list.\n\nThe uncomfortable consequences:\n\n- **A trained model is derived personal data.** If the training set contained personal data, the weights may carry it.\n- **Deletion requests are genuinely hard.** Removing a row from the dataset does not remove its influence from a trained model, and retraining a large model to honour one request is rarely feasible. This is the open problem of *machine unlearning*.\n- **Anonymisation is weaker than it sounds.** Netflix\'s anonymised ratings were re-identified against public IMDb reviews; "anonymised" location traces are re-identifiable from a handful of points. Removing direct identifiers leaves a fingerprint made of everything else.',
              {
                keyTerms: [
                  { term: 'Membership inference', definition: 'Determining whether a specific record was in the training set.' },
                  { term: 'Machine unlearning', definition: 'Removing a training example’s influence from an already-trained model.' },
                ],
              },
            ),
            mcq(
              'Why does deleting a user’s row from the training dataset not fully satisfy a deletion request?',
              [
                'The backup still contains it',
                'The already-trained model retains that record’s influence in its weights and may still reproduce it',
                'Deletion requests do not apply to training data',
                'The data was anonymised so it cannot be deleted',
              ],
              1,
              ['sk-privacy'],
              'The weights were shaped by that row and can carry memorised fragments of it. Honouring the request properly means retraining without it — expensive at scale, and the reason unlearning is an active research area rather than a solved feature.',
            ),
            concept(
              'Differential privacy: a guarantee, at a price',
              '**Differential privacy** offers something stronger than "we removed the names": a mathematical guarantee that **the output is nearly the same whether or not any single individual was in the dataset.**\n\nThe mechanism is calibrated noise. For model training, DP-SGD clips each per-example gradient and adds Gaussian noise before the update, so no single example can move the weights much. The privacy budget **ε** quantifies the guarantee — smaller is stronger, and ε around 1 is considered strong while ε around 10 is weak but often still meaningful.\n\nThree things to understand about it:\n\n**It composes.** Every query against the data spends budget. Run enough analyses and the guarantee is gone, which is why real deployments track cumulative spend.\n\n**It costs accuracy**, and the cost lands unevenly. Noise disproportionately damages the model\'s performance on **underrepresented groups**, because their signal was smaller to begin with. Privacy and fairness genuinely pull against each other here.\n\n**It is a guarantee about the mechanism, not about your pipeline.** DP on training does nothing about a logging system that stores raw prompts.\n\nThe cheaper measures still matter and are what most systems actually need: collect less, retain for less time, redact before training, keep the data in the region it came from, and be able to say which model version saw which data.',
            ),
            trueFalse(
              'Removing names and ID numbers is generally sufficient to anonymise a dataset.',
              false,
              ['sk-privacy'],
              'The remaining fields act as a fingerprint. Postcode, birth date and sex alone identify a large share of a population, and re-identification against a public dataset is a well-established attack — the Netflix Prize data being the textbook case.',
            ),
            multi(
              'Which are true of differential privacy? (Select all)',
              [
                'It bounds how much any single record can influence the output',
                'The privacy budget is consumed across successive queries',
                'It usually costs accuracy, disproportionately for small subgroups',
                'It guarantees no personal data exists anywhere in the system',
              ],
              [0, 1, 2],
              ['sk-privacy'],
              'The fourth is the common misreading. DP constrains a specific mechanism — it says nothing about raw data sitting in your logs, your warehouse, or a vendor’s systems.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-ethics-2',
        title: 'Fairness Checkpoint',
        passingScore: 0.7,
        exercises: [
          mcq(
            'Two groups have different base rates. Which pair of fairness criteria cannot both hold?',
            [
              'Demographic parity and equalised odds',
              'Calibration and equalised odds',
              'Calibration and demographic parity',
              'All three can hold simultaneously',
            ],
            1,
            ['sk-fairness-metrics'],
            'The Kleinberg and Chouldechova impossibility result: with unequal base rates, only a perfect classifier satisfies both. It is arithmetic, not an engineering gap.',
          ),
          trueFalse(
            'Anonymising a dataset by removing names and ID numbers makes re-identification impractical.',
            false,
            ['sk-privacy'],
            'The remaining fields act as a fingerprint. Postcode, birth date and sex alone identify most of a population, and the Netflix Prize data was re-identified against public reviews.',
          ),
          mcq(
            'What does differential privacy actually guarantee?',
            [
              'No personal data exists anywhere in the system',
              'The output is nearly unchanged whether or not any single individual was in the dataset',
              'The model cannot be reverse-engineered',
              'Training data is encrypted',
            ],
            1,
            ['sk-privacy'],
            'It bounds one record’s influence on the output. It says nothing about raw data sitting in your logs or a vendor’s systems.',
          ),
        ],
      },
    },

    // -----------------------------------------------------------------------
    {
      id: 'unit-ethics-3',
      title: 'Rules and Responsibility',
      description: 'What regulators ask for, and what a responsible launch actually involves.',
      lessons: [
        lesson({
          id: 'lesson-governance',
          title: 'Regulation and Documentation',
          summary: 'Risk tiers, model cards, and being able to answer "why did it decide that?"',
          level: 'intermediate',
          domain: 'ethics-safety',
          steps: [
            concept(
              'Regulation sorts by risk, not by technology',
              'AI regulation has converged on a shape worth understanding, because it determines what you have to build.\n\nThe **EU AI Act** is the most developed example and it tiers by **use case**, not by model size or architecture:\n\n- **Unacceptable** — banned outright. Social scoring by governments, most real-time remote biometric identification in public spaces, emotion inference at work and school.\n- **High risk** — permitted with substantial obligations. Employment, credit, education, essential services, law enforcement, medical devices. Requires risk management, data governance, documentation, logging, human oversight, and conformity assessment before market.\n- **Limited risk** — transparency duties. Tell people they are talking to an AI; label synthetic media.\n- **Minimal risk** — spam filters, recommendations. Essentially unregulated.\n\nOther regimes rhyme. **GDPR Article 22** restricts solely automated decisions with legal or similarly significant effects and grants a right to meaningful information about the logic involved. US sectoral law (ECOA, FCRA) has required **adverse action notices** — a specific reason for a denial — for decades. Several jurisdictions require bias audits for automated hiring tools.\n\nThe engineering consequence is the same everywhere: **if the decision materially affects someone, you must be able to explain it, log it, and have a human review it.** That is an architecture requirement, and retrofitting it into a system that cannot reproduce last quarter\'s decisions is painful.',
              {
                keyTerms: [
                  { term: 'High-risk system', definition: 'A use case with substantial obligations under risk-tiered AI regulation.' },
                  { term: 'Adverse action notice', definition: 'A specific, individualised reason given when an application is denied.' },
                ],
              },
            ),
            categorize(
              'Sort each system by its likely EU AI Act risk tier.',
              ['High risk', 'Limited risk', 'Minimal risk'],
              [
                { item: 'CV screening that ranks job applicants', category: 'High risk' },
                { item: 'Credit scoring for consumer loans', category: 'High risk' },
                { item: 'A customer service chatbot', category: 'Limited risk' },
                { item: 'An image generator that must label its output as synthetic', category: 'Limited risk' },
                { item: 'A spam filter', category: 'Minimal risk' },
                { item: 'Product recommendations in a shop', category: 'Minimal risk' },
              ],
              ['sk-ai-governance'],
              'The tier follows consequences for the individual, not sophistication. A simple logistic regression deciding loans is high risk; a far larger model recommending films is not.',
            ),
            concept(
              'Model cards: writing down what it cannot do',
              'A **model card** is short structured documentation shipped with a model. It began as a research proposal (Mitchell et al., 2019) and is now close to a regulatory expectation for high-risk systems.\n\nWhat a useful one contains:\n\n- **Intended use** — and, more importantly, **out-of-scope use**. Naming what it must not be used for is the section that prevents the most harm.\n- **Training data** — sources, time period, known gaps, consent basis.\n- **Performance disaggregated by group** — not one headline number. A card reporting only overall accuracy is hiding the thing the card exists to reveal.\n- **Known limitations and failure modes** — the cases where it is unreliable, stated plainly.\n- **Ethical considerations** — foreseeable harms and what mitigates them.\n- **Version, date, and contact** — so a later reader can tell what they are looking at.\n\nThe reason it works is not the document. It is that **writing the card forces the questions to be asked while there is still time to act on them.** Teams routinely discover during the disaggregated-performance section that they never measured it, and a third of the time the answer is uncomfortable.\n\nThe companion artefact, **datasheets for datasets**, does the same job one layer down: why the dataset was created, who is in it, how it was collected, what it should not be used for.',
            ),
            mcq(
              'Which section of a model card does the most to prevent harm in practice?',
              [
                'Overall accuracy',
                'Out-of-scope uses — an explicit statement of what the model must not be used for',
                'Model architecture',
                'Training hardware',
              ],
              1,
              ['sk-model-cards'],
              'Most real-world harm comes from deployment outside the conditions a model was built and validated for. Writing the boundary down is what lets a later team — who were not in the original room — know they have crossed it.',
            ),
            multi(
              'Which belong in a model card for a high-risk system? (Select all)',
              [
                'Performance broken down by demographic group',
                'Known failure modes and conditions of unreliability',
                'The exact model weights',
                'Training data sources, time period, and known gaps',
              ],
              [0, 1, 3],
              ['sk-model-cards'],
              'Weights are the artefact, not documentation of it. The other three are precisely what a reviewer, an auditor or the next team needs and cannot reconstruct.',
            ),
            trueFalse(
              'A simple logistic regression used for credit decisions falls outside high-risk AI regulation because it is not deep learning.',
              false,
              ['sk-ai-governance'],
              'Risk tiers follow the use case and its consequences for people, not the technique. Credit scoring is high risk whether it runs on a transformer or on a spreadsheet.',
            ),
          ],
        }),

        lesson({
          id: 'lesson-responsible-deployment',
          title: 'Deploying Responsibly',
          summary: 'Red-team it, stage it, watch it, and know how to turn it off.',
          level: 'intermediate',
          domain: 'ethics-safety',
          steps: [
            concept(
              'Red-teaming: attack it before someone else does',
              'Standard evaluation asks whether the system works for cooperative users. **Red-teaming** asks what a motivated adversary — or an ordinary user having a bad day — can make it do.\n\nThe categories worth covering, because they fail differently:\n\n- **Harmful content.** Can it be induced to produce instructions for harm, harassment, or material about minors? Test with indirection, hypotheticals, role-play, and translation, not just direct requests.\n- **Prompt injection.** Can content in a retrieved document or a web page redirect the system? This is the critical one for anything with tools, and the attacker does not need access to your product — only to something your product reads.\n- **Bias and stereotyping.** Run matched-pair tests: identical inputs varying only a name or a pronoun, and compare outputs.\n- **Privacy.** Can training data or another user\'s data be extracted?\n- **Overreliance.** What happens when it is confidently wrong in a domain the user cannot check? This is the most under-tested category and often the most damaging.\n\nThe discipline that makes red-teaming real rather than decorative: **bring people who did not build it**, include domain experts and people from affected groups, write findings down with reproductions, and **fix or explicitly accept each one before launch**. A red-team report with no decisions attached is a document, not a control.',
              {
                keyTerms: [
                  { term: 'Red-teaming', definition: 'Adversarial testing that tries to make a system fail or misbehave.' },
                  { term: 'Matched-pair testing', definition: 'Identical inputs varying only a protected attribute, to expose disparate treatment.' },
                ],
              },
            ),
            multi(
              'Which make a red-team exercise meaningful rather than performative? (Select all)',
              [
                'Including people who did not build the system',
                'Recording each finding with a reproduction and a decision to fix or accept',
                'Testing only the failure modes the team already anticipated',
                'Including domain experts and people from affected groups',
              ],
              [0, 1, 3],
              ['sk-red-teaming'],
              'Testing only anticipated failures measures what you already know. The value of red-teaming comes entirely from perspectives the builders do not have — which is why who is in the room determines what gets found.',
            ),
            concept(
              'The launch checklist',
              'What separates a responsible launch from an ordinary one is mostly decided before any user sees it.\n\n**Before launch**\n\n- The **out-of-scope uses** are written down and the team agrees on them.\n- Performance is measured **disaggregated by group**, not only in aggregate.\n- Red-team findings are each fixed or explicitly accepted, with a name against the decision.\n- A **human review path** exists for consequential decisions, and reviewers can see enough to actually review.\n- **Logging** is sufficient to reconstruct any individual decision later — inputs, model version, output, and the reason surfaced.\n- The **rollback** is tested, not assumed.\n\n**At launch**\n\n- Stage it: internal, then a small cohort, then wider. Exposure should grow only as evidence does.\n- Disclose that it is AI where a person could reasonably be misled.\n- Give users a route to **contest or appeal** an outcome that affects them.\n\n**After launch**\n\n- Monitor the disaggregated metrics, not just the aggregate — a falling overall number is easy, a stable overall number hiding a collapsing subgroup is the one that gets missed.\n- Route complaints back into the evaluation set.\n- Re-run the fairness and red-team analysis on every significant retrain.\n\nThe pattern underneath all of it: **build the ability to answer questions before anyone asks them.** "Why was this application declined?" is answerable if you logged the inputs, the version and the reason at decision time, and unanswerable otherwise — and that is the difference between an incident and a crisis.',
              { figure: 'mlops-lifecycle' },
            ),
            order(
              'Order a staged, responsible rollout.',
              [
                'Red-team the system and resolve or explicitly accept each finding',
                'Release internally and measure performance disaggregated by group',
                'Release to a limited external cohort with human review on consequential decisions',
                'Expand exposure while monitoring subgroup metrics and complaint channels',
              ],
              ['sk-responsible-deployment'],
              'Exposure grows only as evidence accumulates. Each stage is a chance to stop, and the human review path is loosened last — not first.',
            ),
            mcq(
              'Which single engineering decision most determines whether you can answer "why was this decision made?" a year later?',
              [
                'Choosing an interpretable model family',
                'Logging inputs, model version, output and surfaced reason at decision time',
                'Publishing a model card',
                'Running a fairness audit before launch',
              ],
              1,
              ['sk-responsible-deployment', 'sk-explainability'],
              'All four help, but without the log there is nothing to explain — the inputs are gone and the model has been retrained twice. Interpretability tells you how the current model behaves; the log tells you what actually happened to that person on that day.',
            ),
            shortAnswer(
              'Why should post-launch monitoring track metrics disaggregated by group rather than only in aggregate?',
              ['subgroup', 'aggregate', 'hide', 'average', 'group', 'masks'],
              'Because an aggregate number is dominated by the largest group, so a serious degradation for a small subgroup can leave the headline metric flat. The people most likely to be harmed are the ones least able to move the average, which means aggregate-only monitoring is structurally blind to exactly the failures that matter most.',
              ['sk-responsible-deployment', 'sk-fairness-metrics'],
              'The same argument as measuring p99 latency rather than the mean — the average is not where the harm lives.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-ethics-3',
        title: 'Ethics & Governance Checkpoint',
        passingScore: 0.7,
        exercises: [
          mcq(
            'Why can a classifier not be both calibrated and satisfy equalised odds when base rates differ?',
            [
              'The training data is biased',
              'It is mathematically impossible except for a perfect classifier',
              'Calibration needs more data',
              'Equalised odds only works for two groups',
            ],
            1,
            ['sk-fairness-metrics'],
            'A proved impossibility result, not an engineering gap. The decision is which criterion the system is accountable to.',
          ),
          trueFalse(
            'Dropping the protected attribute from the feature set makes a model fair.',
            false,
            ['sk-fairness-metrics'],
            'Proxies reconstruct it, and you have destroyed your ability to measure the disparity you left in place.',
          ),
          mcq(
            'Which model card section prevents the most harm in practice?',
            ['Architecture', 'Out-of-scope uses', 'Training hardware', 'Parameter count'],
            1,
            ['sk-model-cards'],
            'Most harm comes from use outside validated conditions. Writing the boundary down is what lets a later team recognise they have crossed it.',
          ),
        ],
      },
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
            interactive(
              'Train an agent in a gridworld',
              'q-learning',
              'Run episodes and watch the Q-table fill in as reward propagates backwards from the goal. Set epsilon to 0 and watch the agent lock onto the first path it stumbles across, however bad.',
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
    // -----------------------------------------------------------------------
    {
      id: 'unit-rl-2',
      title: 'Value Methods',
      description: 'Estimating how good a state is, and acting on the estimate.',
      lessons: [
        lesson({
          id: 'lesson-exploration',
          title: 'Exploration vs Exploitation',
          summary: 'Take the known-good option, or find out whether something better exists?',
          level: 'intermediate',
          domain: 'reinforcement-learning',
          steps: [
            concept(
              'The dilemma, and why it has no clean answer',
              'You know restaurant A is good. Restaurant B is unknown. Go to A and you get a reliable meal. Go to B and you might find something better — or waste the evening.\n\nThat is the entire problem, and it is unavoidable: **the only way to learn the value of an action is to take it**, and every time you take an unknown action you forgo a known reward.\n\nExploit too much and you lock onto the first decent option and never discover the better one — a recommender that only ever shows what already worked, forever. Explore too much and you spend your whole budget on measurement and bank nothing.\n\nThe standard strategies, in increasing sophistication:\n\n**ε-greedy.** Act greedily with probability 1 − ε, act randomly with probability ε. Crude and remarkably effective. Usually ε is decayed over time — explore early when you know nothing, exploit later when you do.\n\n**Optimistic initialisation.** Start every action\'s estimated value implausibly high. Each one then gets tried at least once and is disappointed down to its true value. Exploration falls out of the initialisation rather than needing randomness at all.\n\n**Upper confidence bound.** Choose the action with the best *optimistic* estimate — value plus a bonus that grows with uncertainty. This explores *the actions it is least sure about* rather than uniformly at random, which is strictly smarter than ε-greedy and is why UCB has regret bounds that ε-greedy cannot match.\n\n**Thompson sampling.** Keep a probability distribution over each action\'s value, sample from it, act on the sample. Exploration emerges naturally from uncertainty, and it is usually the strongest of the four in practice.',
              {
                keyTerms: [
                  { term: 'ε-greedy', definition: 'Act greedily most of the time; act at random a fraction ε of the time.' },
                  { term: 'Regret', definition: 'Cumulative reward lost by not always choosing the best action.' },
                ],
              },
            ),
            mcq(
              'A recommender always shows the highest-scoring items and its catalogue slowly narrows. What is happening?',
              [
                'The model is overfitting',
                'Pure exploitation — items never shown accumulate no evidence, so they never look good enough to show',
                'The learning rate is too low',
                'The reward signal is delayed',
              ],
              1,
              ['sk-exploration-exploitation'],
              'This is the exploration failure in its most common commercial form. No exploration means no data on unshown items, which means they stay unshown — the feedback loop closes on itself. Forcing some exploration is what keeps the catalogue alive.',
            ),
            mcq(
              'Why does UCB explore more intelligently than ε-greedy?',
              [
                'It explores more often',
                'It directs exploration at the actions it is most uncertain about, rather than choosing uniformly at random',
                'It never explores after the first phase',
                'It requires fewer samples per action',
              ],
              1,
              ['sk-exploration-exploitation'],
              'ε-greedy spends its exploration budget uniformly, including on actions it has already established are bad. UCB adds a bonus that grows with uncertainty, so the exploration goes where information is actually still available.',
            ),
            categorize(
              'Sort each behaviour as exploration or exploitation.',
              ['Exploration', 'Exploitation'],
              [
                { item: 'Serving the ad with the highest measured click-through rate', category: 'Exploitation' },
                { item: 'Showing a new item to 1% of users to measure its appeal', category: 'Exploration' },
                { item: 'Sampling an action from its posterior value distribution', category: 'Exploration' },
                { item: 'Always taking the action with the highest current Q-value', category: 'Exploitation' },
              ],
              ['sk-exploration-exploitation'],
              'Thompson sampling sits on the exploration side because the sampling step deliberately lets a less-certain action win sometimes — the uncertainty is doing the exploring.',
            ),
            trueFalse(
              'A well-tuned agent should stop exploring entirely once it has found a good policy.',
              false,
              ['sk-exploration-exploitation'],
              'Only in a world that never changes. Real environments shift — tastes move, competitors appear, supply changes — and an agent with zero exploration cannot detect that its "good" policy has stopped being good. Most production systems keep a small permanent exploration budget for exactly this reason.',
            ),
          ],
        }),

        lesson({
          id: 'lesson-q-learning',
          title: 'Q-Learning',
          summary: 'Learn the value of every action in every state, one update at a time.',
          level: 'expert',
          domain: 'reinforcement-learning',
          steps: [
            concept(
              'The Q-table and the update rule',
              '`Q(s, a)` is the answer to one question: *if I am in state s, take action a, and behave well afterwards, what total reward should I expect?*\n\nStore that for every state–action pair and the policy is trivial — in any state, take the action with the highest Q. The whole problem is filling the table.\n\nQ-learning fills it with one rule, applied after every step:\n\n`Q(s, a) ← Q(s, a) + α [ r + γ · max Q(s′, a′) − Q(s, a) ]`\n\nRead it as *nudge the old estimate toward a better one*. The better estimate is `r + γ · max Q(s′, a′)`: the reward you just got, plus the discounted value of the best you can do from wherever you landed. The bracketed difference is the **temporal-difference error** — how wrong the old estimate was — and **α** controls how far you move.\n\n**γ**, the discount factor, decides how far ahead the agent cares. At γ = 0 it is purely greedy about immediate reward. At γ = 0.99 a reward 100 steps away still counts for about a third of its face value.\n\nThe striking property: the agent never needs a model of the environment. It does not know the rules, the transitions, or where the goal is. It only needs to try things and observe what happened. Value propagates backwards from the goal one step per episode — which is exactly what you watch happening in the widget below.',
              {
                keyTerms: [
                  { term: 'Q-value', definition: 'Expected total future reward from taking action a in state s and acting well thereafter.' },
                  { term: 'Discount factor γ', definition: 'How much future reward is worth relative to immediate reward.' },
                  { term: 'TD error', definition: 'The gap between the old estimate and the better one, and the size of the correction.' },
                ],
              },
            ),
            interactive(
              'Watch value flood backwards',
              'q-learning',
              'Train the agent and watch Q-values spread out from the goal, one square per episode. Then raise and lower the discount factor and see how far the agent is willing to look ahead.',
            ),
            numeric(
              'With α = 0.5, γ = 0.9, current Q(s, a) = 2, reward r = 1, and max Q(s′, a′) = 4, what is the updated Q(s, a)?',
              3.3,
              ['sk-q-learning'],
              'The target is `1 + 0.9 × 4 = 4.6`. The TD error is `4.6 − 2 = 2.6`. Move half of it: `2 + 0.5 × 2.6 = 3.3`. The estimate moves toward the target, not all the way to it — which is what makes learning stable under noisy rewards.',
              { tolerance: 0.01, hint: 'Compute the target first, then move α of the way toward it.' },
            ),
            mcq(
              'Why does Q-learning not need a model of the environment?',
              [
                'It memorises every episode it has seen',
                'The update only uses the reward and next state it actually observed, so the dynamics never have to be written down',
                'It assumes all transitions are equally likely',
                'It plans ahead using a simulator',
              ],
              1,
              ['sk-q-learning'],
              'Each update is built from one observed transition. The environment\'s rules stay unknown; they are absorbed implicitly through the experience of acting in it. This is what "model-free" means.',
            ),
            mcq(
              'A gridworld agent is trained with γ = 0.1 and never finds the distant goal. What is the most likely cause?',
              [
                'The learning rate is too high',
                'The discount factor is so low that reward more than a couple of steps away is worth almost nothing',
                'The Q-table is too small',
                'Exploration is disabled',
              ],
              1,
              ['sk-q-learning'],
              'At γ = 0.1 a reward ten steps away is worth 10⁻¹⁰ of its face value — indistinguishable from zero. The agent is not failing to learn; it is correctly learning that the goal is worthless under the discount you specified.',
            ),
            trueFalse(
              'Q-learning requires the agent to follow the policy it is learning about.',
              false,
              ['sk-q-learning'],
              'Q-learning is **off-policy** — the `max` in the update refers to the best action available, not the one the agent actually took. That is why it can explore randomly and still converge on the optimal policy, and it is precisely what distinguishes it from SARSA.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-rl-2',
        title: 'Value Methods Checkpoint',
        passingScore: 0.7,
        exercises: [
          numeric(
            'With α = 0.5, γ = 1.0, Q(s, a) = 4, reward = 2, and max Q(s′, a′) = 6, what is the updated Q(s, a)?',
            6,
            ['sk-q-learning'],
            'Target is 2 + 6 = 8; the TD error is 8 − 4 = 4; move half of it: 4 + 2 = 6.',
            { tolerance: 0.01 },
          ),
          mcq(
            'Why does UCB explore more efficiently than ε-greedy?',
            [
              'It explores more often',
              'It directs exploration at the actions it is least certain about rather than choosing at random',
              'It stops exploring sooner',
              'It needs fewer samples per action',
            ],
            1,
            ['sk-exploration-exploitation'],
            'ε-greedy spends its exploration budget uniformly, including on actions already known to be bad. UCB sends it where information remains.',
          ),
          trueFalse(
            'Q-learning requires the agent to follow the policy it is learning about.',
            false,
            ['sk-q-learning'],
            'It is off-policy: the max in the update refers to the best available action, not the one taken. That is why it can explore randomly and still converge on the optimal policy.',
          ),
        ],
      },
    },

    // -----------------------------------------------------------------------
    {
      id: 'unit-rl-3',
      title: 'Policies and Rewards',
      description: 'Optimising the policy directly, and the trouble with saying what you want.',
      lessons: [
        lesson({
          id: 'lesson-policy-gradients',
          title: 'Policy Gradients and PPO',
          summary: 'Skip the value table. Adjust the behaviour itself.',
          level: 'expert',
          domain: 'reinforcement-learning',
          steps: [
            concept(
              'Optimise the policy, not the values',
              'Q-learning learns values and derives a policy from them. **Policy gradient methods** skip the middle step: parameterise the policy directly as a network `π(a | s)` and adjust its weights to increase expected reward.\n\nThe core move, in one sentence: **take an action, see how it went, and make that action more likely if it went well and less likely if it did not** — scaled by how much better or worse than expected.\n\nThis buys three things value methods struggle with:\n\n- **Continuous action spaces.** A robot joint angle has no `max` over actions to take. A policy network just outputs the angle.\n- **Stochastic policies.** Sometimes the optimal behaviour is genuinely randomised — bluffing, or any adversarial setting. A policy can represent that; an argmax over Q cannot.\n- **Smoothness.** Small weight changes make small policy changes, where a tiny Q update can flip the argmax and change behaviour discontinuously.\n\nThe cost is variance. The gradient estimate comes from sampled trajectories, and it is noisy — which is why the plain version is unusable and every practical method is about variance reduction. A **baseline** (subtracting the average expected return) is the first fix; **actor–critic** methods learn that baseline with a second network, combining both families.',
              { keyTerms: [{ term: 'Policy gradient', definition: 'Adjusting policy parameters directly in the direction that increases expected return.' }] },
            ),
            concept(
              'Why PPO became the default',
              'The dangerous failure of policy gradients is a step that is too large. Push the policy too far in one update and it lands somewhere much worse — and unlike supervised learning you cannot simply recover, because the *data you collect next* now comes from that bad policy. Collapse is self-reinforcing.\n\n**Proximal Policy Optimization** fixes this with an unglamorous trick: clip the update so the new policy cannot move too far from the old one in a single step. If the ratio between new and old action probabilities leaves a small band around 1, the objective is clipped and the gradient stops pushing.\n\nThat is essentially the whole idea, and it is why PPO won. It is far simpler than the trust-region methods that preceded it, has few hyperparameters, tolerates the ones it has, and rarely collapses. **Reliability beat sophistication** — the same story as diffusion versus GANs.\n\nPPO is also what does the "RL" in **RLHF**. The reward model — trained on human preference comparisons — supplies the reward, and PPO nudges the language model toward higher-scoring outputs while a KL penalty stops it drifting too far from the base model. Without that constraint the policy finds degenerate text that scores highly and reads like nothing a person would write, which is the specification-gaming problem the next lesson is about.',
              { figure: 'rlhf-pipeline' },
            ),
            mcq(
              'What does PPO’s clipping actually prevent?',
              [
                'Overfitting to the training environment',
                'A single update moving the policy so far that performance collapses and the next batch of data comes from a broken policy',
                'The reward from becoming negative',
                'The value network from diverging',
              ],
              1,
              ['sk-policy-gradient'],
              'In RL your data distribution is generated by your current policy, so a bad update poisons everything that follows. Clipping bounds how far one step can move, which is what makes training survivable.',
            ),
            match(
              'Match each setting to the method that suits it.',
              [
                { left: 'Discrete actions in a small gridworld', right: 'Q-learning' },
                { left: 'Continuous robot joint angles', right: 'Policy gradient' },
                { left: 'Fine-tuning a language model on human preferences', right: 'PPO' },
                { left: 'A policy that must stay genuinely randomised', right: 'Stochastic policy network' },
              ],
              ['sk-policy-gradient', 'sk-q-learning'],
              'The dividing line is usually the action space: discrete and small favours value methods, continuous or requiring randomness favours policy methods.',
            ),
            multi(
              'Which are genuine advantages of policy gradient methods over Q-learning? (Select all)',
              [
                'They handle continuous action spaces naturally',
                'They can represent stochastic policies',
                'They have lower gradient variance',
                'Small parameter changes produce small behaviour changes',
              ],
              [0, 1, 3],
              ['sk-policy-gradient'],
              'Variance is the weakness, not the strength — it is the reason baselines, actor–critic, and clipping all exist. The other three are the reasons to reach for policy methods at all.',
            ),
          ],
        }),

        lesson({
          id: 'lesson-reward-design',
          title: 'Reward Design and Specification Gaming',
          summary: 'The agent will optimise exactly what you wrote. That is the problem.',
          level: 'expert',
          domain: 'reinforcement-learning',
          steps: [
            concept(
              'You get what you measure, precisely',
              'An RL agent has no idea what you meant. It optimises the number you gave it, with total literal-mindedness and no common sense to fall back on.\n\nThe documented examples are genuinely funny until you notice the pattern:\n\n- A boat-racing agent rewarded for score found a lagoon where it could circle forever collecting respawning power-ups, never finishing the race, scoring higher than any human.\n- A robot rewarded for how high its block ended up flipped the block over so the *underside* was high, rather than lifting anything.\n- A simulated creature rewarded for forward velocity grew very tall and fell over, converting height into velocity.\n- An agent in a game rewarded for staying alive learned to pause the game indefinitely.\n\nNone of these is a bug in the algorithm. **Each is a correct solution to the problem as specified**, and each exploits a gap between the metric and the intent.\n\nThis is the same phenomenon as Goodhart\'s law — "when a measure becomes a target, it ceases to be a good measure" — and the same phenomenon as every proxy metric that has gone wrong in a business. RL just finds the gap faster and more thoroughly than people do, because it is searching for exactly that.',
              {
                keyTerms: [
                  { term: 'Specification gaming', definition: 'Achieving high reward in a way that violates the designer’s intent.' },
                  { term: 'Reward hacking', definition: 'Exploiting a flaw in the reward function rather than solving the task.' },
                ],
              },
            ),
            mcq(
              'A cleaning robot is rewarded for the amount of mess it collects. What should you expect it to learn?',
              [
                'To clean more thoroughly',
                'To create mess so it can collect it again',
                'To clean faster',
                'To avoid rooms that are already clean',
              ],
              1,
              ['sk-reward-design'],
              'Collecting mess is the metric, so manufacturing mess is a legitimate way to maximise it. The intent was "leave the room clean" — which would be measured by the *state* of the room, not by throughput. Nearly every reward-hacking story is this substitution of a rate for a state.',
            ),
            concept(
              'Four defences, none of them complete',
              '**Reward the outcome, not the proxy.** Measure the state of the world you wanted, not an activity that correlates with reaching it. Cleanliness of the room, not volume collected. Harder to measure, much harder to game.\n\n**Penalise side effects.** Add a cost for changing things the task did not require. Useful and genuinely difficult to specify — "do not disturb anything unnecessary" is hard to write as a number, and an over-strong penalty produces an agent too timid to act.\n\n**Learn the reward from humans.** Rather than writing the function, learn it from preference comparisons — this is the reward model in RLHF. It captures nuance no hand-written function would. It also introduces a new target: the agent can now game the reward *model*, which is why RLHF pipelines add a KL penalty against the base policy and re-collect preference data as the policy moves.\n\n**Red-team the reward before training.** Ask, deliberately and in writing: what is the stupidest behaviour that would score well here? People are reasonably good at this once prompted, and it is far cheaper than discovering it after a training run.\n\nAnd the general principle worth carrying beyond RL: **any sufficiently optimised proxy metric stops measuring what it was chosen for.** Engagement optimisation found outrage. Click-through optimisation found clickbait. Neither system was broken; both were working exactly as specified.',
            ),
            multi(
              'Which reduce specification gaming? (Select all)',
              [
                'Rewarding the final state of the world rather than an activity rate',
                'Adding a penalty for unnecessary side effects',
                'Increasing the learning rate so the agent converges faster',
                'Asking in advance what the laziest high-scoring behaviour would be',
              ],
              [0, 1, 3],
              ['sk-reward-design'],
              'Faster convergence just gets you to the gamed solution sooner. The other three all attack the gap between the metric and the intent, which is where the problem actually lives.',
            ),
            trueFalse(
              'Learning a reward model from human preferences removes the specification-gaming problem.',
              false,
              ['sk-reward-design', 'sk-rlhf'],
              'It moves it. The reward model is now the target, and it is an imperfect learned approximation with exploitable gaps — policies reliably find outputs that score well and read badly. The KL penalty against the base model and iterative preference collection are both there to contain that.',
            ),
            shortAnswer(
              'Why is "the agent found an unintended way to score highly" usually a specification failure rather than an algorithm failure?',
              ['specified', 'reward', 'intent', 'metric', 'correct', 'gap'],
              'Because the algorithm did exactly what it was asked: maximise the reward. The unintended behaviour scores highly under the function that was written, so it is a correct solution to the stated problem. The failure is the gap between what the reward measures and what the designer meant, and that gap is in the specification.',
              ['sk-reward-design'],
              'Reframing it this way is what makes it fixable — you go and look at the reward function rather than tuning hyperparameters.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-rl-3',
        title: 'Reinforcement Learning Checkpoint',
        passingScore: 0.7,
        exercises: [
          numeric(
            'With α = 0.1, γ = 1.0, Q(s, a) = 0, reward = 10, and max Q(s′, a′) = 0, what is the new Q(s, a)?',
            1,
            ['sk-q-learning'],
            'Target is `10 + 0 = 10`; TD error is 10; move 10% of it: `0 + 0.1 × 10 = 1`. This is why value takes many episodes to propagate back from a goal.',
            { tolerance: 0.01 },
          ),
          mcq(
            'What does PPO’s clipped objective protect against?',
            [
              'Overfitting to the reward model',
              'A single oversized update collapsing the policy that generates all future data',
              'Vanishing gradients',
              'Reward hacking',
            ],
            1,
            ['sk-policy-gradient'],
            'In RL the policy generates its own training data, so one bad step compounds. Clipping bounds the step.',
          ),
          trueFalse(
            'An agent that finds an unintended high-scoring strategy has malfunctioned.',
            false,
            ['sk-reward-design'],
            'It has succeeded at the problem as written. The specification is what failed.',
          ),
        ],
      },
    },
  ],
};
