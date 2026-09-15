/**
 * Learning paths.
 *
 * Twenty-six tracks is a catalog, not a curriculum. A path is a curated ordering
 * of tracks around a goal a learner actually has — "I want to ship an LLM
 * feature", "I want to be an ML engineer", "I need to make decisions about this
 * and I am never going to write a gradient by hand".
 *
 * Paths own no content. They are pure references into `TRACKS`, so a lesson
 * completed anywhere counts toward every path that contains its track, and
 * nothing here can drift out of sync with the curriculum except by naming a
 * track that does not exist — which `validateCatalog` checks.
 */

import type { LearnerGoal, LessonId, Path, PathId, Track, TrackId } from '../domain/types';

import { TRACKS_BY_ID } from './index';

export const PATHS: Path[] = [
  {
    id: 'path-informed',
    title: 'Follow the Conversation',
    tagline: 'Understand what people are actually talking about',
    description:
      'The shortest route to holding an informed opinion. Enough vocabulary to read the news accurately, enough mechanism to tell a real capability from a marketing claim, and enough practice to get useful output from a model yourself.',
    audience: 'Anyone who keeps nodding along and would rather not',
    icon: '🧭',
    gradient: ['#6366F1', '#8B5CF6'],
    trackIds: ['track-foundations', 'track-prompt-engineering', 'track-types-of-ml'],
    outcomes: [
      'Use the vocabulary accurately, and notice when someone else is not',
      'Explain how a model learns, and where that breaks',
      'Get reliably better output from any chat model',
      'Recognise the four learning paradigms behind a product claim',
    ],
    entryLevel: 'intro',
    goals: ['curious'] as LearnerGoal[],
  },

  {
    id: 'path-llm-builder',
    title: 'Build With LLMs',
    tagline: 'Ship a language-model feature that survives real users',
    description:
      'For engineers putting a model into production. How LLMs work at the level that changes your design decisions, how to prompt and evaluate rigorously, how to build agents that do not run away, and the safety and governance work that turns a demo into a product.',
    audience: 'Engineers shipping AI features, not training models',
    icon: '⚡',
    gradient: ['#F59E0B', '#EF4444'],
    trackIds: [
      'track-foundations',
      'track-prompt-engineering',
      'track-llms',
      'track-agents',
      'track-ethics',
    ],
    outcomes: [
      'Explain tokenization, context, and sampling well enough to debug them',
      'Design prompts that are decomposed, tested, and version-controlled',
      'Build an agent with containment, evaluation, and a sane failure path',
      'Meet the documentation and oversight expectations for a deployed system',
    ],
    entryLevel: 'intro',
    goals: ['build-products', 'career-switch'] as LearnerGoal[],
  },

  {
    id: 'path-ml-engineer',
    title: 'Machine Learning Engineer',
    tagline: 'Train it, evaluate it honestly, and keep it alive in production',
    description:
      'The full classical route. The maths you actually need, the algorithms that still win on tabular data, the feature and data work that is most of the job, and the operational discipline that decides whether any of it survives contact with production.',
    audience: 'Engineers and analysts moving into applied ML',
    icon: '⚙️',
    gradient: ['#0EA5E9', '#22D3EE'],
    trackIds: [
      'track-foundations',
      'track-dsa',
      'track-math',
      'track-types-of-ml',
      'track-machine-learning',
      'track-classic-ml',
      'track-data',
      'track-mlops',
    ],
    outcomes: [
      'Choose an algorithm for a problem and defend the choice',
      'Build an evaluation that does not lie to you',
      'Find leakage, imbalance, and drift before they find you',
      'State the complexity of the code you just wrote',
      'Ship a model with shadow, canary, and rollback in place',
    ],
    entryLevel: 'intro',
    goals: ['career-switch', 'exam-prep'] as LearnerGoal[],
  },

  {
    id: 'path-deep-learning',
    title: 'Deep Learning, Properly',
    tagline: 'From one neuron to the architectures behind modern models',
    description:
      'The research route. Backpropagation from the chain rule up, then the two branches that shaped the field — convolution and vision, recurrence and language — arriving at transformers with a clear view of what problem each piece was solving.',
    audience: 'People who want to read papers and follow the maths',
    icon: '🧠',
    gradient: ['#8B5CF6', '#EC4899'],
    trackIds: [
      'track-math',
      'track-machine-learning',
      'track-deep-learning',
      'track-computer-vision',
      'track-nlp',
      'track-llms',
    ],
    outcomes: [
      'Derive backpropagation and explain why gradients vanish',
      'Read a CNN or transformer architecture and say what each stage does',
      'Explain what attention replaced, and why that mattered more than quality',
      'Diagnose a training run from its loss curve',
    ],
    entryLevel: 'intermediate',
    goals: ['research', 'exam-prep'] as LearnerGoal[],
  },

  {
    id: 'path-generative',
    title: 'Generative AI End to End',
    tagline: 'Text, images, and the models that make both',
    description:
      'Everything that generates rather than classifies. Language models in depth, then diffusion, latent spaces, and multimodal models — plus the prompting and agent skills that turn a generator into something people can use.',
    audience: 'Builders and creators working with generative models',
    icon: '🎨',
    gradient: ['#EC4899', '#F43F5E'],
    trackIds: [
      'track-foundations',
      'track-prompt-engineering',
      'track-llms',
      'track-generative-ai',
      'track-agents',
    ],
    outcomes: [
      'Explain how a diffusion model turns noise into an image',
      'Say what guidance, seeds, and samplers actually control',
      'Understand latent spaces well enough to reason about failure',
      'Compose generation into a product rather than a demo',
    ],
    entryLevel: 'intro',
    goals: ['build-products', 'curious'] as LearnerGoal[],
  },

  {
    id: 'path-decision-maker',
    title: 'AI for Decision Makers',
    tagline: 'Enough depth to ask the right questions — no calculus',
    description:
      'For people who commission, fund, regulate, or are accountable for AI systems. What these systems can and cannot do, how to read an evaluation, what fairness and privacy actually require, and what a responsible deployment involves. No maths track, by design.',
    audience: 'Leaders, PMs, policy and risk people',
    icon: '🧩',
    gradient: ['#14B8A6', '#6366F1'],
    trackIds: [
      'track-foundations',
      'track-types-of-ml',
      'track-prompt-engineering',
      'track-ethics',
      'track-mlops',
    ],
    outcomes: [
      'Tell a plausible AI claim from an implausible one',
      'Read an evaluation and know what it is not telling you',
      'Name the fairness criterion a system is accountable to, and why',
      'Ask for the documentation, oversight, and rollback that should exist',
    ],
    entryLevel: 'intro',
    goals: ['lead-teams', 'curious'] as LearnerGoal[],
  },

  {
    id: 'path-rl',
    title: 'Learning From Consequences',
    tagline: 'Reinforcement learning, from gridworlds to RLHF',
    description:
      'The paradigm where there is no answer key — only reward. Value methods, policy methods, and the reward-design problems that turn out to be the same problems alignment is about.',
    audience: 'People interested in agents, control, and alignment',
    icon: '🎮',
    gradient: ['#14B8A6', '#6366F1'],
    trackIds: [
      'track-foundations',
      'track-types-of-ml',
      'track-math',
      'track-rl',
      'track-ethics',
    ],
    outcomes: [
      'Apply the Q-learning update and explain what each term does',
      'Say when a policy method beats a value method, and why',
      'Recognise specification gaming before it is trained in',
      'Connect RLHF to both the RL and the alignment literature',
    ],
    entryLevel: 'intermediate',
    goals: ['research', 'curious'] as LearnerGoal[],
  },

  {
    id: 'path-cs-first',
    title: 'Start With the Fundamentals',
    tagline: 'The computer science underneath, before any of the AI',
    description:
      'For people coming to AI from outside software. What things cost, the structures every language ships, and the maths that makes machine learning readable — then the AI foundations, which land very differently once you already think in terms of complexity and data structures.',
    audience: 'Career changers and self-taught engineers filling the gaps',
    icon: '🧱',
    gradient: ['#22C55E', '#6366F1'],
    trackIds: ['track-dsa', 'track-math', 'track-foundations'],
    outcomes: [
      'Read code and state its time and space complexity',
      'Choose a data structure from the access pattern rather than by habit',
      'Read vector, matrix and probability notation without stalling',
      'Hold an informed conversation about what AI systems do',
    ],
    entryLevel: 'intro',
    goals: ['career-switch', 'curious'] as LearnerGoal[],
  },

  {
    id: 'path-ml-interview',
    title: 'ML Interview Prep',
    tagline: 'The two things every loop tests, plus the maths behind them',
    description:
      'Machine-learning interviews are two interviews wearing one badge: an algorithms round that is pure data structures and complexity, and an ML round that asks you to justify a model choice and read an evaluation honestly. This covers both, plus the maths that the follow-up questions reach for.',
    audience: 'Anyone with an ML or data-science loop coming up',
    icon: '📝',
    gradient: ['#F59E0B', '#8B5CF6'],
    trackIds: [
      'track-dsa',
      'track-math',
      'track-types-of-ml',
      'track-machine-learning',
      'track-classic-ml',
      'track-deep-learning',
    ],
    outcomes: [
      'Analyse an algorithm’s complexity under time pressure',
      'Pick a structure and defend the choice out loud',
      'Justify an algorithm choice for a described problem',
      'Explain backpropagation and the bias–variance tradeoff clearly',
    ],
    entryLevel: 'intro',
    goals: ['exam-prep', 'career-switch'] as LearnerGoal[],
  },

  {
    id: 'path-vision',
    title: 'Computer Vision Engineer',
    tagline: 'Pixels to production, one pipeline',
    description:
      'The vision specialisation end to end. The maths and deep-learning core first, then convolution, architectures and the modern branches — and the operational work that decides whether a model that scores well ever helps anyone.',
    audience: 'Engineers building perception systems',
    icon: '👁️',
    gradient: ['#0EA5E9', '#8B5CF6'],
    trackIds: [
      'track-foundations',
      'track-math',
      'track-deep-learning',
      'track-computer-vision',
      'track-mlops',
    ],
    outcomes: [
      'Explain what each stage of a CNN contributes',
      'Choose between a CNN and a vision transformer for a given dataset size',
      'Match the task — classification, detection, segmentation — to an architecture',
      'Serve a vision model within a latency and cost budget',
    ],
    entryLevel: 'intermediate',
    goals: ['career-switch', 'build-products'] as LearnerGoal[],
  },

  {
    id: 'path-nlp',
    title: 'NLP Engineer',
    tagline: 'From bag of words to production language models',
    description:
      'Language specifically, in the order the field actually developed. Tokenization and word vectors, the recurrent models and their bottleneck, then transformers and LLMs — which are far easier to reason about once you have felt the problem attention solved.',
    audience: 'Engineers working with text at depth',
    icon: '🔤',
    gradient: ['#14B8A6', '#F59E0B'],
    trackIds: [
      'track-foundations',
      'track-nlp',
      'track-deep-learning',
      'track-llms',
      'track-mlops',
    ],
    outcomes: [
      'Explain tokenization choices and their downstream effects',
      'Describe the seq2seq bottleneck and how attention removed it',
      'Read a transformer architecture block by block',
      'Deploy and monitor a language model under real load',
    ],
    entryLevel: 'intermediate',
    goals: ['career-switch', 'build-products'] as LearnerGoal[],
  },

  {
    id: 'path-safety',
    title: 'Safety and Alignment',
    tagline: 'How these systems are steered, and why that is hard',
    description:
      'The technical route into alignment. How models are trained to be useful, what reinforcement learning from human feedback actually does, why specification gaming is the same problem in a different costume, and what fairness, interpretability and governance demand of a deployed system.',
    audience: 'Researchers, policy people, and engineers who own the risk',
    icon: '🛡️',
    gradient: ['#6366F1', '#34D399'],
    trackIds: [
      'track-foundations',
      'track-types-of-ml',
      'track-llms',
      'track-rl',
      'track-ethics',
    ],
    outcomes: [
      'Explain RLHF and what the KL penalty is holding back',
      'Recognise specification gaming before it is trained in',
      'Name the fairness criterion a system is accountable to, and why the others fail',
      'Say what a responsible deployment has to be able to answer',
    ],
    entryLevel: 'intermediate',
    goals: ['research', 'lead-teams'] as LearnerGoal[],
  },

  {
    id: 'path-data-science',
    title: 'Data Science Foundations',
    tagline: 'The classical toolkit, before anything deep',
    description:
      'The route for tabular data, which is still most of the data. Probability and statistics, the paradigm map, the algorithms that win on structured problems, and the feature and data work that is most of the actual job.',
    audience: 'Analysts and scientists working with structured data',
    icon: '📊',
    gradient: ['#F59E0B', '#84CC16'],
    trackIds: [
      'track-foundations',
      'track-math',
      'track-types-of-ml',
      'track-classic-ml',
      'track-data',
    ],
    outcomes: [
      'Frame a business question as a supervised learning problem',
      'Choose among k-NN, trees, boosting and linear models with reasons',
      'Build an evaluation that survives class imbalance',
      'Catch leakage before it reaches a stakeholder deck',
    ],
    entryLevel: 'intro',
    goals: ['career-switch', 'exam-prep'] as LearnerGoal[],
  },

  {
    id: 'path-cs-degree',
    title: 'Computer Science, Properly',
    tagline: 'The degree-shaped route, without the degree',
    description:
      'The core of an undergraduate computer science curriculum, ordered so each track earns the next. Complexity and data structures, the discrete maths that proves things about them, how a machine actually executes code, the operating system underneath, and finally the theory that says what can be computed at all.',
    audience: 'Self-taught engineers who want the foundations they skipped',
    icon: '🎓',
    gradient: ['#6366F1', '#22D3EE'],
    trackIds: [
      'track-foundations',
      'track-dsa',
      'track-discrete-math',
      'track-architecture',
      'track-systems',
      'track-os',
      'track-theory',
    ],
    outcomes: [
      'State the complexity of any code you write, and prove it by recurrence',
      'Write an induction argument for a loop invariant or a recursive function',
      'Explain what happens between your source code and an executed instruction',
      'Say why a program is slow at the level of caches, syscalls, and paging',
      'Recognise an undecidable or NP-complete problem before you waste a month on it',
    ],
    entryLevel: 'intro',
    goals: ['career-switch', 'exam-prep', 'curious'] as LearnerGoal[],
  },

  {
    id: 'path-backend',
    title: 'Backend Engineer',
    tagline: 'Everything behind the API, from schema to incident',
    description:
      'The working knowledge a backend engineer is assumed to have and is rarely taught in order. Data structures, the data layer, the request path, the practices that keep a codebase changeable, and the security failures that account for most real breaches.',
    audience: 'Engineers building and running server-side systems',
    icon: '🛰️',
    gradient: ['#0EA5E9', '#8B5CF6'],
    trackIds: [
      'track-foundations',
      'track-dsa',
      'track-databases',
      'track-networking',
      'track-swe',
      'track-security',
    ],
    outcomes: [
      'Design a normalised schema and know exactly where you denormalised and why',
      'Read a query plan and fix the scan rather than guessing at an index',
      'Budget a request end to end and find the sequential calls costing you most',
      'Make an operation idempotent and retry it without causing a second outage',
      'Recognise injection, broken authorisation, and leaked secrets on sight',
    ],
    entryLevel: 'intro',
    goals: ['build-products', 'career-switch'] as LearnerGoal[],
  },

  {
    id: 'path-performance',
    title: 'Make It Fast',
    tagline: 'Find the real bottleneck, then fix the right layer',
    description:
      'Performance work across every layer that can be the problem: the algorithm, the hardware underneath it, the operating system between them, the database, and the network. The organising discipline throughout is the same one — measure before you change anything.',
    audience: 'Engineers whose system is slow and who are tired of guessing',
    icon: '🚀',
    gradient: ['#F59E0B', '#EF4444'],
    trackIds: [
      'track-dsa',
      'track-systems',
      'track-architecture',
      'track-os',
      'track-databases',
      'track-networking',
    ],
    outcomes: [
      'Separate an algorithmic problem from a memory-locality one',
      'Tell I/O-bound from CPU-bound work before choosing a concurrency model',
      'Recognise thrashing, cache stampedes, and N+1 queries by their signature',
      'Profile first, and defend every optimisation with a measurement',
    ],
    entryLevel: 'intermediate',
    goals: ['build-products', 'lead-teams'] as LearnerGoal[],
  },

  {
    id: 'path-secure-engineering',
    title: 'Ship It Securely',
    tagline: 'The failures that cause most breaches, and the habits that prevent them',
    description:
      'Defensive security for people who build things rather than break them. Threat modelling, authentication and authorisation done properly, the cryptography you will actually touch, untrusted input, and the engineering practices — review, tests, dependency hygiene — that catch the rest.',
    audience: 'Engineers who want secure defaults to feel obvious',
    icon: '🛡️',
    gradient: ['#EF4444', '#8B5CF6'],
    trackIds: [
      'track-foundations',
      'track-security',
      'track-networking',
      'track-databases',
      'track-swe',
    ],
    outcomes: [
      'Threat model a feature before you build it, not after an incident',
      'Store passwords and secrets in a way that survives a database leak',
      'Explain what a certificate proves and what disabling verification costs',
      'Write parameterised queries and context-aware output encoding by habit',
      'Assess a dependency as a permanent trust decision rather than a convenience',
    ],
    entryLevel: 'intro',
    goals: ['build-products', 'lead-teams', 'career-switch'] as LearnerGoal[],
  },

  {
    id: 'path-cs-interview',
    title: 'CS Interview Prep',
    tagline: 'Algorithms, systems design, and the questions behind the questions',
    description:
      'What technical interviews actually cover, in the order they cover it. Complexity and data structures for the coding round, discrete maths for the reasoning, and databases, networking and systems for the design round — where the interviewer is checking whether you can name a trade-off, not whether you memorised an architecture.',
    audience: 'Anyone with an interview loop coming up',
    icon: '🎯',
    gradient: ['#22C55E', '#0EA5E9'],
    trackIds: [
      'track-dsa',
      'track-discrete-math',
      'track-systems',
      'track-databases',
      'track-networking',
      'track-theory',
    ],
    outcomes: [
      'State and justify the complexity of a solution without hedging',
      'Pick a data structure from the access pattern under time pressure',
      'Walk a systems design question through storage, caching, and failure',
      'Name the CAP and consistency trade-off a design is actually making',
    ],
    entryLevel: 'intermediate',
    goals: ['exam-prep', 'career-switch'] as LearnerGoal[],
  },

  {
    id: 'path-ai-infrastructure',
    title: 'AI Infrastructure',
    tagline: 'The systems layer under every training run',
    description:
      'Where computer science and machine learning actually meet. Why GPUs suit the workload, what the memory hierarchy does to your data loader, how the operating system decides whether your batch fits, and the data and deployment engineering that turns a notebook into a service.',
    audience: 'Engineers making ML systems fast, reliable, and affordable',
    icon: '🏗️',
    gradient: ['#8B5CF6', '#F59E0B'],
    trackIds: [
      'track-foundations',
      'track-systems',
      'track-architecture',
      'track-os',
      'track-data',
      'track-mlops',
    ],
    outcomes: [
      'Explain why deep learning runs on GPUs in terms of the hardware, not folklore',
      'Diagnose a starved GPU as a data-pipeline problem rather than a model one',
      'Predict when a batch size will fall off the memory cliff instead of degrading',
      'Reason about numerical stability where it changes results, not where it does not',
      'Ship a model with shadow, canary, and rollback, on infrastructure you understand',
    ],
    entryLevel: 'intermediate',
    goals: ['build-products', 'career-switch', 'research'] as LearnerGoal[],
  },

  {
    id: 'path-learn-to-code',
    title: 'Learn to Code',
    tagline: 'From never having programmed to writing real things',
    description:
      'The route for someone starting at zero. Variables through functions to collections, written and run in the app; then Python, because that is where the data and AI work is; then how to organise code once there is enough of it to need organising; and finally what things cost.',
    audience: 'Complete beginners, and people who learned by copying and want the foundations',
    icon: '🌱',
    gradient: ['#22C55E', '#06B6D4'],
    trackIds: ['track-programming', 'track-python', 'track-paradigms', 'track-dsa'],
    outcomes: [
      'Write, run and debug a program from an empty file',
      'Choose a data structure from how you will access it',
      'Read unfamiliar code without needing to understand all of it',
      'Write Python that a Python programmer would recognise as Python',
      'State what your code costs as the input grows',
    ],
    entryLevel: 'intro',
    goals: ['curious', 'career-switch'] as LearnerGoal[],
  },

  {
    id: 'path-fullstack',
    title: 'Full-Stack Engineer',
    tagline: 'Browser to database, and everything in between',
    description:
      'The whole request path, owned end to end. Markup and layout, the event loop that decides whether a page responds, the API in the middle, the schema underneath, and the infrastructure it all runs on — plus the engineering practices that keep it changeable.',
    audience: 'Engineers who want to own a feature from the pixel to the row',
    icon: '🧱',
    gradient: ['#F59E0B', '#8B5CF6'],
    trackIds: [
      'track-programming',
      'track-web',
      'track-databases',
      'track-networking',
      'track-cloud',
      'track-swe',
    ],
    outcomes: [
      'Build an interface that works with a keyboard and a screen reader',
      'Explain why a page freezes and fix it',
      'Design an API surface you can live with a year later',
      'Read a query plan instead of guessing at an index',
      'Deploy it, watch it, and know what to do when it breaks',
    ],
    entryLevel: 'intro',
    goals: ['build-products', 'career-switch'] as LearnerGoal[],
  },

  {
    id: 'path-platform',
    title: 'Platform & Reliability',
    tagline: 'Run it, watch it, and survive the incident',
    description:
      'The operational half of software engineering. What the operating system is doing underneath, where code actually runs and what it costs, how a distributed system fails, and the practices — infrastructure as code, observability, incident response — that turn an outage from a mystery into a procedure.',
    audience: 'Engineers moving toward platform, SRE or DevOps work',
    icon: '🔧',
    gradient: ['#0EA5E9', '#EF4444'],
    trackIds: [
      'track-os',
      'track-cloud',
      'track-networking',
      'track-security',
      'track-swe',
    ],
    outcomes: [
      'Diagnose a slow machine from thrashing, syscall cost or I/O wait',
      'Describe infrastructure in code and detect drift from it',
      'Alert on symptoms users feel, not on causes that are usually fine',
      'Set an RPO and an RTO and design backwards from them',
      'Keep secrets, dependencies and access scoped to what is needed',
    ],
    entryLevel: 'intermediate',
    goals: ['build-products', 'lead-teams', 'career-switch'] as LearnerGoal[],
  },

  {
    id: 'path-cs-theory',
    title: 'The Theory Underneath',
    tagline: 'Logic, information, computation, and the limits of each',
    description:
      'For people who want the why rather than the how. Discrete maths and proof, the information theory that turns out to define every loss function, the theory of computation and its impossibility results, and the compiler that puts the grammar to work.',
    audience: 'Students, and engineers who want the foundations properly',
    icon: '🔭',
    gradient: ['#A78BFA', '#06B6D4'],
    trackIds: [
      'track-discrete-math',
      'track-theory',
      'track-information-theory',
      'track-compilers',
    ],
    outcomes: [
      'Write an induction proof and a proof by contradiction',
      'Compute entropy and connect it to compression and to cross-entropy loss',
      'Recognise an undecidable question and solve a decidable neighbour instead',
      'Explain how source text becomes a tree and then machine code',
    ],
    entryLevel: 'intermediate',
    goals: ['research', 'exam-prep', 'curious'] as LearnerGoal[],
  },

  {
    id: 'path-from-sand',
    title: 'From Sand to Software',
    tagline: 'The whole stack, bottom to top',
    description:
      'Start at a transistor and climb. Gates, adders and memory; the instruction cycle and the memory hierarchy; the operating system that shares it out; and the compiler that turns your source into something the whole apparatus can execute. Nothing is a black box by the end.',
    audience: 'Anyone who has wondered what is actually happening down there',
    icon: '⛰️',
    gradient: ['#64748B', '#8B5CF6'],
    trackIds: [
      'track-hardware',
      'track-architecture',
      'track-systems',
      'track-os',
      'track-compilers',
    ],
    outcomes: [
      'Build arithmetic from logic gates and explain how a circuit remembers',
      'Trace source code down to a signal on a wire',
      'Say why a program is slow at the level of caches, pages and syscalls',
      'Explain what an optimiser is allowed to do and what it is not',
    ],
    entryLevel: 'intro',
    goals: ['curious', 'career-switch', 'research'] as LearnerGoal[],
  },

  {
    id: 'path-measure-it',
    title: 'Measure It Properly',
    tagline: 'Experiments and evidence that survive scrutiny',
    description:
      'For anyone whose job involves claiming something works. Sampling and intervals, what a p-value actually says, how to size an experiment before running it, and the confounding that makes most observational claims unsafe — then the data and evaluation work that makes a model claim credible.',
    audience: 'Analysts, PMs, researchers, and engineers who ship changes',
    icon: '🧪',
    gradient: ['#10B981', '#6366F1'],
    trackIds: [
      'track-statistics',
      'track-math',
      'track-data',
      'track-classic-ml',
    ],
    outcomes: [
      'Report an effect size with an interval instead of a bare p-value',
      'Size an experiment from the smallest effect worth acting on',
      'Spot peeking, p-hacking and multiple comparisons in a result',
      'Build an evaluation that survives class imbalance and leakage',
    ],
    entryLevel: 'intro',
    goals: ['research', 'lead-teams', 'career-switch'] as LearnerGoal[],
  },

  {
    id: 'path-applied-crypto',
    title: 'Security & Cryptography',
    tagline: 'Why the padlock means anything, and where systems actually fail',
    description:
      'Defensive security end to end. Threat modelling and the failures behind most breaches, then the primitives underneath them — symmetric and public-key encryption, key exchange, signatures — and the network layer they run over. Ends knowing why you should not implement any of it yourself.',
    audience: 'Engineers who want secure defaults to be obvious',
    icon: '🔒',
    gradient: ['#F43F5E', '#0EA5E9'],
    trackIds: [
      'track-security',
      'track-cryptography',
      'track-networking',
      'track-information-theory',
    ],
    outcomes: [
      'Threat model a feature and scope access to the minimum it needs',
      'Explain what a certificate proves and what a signature proves',
      'Recognise ECB, IV reuse and a non-cryptographic random source on sight',
      'Say precisely what quantum computing breaks and what it does not',
    ],
    entryLevel: 'intermediate',
    goals: ['build-products', 'research', 'lead-teams'] as LearnerGoal[],
  },
];

