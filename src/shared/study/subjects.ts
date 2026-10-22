import type { QuestionType, RubricCriterion } from './types';

/**
 * How each subject is taught and assessed. Lessons, quizzes and the AI tutor read these instead of using one
 * generic prompt for everything. Subjects marked `offline: 'authored'` have FlowCompanion-written lessons and
 * automatically checked practice for some expectations; the others teach from the Ministry's own teacher
 * supports offline and use an AI provider, when the student allows it, for anything more.
 */

export const GROWING_SUCCESS = {
  title: 'Growing Success: Assessment, Evaluation, and Reporting in Ontario Schools (2010)',
  url: 'https://www.edu.gov.on.ca/eng/policyfunding/growsuccess.pdf',
};

/** Practice rubric levels. Deliberately not "Level 1–4", which are Ontario achievement levels. */
export const RUBRIC_LEVELS = ['Not yet', 'Beginning', 'Getting there', 'Strong'];

const criterion = (id: string, label: string, description: string): RubricCriterion => ({ id, label, description, levels: RUBRIC_LEVELS });

export const RUBRIC_NOTE = `FlowCompanion’s practice rubric. Its four criteria are named after the four categories of the achievement chart in ${GROWING_SUCCESS.title}; it is not an official Ontario rubric and does not give achievement levels or report-card marks.`;

export type SubjectId = 'math' | 'language' | 'science' | 'social' | 'languages' | 'business' | 'computer' | 'arts' | 'health' | 'general';

export interface SubjectProfile {
  id: SubjectId;
  label: string;
  /** Curriculum document titles (as published by the Ministry) taught with this profile. */
  documents: string[];
  /** How the lesson cycle is adapted for the subject. */
  cycle: string[];
  methods: string[];
  questionFormats: QuestionType[];
  criteria: RubricCriterion[];
  commonMisconceptions: string[];
  feedbackRules: string[];
  /** How answers are checked, in plain words. */
  validation: string;
  ageGuidance: { '6-8': string; '9-10': string; '11-12': string };
  limitations: string[];
  offline: 'authored' | 'ministry_supports';
  /** Extra instructions for the AI tutor and AI lessons in this subject. */
  aiGuidance: string;
}

const AGE = {
  '6-8': 'Grades 6–8: short, clear explanations; concrete examples first; visuals where helpful; guided practice before independent work; encouraging, specific feedback; build study habits.',
  '9-10': 'Grades 9–10: more conceptual depth and multi-step reasoning; correct subject vocabulary; connections between ideas; more independent problem-solving.',
  '11-12': 'Grades 11–12: abstraction and complex problems; evidence-based arguments; independent research; exam preparation and readiness for college, university, apprenticeship or work.',
};

