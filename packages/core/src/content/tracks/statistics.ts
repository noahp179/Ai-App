/**
 * Track 36 — Statistics & Experimentation.
 *
 * The track that decides whether anything else in the catalog is working. A
 * model is only better if you can show it, and most claims that something is
 * better do not survive contact with a correctly designed experiment.
 */

import type { Track } from '../../domain/types';
import { categorize, concept, fill, interactive, lesson, match, mcq, multi, numeric, order, shortAnswer, trueFalse } from '../builders';

export const statisticsTrack: Track = {
  id: 'track-statistics',
  title: 'Statistics & Experimentation',
  tagline: 'Telling a real effect from a lucky sample',
  description:
    'Sampling, confidence intervals, hypothesis tests and what a p-value is not; then A/B testing, power, multiple comparisons, and the confounding that makes correlation such a poor guide to causation.',
  domain: 'math',
  level: 'intermediate',
  icon: '📊',
  gradient: ['#10B981', '#F59E0B'],
  prerequisites: ['track-math'],
  outcomes: [
    'Explain sampling error and why a bigger sample narrows it',
    'Interpret a confidence interval correctly, and spot the usual misreading',
    'State what a p-value is and the four things it is not',
    'Size an experiment from an effect you would care about',
    'Recognise p-hacking, peeking, and the multiple-comparisons trap',
    'Say what randomisation buys that statistical control cannot',
  ],
  units: [
    // -----------------------------------------------------------------------
    {
      id: 'unit-stats-1',
      title: 'From Sample to Claim',
      description: 'What a sample can and cannot tell you about a population.',
      lessons: [
        lesson({
          id: 'lesson-sampling',
          title: 'Samples, Error, and Intervals',
          summary: 'You measured 500 people. What can you honestly say about a million?',
          level: 'intermediate',
          domain: 'math',
          free: true,
          steps: [
            concept(
              'Two ways a sample misleads',
              'You cannot measure everyone, so you measure a **sample** and infer. Two different things can go wrong, and conflating them is the root of most bad statistics.\n\n**Sampling error** is random. Your sample happened to contain slightly more of one kind of person. It is unavoidable, it is quantifiable, and it **shrinks as the sample grows** — proportional to 1/√n, which is why going from 100 to 400 halves it and getting another halving costs you 1,600.\n\n**Sampling bias** is systematic. Your sample was not representative to begin with, and **more data does not help at all** — a bigger biased sample is a more confidently wrong answer.\n\nThe canonical illustration is the 1936 *Literary Digest* poll: 2.4 million responses, predicting a Landon landslide. Roosevelt won 46 states. The sample came from telephone directories and car registrations in the Depression, which selected for wealth. Two point four million is an enormous sample and none of it helped.\n\nThe modern version is everywhere: survey respondents are people who answer surveys, app telemetry covers people who did not uninstall, and a model trained on the users you have cannot tell you about the users who left.\n\n**Survivorship bias** is the same failure with a memorable shape. Abraham Wald, asked where to armour bombers based on where returning planes had bullet holes, pointed out that the answer was the places with *no* holes — planes hit there did not come back.',
              {
                keyTerms: [
                  { term: 'Sampling error', definition: 'Random variation from having measured a subset — shrinks with √n.' },
                  { term: 'Sampling bias', definition: 'Systematic unrepresentativeness — more data makes it worse, not better.' },
                ],
              },
            ),
            mcq(
              'A survey gets 2 million responses but only from people with landlines. What is the problem?',
              [
                'The sample is too small',
                'Sampling bias — the sample is unrepresentative, and size does not fix that',
                'Sampling error',
                'Nothing; 2 million is plenty',
              ],
              1,
              ['sk-sampling', 'sk-selection-bias'],
              'Size reduces random error and does nothing about systematic error. The Literary Digest had 2.4 million and got it spectacularly wrong.',
            ),
            numeric(
              'To halve the sampling error of a sample of 400, how many observations do you need in total?',
              1600,
              ['sk-sampling'],
              'Error scales with 1/√n, so halving it needs 4× the data. This is why precision gets expensive fast.',
            ),
            multi(
              'Which are examples of selection or survivorship bias?',
              [
                'Judging a strategy by the funds that still exist',
                'Armouring the parts of returning bombers that show damage',
                'Measuring satisfaction among users who have not churned',
                'A random sample of all registered voters',
              ],
              [0, 1, 2],
              ['sk-selection-bias'],
              'Each measures only what survived to be measured. The fourth is what you want.',
            ),
            concept(
              'The central limit theorem, and confidence intervals',
              'Here is the result that makes inference possible. Take repeated samples and compute each one’s mean. Those means form a distribution — the **sampling distribution** — and the **central limit theorem** says it is approximately **normal**, regardless of the shape of the underlying population, provided the sample is reasonably large.\n\nThat is remarkable. Incomes are wildly skewed; the distribution of *mean* incomes across samples of 500 is a bell curve. And because we know the shape, we can put a number on our uncertainty.\n\nA **95% confidence interval** is the range within which the true value plausibly lies. And it is the most misinterpreted object in statistics, so here is the correct reading:\n\n**Wrong:** "There is a 95% probability the true value is in this interval."\n\n**Right:** "If I repeated this procedure many times, 95% of the intervals it produces would contain the true value."\n\nThe probability is a property of the *procedure*, not of this particular interval — the true value is fixed and either in this one or not.\n\nPractically, the interval is far more informative than a point estimate, and far more informative than a p-value. "Conversion rose 2.1% (95% CI: 0.3% to 3.9%)" tells you the effect is probably real and probably small. "p = 0.03" tells you almost nothing by comparison.\n\nAnd interval width is the honest signal of how much you know. A wide one means you have not measured enough, whatever the point estimate happens to be.',
              {
                keyTerms: [
                  { term: 'Central limit theorem', definition: 'Sample means are approximately normal whatever the population’s shape.' },
                  { term: 'Confidence interval', definition: 'A range produced by a procedure that captures the true value 95% of the time.' },
                ],
              },
            ),
            interactive(
              'Watch intervals cover, and miss',
              'confidence-interval',
              'Draw repeated samples and watch each one produce its own interval. Count how many miss the true value — it should be about one in twenty, which is what "95% confidence" actually means.',
            ),
            mcq(
              'Which is the correct reading of a 95% confidence interval?',
              [
                'There is a 95% chance the true value is in this interval',
                '95% of intervals produced this way would contain the true value',
                '95% of the data lies in this interval',
                'The result is 95% accurate',
              ],
              1,
              ['sk-confidence-intervals'],
              'A property of the procedure, not of this one interval. The true value is fixed; it is in this interval or it is not.',
            ),
            mcq(
              'Why is a confidence interval more useful than a p-value alone?',
              [
                'It is easier to compute',
                'It shows the plausible size of the effect, not merely whether it is distinguishable from zero',
                'It cannot be wrong',
                'It needs less data',
              ],
              1,
              ['sk-confidence-intervals'],
              'A statistically significant effect of 0.01% is significant and useless. The interval says so; the p-value does not.',
            ),
            trueFalse(
              'The central limit theorem requires the underlying population to be normally distributed.',
              false,
              ['sk-sampling-distribution'],
              'That is exactly what makes it useful — the sampling distribution of the mean tends to normal regardless of the population’s shape.',
            ),
          ],
        }),
        lesson({
          id: 'lesson-hypothesis-tests',
          title: 'Hypothesis Tests and p-values',
          summary: 'The most used and most misunderstood number in science.',
          level: 'intermediate',
          domain: 'math',
          steps: [
            concept(
              'The logic of the test',
              'A hypothesis test asks one narrow question: **could this result plausibly have come from chance alone?**\n\nThe structure is a proof by contradiction, softened:\n\n1. Assume the **null hypothesis** — no effect, no difference.\n2. Compute how likely a result at least this extreme would be *if the null were true*.\n3. That probability is the **p-value**.\n4. If it is small enough, reject the null.\n\nSo a p-value of 0.03 means: *if there were genuinely no effect*, you would see data this extreme about 3% of the time.\n\nThe threshold of 0.05 is a convention, not a law of nature. Fisher suggested it as a rough rule in 1925 and its promotion to a bright line separating "real" from "not real" is a historical accident with enormous consequences.\n\nTwo ways to be wrong, and they trade off:\n\n**Type I error** — a false positive. You declare an effect that is not there. The rate is your threshold: use 0.05 and you will do this 5% of the time when nothing is happening.\n\n**Type II error** — a false negative. A real effect that you miss.\n\nTightening the threshold reduces false positives and increases false negatives. Which error is worse is a domain question, not a statistical one: a screening test wants few false negatives, a drug approval wants few false positives.',
              {
                keyTerms: [
                  { term: 'Null hypothesis', definition: 'The assumption of no effect, which the test tries to rule out.' },
                  { term: 'Type I / Type II error', definition: 'A false positive / a false negative.' },
                ],
              },
            ),
            concept(
              'The four things a p-value is not',
              'Nearly every misuse of statistics in public is one of these four.\n\n**Not the probability the null is true.** p = 0.03 does not mean a 3% chance there is no effect. It is a probability computed *assuming* the null is true, which makes it the wrong conditional direction entirely — the base-rate error from the foundations track.\n\n**Not the probability the result will replicate.** Replication depends on the true effect size and on power, neither of which a p-value reports.\n\n**Not a measure of effect size.** With a large enough sample, a difference of 0.001% is significant. Significant means "distinguishable from zero", which is not the same as "large enough to matter".\n\n**Not a bright line.** p = 0.049 and p = 0.051 are essentially identical evidence. Treating one as a discovery and the other as nothing is the mechanism that produces a literature full of results clustered just under 0.05.\n\nThe better habit, and it is a simple one: **report the effect size with a confidence interval**, and treat the p-value as supporting detail. "Conversion rose 2.1 percentage points (95% CI 0.3 to 3.9)" answers the question anyone actually has. "p < 0.05" does not.\n\nThe American Statistical Association issued a formal statement in 2016 saying most of this, which is not something professional bodies do lightly.',
              {
                keyTerms: [
                  { term: 'Statistical significance', definition: 'Distinguishable from zero — which is not the same as important.' },
                ],
              },
            ),
            mcq(
              'p = 0.03. What does this mean?',
              [
                'There is a 3% chance the null hypothesis is true',
                'If there were no effect, data this extreme would occur about 3% of the time',
                'There is a 97% chance the effect is real',
                'The effect is 3% in size',
              ],
              1,
              ['sk-hypothesis-testing'],
              'The probability is conditional on the null being true. Reversing that conditional is the single most common error in reading statistics.',
            ),
            multi(
              'Which statements about p-values are false?',
              [
                'It is the probability the null hypothesis is true',
                'It measures the size of the effect',
                'It predicts whether the result will replicate',
                'It is computed assuming the null hypothesis holds',
              ],
              [0, 1, 2],
              ['sk-p-value-misuse'],
              'Only the last is correct, and it is the one people forget.',
            ),
            trueFalse(
              'With a large enough sample, a trivially small difference can be statistically significant.',
              true,
              ['sk-p-value-misuse'],
              'Significance is about distinguishability from zero. Ten million users will make a 0.001% difference significant and still worthless.',
            ),
            match(
              'Match each term to its meaning.',
              [
                { left: 'Type I error', right: 'Declaring an effect that is not there' },
                { left: 'Type II error', right: 'Missing an effect that is there' },
                { left: 'p-value', right: 'How surprising the data is under the null' },
                { left: 'Confidence interval', right: 'The plausible range of the true effect' },
              ],
              ['sk-hypothesis-testing'],
              'Only the last one tells you how big the thing is.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-stats-1',
        title: 'Inference Checkpoint',
        passingScore: 0.7,
        exercises: [
          mcq(
            'More data fixes which problem?',
            ['Sampling bias', 'Sampling error', 'Both', 'Neither'],
            1,
            ['sk-sampling'],
            'Random error shrinks with √n; systematic error does not shrink at all.',
          ),
          mcq(
            'A 95% confidence interval means what?',
            [
              '95% chance the true value is inside it',
              '95% of intervals built this way contain the true value',
              '95% of data points are inside it',
              'The estimate is 95% accurate',
            ],
            1,
            ['sk-confidence-intervals'],
            'A property of the procedure.',
          ),
          trueFalse(
            'p = 0.04 means there is a 4% chance the null hypothesis is true.',
            false,
            ['sk-p-value-misuse'],
            'It is computed assuming the null is true, so it cannot be a probability about the null.',
          ),
        ],
      },
    },
    // -----------------------------------------------------------------------
    {
      id: 'unit-stats-2',
      title: 'Experiments That Answer Something',
      description: 'Power, peeking, multiplicity, and causation.',
      lessons: [
        lesson({
          id: 'lesson-ab-testing',
          title: 'A/B Testing and Power',
          summary: 'Randomise, size it in advance, and do not look early.',
          level: 'intermediate',
          domain: 'math',
          steps: [
            concept(
              'What randomisation buys',
              'An **A/B test** randomly assigns users to a control or a treatment and compares an outcome.\n\nRandomisation is doing something subtle and enormously valuable: it balances **every** confounder, including the ones you have never thought of. Statistical control can only adjust for variables you measured. Randomisation handles device type, time zone, prior engagement, mood, and the thousand things you will never record.\n\nThat is why a randomised experiment beats any amount of observational analysis, and why "we compared users who used the feature against users who did not" is not an experiment — the people who chose to use it differ in ways that caused both the choice and the outcome.\n\nWhat can still go wrong:\n\n**Assignment leakage.** Users on two devices, or shared accounts, landing in both arms.\n\n**Network effects.** In a social product, treating one user affects their untreated friends, so the arms are not independent.\n\n**Novelty and primacy.** A change performs unusually well because it is new, or unusually badly because it is unfamiliar. Both fade, which is why short tests mislead.\n\n**Sample ratio mismatch.** You asked for 50/50 and got 52/48. This is an alarm, not a curiosity — it means assignment is broken somewhere, and any result is suspect.\n\nAnd pick the **metric** before you start. A test with twenty metrics and no pre-registered primary one will always find something, which is the subject of the next section.',
              {
                keyTerms: [
                  { term: 'Randomisation', definition: 'Random assignment, which balances confounders you did not measure.' },
                  { term: 'Sample ratio mismatch', definition: 'Arm sizes differing from the intended split — a sign assignment is broken.' },
                ],
              },
            ),
            mcq(
              'What does randomisation give you that statistical adjustment cannot?',
              [
                'A larger sample',
                'Balance across confounders you never measured or thought of',
                'Faster results',
                'Lower variance',
              ],
              1,
              ['sk-ab-testing'],
              'Adjustment can only handle variables you have. Randomisation handles all of them.',
            ),
            mcq(
              'A test configured for a 50/50 split delivers 53/47 with 200,000 users. What should you do?',
              [
                'Nothing — it is close enough',
                'Investigate: a sample ratio mismatch means assignment is broken and the results cannot be trusted',
                'Reweight the results',
                'Extend the test',
              ],
              1,
              ['sk-ab-testing'],
              'At that sample size the deviation is far outside chance. Something is filtering users differently between arms, which biases everything.',
            ),
            concept(
              'Power: sizing the experiment before you run it',
              '**Statistical power** is the probability of detecting an effect that is genuinely there. Convention is 80%, meaning that even with a real effect you will miss it one time in five.\n\nFour quantities are locked together — fix any three and the fourth follows:\n\n- **Effect size** you want to detect\n- **Sample size**\n- **Significance threshold** (usually 0.05)\n- **Power** (usually 0.80)\n\nThe order of operations matters enormously. Decide the **smallest effect worth acting on** first — that is a business question — then compute the sample size needed. Running a test first and asking afterwards whether it was big enough is how underpowered experiments happen.\n\nAnd underpowered experiments are worse than no experiment, for a reason that is not obvious: a small study can only reach significance if the observed effect is large, so **the significant results from underpowered studies systematically overstate the effect**. You get a p < 0.05 and an effect size that is inflated, and the replication then "fails" because the original number was never real.\n\nThe practical implications:\n\n- Detecting small effects needs large samples. Halving the detectable effect quadruples the sample.\n- Low-traffic products often cannot test small changes at all, and should be honest about that rather than running a test that cannot answer.\n- A null result from a well-powered test is informative. A null result from an underpowered one tells you nothing.',
              {
                keyTerms: [
                  { term: 'Statistical power', definition: 'The chance of detecting a real effect of a given size.' },
                  { term: 'Minimum detectable effect', definition: 'The smallest effect the experiment can reliably find.' },
                ],
              },
            ),
            interactive(
              'Run an A/B test',
              'ab-test-sim',
              'Set a true effect and a sample size, then run the test. Try a small effect with a small sample repeatedly and watch how often it reaches significance — and how inflated the effect looks on the runs that do.',
            ),
            mcq(
              'Why are the significant results of underpowered studies systematically inflated?',
              [
                'Researchers exaggerate them',
                'Only unusually large observed effects can clear significance at a small sample, so the ones that pass overstate the truth',
                'Small samples have more bias',
                'They use the wrong test',
              ],
              1,
              ['sk-statistical-power'],
              'The winner’s curse. This is a major driver of the replication crisis, and it requires no misconduct at all.',
            ),
            numeric(
              'Detecting an effect half as large requires roughly how many times the sample size?',
              4,
              ['sk-statistical-power'],
              'Sample size scales with 1/effect², so halving the detectable effect quadruples the requirement.',
            ),
            order(
              'Order the steps of designing an experiment.',
              [
                'Choose the primary metric',
                'Decide the smallest effect worth acting on',
                'Compute the required sample size for 80% power',
                'Run until that sample is reached',
                'Analyse once, and report the effect with an interval',
              ],
              ['sk-ab-testing', 'sk-statistical-power'],
              'Every one of these before the test starts. Deciding any of them afterwards is where the trouble comes from.',
            ),
          ],
        }),
        lesson({
          id: 'lesson-pitfalls',
          title: 'Multiplicity, Peeking, and Causation',
          summary: 'Four ways to find an effect that is not there, and one way to find one that is.',
          level: 'expert',
          domain: 'math',
          steps: [
            concept(
              'Test twenty things and one will be significant',
              'At a 5% threshold, each test has a 5% chance of a false positive. Run twenty independent tests with no real effects anywhere and the chance of at least one "significant" result is 1 − 0.95²⁰ ≈ **64%**.\n\nSo a dashboard comparing twenty metrics will essentially always show something. That is not a finding; it is arithmetic.\n\nThis is the **multiple comparisons problem**, and it appears in more guises than people expect:\n\n- Many metrics in one test\n- Many segments ("it worked for users in Canada on Android")\n- Many variants\n- Repeated analysis over time — which is **peeking**, and is the same problem in the time dimension\n\n**Peeking** deserves its own warning because it feels so reasonable. Checking a running test each day and stopping when it reaches p < 0.05 inflates the false positive rate to somewhere around 20–30%, because you took twenty chances to cross a line and stopped at the first one. Either fix the sample size in advance, or use a sequential method designed for continuous monitoring.\n\nThe corrections, in increasing sophistication: **Bonferroni** (divide the threshold by the number of tests — simple and conservative), **Benjamini–Hochberg** (control the false discovery rate — more powerful and standard in genomics), or **pre-registration** of one primary metric with everything else explicitly exploratory.\n\nThat last one is the real fix. **p-hacking** rarely involves dishonesty. It is trying a few segments, dropping an outlier, testing a variant metric — each step individually defensible, and jointly a search for significance. Deciding the analysis before seeing the data is what makes the p-value mean what it claims to mean.',
              {
                keyTerms: [
                  { term: 'Multiple comparisons', definition: 'Many tests inflating the chance of a false positive somewhere.' },
                  { term: 'Peeking', definition: 'Repeated interim analysis, which inflates the false positive rate.' },
                ],
              },
            ),
            numeric(
              'Running 20 independent tests at a 5% threshold with no real effects, what is the approximate percentage chance of at least one significant result?',
              64,
              ['sk-multiple-comparisons'],
              '1 − 0.95²⁰ ≈ 0.64. Which is why a twenty-metric dashboard always has something to report.',
              { tolerance: 3 },
            ),
            mcq(
              'Why is checking a running test daily and stopping at p < 0.05 a problem?',
              [
                'It wastes traffic',
                'Repeated looks are repeated chances to cross the line, inflating the false positive rate well above 5%',
                'The test needs a full week',
                'It biases the assignment',
              ],
              1,
              ['sk-multiple-comparisons'],
              'Twenty peeks at 5% each behaves like twenty tests. Fix the sample in advance, or use a sequential design built for it.',
            ),
            multi(
              'Which count as p-hacking, even without any intent to deceive?',
              [
                'Trying several metrics and reporting the one that reached significance',
                'Slicing by segment until one shows an effect',
                'Removing an outlier after seeing that it changes the result',
                'Pre-registering a single primary metric and reporting it',
              ],
              [0, 1, 2],
              ['sk-multiple-comparisons'],
              'Each individual step can be defended. Together they are a search for significance, which is exactly what invalidates the p-value.',
            ),
            concept(
              'Correlation, causation, and confounding',
              'Two variables move together. Four explanations, and only one of them is the interesting case:\n\n**A causes B.** The hypothesis.\n**B causes A.** Reverse causation, and more common than people expect. "Users who engage with notifications retain better" — or retained users engage with notifications.\n**A third thing causes both.** **Confounding.** Ice cream sales and drownings correlate because both rise with temperature.\n**Coincidence.** With enough variables, some will correlate for no reason at all.\n\nConfounding is the one that does most damage in practice because the story is so plausible. Users of a premium feature retain better — because premium users were already more engaged, which caused both the purchase and the retention.\n\nWhat establishes causation:\n\n**Randomised experiment.** The gold standard, because random assignment breaks the link between the treatment and every confounder at once.\n\nWhen you cannot randomise — you cannot randomly assign people to smoke — there are quasi-experimental methods, each with assumptions you must be able to defend:\n\n**Difference in differences** — compare change over time between a treated and an untreated group.\n**Instrumental variables** — find something affecting treatment but not the outcome directly.\n**Regression discontinuity** — exploit a sharp threshold in who receives the treatment.\n\nThe honest position is that these are weaker than randomisation and better than nothing, and each rests on an assumption that cannot itself be tested. Say which assumption you are making, out loud.\n\nAnd the practical rule that saves the most trouble: **before accepting a causal story, ask what else could produce the same correlation.** Usually something can.',
              {
                keyTerms: [
                  { term: 'Confounder', definition: 'A third variable causing both of the two you are comparing.' },
                  { term: 'Difference in differences', definition: 'Comparing change over time between treated and untreated groups.' },
                ],
              },
            ),
            categorize(
              'What best explains each correlation?',
              ['Likely confounding', 'Likely reverse causation', 'Plausibly causal'],
              [
                { item: 'Ice cream sales and drowning deaths', category: 'Likely confounding' },
                { item: 'Premium subscribers retain better', category: 'Likely confounding' },
                { item: 'Users who open notifications retain better', category: 'Likely reverse causation' },
                { item: 'A randomised checkout redesign raised conversion', category: 'Plausibly causal' },
              ],
              ['sk-causal-inference'],
              'Only the randomised one supports a causal claim without further assumptions.',
            ),
            mcq(
              'Why does randomisation establish causation where adjustment does not?',
              [
                'It uses more data',
                'It breaks the link between treatment and every confounder, including unmeasured ones',
                'It removes sampling error',
                'It is more precise',
              ],
              1,
              ['sk-causal-inference'],
              'Adjustment can only control for variables you recorded. Randomisation handles the ones you never thought of.',
            ),
            shortAnswer(
              'A colleague reports: "Users who use our new AI assistant retain 40% better — we should promote it everywhere." What would you ask?',
              ['confound', 'random', 'selection', 'causal', 'experiment'],
              'Whether users were randomly assigned to the assistant or chose it themselves. If they chose it, the comparison is between people who were already more engaged and everyone else, and engagement plausibly caused both the choice and the retention — so the 40% is confounded and may be entirely selection. I would ask for a randomised rollout, or failing that a difference-in-differences against a comparable untreated cohort, and I would want to see the effect size with an interval rather than a single headline number.',
              ['sk-causal-inference', 'sk-ab-testing'],
              'Self-selection is the default explanation for this shape of result, and it has to be ruled out before the causal reading is available.',
            ),
            fill(
              'Randomisation balances confounders you did not ___ , while statistical adjustment can only handle those you ___ .',
              [['measure', 'record', 'think of'], ['measured', 'recorded', 'have']],
              ['sk-causal-inference'],
              'Which is the entire argument for running an experiment rather than analysing what you already have.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-stats-2',
        title: 'Experimentation Checkpoint',
        passingScore: 0.7,
        exercises: [
          mcq(
            'Detecting an effect half as large requires roughly how much more data?',
            ['Twice', 'Four times', 'The same', 'Eight times'],
            1,
            ['sk-statistical-power'],
            'Sample size scales with the inverse square of the effect.',
          ),
          mcq(
            'Stopping a test the first day it reaches p < 0.05 does what?',
            [
              'Saves traffic with no downside',
              'Inflates the false positive rate well above 5%',
              'Increases power',
              'Reduces confounding',
            ],
            1,
            ['sk-multiple-comparisons'],
            'Each look is another chance to cross the line by luck.',
          ),
          trueFalse(
            'Randomisation balances confounders you never measured.',
            true,
            ['sk-causal-inference'],
            'Which is exactly what statistical adjustment cannot do.',
          ),
        ],
      },
    },
  ],
};
