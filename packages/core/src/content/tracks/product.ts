/**
 * Track 40 — Design, Product, and Working as an Engineer.
 *
 * The material that decides whether any of the rest of the catalog reaches
 * anyone. Interfaces people can use, metrics that measure the right thing, and
 * the professional practices — writing, estimating, incidents, mentoring —
 * that separate a competent engineer from an effective one.
 */

import type { Track } from '../../domain/types';
import { categorize, concept, interactive, lesson, match, mcq, multi, order, shortAnswer, trueFalse } from '../builders';

export const productTrack: Track = {
  id: 'track-product',
  title: 'Design, Product & Practice',
  tagline: 'Building the right thing, and working well while you do',
  description:
    'Mental models and usability, inclusive design, metrics that measure what you meant, and the persuasion line — then the professional side: writing, estimating, incidents, on-call, mentoring, and negotiating scope.',
  domain: 'product',
  level: 'intro',
  icon: '🧭',
  gradient: ['#EC4899', '#22C55E'],
  prerequisites: [],
  outcomes: [
    'Diagnose a usability problem as a mismatch between two mental models',
    'Audit an interface against heuristics that find real problems',
    'Design for the range of human ability rather than a median user',
    'Choose a metric that cannot be gamed into meaninglessness',
    'Write a document that gets read and acted on',
    'Run an incident and a postmortem that improve the system',
  ],
  units: [
    // -----------------------------------------------------------------------
    {
      id: 'unit-prod-1',
      title: 'Designing for People',
      description: 'Mental models, affordances, inclusion, and measurement.',
      lessons: [
        lesson({
          id: 'lesson-usability',
          title: 'Mental Models and Usability',
          summary: 'Most usability problems are one model failing to match another.',
          level: 'intro',
          domain: 'product',
          free: true,
          steps: [
            concept(
              'Three models, and the gap between them',
              'Everyone using a system carries a **mental model** — a belief about how it works, usually wrong in detail and good enough to act on.\n\nDonald Norman’s framing is that there are three:\n\n**The designer’s model** — how the designer thinks about it.\n**The system image** — what the interface actually communicates.\n**The user’s model** — what the user concludes from that image.\n\nThe designer never talks to the user. All communication happens through the system image, so **a usability problem is almost always a gap between the designer’s model and the user’s, caused by the image failing to convey it.**\n\nThe hotel-shower example is the canonical one: a single control that mixes temperature and pressure, with no indication of which way does what. People turn it and are scalded, not because they are careless but because the interface communicated nothing.\n\nSoftware examples are everywhere once you look. A "sync" button whose behaviour depends on invisible state. A form that silently discards input on validation failure. A save icon in an app that autosaves. In each case the user’s model is reasonable and wrong, and the interface is why.\n\nThe practical consequence is that **you cannot fix this by explaining harder.** A tooltip patching a bad model is a symptom of one. The fix is to change what the interface communicates until the obvious reading is the correct one.\n\nWhich also explains why you cannot evaluate your own design by using it. You have the designer’s model already. You are the one person who cannot experience the gap.',
              {
                keyTerms: [
                  { term: 'Mental model', definition: 'A user’s working theory of how the system behaves.' },
                  { term: 'System image', definition: 'Everything the interface communicates — the only channel to the user.' },
                ],
              },
            ),
            mcq(
              'Why can you not evaluate the usability of your own design by using it?',
              [
                'You are biased toward liking it',
                'You already hold the designer’s model, so you cannot experience the gap the interface creates',
                'You know where the bugs are',
                'You use it too often',
              ],
              1,
              ['sk-mental-models'],
              'The one perspective you cannot take is the one that matters.',
            ),
            concept(
              'Affordances, signifiers, and feedback',
              'Three ideas cover most of what makes an interface usable.\n\nAn **affordance** is what an object makes possible. A handle affords pulling; a flat plate affords pushing. A door with a handle on the push side is fighting its own affordance, and people will pull it forever.\n\nA **signifier** is the perceivable indication of that affordance. In software almost everything is a signifier, because pixels afford nothing physically: a button looks raised, a link is underlined, a draggable item has a grip. Flat design got into trouble by removing signifiers in pursuit of cleanliness — an interface where you cannot tell what is interactive is a puzzle.\n\n**Feedback** confirms that something happened. A press that produces no visible response will be pressed again, and now the order is placed twice. Anything taking more than 100ms needs an acknowledgement; more than a second needs progress; more than ten seconds needs an estimate and a way out.\n\nAround these sit two more:\n\n**Constraints** — make the wrong action impossible rather than merely discouraged. Disable the button; do not let the date picker offer February 31st.\n\n**Mapping** — the relationship between control and effect should be natural. Cooker knobs arranged like the burners need no labels; four knobs in a row need labels that people still read wrong.\n\nAnd **discoverability**. A feature nobody finds does not exist. Hidden gestures and long-press menus are conveniences for people who already know, never introductions for people who do not.',
              {
                keyTerms: [
                  { term: 'Affordance', definition: 'What an object makes possible.' },
                  { term: 'Signifier', definition: 'The perceivable cue indicating that possibility.' },
                ],
              },
            ),
            match(
              'Match each concept to its example.',
              [
                { left: 'Affordance', right: 'A handle makes pulling possible' },
                { left: 'Signifier', right: 'An underline indicating a link' },
                { left: 'Feedback', right: 'A spinner confirming the request was received' },
                { left: 'Constraint', right: 'A disabled button that cannot be pressed yet' },
              ],
              ['sk-affordances'],
              'Constraints are the strongest of the four: an impossible mistake needs no instruction.',
            ),
            mcq(
              'A user taps "place order" twice and is charged twice. Which design failure is this?',
              [
                'Poor mapping',
                'Missing feedback — nothing indicated the first tap was received',
                'A bad affordance',
                'Low discoverability',
              ],
              1,
              ['sk-affordances'],
              'Fix the feedback, and make the operation idempotent as well — the two fixes belong to different tracks and both apply.',
            ),
            concept(
              'Heuristics that find real problems',
              'A **heuristic evaluation** is a structured walk through an interface against a checklist. It is cheap, needs no participants, and reliably finds a large share of problems — which makes it the highest-return technique available to a team with no design researcher.\n\nThe ones that earn their place:\n\n**Visibility of system status.** Can the user tell what is happening and what state things are in?\n\n**Match to the real world.** Does it use the user’s vocabulary rather than the database’s? "Archive" not "soft delete".\n\n**User control and freedom.** Is there an obvious way out? Undo beats a confirmation dialogue, because confirmations get clicked through reflexively.\n\n**Consistency.** Does the same thing look and behave the same way throughout?\n\n**Error prevention.** Better than good error messages.\n\n**Recognition over recall.** Do not make people remember something from a previous screen.\n\n**Help users recover from errors.** Say what went wrong, in plain language, and what to do. "Error 0x80004005" fails all three.\n\nAnd then research, because heuristics find violations and not everything:\n\n**Watch people use it.** Five participants find most of the problems. Give them a task and say nothing — the strong instinct to help is exactly what invalidates the session.\n\n**Ask about behaviour, not opinions.** "What did you do last time this happened?" is evidence. "Would you use this?" is a prediction people are bad at, and they will say yes to be polite.\n\nThe most common research mistake is asking users what they want. They know their problems intimately and are no better than you at designing solutions — as the apocryphal faster-horses line has it. Take the problem seriously and treat the proposed solution as a clue.',
              {
                keyTerms: [
                  { term: 'Heuristic evaluation', definition: 'A structured expert walkthrough against a checklist of principles.' },
                  { term: 'Recognition over recall', definition: 'Show options rather than requiring the user to remember them.' },
                ],
              },
            ),
            interactive(
              'Audit an interface',
              'usability-audit',
              'Walk a small interface against the heuristics and mark the violations. Compare your list with the annotated one — the ones people miss most often are status visibility and error recovery.',
            ),
            multi(
              'Which questions produce useful research findings?',
              [
                '"Walk me through what you did last time you needed this."',
                '"What happened when you tried that?"',
                '"Would you use this feature?"',
                '"Which of these three designs do you prefer?"',
              ],
              [0, 1],
              ['sk-user-research'],
              'Past behaviour is evidence. Predicted behaviour and stated preference are both unreliable, and politeness skews them further.',
            ),
            mcq(
              'Users cannot find the export feature, which sits under Settings → Advanced → Data. What is the problem?',
              [
                'The feature is poorly implemented',
                'Information architecture — it is filed where the system thinks about it rather than where a user would look',
                'Insufficient documentation',
                'The label is too short',
              ],
              1,
              ['sk-information-architecture'],
              'Structure that mirrors the org chart or the database schema is the usual cause. Card sorting with real users is the standard fix, and it almost always moves things.',
            ),
            mcq(
              'Why is undo generally better than a confirmation dialogue?',
              [
                'It is faster to implement',
                'Confirmations get clicked through reflexively, while undo works after the mistake has been noticed',
                'It uses less screen space',
                'Dialogues are inaccessible',
              ],
              1,
              ['sk-usability-heuristics'],
              'A confirmation interrupts every correct action to catch the rare wrong one, and stops being read within a week.',
            ),
          ],
        }),
        lesson({
          id: 'lesson-inclusive-metrics',
          title: 'Inclusive Design and Honest Metrics',
          summary: 'Designing for the range of ability, and measuring what you actually meant.',
          level: 'intermediate',
          domain: 'product',
          steps: [
            concept(
              'There is no average user',
              '**Inclusive design** starts from the observation that "the average user" does not exist. People vary across vision, hearing, motor control, cognition, language, literacy, device and context — and any given person varies across their own life.\n\nMicrosoft’s persona spectrum makes this concrete. For any impairment there are three populations:\n\n| | Permanent | Temporary | Situational |\n|---|---|---|---|\n| Touch | One arm | Arm in a cast | Holding a baby |\n| See | Blind | Cataract | Bright sunlight |\n| Hear | Deaf | Ear infection | Noisy bar |\n| Speak | Non-verbal | Laryngitis | Loud environment |\n\nDesigning for the permanent case serves all three, which is why the business argument and the ethical argument point the same way.\n\nThe **curb cut effect** names the pattern: kerb ramps were mandated for wheelchairs and are used constantly by people with prams, suitcases, bikes and delivery trolleys. Captions were for deaf viewers and are now used by most viewers in public. Voice control was assistive and is now ambient.\n\nIn practice this is mostly the accessibility work from the web track — semantic structure, keyboard operability, contrast, text alternatives — plus a few things that are specifically design decisions:\n\n**Do not rely on colour alone.** Around 8% of men have some colour vision deficiency. Add a shape, a label, or a pattern.\n**Respect reduced motion.** Vestibular disorders make large animations genuinely unpleasant; the OS preference exists and should be honoured.\n**Write plainly.** Helps people with cognitive differences, non-native speakers, and everybody in a hurry.\n**Make targets large enough.** 44 points minimum, which helps tremor, large fingers, and anyone on a train.',
              {
                figure: 'persona-spectrum',
                keyTerms: [
                  { term: 'Persona spectrum', definition: 'Permanent, temporary and situational versions of the same constraint.' },
                  { term: 'Curb cut effect', definition: 'Accessibility work that ends up serving a much wider population.' },
                ],
              },
            ),
            categorize(
              'Which kind of constraint is each?',
              ['Permanent', 'Temporary', 'Situational'],
              [
                { item: 'Blind', category: 'Permanent' },
                { item: 'Eye surgery recovery', category: 'Temporary' },
                { item: 'Reading a phone in bright sun', category: 'Situational' },
                { item: 'Holding a baby in one arm', category: 'Situational' },
                { item: 'Arm in a cast', category: 'Temporary' },
              ],
              ['sk-inclusive-design'],
              'One design serves all three rows, which is why the population it helps is far larger than the permanent column.',
            ),
            mcq(
              'What is the curb cut effect?',
              [
                'A cost of accessibility work',
                'Accessibility features ending up widely used by people without the disability they were designed for',
                'A rendering artefact',
                'A legal requirement',
              ],
              1,
              ['sk-inclusive-design'],
              'Ramps, captions and voice control all started as accommodations and became defaults.',
            ),
            concept(
              'Goodhart’s law, and choosing a metric anyway',
              '"When a measure becomes a target, it ceases to be a good measure." **Goodhart’s law** is not a reason to avoid metrics; it is a reason to choose them carefully and watch what they do.\n\nThe failures follow a pattern:\n\n**Optimising a proxy.** Time on site is a proxy for value, so a confusing interface that makes people hunt raises it. Engagement is a proxy for satisfaction, so outrage raises it.\n\n**Ignoring the counter-metric.** Conversion rises, refunds rise faster. Session length rises, retention falls. Every primary metric needs a guardrail metric that catches the obvious way to cheat it.\n\n**Averages hiding the distribution.** Average satisfaction rising while the worst-served group’s falls. Segment before believing an aggregate.\n\n**Vanity metrics.** Total registered users only ever goes up and tells you nothing about whether the product works.\n\nWhat works instead:\n\n**Measure the outcome, not the activity.** Not "videos watched" but "did they learn the thing".\n\n**Pair every metric with a guardrail.** Conversion with refund rate. Speed with error rate. Engagement with churn.\n\n**Use a small set.** One primary metric, two or three guardrails. A dashboard of forty metrics means twenty of them are always moving and none of them is a decision.\n\n**Re-examine on a schedule.** A metric that was a good proxy two years ago may have been optimised into meaninglessness since.\n\nThis is precisely the alignment problem in miniature — a system optimising a specified objective that is not quite the intended one, and producing exactly what you asked for. The ethics track calls it specification gaming; here it is Tuesday.',
              {
                keyTerms: [
                  { term: 'Goodhart’s law', definition: 'A measure made into a target stops measuring what it did.' },
                  { term: 'Guardrail metric', definition: 'A paired metric that catches the obvious way to game the primary one.' },
                ],
              },
            ),
            match(
              'Match each primary metric to a sensible guardrail.',
              [
                { left: 'Conversion rate', right: 'Refund and chargeback rate' },
                { left: 'Session length', right: 'Long-term retention' },
                { left: 'Deploy frequency', right: 'Change failure rate' },
                { left: 'Support tickets closed', right: 'Reopen rate' },
              ],
              ['sk-product-metrics'],
              'Each guardrail catches the cheapest way to move the primary metric without doing the underlying work.',
            ),
            mcq(
              'Time on site rises 30% after a redesign. What should you check?',
              [
                'Nothing — engagement is up',
                'Whether users are spending longer because it became harder to find things',
                'Whether the servers can handle it',
                'Whether to raise the target',
              ],
              1,
              ['sk-product-metrics'],
              'Time is a proxy for value and also a proxy for confusion. Task completion rate distinguishes them.',
            ),
            concept(
              'Persuasion, manipulation, and the line',
              'Design influences behaviour — that is what it is for. The question is whose interest the influence serves.\n\nA **dark pattern** is an interface designed to get a user to do something they did not intend and would not choose if it were clear. They have names because they recur:\n\n**Roach motel** — trivial to subscribe, a phone call to cancel.\n**Confirmshaming** — "No thanks, I don’t want to save money."\n**Misdirection** — the decline option styled to look disabled.\n**Hidden costs** — fees appearing at the final step.\n**Forced continuity** — a free trial converting silently.\n**Privacy zuckering** — defaults that share more than anyone would choose.\n\nThe test that works: **would the user be annoyed if they understood what just happened?** Persuasion survives disclosure. Manipulation does not.\n\nThis is increasingly not only an ethical question. The EU’s Digital Services Act and the US FTC have both acted against specific patterns, and "click to cancel" rules now exist in several jurisdictions.\n\nThe engineering-specific version deserves saying, because engineers are often the last line: you will be asked to implement these. "Make the cancel flow longer." "Pre-tick the marketing box." Recognising the pattern and naming it — "this is a dark pattern and it carries regulatory risk" — is frequently enough to stop it, and it is a far more effective objection than expressing discomfort.\n\nAnd the recruitment loop is worth noticing too. An engagement metric plus an optimisation process will *find* dark patterns without anybody choosing one, which is why the guardrail metrics from the previous section are an ethical control as much as an analytical one.',
              {
                keyTerms: [
                  { term: 'Dark pattern', definition: 'An interface that gets a user to do what they would not choose if it were clear.' },
                ],
              },
            ),
            mcq(
              'What is the practical test for whether influence has crossed into manipulation?',
              [
                'Whether it increases revenue',
                'Whether the user would be annoyed if they fully understood what happened',
                'Whether it is legal',
                'Whether competitors do it',
              ],
              1,
              ['sk-dark-patterns'],
              'Persuasion survives disclosure; manipulation depends on the user not noticing.',
            ),
            multi(
              'Which are dark patterns?',
              [
                'A cancel flow requiring a phone call while signup is one click',
                'Fees that appear only at the final checkout step',
                'A decline button styled to look disabled',
                'A clearly labelled discount for annual billing',
              ],
              [0, 1, 2],
              ['sk-dark-patterns'],
              'The last is an honest offer stated plainly, which is what ordinary persuasion looks like.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-prod-1',
        title: 'Design Checkpoint',
        passingScore: 0.7,
        exercises: [
          mcq(
            'A usability problem is usually what?',
            [
              'A bug',
              'A gap between the user’s mental model and the designer’s, caused by what the interface communicates',
              'Insufficient documentation',
              'A performance issue',
            ],
            1,
            ['sk-mental-models'],
            'And it cannot be fixed by explaining harder.',
          ),
          mcq(
            'Every primary metric should be paired with what?',
            ['A target', 'A guardrail metric that catches the obvious way to game it', 'A dashboard', 'A forecast'],
            1,
            ['sk-product-metrics'],
            'Goodhart is reliable enough to plan around.',
          ),
          trueFalse(
            'Designing for a permanent impairment also serves temporary and situational versions of it.',
            true,
            ['sk-inclusive-design'],
            'Which is why the population served is far larger than the one targeted.',
          ),
        ],
      },
    },
    // -----------------------------------------------------------------------
    {
      id: 'unit-prod-2',
      title: 'Working as an Engineer',
      description: 'Writing, estimating, incidents, and the parts of the job nobody teaches.',
      lessons: [
        lesson({
          id: 'lesson-writing-estimating',
          title: 'Writing and Estimating',
          summary: 'Two skills that determine your effectiveness more than your code does.',
          level: 'intermediate',
          domain: 'product',
          steps: [
            concept(
              'Writing that gets read',
              'Past a certain scope, your influence is mostly carried by writing. A design nobody understood is a design that did not happen.\n\nWhat actually works:\n\n**Lead with the conclusion.** Not a narrative of your investigation. "We should use Postgres rather than DynamoDB, because our access patterns are relational and the team already operates Postgres." Then the detail. Most readers stop after the first paragraph, and that is fine if the first paragraph contains the answer.\n\n**Write for the least informed reader who matters.** Expand the acronym once. A document only three people can read will be approved by three people.\n\n**Make the structure skimmable.** Headings, short paragraphs, a table where there is a comparison. Assume scanning, not reading.\n\n**State the alternatives and why they lost.** This is the single highest-value section of a design document, because it pre-empts the obvious objections and because the reader six months from now needs it most.\n\n**Be explicit about uncertainty.** "I am confident about the schema and unsure about the migration path" is more useful than uniform confidence, and it directs review attention where it is needed.\n\nThe **design document** and the **architecture decision record** are the two formats worth knowing. A design doc argues a proposal before the work; an ADR records what was decided and why, in a short, immutable file next to the code. ADRs are unglamorous and they answer the question every new engineer asks — "why is it like this?" — which is otherwise answered by guessing.\n\nOne rule saves the most time: **write the document before doing the work, not after.** Its purpose is to surface disagreement while changing your mind is still cheap.',
              {
                keyTerms: [
                  { term: 'Architecture decision record', definition: 'A short immutable note recording a decision and its reasoning.' },
                  { term: 'Alternatives considered', definition: 'The section that pre-empts objections and explains the choice later.' },
                ],
              },
            ),
            multi(
              'Which make a technical document more effective?',
              [
                'Stating the conclusion in the first paragraph',
                'A section on alternatives considered and why they lost',
                'Being explicit about where you are uncertain',
                'Presenting the investigation chronologically',
              ],
              [0, 1, 2],
              ['sk-technical-writing', 'sk-design-docs'],
              'Chronology is how you did the work, not how anyone wants to read about it.',
            ),
            mcq(
              'When should a design document be written?',
              [
                'After the implementation, to document it',
                'Before the work, so disagreement surfaces while changing course is still cheap',
                'Only for large projects',
                'Never — the code is the documentation',
              ],
              1,
              ['sk-design-docs'],
              'A document written afterwards is a description. Written beforehand it is a decision-making tool.',
            ),
            concept(
              'Estimating, and being wrong usefully',
              'Software estimates are famously bad, and the reason is structural rather than a failure of effort: you are estimating work that has never been done before, since anything done before would be reused.\n\nWhat helps:\n\n**Estimate ranges, not points.** "Three to eight days" is honest. "Five days" implies a precision nobody has, and will be heard as a commitment.\n\n**Break it down.** Estimation error compounds far less over several small pieces than it does on one large one, and the act of decomposing surfaces the parts you had not thought about — which is where the underestimate lives.\n\n**Use history.** What did the last three similar tasks actually take? Reference-class forecasting beats intuition reliably, and everyone ignores it.\n\n**Remember the planning fallacy.** People systematically underestimate, even when they know about the planning fallacy. Knowing does not correct it; historical data does.\n\n**Estimate the whole job.** Code is often half of it. Tests, review, deployment, documentation, monitoring, and the follow-up bugs are the other half.\n\n**Separate estimate from commitment.** An estimate is a forecast under uncertainty. A commitment is a promise. Being asked to commit to an estimate is a request to absorb someone else’s risk, and it is reasonable to say so.\n\nAnd when an estimate is going wrong, **say so early**. The cost of a slip is roughly proportional to how late the news arrives. "This will take two more weeks" said at the halfway point is a scheduling conversation; said on the due date it is a crisis, and it damages trust in a way the delay itself would not have.',
              {
                keyTerms: [
                  { term: 'Planning fallacy', definition: 'Systematic underestimation that persists even when you know about it.' },
                  { term: 'Reference-class forecasting', definition: 'Estimating from what similar past work actually took.' },
                ],
              },
            ),
            mcq(
              'Why give a range rather than a single number?',
              [
                'It is harder to hold you to',
                'It communicates the real uncertainty, where a point estimate implies a precision nobody has',
                'It is faster',
                'Ranges are always accurate',
              ],
              1,
              ['sk-estimation'],
              'A point estimate gets heard as a commitment, which is a different kind of statement.',
            ),
            mcq(
              'An estimate is slipping badly. When do you raise it?',
              [
                'At the deadline, once you are certain',
                'As soon as you believe it, because the cost of a slip scales with how late the news arrives',
                'Only if asked',
                'After trying to catch up',
              ],
              1,
              ['sk-estimation', 'sk-scope-negotiation'],
              'Early news is a scheduling conversation. Late news is a crisis, and the lateness damages trust more than the delay does.',
            ),
            concept(
              'Scope, trade-offs, and saying no well',
              'Everything is a trade-off and there is always more to do than time. Making those trade-offs explicit — rather than absorbing them silently — is a large part of senior engineering.\n\n**Name the trade-off rather than refusing.** "Yes, and that moves the launch by three weeks — or we could ship without it and add it in the next cycle." That converts a confrontation into a decision, and puts it with the person who should be making it.\n\n**Push back with information, not feeling.** "This will take longer than it looks because the payment path has no test coverage and I would need to build that first" is actionable. "That seems unrealistic" is not.\n\n**Distinguish a constraint from a preference.** "This cannot be done safely in a week" is different from "I would rather do it differently", and conflating them spends credibility you will want later.\n\n**Offer the smaller version.** Most requests have a 20% version delivering most of the value. Proposing it is more useful than either agreeing or declining.\n\n**Be explicit about what drops.** Adding to a fixed-capacity plan removes something. Saying which thing is the whole conversation, and if you do not say it, the thing that drops will be tests or monitoring, silently.\n\nThe underlying framing: your job is not to do what is asked, and not to refuse what is asked, but to make the cost visible so the person accountable can choose. Most disagreements about scope dissolve once both sides can see the same trade.',
              {
                keyTerms: [
                  { term: 'Scope negotiation', definition: 'Making the cost of a request visible so the trade-off can be chosen deliberately.' },
                ],
              },
            ),
            mcq(
              'What is the most useful response to "can we also add X before launch?"',
              [
                '"No, we do not have time"',
                '"Yes, and that moves the date by three weeks — or we ship without it and add it next cycle"',
                '"I will try"',
                '"That is not my decision"',
              ],
              1,
              ['sk-scope-negotiation'],
              'It converts a confrontation into a decision, and returns the decision to whoever owns the trade-off.',
            ),
          ],
        }),
        lesson({
          id: 'lesson-incidents-people',
          title: 'Incidents, On-Call, and Other People',
          summary: 'When it breaks, and how to work in a way that lasts.',
          level: 'intermediate',
          domain: 'product',
          steps: [
            concept(
              'Running an incident',
              'Production is broken and several people are typing. Without structure that is worse than one person working calmly.\n\nThe roles that matter, even informally:\n\n**Incident commander** — coordinates, decides, and does not debug. The most common failure in a small team is that the most capable engineer takes command and then disappears into the logs, leaving nobody coordinating.\n\n**Communications** — keeps stakeholders and customers informed so nobody has to interrupt the people working.\n\n**Responders** — actually investigate and fix.\n\nAnd the order of operations, which is the part people get wrong under pressure:\n\n**Mitigate first, diagnose second.** Roll back, fail over, disable the feature, shed load. Restoring service is the priority; understanding why can wait until nobody is losing money. The instinct to find the root cause first is strong and expensive.\n\n**Communicate early and often.** A holding update every 30 minutes, even with no progress, prevents a dozen separate interruptions.\n\n**Keep a timeline as you go.** Nobody will remember the sequence afterwards, and the postmortem depends on it.\n\n**One person changes things.** Two people mitigating simultaneously produces a state neither understands.',
              {
                keyTerms: [
                  { term: 'Incident commander', definition: 'The coordinating role — decides and delegates, does not debug.' },
                  { term: 'Mitigate first', definition: 'Restore service before understanding the cause.' },
                ],
              },
            ),
            interactive(
              'Run an incident',
              'incident-timeline',
              'Work through an outage choosing what to do at each step. The scoring rewards mitigating before diagnosing and communicating early — which is the opposite of what most engineers instinctively do.',
            ),
            order(
              'Order the first steps of an incident response.',
              [
                'Declare the incident and name a commander',
                'Mitigate — roll back, fail over, or disable the feature',
                'Communicate status to stakeholders',
                'Diagnose the underlying cause',
                'Write the postmortem and assign follow-up actions',
              ],
              ['sk-incident-response'],
              'Mitigation before diagnosis is the step people reverse under pressure, and it costs the most.',
            ),
            mcq(
              'Why should the incident commander not also be debugging?',
              [
                'They may not be technical',
                'Coordination stops the moment they disappear into the logs, and that is when the response fragments',
                'It is against policy',
                'They need to write the postmortem',
              ],
              1,
              ['sk-incident-response'],
              'The most capable engineer taking command and then vanishing into the investigation is the classic small-team failure.',
            ),
            concept(
              'Blameless postmortems, and sustainable on-call',
              'A **postmortem** after a significant incident is where an organisation either learns or does not.\n\n**Blameless** is the operative word, and it is a practical stance rather than a kind one. If people expect blame they will minimise, omit and reframe, and you lose the information you needed. The premise is that people act reasonably given what they knew at the time, so when the outcome was bad, the interesting question is what made the wrong action look right.\n\n"Why did they deploy on Friday?" is a blame question. "Why did our process make a Friday deploy feel safe?" is a systems question. The second produces changes; the first produces silence.\n\nWhat a good postmortem contains: a timeline, the impact in user terms, contributing factors in the plural — single root causes are usually a simplification — what went well, and specific actions with owners and dates. An action item without an owner is a wish.\n\n**On-call** deserves the same systemic treatment, because it is where good intentions decay:\n\n**Every page must be actionable.** If there is nothing to do, it should not have woken anyone. Non-actionable alerts train people to ignore all alerts, and the one that mattered is indistinguishable.\n\n**Track alert volume as a metric.** Rising page counts are a system health signal, not an individual resilience problem.\n\n**Follow the sun where possible.** Nights are what makes on-call unsustainable.\n\n**Compensate it**, in money or time, because it is work.\n\n**Fix the top cause every rotation.** Without that, the rotation is a permanent tax rather than a temporary one.\n\nA rotation that is quiet most weeks is a sign of a healthy system. A heroic on-call culture is a symptom, and treating it as a virtue is how teams burn out slowly enough that nobody notices until people leave.',
              {
                keyTerms: [
                  { term: 'Blameless postmortem', definition: 'Asking what made the wrong action look right, rather than who did it.' },
                  { term: 'Alert fatigue', definition: 'Non-actionable pages training people to ignore the actionable ones.' },
                ],
              },
            ),
            mcq(
              'Why are postmortems blameless?',
              [
                'To be kind',
                'Because people hide information when they expect blame, and the information is the point',
                'For legal reasons',
                'To avoid difficult conversations',
              ],
              1,
              ['sk-incident-response'],
              'It is a practical stance. Blame reliably reduces the quality of what you learn.',
            ),
            mcq(
              'What makes on-call unsustainable fastest?',
              [
                'Complex systems',
                'Pages that are not actionable, which train people to ignore all of them',
                'Large teams',
                'Written runbooks',
              ],
              1,
              ['sk-on-call'],
              'Alert fatigue. Once every page is presumed noise, the real one arrives indistinguishable from the rest.',
            ),
            concept(
              'Mentoring, interviewing, and working together',
              'Three things that quietly determine how far your work reaches.\n\n**Mentoring.** The instinct is to give the answer, which is fastest and teaches least. Better is to ask what they have tried, work through the reasoning aloud, and let them make the safe mistakes — those are where the learning is. Pair on something hard occasionally rather than reviewing everything, because watching how someone thinks teaches more than seeing what they produced.\n\nGive **feedback specifically and soon**. "Good work" is pleasant and useless. "The way you wrote up the trade-offs in that document made the decision easy for everyone — do that again" is repeatable.\n\n**Interviewing**, from both sides. As a candidate, ask about the actual work: what a normal week looks like, how decisions get made, what the last incident was and what changed afterwards. Answers to those predict your experience far better than anything on the careers page.\n\nAs an interviewer, remember you are also being evaluated, and that a hostile interview loses the candidates who have options. Test what the job needs: reading and modifying real code, reasoning about a design, explaining a trade-off. Trick questions and obscure algorithm puzzles select for recent interview practice, and against people who were doing the job instead.\n\n**Collaboration**, especially remote and asynchronous. Write things down, because a decision made in a call and never recorded does not exist for anyone who was not there. Default to open channels, so people can follow without being interrupted. Over-communicate context rather than status — what you are doing is less useful to others than why. And be explicit about expected response times; the anxiety in remote work usually comes from ambiguity about urgency rather than from the work itself.',
              {
                keyTerms: [
                  { term: 'Specific feedback', definition: 'Naming the behaviour and its effect, so it can be repeated.' },
                  { term: 'Working in the open', definition: 'Defaulting to shared channels and written decisions.' },
                ],
              },
            ),
            multi(
              'Which make mentoring more effective?',
              [
                'Asking what they have already tried before offering an answer',
                'Letting them make mistakes that are safe to make',
                'Giving specific feedback naming the behaviour and its effect',
                'Reviewing every change they make in detail',
              ],
              [0, 1, 2],
              ['sk-mentoring'],
              'Reviewing everything creates dependence. Pairing occasionally on something hard teaches more and scales better.',
            ),
            mcq(
              'As a candidate, which question best predicts what working somewhere is like?',
              [
                '"What is the company culture?"',
                '"What was the last incident, and what changed as a result?"',
                '"Do you offer remote work?"',
                '"What technologies do you use?"',
              ],
              1,
              ['sk-interviewing'],
              'It reveals how they handle failure, whether they follow through, and whether blame is in play — none of which appears on a careers page.',
            ),
            multi(
              'Which help most in asynchronous, distributed collaboration?',
              [
                'Writing decisions down rather than leaving them in a call',
                'Defaulting to open channels so people can follow without being interrupted',
                'Communicating why you are doing something, not just what',
                'Expecting an immediate reply to every message',
              ],
              [0, 1, 2],
              ['sk-collaboration'],
              'The last one is the main source of anxiety in remote work. Being explicit about expected response times removes more stress than any tool does.',
            ),
            shortAnswer(
              'Your team’s on-call rotation has become exhausting and two people have asked to leave it. What would you do?',
              ['alert', 'actionable', 'volume', 'fix', 'cause', 'measure'],
              'Start by measuring rather than rescheduling: count pages per rotation, what fraction were actionable, and which alerts fired most. Almost always a small number of causes dominate. Then delete or tune the alerts that are not actionable, because those are what create the fatigue that makes everything else feel worse. Then commit to fixing the top cause every rotation so the load actually falls instead of being redistributed. Rotating more people through an unhealthy rotation spreads the damage rather than reducing it — the volume is a system health signal, not a staffing problem.',
              ['sk-on-call', 'sk-incident-response'],
              'Measure the pages, delete the non-actionable ones, fix the top cause each rotation. Adding people to a bad rotation just spreads it.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-prod-2',
        title: 'Practice Checkpoint',
        passingScore: 0.7,
        exercises: [
          mcq(
            'What comes first in an incident?',
            ['Finding the root cause', 'Mitigating — restore service, then diagnose', 'Writing the postmortem', 'Notifying legal'],
            1,
            ['sk-incident-response'],
            'Understanding can wait until service is back.',
          ),
          mcq(
            'Why estimate in ranges?',
            ['To avoid accountability', 'Because a point estimate implies a precision that does not exist', 'It is faster', 'Ranges are more accurate'],
            1,
            ['sk-estimation'],
            'And a point estimate gets heard as a commitment.',
          ),
          trueFalse(
            'A page with no action to take should still wake someone, for awareness.',
            false,
            ['sk-on-call'],
            'It trains people to ignore pages, which makes the actionable one indistinguishable.',
          ),
        ],
      },
    },
  ],
};
