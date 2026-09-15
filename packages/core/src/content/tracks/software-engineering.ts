/**
 * Track 23 — Software Engineering Practice.
 *
 * The habits that separate code that works once from code a team can keep
 * changing for years. Nothing here is about a language; all of it is about
 * what you do around the code.
 */

import type { Track } from '../../domain/types';
import { categorize, concept, interactive, lesson, match, mcq, multi, numeric, order, shortAnswer, trueFalse } from '../builders';

export const softwareEngineeringTrack: Track = {
  id: 'track-swe',
  title: 'Software Engineering Practice',
  tagline: 'Version control, tests, review, and debugging as a method',
  description:
    'How working code becomes maintainable code: commits that explain themselves, tests at the right level, review that finds real problems, debugging as a search procedure, and technical debt treated as a decision rather than a moral failing.',
  domain: 'software-engineering',
  level: 'intro',
  icon: '🛠️',
  gradient: ['#8B5CF6', '#EC4899'],
  prerequisites: ['track-foundations'],
  outcomes: [
    'Use branches and merges deliberately, and resolve a conflict without fear',
    'Place a test at the right level of the pyramid and say what it is actually asserting',
    'Write a property-based test for logic where examples are not enough',
    'Debug by bisecting the space of possibilities instead of guessing',
    'Name where an abstraction helps, where it costs, and when debt is worth taking',
  ],
  units: [
    // -----------------------------------------------------------------------
    {
      id: 'unit-swe-1',
      title: 'History and Collaboration',
      description: 'Commits as a record, branches as parallel work, review as a conversation.',
      lessons: [
        lesson({
          id: 'lesson-version-control',
          title: 'Commits, Branches, and Merges',
          summary: 'A version-control history is documentation you get for free — or do not.',
          level: 'intro',
          domain: 'software-engineering',
          free: true,
          steps: [
            concept(
              'A commit is a snapshot plus an explanation',
              'Git stores a commit as a complete snapshot of the tree, a pointer to its parent, and a message. The history is a directed graph of those snapshots, which is why almost everything in Git is fast: checking out a branch is following a pointer, not replaying diffs.\n\nThe part with real leverage is the **message**. Six months from now someone — probably you — will run `git blame` on a confusing line and read your explanation. What they need is not *what* changed (the diff shows that) but **why**.\n\n"Fixed bug" tells them nothing. "Clamp retry delay to 30s; the unbounded backoff was leaving jobs queued for hours after an outage" tells them the constraint, and warns them off re-introducing it.\n\nThe practical discipline is **one logical change per commit**. A commit that renames a variable *and* fixes a race condition cannot be reverted, cherry-picked, or bisected cleanly. Small, coherent commits are what make the rest of the toolchain work — and `git bisect`, later in this track, is entirely built on that assumption.',
              {
                keyTerms: [
                  { term: 'Commit', definition: 'A snapshot of the tree with a parent pointer and a message.' },
                  { term: 'Atomic commit', definition: 'One logical change, so it can be reverted or cherry-picked on its own.' },
                ],
              },
            ),
            mcq(
              'What should a commit message primarily explain?',
              [
                'Which files changed',
                'Why the change was made and what constraint it satisfies',
                'Who requested it',
                'How long it took',
              ],
              1,
              ['sk-version-control'],
              'The diff already shows what changed. Only you can record why.',
            ),
            trueFalse(
              'A commit that renames a variable and fixes a bug in the same change is fine as long as both work.',
              false,
              ['sk-version-control'],
              'It cannot be reverted or bisected cleanly. Mixing changes costs you later, when you are already under pressure.',
            ),
            concept(
              'Branches, merges, and why conflicts happen',
              'A branch is a movable pointer to a commit. Creating one is instantaneous — nothing is copied. That cheapness is why the workflow exists at all.\n\nIntegrating work comes in two shapes:\n\n**Merge** creates a commit with two parents. History shows what really happened, including the branching. Non-destructive.\n\n**Rebase** replays your commits onto a new base, producing a linear history. Cleaner to read, but it rewrites commits — so never rebase a branch other people have pulled, because their history and yours no longer share the commits they think they do.\n\nA **conflict** happens when two branches changed the same lines and Git will not guess. This is not a malfunction; it is Git correctly refusing to make a judgement call it cannot make. You read both sides, decide what the combined intent is, and mark it resolved.\n\nThe real lesson about conflicts is preventative: they scale with how long a branch lives. A branch merged daily rarely conflicts. A branch open for three weeks conflicts with everything, and by then nobody remembers why either side made its change.',
              {
                keyTerms: [
                  { term: 'Merge commit', definition: 'A commit with two parents, recording that two lines of work joined.' },
                  { term: 'Rebase', definition: 'Replaying commits onto a new base, producing linear but rewritten history.' },
                ],
              },
            ),
            mcq(
              'Why should you not rebase a branch that others have already pulled?',
              [
                'Rebasing is slower than merging',
                'It rewrites commits, so their history and the new one no longer share the commits they are based on',
                'Rebase deletes the branch',
                'It loses the commit messages',
              ],
              1,
              ['sk-branching'],
              'Rewriting shared history forces everyone downstream into a painful recovery. Rebase your own unpushed work freely.',
            ),
            mcq(
              'Your team has frequent, painful merge conflicts. What most reliably reduces them?',
              [
                'Using rebase instead of merge',
                'Integrating branches more often, so each one diverges less',
                'A better merge tool',
                'Assigning each person their own files',
              ],
              1,
              ['sk-branching'],
              'Conflict size grows with divergence. Short-lived branches are the structural fix; tooling only softens the symptom.',
            ),
            order(
              'Order the steps of resolving a merge conflict.',
              ['Attempt the merge and see it stop with conflicts', 'Open the conflicted files and read both sides', 'Edit to the combined intent and remove the markers', 'Stage the resolved files', 'Complete the merge commit'],
              ['sk-branching'],
              'The judgement is in step three; everything else is mechanical.',
            ),
          ],
        }),
        lesson({
          id: 'lesson-code-review',
          title: 'Code Review That Finds Things',
          summary: 'Not a gate. A second pair of eyes with a specific job.',
          level: 'intermediate',
          domain: 'software-engineering',
          steps: [
            concept(
              'What review is actually for',
              'Code review has four jobs, and they are not equally well served by the same behaviour.\n\n**Catching defects.** Genuine, but weaker than people assume — reviewers find logic errors and missing cases, and are poor at spotting concurrency bugs or performance cliffs. Tests catch more.\n\n**Spreading knowledge.** Often the biggest value. After review, two people understand the change, which is the cheapest insurance against a bus factor of one.\n\n**Design feedback.** Most valuable early and nearly worthless late. A reviewer suggesting a different architecture on a 2,000-line PR is asking for a week of rework, so the suggestion gets waved through.\n\n**Consistency.** Keeping the codebase looking like it was written by one person. Mostly automatable, and should be automated.\n\nThat last point is the highest-leverage move available: **let machines review what machines can review**. Formatting, lint, import order, type errors, test coverage — all of it belongs in CI. Every comment a human spends on a missing semicolon is attention not spent on the logic.\n\nAnd review effectiveness collapses with size. Under ~200 lines, reviewers find real problems. Over ~800, they approve. If you want review to work, the lever is smaller pull requests, not sterner reviewers.',
              {
                keyTerms: [
                  { term: 'Bus factor', definition: 'How many people must be unavailable before knowledge is lost.' },
                ],
              },
            ),
            mcq(
              'Review quality drops sharply above roughly how many changed lines?',
              ['50', '200–400', '800+', 'It does not vary with size'],
              2,
              ['sk-code-review'],
              'Past a few hundred lines defect detection falls off a cliff and approval rates rise. Small PRs are a review technique.',
            ),
            multi(
              'Which review comments are best replaced by automation?',
              [
                'Inconsistent indentation',
                'This loop is O(n²) over a list that will grow',
                'Missing type annotation',
                'Unsorted imports',
              ],
              [0, 2, 3],
              ['sk-code-review'],
              'Formatting, types and ordering are machine work. Complexity in context is exactly what you want a human looking at.',
            ),
            mcq(
              'What is usually the most durable benefit of code review?',
              [
                'Catching every bug before release',
                'A second person now understands the change and the system',
                'Enforcing the style guide',
                'Creating an audit trail',
              ],
              1,
              ['sk-code-review'],
              'Defect catching is real but limited. Shared understanding compounds.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-swe-1',
        title: 'Collaboration Checkpoint',
        passingScore: 0.7,
        exercises: [
          mcq(
            'What is the strongest structural fix for painful merge conflicts?',
            ['A better merge tool', 'Shorter-lived branches integrated more often', 'Rebasing everything', 'File ownership rules'],
            1,
            ['sk-branching'],
            'Conflicts scale with divergence.',
          ),
          trueFalse(
            'A commit message should explain why the change was made, not just what changed.',
            true,
            ['sk-version-control'],
            'The diff covers what. Only the author can supply why.',
          ),
          mcq(
            'Which belongs in CI rather than in a human review comment?',
            ['Whether the abstraction fits the domain', 'Formatting and import order', 'Whether the edge case is handled', 'Whether the API is a good contract'],
            1,
            ['sk-code-review'],
            'Automate the mechanical checks so humans spend attention on judgement.',
          ),
        ],
      },
    },
    // -----------------------------------------------------------------------
    {
      id: 'unit-swe-2',
      title: 'Tests That Earn Their Keep',
      description: 'What to assert, at what level, and what to run automatically.',
      lessons: [
        lesson({
          id: 'lesson-testing',
          title: 'Unit Tests and the Pyramid',
          summary: 'Test behaviour, not implementation. Then put each test at the right height.',
          level: 'intro',
          domain: 'software-engineering',
          steps: [
            concept(
              'Assert behaviour, not implementation',
              'A test exists to let you change code with confidence. That goal tells you what to assert: the **observable behaviour** of a unit, not how it achieves it.\n\nA test asserting "`sort` returns elements in ascending order" survives a rewrite from bubble sort to quicksort. A test asserting "`sort` calls `swap` 14 times" breaks on that rewrite while nothing is actually wrong. The second test does not protect you from regressions; it protects the implementation from improvement.\n\nThe shape that keeps this honest is **arrange, act, assert** — set up the state, perform the one action, check the one outcome. One behaviour per test, so a failure names the problem instead of requiring an investigation.\n\nWhat to cover, in order of value:\n\n- The **happy path**, once.\n- The **edge cases**: empty, one element, maximum size, duplicates.\n- The **error cases**: invalid input, and that the right error surfaces.\n- Every **bug you have ever fixed** — a regression test is the cheapest test to justify, because you have already proved that case can break.\n\nThe trap to avoid is coverage as a target. 100% coverage with assertions that never fail is worse than 60% with sharp ones, because it reports safety you do not have.',
              {
                keyTerms: [
                  { term: 'Arrange-act-assert', definition: 'A test structure: set up state, perform one action, check one outcome.' },
                  { term: 'Regression test', definition: 'A test pinning a bug you have already fixed once.' },
                ],
              },
            ),
            mcq(
              'Which assertion makes a test brittle without making it more useful?',
              [
                'The returned list is sorted ascending',
                'The function called the internal comparator exactly 14 times',
                'An empty input returns an empty list',
                'Invalid input raises ValueError',
              ],
              1,
              ['sk-unit-testing'],
              'It pins the implementation. Any optimisation breaks the test even though behaviour is unchanged.',
            ),
            multi(
              'Which cases are worth a test for a `parse_date` function?',
              [
                'A well-formed date',
                'An empty string',
                'A date with an invalid month',
                'That it internally uses a regular expression',
              ],
              [0, 1, 2],
              ['sk-unit-testing'],
              'Behaviour at the boundaries and on bad input. How it parses is its own business.',
            ),
            concept(
              'The pyramid: cost, speed, and confidence',
              'Tests sit at different levels, and the levels trade speed against realism.\n\n**Unit tests** — one function or class, dependencies faked. Milliseconds. Pinpoint a failure exactly. Prove nothing about whether the pieces fit together.\n\n**Integration tests** — several components with the real database or real HTTP. Hundreds of milliseconds to seconds. Catch the wiring mistakes that units cannot.\n\n**End-to-end tests** — the whole system through the real interface. Seconds to minutes. Maximum confidence, maximum flakiness, and a failure tells you *something* broke without saying what.\n\nThe pyramid shape — many unit, some integration, few end-to-end — comes from a feedback-loop argument, not dogma. A suite you can run in ten seconds gets run on every save. A suite that takes forty minutes gets run at the end, which is exactly when a failure is most expensive to diagnose.\n\nThe common failure is the **ice cream cone**: mostly end-to-end tests, because they feel the most convincing. The result is a slow, flaky suite that people learn to re-run rather than believe — and a test suite nobody believes is worse than none, because it consumes time and supplies no information.',
              {
                figure: 'test-pyramid',
                keyTerms: [
                  { term: 'Test pyramid', definition: 'Many fast unit tests, fewer integration tests, very few end-to-end tests.' },
                  { term: 'Flaky test', definition: 'One that passes and fails without code changes, destroying trust in the suite.' },
                ],
              },
            ),
            categorize(
              'Sort each test by level.',
              ['Unit', 'Integration', 'End-to-end'],
              [
                { item: 'A pure discount calculation with sample inputs', category: 'Unit' },
                { item: 'The repository layer against a real test database', category: 'Integration' },
                { item: 'A browser signing up, paying, and receiving an email', category: 'End-to-end' },
                { item: 'Date parsing edge cases', category: 'Unit' },
              ],
              ['sk-test-pyramid'],
              'Push down the pyramid wherever a lower-level test can answer the same question.',
            ),
            mcq(
              'What is wrong with a suite that is mostly end-to-end tests?',
              [
                'It provides no confidence',
                'It is slow and flaky, so it stops being run often and stops being believed',
                'It cannot test the database',
                'It requires more code',
              ],
              1,
              ['sk-test-pyramid'],
              'Feedback loops are the whole point. A forty-minute flaky suite trains the team to ignore it.',
            ),
          ],
        }),
        lesson({
          id: 'lesson-property-ci',
          title: 'Property Testing and CI/CD',
          summary: 'Let the machine invent the inputs, and run everything on every push.',
          level: 'intermediate',
          domain: 'software-engineering',
          steps: [
            concept(
              'Test the invariant, not the examples',
              'Example-based tests check the cases you thought of. Your bugs live in the cases you did not.\n\n**Property-based testing** inverts this. You state a property that must hold for *all* valid inputs, and the framework generates hundreds of random ones trying to break it.\n\nThe properties that tend to find real bugs:\n\n**Round trips.** `decode(encode(x)) == x` for any x. This alone finds an enormous share of serialisation bugs.\n\n**Invariants.** `len(sort(xs)) == len(xs)`, and the result is ordered, and it is a permutation of the input.\n\n**Idempotence.** `normalise(normalise(x)) == normalise(x)`.\n\n**Oracles.** The fast implementation agrees with the obviously-correct slow one.\n\nThe feature that makes it genuinely practical is **shrinking**. When a failure is found with a 200-element list, the framework automatically reduces it to the smallest failing case — often something like `[0, -0.0]` — which hands you the bug rather than a haystack.\n\nThis is where property testing pays for itself: parsers, serialisers, and anything with a mathematical structure. For plain CRUD, examples are usually enough.',
              {
                keyTerms: [
                  { term: 'Property', definition: 'An assertion that must hold for every valid input, not just chosen ones.' },
                  { term: 'Shrinking', definition: 'Automatically reducing a failing input to the smallest case that still fails.' },
                ],
              },
            ),
            multi(
              'Which are good properties to assert about a sort function?',
              [
                'The output is ordered',
                'The output has the same length as the input',
                'The output is a permutation of the input',
                'Sorting takes less than 5 ms',
              ],
              [0, 1, 2],
              ['sk-property-testing'],
              'The first three together fully characterise sorting. Timing is a benchmark, and a flaky one.',
            ),
            mcq(
              'What does shrinking do when a property test fails?',
              [
                'Reduces the number of test runs',
                'Reduces the failing input to the smallest case that still fails',
                'Compresses the test output',
                'Skips the failing property',
              ],
              1,
              ['sk-property-testing'],
              'It turns "it broke on these 200 random values" into "it breaks on [0, -0.0]".',
            ),
            concept(
              'CI/CD: the loop that keeps main releasable',
              '**Continuous integration** means every push runs the checks automatically — build, lint, types, tests — against the merged result. Not "the tests passed on my machine", but "the tests pass on the code as it will exist after merging".\n\nThat is the whole idea, and its value is timing. A bug caught in CI costs minutes. The same bug caught in production costs an incident, a rollback, and the credibility of your deploy process.\n\n**Continuous delivery** extends it: every commit that passes is a candidate for release, so releasing is a decision rather than a project. **Continuous deployment** removes the decision too.\n\nWhat makes it work:\n\n- **Fast.** Over ten minutes and people stop waiting for it, which means they stop reading it.\n- **Reliable.** A flaky pipeline teaches everyone to re-run rather than investigate — at which point it detects nothing.\n- **Blocking.** A red build that can be merged anyway is a status light, not a check.\n\nAnd the deploy side needs a reverse gear. **Rollback** must be routine and fast, because the alternative — fixing forward under pressure at 3am — is how small incidents become long ones. A deploy you cannot undo in one step is a deploy you will hesitate to make, and hesitation means larger, riskier batches.',
              {
                keyTerms: [
                  { term: 'Continuous integration', definition: 'Automatically building and testing every change against the merged result.' },
                  { term: 'Rollback', definition: 'Returning to the previous known-good release in one fast, routine step.' },
                ],
              },
            ),
            mcq(
              'Why is a flaky CI pipeline worse than a slow one?',
              [
                'It uses more compute',
                'It trains the team to re-run failures instead of investigating them, so real failures get ignored too',
                'It cannot run tests in parallel',
                'It breaks rollbacks',
              ],
              1,
              ['sk-ci-cd'],
              'A check nobody believes provides no signal while still costing time.',
            ),
            order(
              'Order a typical CI pipeline from fastest-failing to slowest.',
              ['Lint and format check', 'Type check', 'Unit tests', 'Integration tests', 'End-to-end tests'],
              ['sk-ci-cd'],
              'Cheap checks first so an obvious failure reports in seconds rather than after the full suite.',
            ),
            trueFalse(
              'If rollback is slow and risky, teams tend to deploy less often and in larger batches.',
              true,
              ['sk-ci-cd'],
              'And larger batches are riskier, which makes rollback more likely to be needed. The loop reinforces itself in both directions.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-swe-2',
        title: 'Testing Checkpoint',
        passingScore: 0.7,
        exercises: [
          mcq(
            'What should a unit test assert?',
            ['Which internal methods were called', 'The observable behaviour of the unit', 'Execution time', 'Line coverage'],
            1,
            ['sk-unit-testing'],
            'Behaviour survives refactoring; implementation details do not.',
          ),
          mcq(
            'What is the main argument for the pyramid shape?',
            [
              'Unit tests find more bugs than end-to-end tests',
              'Fast, reliable feedback gets run constantly, and constant feedback is what catches problems early',
              'End-to-end tests are unnecessary',
              'Integration tests are hard to write',
            ],
            1,
            ['sk-test-pyramid'],
            'It is an argument about feedback loops, not about which level is more truthful.',
          ),
          trueFalse(
            '`decode(encode(x)) == x` for all x is a property worth testing.',
            true,
            ['sk-property-testing'],
            'Round-trip properties find a large share of serialisation bugs with one assertion.',
          ),
        ],
      },
    },
    // -----------------------------------------------------------------------
    {
      id: 'unit-swe-3',
      title: 'Finding and Preventing Bugs',
      description: 'Debugging as search, and design decisions that decide how many bugs there are.',
      lessons: [
        lesson({
          id: 'lesson-debugging',
          title: 'Debugging as a Discipline',
          summary: 'Not inspiration. A binary search over the space of possibilities.',
          level: 'intermediate',
          domain: 'software-engineering',
          steps: [
            concept(
              'Halve the search space, repeatedly',
              'Bad debugging is guessing: change something plausible, re-run, hope. It feels like progress and can run for hours.\n\nGood debugging is a **search**, and the method is the one from the DSA track. You have a space of possible causes. Each experiment should eliminate about half of it.\n\nThe procedure:\n\n1. **Reproduce reliably.** A bug you cannot trigger on demand cannot be debugged, only speculated about. This step is often most of the work and it is never wasted.\n2. **Reduce.** Strip the failing case down until every remaining element is necessary. A ten-line reproduction usually makes the cause obvious.\n3. **Form a falsifiable hypothesis.** "The timestamp is being parsed as local time, not UTC" — something an experiment can *disprove*.\n4. **Test the midpoint.** Assert or log halfway through the pipeline. Is the data correct there? That answer halves the space.\n5. **Repeat** on the surviving half.\n\nThe discipline that matters most is the one people skip: **change one thing at a time**. Change three and a fix tells you nothing about which change mattered, so you have learned nothing even when it works.\n\nAnd `git bisect` is this same search applied to history. Given a good commit and a bad one, it checks out the midpoint and asks; twenty questions finds the culprit among a million commits.',
              {
                keyTerms: [
                  { term: 'Minimal reproduction', definition: 'The smallest case that still exhibits the bug.' },
                  { term: 'git bisect', definition: 'Binary search over commit history to find the change that introduced a bug.' },
                ],
              },
            ),
            interactive(
              'Bisect to the bad commit',
              'bisect-debug',
              'A regression appeared somewhere in this history. Mark each checked-out commit good or bad and watch the range halve. Count how few steps it takes — and what happens to the count if you test sequentially instead.',
            ),
            numeric(
              'How many bisect steps are needed, at most, to find the bad commit among 1,024?',
              10,
              ['sk-debugging'],
              'log₂(1024) = 10. Linear search would average 512.',
            ),
            mcq(
              'Why is changing only one thing per debugging experiment important?',
              [
                'It is faster to type',
                'If several changes are made at once, a fix does not tell you which change mattered, so nothing is learned',
                'Version control requires it',
                'It avoids merge conflicts',
              ],
              1,
              ['sk-debugging'],
              'The point of an experiment is information. Confounded experiments produce none.',
            ),
            order(
              'Order a disciplined debugging session.',
              ['Reproduce the failure reliably', 'Reduce it to a minimal case', 'Form a falsifiable hypothesis', 'Run an experiment that halves the search space', 'Fix, then add a regression test'],
              ['sk-debugging'],
              'The regression test at the end is what stops this bug from needing debugging twice.',
            ),
            shortAnswer(
              'A test passes locally and fails in CI. How would you narrow it down?',
              ['environment', 'difference', 'order', 'reproduce', 'log'],
              'Start by enumerating what differs between the two environments: versions, environment variables, timezone and locale, available services, filesystem state, and CPU count. Then attack the most likely class of difference — test ordering and shared state are the usual culprits, so run the suite locally in CI order and with the same seed. If that reproduces it, bisect the ordering; if not, add logging in CI to compare the actual inputs at the point of failure against the local run.',
              ['sk-debugging'],
              'The bug is in the difference. Enumerate the differences, then bisect them like anything else.',
            ),
          ],
        }),
        lesson({
          id: 'lesson-design-debt',
          title: 'Abstraction, Coupling, and Debt',
          summary: 'Every abstraction is a bet. Some of them should be deferred.',
          level: 'intermediate',
          domain: 'software-engineering',
          steps: [
            concept(
              'Abstraction hides detail — and hiding has a cost',
              'A good abstraction lets you use something without knowing how it works. `sort(xs)` — you do not care which algorithm. That is real leverage.\n\nThe cost is that hidden detail is detail you can no longer reason about. When the abstraction is wrong for your case, you have to break it open, and now you understand both the underlying thing *and* a layer of indirection.\n\nTwo properties tell you whether one is earning its keep:\n\n**Coupling** — how much one module must know about another. Low coupling means you can change one without the other. **Cohesion** — how related the things inside a module are. High cohesion means a module has one job.\n\nLow coupling, high cohesion. Everything else is commentary.\n\nThe failure mode worth naming is **premature abstraction**. Two pieces of code look similar, so they are unified behind a parameterised interface. Then their requirements diverge, and the parameter list grows flags, and eventually you have a function with six booleans nobody can call correctly.\n\nThe rule of three is a reasonable defence: wait for the third occurrence before abstracting. Two similar things may be coincidence; three is a pattern. **Duplication is cheaper than the wrong abstraction** — you can always merge duplicates later, but disentangling a bad abstraction means understanding every caller that depends on its current shape.',
              {
                keyTerms: [
                  { term: 'Coupling', definition: 'How much one module depends on another’s internals.' },
                  { term: 'Cohesion', definition: 'How strongly the contents of a module belong together.' },
                ],
              },
            ),
            mcq(
              'Two functions look similar today. What is the argument for waiting before unifying them?',
              [
                'Duplication is always better',
                'Their requirements may diverge, and an abstraction built on coincidence is harder to undo than duplication',
                'Abstractions are slower at runtime',
                'It makes tests harder',
              ],
              1,
              ['sk-abstraction'],
              'You can merge duplicates at any time. Disentangling a wrong abstraction means touching every caller.',
            ),
            mcq(
              'A function has grown six boolean parameters that switch its behaviour. What does that usually indicate?',
              [
                'Good configurability',
                'An abstraction built on a coincidental similarity, now doing several unrelated jobs',
                'A need for more tests',
                'Insufficient documentation',
              ],
              1,
              ['sk-abstraction'],
              'Flag parameters are a strong smell that several functions have been forced into one.',
            ),
            concept(
              'Technical debt as a decision',
              'The metaphor is financial and it is worth taking seriously. You take a shortcut to ship sooner; you pay **interest** afterwards in the form of every future change being slower.\n\nSometimes that is the right trade. Shipping a prototype to learn whether anyone wants the product, and knowing you will rewrite the data layer if they do, is a sound decision. Debt taken deliberately, with the repayment understood, is leverage.\n\nWhat makes it pathological is when it is invisible — when nobody recorded that a shortcut was taken, why, or what would trigger paying it back. Then it is not a decision, it is just decay.\n\nSo the practices that matter are about visibility:\n\n- **Write down** what the shortcut is and what condition should trigger fixing it ("when we exceed 10k users, this in-memory index must move to Redis").\n- **Distinguish deliberate from accidental.** Accidental debt — from not knowing better — is a learning problem, not a scheduling one.\n- **Pay it down where you are already working.** A dedicated "refactoring sprint" competes with features and loses. Improving the module you are currently changing does not.\n\nThe honest framing: debt is not a moral failing, and "we should rewrite it" is not a plan. Name the interest you are paying, and pay it down where it hurts.',
              {
                keyTerms: [
                  { term: 'Technical debt', definition: 'A deliberate shortcut whose cost is paid as slower future change.' },
                  { term: 'Interest', definition: 'The ongoing drag debt imposes on every subsequent change.' },
                ],
              },
            ),
            match(
              'Match each situation to how it should be treated.',
              [
                { left: 'Shortcut taken knowingly to hit a deadline, written down', right: 'Deliberate debt with a repayment trigger' },
                { left: 'Bad structure because nobody knew the pattern', right: 'A learning gap, not a scheduling item' },
                { left: 'Six boolean flags on one function', right: 'A wrong abstraction to unpick' },
                { left: 'Duplication across two modules', right: 'Acceptable until a third case proves the pattern' },
              ],
              ['sk-technical-debt'],
              'Different causes need different responses. Lumping them all as "tech debt" hides that.',
            ),
            multi(
              'Which make technical debt manageable rather than corrosive?',
              [
                'Recording what the shortcut was and what should trigger fixing it',
                'Paying it down in the modules you are already changing',
                'Scheduling a quarterly refactoring sprint and nothing else',
                'Distinguishing deliberate shortcuts from things nobody knew better than',
              ],
              [0, 1, 3],
              ['sk-technical-debt'],
              'Dedicated refactoring sprints compete with feature work and reliably lose. Incremental repayment where you are already working does not.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-swe-3',
        title: 'Debugging and Design Checkpoint',
        passingScore: 0.7,
        exercises: [
          numeric(
            'At most how many bisect steps to find one bad commit among 256?',
            8,
            ['sk-debugging'],
            'log₂(256) = 8.',
          ),
          mcq(
            'What is the stated reason to prefer duplication over a premature abstraction?',
            [
              'Duplication runs faster',
              'Duplicates can be merged later, but a wrong abstraction must be untangled from every caller',
              'Abstractions are harder to test',
              'Duplication is easier to read',
            ],
            1,
            ['sk-abstraction'],
            'Asymmetric reversibility. One direction is cheap and the other is not.',
          ),
          trueFalse(
            'Technical debt is only a problem when it is taken deliberately and recorded.',
            false,
            ['sk-technical-debt'],
            'The opposite. Recorded, deliberate debt is a decision; unrecorded debt is decay nobody can plan around.',
          ),
        ],
      },
    },
  ],
};