export const PATHS_BY_ID: ReadonlyMap<PathId, Path> = new Map(PATHS.map((p) => [p.id, p]));

export function getPath(id: PathId): Path | undefined {
  return PATHS_BY_ID.get(id);
}

/** The path's tracks, in order, skipping any id that no longer resolves. */
export function pathTracks(path: Path): Track[] {
  return path.trackIds
    .map((id) => TRACKS_BY_ID.get(id))
    .filter((t): t is Track => t !== undefined);
}

/** Every path that contains a given track. Shown on the track screen. */
export function pathsForTrack(trackId: TrackId): Path[] {
  return PATHS.filter((p) => p.trackIds.includes(trackId));
}

export interface PathStats {
  tracks: number;
  lessons: number;
  minutes: number;
}

export function pathStats(path: Path): PathStats {
  const tracks = pathTracks(path);
  let lessons = 0;
  let minutes = 0;
  for (const track of tracks) {
    for (const unit of track.units) {
      for (const lesson of unit.lessons) {
        lessons += 1;
        minutes += lesson.estimatedMinutes;
      }
    }
  }
  return { tracks: tracks.length, lessons, minutes };
}

export interface PathProgress {
  completedLessons: number;
  totalLessons: number;
  /** 0–1. */
  fraction: number;
  /** Per-track completion, in path order. */
  trackProgress: Array<{ trackId: TrackId; completed: number; total: number; fraction: number }>;
  /** The next unfinished lesson in path order, or null when the path is done. */
  next: { trackId: TrackId; lessonId: LessonId } | null;
}