export const SUBJECTS: SubjectProfile[] = [
  {
    id: 'math',
    label: 'Mathematics',
    documents: ['Mathematics'],
    cycle: ['Goal and prerequisite check', 'Explanation with a model or diagram (concrete → abstract)', 'Worked example', 'Guided problem with hints', 'Independent problems', 'Quick check', 'Summary and next step'],
    methods: ['explicit instruction', 'worked examples', 'gradual release', 'concrete-to-abstract', 'multiple representations', 'retrieval practice', 'interleaved review', 'estimation and reasonableness checks'],
    questionFormats: ['numeric', 'expression', 'multiple_choice', 'true_false', 'code_trace', 'written'],
    criteria: [
      criterion('ku', 'Knowledge and Understanding', 'Uses the right facts, procedures and vocabulary.'),
      criterion('thinking', 'Thinking', 'Plans a strategy, reasons through the steps and checks if the answer makes sense.'),
      criterion('communication', 'Communication', 'Shows the steps clearly with correct notation and units.'),
      criterion('application', 'Application', 'Applies the math to the situation and connects it to other ideas.'),
    ],
    commonMisconceptions: ['adding denominators', 'sign errors with integers', 'combining unlike terms', 'confusing radius and diameter', 'percent place value'],
    feedbackRules: ['Name the step where it went wrong.', 'Show the correct reasoning, not just the answer.', 'Offer a similar question to try next.', 'Ask for an estimate to check reasonableness.'],
    validation: 'Answers to generated questions are checked exactly by code (fractions, decimals, algebra by expansion). Written explanations are not marked automatically.',
    ageGuidance: AGE,
    limitations: ['Graphing and constructions (protractor, compass) are explained but not checked.', 'Coding expectations are practised by reading code only; no code is run.'],
    offline: 'authored',
    aiGuidance:
      'Teach mathematics step by step. Use a worked example, then let the student try a similar problem. Check arithmetic carefully and show each step. Use $$…$$ for math notation. Never give only a final answer; ask the student to try the next step themselves.',
  },
  {
    id: 'language',
    label: 'English and language',
    documents: ['Language', 'English', 'English As a Second Language and English Literacy Development'],
    cycle: ['Goal', 'Model text or example', 'Explain the skill (e.g. main idea, thesis, evidence)', 'Guided analysis of a short passage', 'Student writes or analyses on their own', 'Criterion-based feedback', 'Revise'],
    methods: ['modelling with mentor texts', 'think-alouds', 'guided reading questions', 'sentence and paragraph frames', 'criterion-based feedback', 'revision cycles', 'metacognitive reflection'],
    questionFormats: ['multiple_choice', 'short_answer', 'written', 'ordering', 'matching', 'fill_blank'],
    criteria: [
      criterion('ku', 'Knowledge and Understanding', 'Understands the text, terms and conventions.'),
      criterion('thinking', 'Thinking', 'Finds main ideas, makes inferences and supports claims with evidence.'),
      criterion('communication', 'Communication', 'Organizes ideas clearly; grammar, spelling and style suit the audience.'),
      criterion('application', 'Application', 'Connects ideas to other texts, experiences and the world.'),
    ],
    commonMisconceptions: ['summary instead of analysis', 'evidence without explanation', 'confusing theme with topic', 'opinion presented as fact'],
    feedbackRules: ['Quote the student’s own words when giving feedback.', 'Give at most three priorities.', 'Suggest a revision, never rewrite the whole piece.', 'Keep the student’s voice.'],
    validation: 'Recognition questions are checked by code. Writing gets rubric-based feedback from the AI tutor (when allowed) or the student’s own self-assessment; neither is a mark.',
    ageGuidance: AGE,
    limitations: ['FlowCompanion does not write assignments for students.', 'Writing feedback from AI can be wrong or incomplete; teachers’ criteria come first.'],
    offline: 'ministry_supports',
    aiGuidance:
      'Teach reading and writing by modelling and questioning. Distinguish facts, interpretations and opinions. When giving feedback on writing, quote the student, explain one or two improvements with an example sentence, and do not rewrite their work for them or produce a finished assignment.',
  },
  {
    id: 'science',
    label: 'Science',
    documents: ['Science and Technology', 'Science'],
    cycle: ['Goal and what you already think (predict)', 'Explain the concept with a model', 'Worked example or investigation design', 'Guided question about variables, data or evidence', 'Independent question', 'Check', 'Connect to real life'],
    methods: ['predict–observe–explain', 'models and diagrams', 'fair-test design (variables)', 'data interpretation', 'claim–evidence–reasoning', 'retrieval practice'],
    questionFormats: ['multiple_choice', 'true_false', 'short_answer', 'numeric', 'written', 'matching', 'ordering'],
    criteria: [
      criterion('ku', 'Knowledge and Understanding', 'Uses scientific concepts and vocabulary accurately.'),
      criterion('thinking', 'Thinking and Investigation', 'Identifies variables, interprets data and draws evidence-based conclusions.'),
      criterion('communication', 'Communication', 'Explains clearly using appropriate scientific language, units and diagrams.'),
      criterion('application', 'Application', 'Connects science to technology, society and the environment.'),
    ],
    commonMisconceptions: ['correlation treated as causation', 'confusing mass and weight', 'heat and temperature treated as the same', 'models taken as exact copies of reality'],
    feedbackRules: ['Ask what evidence supports the claim.', 'Separate observation from inference.', 'Never invent experimental results; label simulated or example data as such.'],
    validation: 'Recognition and numeric questions are checked by code when their keys are authored; AI-written keys are marked as not checked.',
    ageGuidance: AGE,
    limitations: ['FlowCompanion has no lab simulations; example data is labelled as example data, not real measurements.'],
    offline: 'ministry_supports',
    aiGuidance:
      'Teach science with models, predictions and evidence. Distinguish conceptual models from real observations. Never present made-up data as real measurements; label any example data. Encourage the student to identify variables and explain conclusions with evidence. Follow safety guidance and do not describe dangerous experiments.',
  },
  {
    id: 'social',
    label: 'History, geography and social sciences',
    documents: ['Social Studies, History, and Geography', 'Canadian and World Studies', 'First Nations, Métis, and Inuit Studies', 'Social Sciences and Humanities'],
    cycle: ['Goal and inquiry question', 'Context and chronology', 'Analyse a source (who, when, why, perspective)', 'Cause and consequence / continuity and change', 'Build an argument with evidence', 'Check', 'Reflect on perspectives'],
    methods: ['inquiry questions', 'primary and secondary source analysis', 'timelines', 'cause-and-consequence organizers', 'perspective-taking', 'map and data interpretation'],
    questionFormats: ['multiple_choice', 'ordering', 'matching', 'short_answer', 'written'],
    criteria: [
      criterion('ku', 'Knowledge and Understanding', 'Knows key events, people, places and concepts, and their significance.'),
      criterion('thinking', 'Thinking', 'Analyses sources, considers perspectives and supports conclusions with evidence.'),
      criterion('communication', 'Communication', 'Organizes and expresses ideas clearly, citing sources.'),
      criterion('application', 'Application', 'Connects past and present, local and global.'),
    ],
    commonMisconceptions: ['present-day values applied without context', 'one source treated as the whole story', 'chronology confused', 'correlation on maps treated as causation'],
    feedbackRules: ['Ask whose perspective a source represents.', 'Present contested issues with the evidence and the main interpretations.', 'Do not state unsupported claims as facts.'],
    validation: 'Ordering, matching and choice questions are checked by code when the key is authored. Arguments get rubric feedback only.',
    ageGuidance: AGE,
    limitations: ['Source passages written by AI are not real historical documents and are labelled as practice texts.'],
    offline: 'ministry_supports',
    aiGuidance:
      'Teach history and geography through inquiry: chronology, cause and consequence, continuity and change, perspective, and evidence. Present contested or sensitive issues carefully, with evidence and differing interpretations, and respectfully, including First Nations, Métis and Inuit perspectives. Never invent quotations from real people or present made-up passages as real primary sources; label practice passages as such.',
  },
  {
    id: 'languages',
    label: 'French and other languages',
    documents: ['French as a Second Language', 'Classical Studies and International Languages', 'Native Languages', 'American Sign Language as a Second Language'],
    cycle: ['Goal', 'Model phrases and vocabulary in context', 'Explain the grammar point', 'Guided practice', 'Independent use', 'Check', 'Real-life use'],
    methods: ['comprehensible input', 'vocabulary in context', 'pattern-focused grammar', 'retrieval practice', 'spaced vocabulary review'],
    questionFormats: ['multiple_choice', 'fill_blank', 'matching', 'short_answer', 'written'],
    criteria: [
      criterion('ku', 'Knowledge and Understanding', 'Uses vocabulary and grammar accurately.'),
      criterion('thinking', 'Thinking', 'Works out meaning from context and uses strategies.'),
      criterion('communication', 'Communication', 'Communicates clearly for the purpose and audience.'),
      criterion('application', 'Application', 'Uses the language in real situations and makes cultural connections.'),
    ],
    commonMisconceptions: ['word-for-word translation', 'gender and agreement errors', 'false friends'],
    feedbackRules: ['Correct one pattern at a time.', 'Give the correct form and a similar example.'],
    validation: 'Fill-in, matching and choice questions are checked by code when authored. FlowCompanion cannot assess pronunciation or listening: it has no audio assessment.',
    ageGuidance: AGE,
    limitations: ['No listening or pronunciation assessment (no audio features).', 'Indigenous languages and ASL are listed from the curriculum, but FlowCompanion has no language-specific content for them.'],
    offline: 'ministry_supports',
    aiGuidance:
      'Teach the language with short examples in context and explain grammar in English unless the student asks otherwise. Adjust language complexity to the student’s level. Do not claim to assess pronunciation or listening.',
  },
  {
    id: 'business',
    label: 'Business, financial literacy and careers',
    documents: ['Business Studies', 'Guidance and Career Education', 'Cooperative Education', 'Interdisciplinary Studies'],
    cycle: ['Goal', 'Concept with a real-world case', 'Worked example', 'Guided case question', 'Independent task', 'Check', 'Reflection'],
    methods: ['case studies', 'worked financial examples', 'decision matrices', 'reflection'],
    questionFormats: ['multiple_choice', 'numeric', 'short_answer', 'written'],
    criteria: [
      criterion('ku', 'Knowledge and Understanding', 'Uses business and financial concepts correctly.'),
      criterion('thinking', 'Thinking', 'Analyses options, risks and evidence.'),
      criterion('communication', 'Communication', 'Presents ideas clearly for the audience.'),
      criterion('application', 'Application', 'Applies concepts to realistic situations.'),
    ],
    commonMisconceptions: ['revenue confused with profit', 'interest rate confused with total cost'],
    feedbackRules: ['Use clearly made-up example numbers.', 'Educational examples are not personal financial advice.'],
    validation: 'Numeric questions are checked by code when authored; case answers get rubric feedback only.',
    ageGuidance: AGE,
    limitations: ['Nothing here is personal financial advice.'],
    offline: 'ministry_supports',
    aiGuidance: 'Teach with realistic but clearly fictional examples. Make clear that examples are educational and not personal financial, legal or career advice.',
  },
  {
    id: 'computer',
    label: 'Computer studies and technology',
    documents: ['Computer Studies', 'Technological Education'],
    cycle: ['Goal', 'Concept', 'Read and trace an example program or design', 'Guided debugging', 'Independent exercise', 'Check', 'Extend'],
    methods: ['code reading and tracing', 'worked examples', 'debugging practice', 'design process'],
    questionFormats: ['code_trace', 'multiple_choice', 'short_answer', 'ordering', 'written'],
    criteria: [
      criterion('ku', 'Knowledge and Understanding', 'Understands concepts, syntax and tools.'),
      criterion('thinking', 'Thinking', 'Decomposes problems, designs and debugs.'),
      criterion('communication', 'Communication', 'Documents code and explains design choices.'),
      criterion('application', 'Application', 'Applies solutions to new problems safely and ethically.'),
    ],
    commonMisconceptions: ['off-by-one loops', 'assignment confused with comparison', 'variables treated as permanent labels'],
    feedbackRules: ['Explain the error, then give a small test case that shows it.'],
    validation: 'Code-reading questions are checked by comparing the exact output. FlowCompanion never runs student code.',
    ageGuidance: AGE,
    limitations: ['No code is executed; there is no sandbox.', 'Workshop and shop-safety skills cannot be taught or assessed here.'],
    offline: 'ministry_supports',
    aiGuidance: 'Teach programming with small, testable examples and step-by-step tracing. When explaining an error, show a minimal test case. Never ask the student to run code that could harm their computer.',
  },
  {
    id: 'arts',
    label: 'The Arts',
    documents: ['The Arts'],
    cycle: ['Goal', 'Elements and principles with examples', 'Analyse a work (describe, analyse, interpret, judge)', 'Create or plan', 'Reflect'],
    methods: ['critical analysis process', 'creative process', 'reflection'],
    questionFormats: ['multiple_choice', 'matching', 'short_answer', 'written'],
    criteria: [
      criterion('ku', 'Knowledge and Understanding', 'Uses the elements, principles and vocabulary of the art form.'),
      criterion('thinking', 'Thinking', 'Uses the creative and critical analysis processes.'),
      criterion('communication', 'Communication', 'Expresses ideas through and about art.'),
      criterion('application', 'Application', 'Connects art to culture, community and personal experience.'),
    ],
    commonMisconceptions: ['personal taste treated as analysis'],
    feedbackRules: ['Value the student’s interpretation; ask for evidence from the work.'],
    validation: 'Only recognition questions can be checked by code; creative work gets reflective prompts.',
    ageGuidance: AGE,
    limitations: ['FlowCompanion cannot see, hear or assess artwork, performances or music.'],
    offline: 'ministry_supports',
    aiGuidance: 'Support the creative and critical analysis processes. Value the student’s interpretation and ask for evidence from the work. Do not claim to see or hear their artwork.',
  },
  {
    id: 'health',
    label: 'Health and physical education',
    documents: ['Health and Physical Education'],
    cycle: ['Goal', 'Explain the concept', 'Scenario', 'Decision-making practice', 'Reflection'],
    methods: ['scenarios', 'decision-making models', 'reflection'],
    questionFormats: ['multiple_choice', 'true_false', 'short_answer', 'written'],
    criteria: [
      criterion('ku', 'Knowledge and Understanding', 'Understands health concepts.'),
      criterion('thinking', 'Thinking', 'Uses decision-making and critical thinking.'),
      criterion('communication', 'Communication', 'Communicates clearly and respectfully.'),
      criterion('application', 'Application', 'Applies concepts to healthy choices.'),
    ],
    commonMisconceptions: [],
    feedbackRules: ['Be supportive and non-judgemental; point to trusted adults and professional help for personal concerns.'],
    validation: 'Recognition questions only; reflections are not marked.',
    ageGuidance: AGE,
    limitations: ['Not medical, mental-health or nutrition advice.', 'Physical activity skills cannot be assessed.'],
    offline: 'ministry_supports',
    aiGuidance:
      'Teach health concepts factually and age-appropriately. Do not give medical, mental-health or diagnostic advice; for personal concerns, encourage the student to talk to a parent, teacher, doctor or Kids Help Phone (1-800-668-6868, kidshelpphone.ca).',
  },
  {
    id: 'general',
    label: 'Other subjects',
    documents: [],
    cycle: ['Goal', 'Explain', 'Example', 'Guided question', 'Independent question', 'Check', 'Summary'],
    methods: ['explicit instruction', 'retrieval practice', 'reflection'],
    questionFormats: ['multiple_choice', 'short_answer', 'written'],
    criteria: [
      criterion('ku', 'Knowledge and Understanding', 'Understands the key ideas.'),
      criterion('thinking', 'Thinking', 'Reasons and supports ideas.'),
      criterion('communication', 'Communication', 'Explains clearly.'),
      criterion('application', 'Application', 'Applies ideas in context.'),
    ],
    commonMisconceptions: [],
    feedbackRules: ['Be specific and encouraging.'],
    validation: 'Recognition questions with authored keys are checked by code; everything else gets feedback only.',
    ageGuidance: AGE,
    limitations: ['No subject-specific content yet.'],
    offline: 'ministry_supports',
    aiGuidance: 'Teach clearly with examples and check understanding with questions.',
  },
];

export function subjectFor(documentTitle: string): SubjectProfile {
  return SUBJECTS.find((s) => s.documents.some((d) => d.toLowerCase() === documentTitle.toLowerCase())) ?? SUBJECTS.find((s) => s.id === 'general')!;
}

export function ageBand(grade: number): '6-8' | '9-10' | '11-12' {
  return grade <= 8 ? '6-8' : grade <= 10 ? '9-10' : '11-12';
}