/**
 * Progress along a path.
 *
 * Takes the set of completed lesson ids rather than the whole progress store,
 * so this stays in `content/` and the dependency keeps pointing one way.
 */
export function pathProgress(path: Path, completedLessonIds: ReadonlySet<LessonId>): PathProgress {
  const trackProgress: PathProgress['trackProgress'] = [];
  let completedLessons = 0;
  let totalLessons = 0;
  let next: PathProgress['next'] = null;

  for (const track of pathTracks(path)) {
    let completed = 0;
    let total = 0;
    for (const unit of track.units) {
      for (const lesson of unit.lessons) {
        total += 1;
        if (completedLessonIds.has(lesson.id)) {
          completed += 1;
        } else if (next === null) {
          next = { trackId: track.id, lessonId: lesson.id };
        }
      }
    }
    completedLessons += completed;
    totalLessons += total;
    trackProgress.push({
      trackId: track.id,
      completed,
      total,
      fraction: total === 0 ? 0 : completed / total,
    });
  }

  return {
    completedLessons,
    totalLessons,
    fraction: totalLessons === 0 ? 0 : completedLessons / totalLessons,
    trackProgress,
    next,
  };
}

/**
 * Paths ranked for a learner, best first.
 *
 * Started-but-unfinished paths come first — finishing something beats starting
 * something. Completed paths sink. Among untouched paths, the ones matching the
 * learner's stated interests rise.
 */
export function recommendPaths(
  completedLessonIds: ReadonlySet<LessonId>,
  goals: readonly LearnerGoal[] = [],
): Path[] {
  const wanted = new Set(goals);

  return [...PATHS]
    .map((path) => {
      const { fraction } = pathProgress(path, completedLessonIds);
      let score = 0;
      if (fraction > 0 && fraction < 1) score += 100 + fraction * 50;
      if (fraction >= 1) score -= 100;
      for (const goal of path.goals) {
        if (wanted.has(goal)) score += 20;
      }
      return { path, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.path);
}
