/** Track 7 — AI Agents & Applied Systems. Expert. */

import type { Track } from '../../domain/types';
import { categorize, concept, interactive, lesson, match, mcq, multi, numeric, order, shortAnswer, trueFalse } from '../builders';

export const agentsTrack: Track = {
  id: 'track-agents',
  title: 'AI Agents & Applied Systems',
  tagline: 'Models that use tools, plan, and act',
  description:
    'What changes when a model can call functions, run code, and take actions in the world — and the engineering discipline that keeps that from going badly.',
  domain: 'agents',
  level: 'expert',
  icon: '🤖',
  gradient: ['#3B82F6', '#6366F1'],
  prerequisites: ['track-llms', 'track-prompt-engineering'],
  outcomes: [
    'Explain the agent loop and where it fails',
    'Design tool interfaces a model can use reliably',
    'Choose between single-agent, multi-agent, and workflow designs',
    'Build evaluation and guardrails for agentic systems',
  ],
  units: [
    {
      id: 'unit-agents-1',
      title: 'The Agent Loop',
      description: 'From text generator to actor.',
      lessons: [
        lesson({
          id: 'lesson-agent-loop',
          title: 'What Makes an Agent',
          summary: 'A model in a loop with tools and a goal.',
          level: 'intermediate',
          domain: 'agents',
          free: true,
          steps: [
            concept(
              'Observe, think, act, repeat',
              'A chatbot takes input and returns output. An **agent** runs a loop:\n\n1. **Observe** — read the goal and everything that has happened so far.\n2. **Think** — decide the next step.\n3. **Act** — call a tool, or produce the final answer.\n4. **Observe the result** — feed the tool output back in.\n5. Repeat until done or a limit is hit.\n\nThree things distinguish an agent from a single call: **tools** (it can affect the world), **iteration** (it can adjust based on results), and **autonomy** (it chooses the steps rather than following a fixed script).\n\nThat last one is the whole tradeoff. Autonomy is what makes agents useful for open-ended tasks, and it is exactly what makes them unpredictable, hard to test, and occasionally expensive.',
              { figure: 'agent-loop' },
            ),
            order(
              'Order one iteration of the agent loop.',
              [
                'Read the goal and the history so far',
                'Decide which tool to call and with what arguments',
                'Execute the tool and capture its result',
                'Append the result to the history and re-evaluate',
              ],
              ['sk-agent-loop'],
              'The appended result is what makes it a loop rather than a chain — the agent can recover from a failed call by seeing the error.',
            ),
            interactive(
              'Step an agent through its loop',
              'agent-loop-sim',
              'Give the agent a goal and step it through observe-think-act one iteration at a time. Inject a tool failure and watch it recover — or loop forever, which is exactly why step limits exist.',
            ),
            concept(
              'Tool use and function calling',
              'A tool is a function the model can invoke. You provide a name, a description, and a parameter schema; the model returns a structured call, your code executes it, and the result goes back into the context.\n\n**The description is the interface.** The model has no documentation, no type inference, and no ability to experiment — only your text. Tool descriptions deserve the care you would give a public API\'s docs.\n\nWhat reliably improves tool-calling accuracy:\n\n- **Few, well-separated tools.** Accuracy degrades noticeably past a dozen or so, especially when their purposes overlap. Merge near-duplicates.\n- **Explicit parameter descriptions**, with units and formats. `"start_date: ISO 8601 date, e.g. 2026-03-01"` beats `"start_date: the start date"`.\n- **Say when *not* to use it.** *"Use only for orders placed in the last 90 days; for older orders use search_archive."*\n- **Errors that teach.** `"Error: date must be ISO 8601, got \'March 1st\'"` lets the model self-correct. `"Error: 400"` does not.',
            ),
            mcq(
              'An agent with 40 tools frequently picks the wrong one. Best first move?',
              [
                'Use a larger model',
                'Consolidate overlapping tools and improve descriptions, or retrieve a relevant subset per request',
                'Increase the temperature',
                'Add more examples of every tool',
              ],
              1,
              ['sk-tool-use'],
              'Selection accuracy falls as the tool set grows and overlaps. Fewer, clearly-distinguished tools help immediately; for large sets, retrieving the handful relevant to the current request is the standard scaling approach.',
            ),
            multi(
              'What makes a tool description effective? (Select all)',
              [
                'Stating exactly when to use it and when not to',
                'Parameter descriptions including units and formats',
                'Returning error messages that explain how to fix the call',
                'Listing the tool\'s internal implementation details',
              ],
              [0, 1, 2],
              ['sk-tool-use'],
              'The model needs to know when, how, and what went wrong. Implementation details consume context without informing the decision.',
            ),
            concept(
              'ReAct: reasoning interleaved with acting',
              'The **ReAct** pattern alternates explicit reasoning with tool calls:\n\n```\nThought: I need this customer\'s order history first.\nAction: search_orders(customer_id="C-4821")\nObservation: 3 orders, most recent 2026-02-14, status DELAYED\nThought: The delay explains the complaint. I should check the shipment.\nAction: get_shipment(order_id="O-9912")\n```\n\nWriting the reasoning down before acting improves tool choice for the same reason chain-of-thought improves arithmetic — it gives the model more computation and explicit intermediate state.\n\nIt also produces a readable trace, which matters enormously in practice. When an agent does something strange, the thought log is usually the only way to find out where it went wrong.',
            ),
            mcq(
              'Why does interleaving explicit reasoning with tool calls improve agent reliability?',
              [
                'It reduces token cost',
                'It gives the model computation to plan with and leaves an auditable trace of its decisions',
                'It bypasses the context limit',
                'It removes the need for error handling',
              ],
              1,
              ['sk-react-pattern'],
              'Better decisions and debuggable behaviour. The trace is not a side benefit — it is often the primary operational value.',
            ),
          ],
        }),

        lesson({
          id: 'lesson-agent-memory',
          title: 'Memory and Context Management',
          summary: 'The agent forgets everything between requests.',
          level: 'expert',
          domain: 'agents',
          steps: [
            concept(
              'Every kind of memory is engineered',
              'The model is stateless. Any memory an agent appears to have was built by you.\n\n**Working memory** — the current context window. Fast, complete, and bounded. It fills up.\n\n**Episodic memory** — what happened in past sessions. Store summaries, retrieve relevant ones on demand.\n\n**Semantic memory** — durable facts about the user or domain. A key-value store beats a vector database here; you want `user.timezone` looked up exactly, not approximately.\n\n**Procedural memory** — learned successful patterns, reused as examples.\n\nThe practical difficulty is that long-running agents fill their context with tool outputs, and quality degrades before the hard limit is reached.',
            ),
            concept(
              'Managing a filling context',
              'Four techniques, usually combined:\n\n**Summarise and compact.** When history exceeds a threshold, summarise the older portion and replace it. Keep the goal and recent turns verbatim — those are what the next decision depends on.\n\n**Externalise state.** Have the agent write findings to a scratchpad file or structured store rather than keeping them in context. It reads back what it needs. This scales far past any window size.\n\n**Truncate tool output.** A tool returning 50,000 tokens of JSON should return a summary plus a handle to fetch details. Cap outputs at the source.\n\n**Sub-agents.** Delegate a research task to a fresh agent with its own clean context and take back only its conclusion. The parent never sees the intermediate mess.\n\nAll four exist because **relevant context beats abundant context** — attention is imperfect over long inputs, and every irrelevant token is both a cost and a distraction.',
            ),
            match(
              'Match each memory type to its best storage.',
              [
                { left: 'Current task and recent turns', right: 'Context window' },
                { left: 'Summaries of past sessions', right: 'Retrievable episodic store' },
                { left: 'User\'s timezone and preferences', right: 'Key-value store' },
                { left: 'Large document corpus', right: 'Vector database' },
              ],
              ['sk-agent-memory'],
              'Match the retrieval pattern to the access pattern. Exact lookups want a key-value store; fuzzy semantic search wants embeddings.',
            ),
            mcq(
              'An agent doing a long research task degrades after 20 tool calls. Most likely cause?',
              [
                'The model is too small',
                'Context is filled with accumulated tool output, diluting the goal and important findings',
                'The temperature drifted',
                'Tools are returning errors',
              ],
              1,
              ['sk-agent-memory'],
              'Context bloat is the characteristic long-agent failure. Compaction, truncated tool output, and externalised state are the fixes — a bigger model does not solve a diluted context.',
            ),
            multi(
              'Which help a long-running agent stay effective? (Select all)',
              [
                'Summarising older history while keeping the goal verbatim',
                'Writing findings to external storage and reading them back on demand',
                'Capping the size of tool outputs',
                'Always using the largest available context window',
              ],
              [0, 1, 2],
              ['sk-agent-memory'],
              'The first three keep context relevant. Simply using a bigger window delays the problem while raising cost and latency — and attention over very long contexts is uneven anyway.',
            ),
          ],
        }),

        lesson({
          id: 'lesson-agent-design',
          title: 'Designing Agentic Systems',
          summary: 'When to use an agent, and when a workflow is better.',
          level: 'expert',
          domain: 'agents',
          steps: [
            concept(
              'Most tasks do not need an agent',
              'Agents are the most flexible and least predictable option. Ordered from most to least constrained:\n\n**Single call.** One prompt, one response. Use it whenever it suffices.\n\n**Chain.** Fixed sequence of calls, output feeding input. Predictable, testable, debuggable.\n\n**Router.** A classifier picks one of several fixed paths.\n\n**Workflow with tools.** Predefined steps, model fills in the decisions. Still bounded.\n\n**Autonomous agent.** The model decides the steps.\n\nThe honest guidance: **use the most constrained option that solves the problem.** Agents are appropriate when the sequence genuinely cannot be known ahead of time — open-ended research, debugging, multi-step negotiation with unpredictable branching.\n\nA lot of production "agents" are workflows wearing a costume, and they are better for it: cheaper, faster, and testable.',
            ),
            mcq(
              'A task is: extract fields from an invoice, validate them, write to a database. Which design?',
              [
                'Autonomous agent with database tools',
                'A fixed chain — the steps are known in advance',
                'Multi-agent system',
                'A single prompt',
              ],
              1,
              ['sk-agent-loop'],
              'The sequence is fixed and known. A chain is cheaper, faster, deterministic, and testable. Autonomy adds cost and unpredictability with nothing to show for it.',
            ),
            concept(
              'Multi-agent systems',
              'Multiple agents with distinct roles, coordinating.\n\n**Supervisor pattern.** A lead agent decomposes the task and delegates to specialists. Clear control flow, and the one that works most reliably.\n\n**Parallel fan-out.** Several agents work independently on separable subtasks; results are merged. Genuinely faster for research-style work with independent branches.\n\n**Debate / critique.** One agent produces, another critiques, the first revises. Measurably improves quality on writing and analysis.\n\nBe skeptical, though. Multi-agent systems multiply cost and latency, and errors compound across handoffs — each agent sees only a summary of what came before. They earn their place when subtasks are genuinely independent (parallelism is real) or when critique adds something a single pass cannot.\n\n**A well-designed single agent beats a poorly-coordinated committee**, and most of the time the committee is the poorly-coordinated one.',
            ),
            multi(
              'When is a multi-agent design genuinely justified? (Select all)',
              [
                'Subtasks are independent and can run in parallel',
                'A critique pass measurably improves output quality',
                'The task requires different tool sets with different privilege levels',
                'The single-agent version has a slightly long prompt',
              ],
              [0, 1, 2],
              ['sk-multi-agent'],
              'Parallelism, critique, and privilege separation are real reasons. Prompt length is not — splitting for that adds coordination cost without addressing the actual issue.',
            ),
            concept(
              'Evaluating agents',
              'Agents are harder to evaluate than single calls, because the same task can succeed via many valid paths and fail in many distinct ways.\n\n**Measure the outcome, not the path.** Did the task complete correctly? Path-matching against a "golden" trajectory penalises valid alternatives.\n\n**Track cost and steps.** An agent that succeeds in 3 calls and one that succeeds in 40 are not equivalent. Runaway loops are a real failure mode and cost real money.\n\n**Build a regression suite of failures.** Every production failure becomes a permanent test case. This suite is the most valuable artefact you will build.\n\n**Test the unhappy paths deliberately.** Tool timeouts, malformed responses, empty results, rate limits. Most agent failures in production are error-handling failures, not reasoning failures.\n\n**Always set hard limits.** Max steps, max cost, max wall time. Non-negotiable — an unbounded loop with a paid API is an unbounded bill.',
            ),
            shortAnswer(
              'Why is comparing an agent\'s trajectory to a single "correct" path a poor evaluation method?',
              ['multiple', 'valid', 'path', 'outcome', 'different'],
              'Many different sequences of tool calls can accomplish the same task correctly. Scoring against one reference path penalises valid alternatives and rewards imitation rather than success. Evaluate the outcome, with cost and step count as secondary measures.',
              ['sk-agent-loop'],
              'Outcome-based evaluation is the only approach that scales across the variety of valid strategies an agent can take.',
            ),
            trueFalse(
              'An agent in production should always have a hard cap on steps and spend.',
              true,
              ['sk-agent-loop'],
              'Loops happen — a failing tool that the agent keeps retrying will run until something stops it. Hard limits are the only reliable backstop.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-agents-1',
        title: 'Agent Systems Checkpoint',
        passingScore: 0.75,
        exercises: [
          mcq(
            'What most distinguishes an agent from a single LLM call?',
            [
              'A larger model',
              'It loops, calls tools, and chooses its own next step',
              'It uses a longer prompt',
              'It runs on a GPU',
            ],
            1,
            ['sk-agent-loop'],
            'Iteration, tools, and autonomy over the step sequence are the defining properties.',
          ),
          multi(
            'Which are essential guardrails for a production agent? (Select all)',
            [
              'Maximum step and cost limits',
              'Least-privilege tool access',
              'Human approval for irreversible actions',
              'Maximum context window size',
            ],
            [0, 1, 2],
            ['sk-agent-loop', 'sk-prompt-injection'],
            'Limits, privilege, and approval gates are safety controls. Context size is a capability parameter, not a guardrail.',
          ),
          trueFalse(
            'Multi-agent systems are generally more reliable than a well-designed single agent.',
            false,
            ['sk-multi-agent'],
            'They multiply cost and latency and compound errors across handoffs. They win on genuinely parallel subtasks and critique loops — not by default.',
          ),
        ],
      },
    },
    // -----------------------------------------------------------------------
    {
      id: 'unit-agents-2',
      title: 'Tools and Reasoning',
      description: 'How a model reaches outside its own context, and how it decides to.',
      lessons: [
        lesson({
          id: 'lesson-tool-use',
          title: 'Tool Use and Function Calling',
          summary: 'The model never calls anything. It asks, and your code decides.',
          level: 'intermediate',
          domain: 'agents',
          steps: [
            concept(
              'The model emits a request, not a call',
              'The single most useful thing to understand about tool use is that **the model has no ability to execute anything.**\n\nYou give it a list of tools with names, descriptions, and JSON schemas for their arguments. When it decides one is relevant, it emits a structured request: this tool, these arguments. Your code parses that, decides whether to run it, runs it, and puts the result back into the conversation as a new message. The model then continues with the result in context.\n\nThat loop is the entire mechanism. Everything people find surprising about agents follows from it:\n\n- The model **cannot** do anything you have not implemented and exposed.\n- Every tool call passes through your code, so **your code is where authorisation belongs** — never the prompt.\n- The tool\'s *description* is part of the prompt. A vague description produces wrong calls, and improving the description is usually a bigger win than improving the system prompt.\n- Results re-enter the context window, so a tool returning 50KB of JSON has just spent your budget.\n\nThe common design error is exposing tools shaped like your internal API — twelve functions with overlapping responsibilities. Models choose badly among near-duplicates. Fewer, well-separated tools with sharply distinct descriptions outperform a faithful API mirror every time.',
              {
                figure: 'agent-loop',
                keyTerms: [
                  { term: 'Tool schema', definition: 'The name, description, and argument JSON Schema that tell the model a tool exists.' },
                  { term: 'Tool result', definition: 'The output your code returns, injected into the conversation for the model to read.' },
                ],
              },
            ),
            order(
              'Order one round of tool use.',
              [
                'The developer supplies tool names, descriptions, and argument schemas',
                'The model emits a structured request naming a tool and its arguments',
                'Application code validates the request and decides whether to execute it',
                'The tool runs and its output is appended to the conversation',
                'The model reads the result and either answers or requests another tool',
              ],
              ['sk-tool-use'],
              'Step three is the one that matters for safety: it is application code, not the model, that decides whether a call happens. Skip it and you have handed an untrusted text generator direct access to your systems.',
            ),
            mcq(
              'An agent keeps calling the wrong one of two similar tools. What is the most effective fix?',
              [
                'Lower the temperature',
                'Rewrite the tool descriptions so the boundary between them is explicit, or merge them into one',
                'Add "be careful" to the system prompt',
                'Give the model more examples in every user message',
              ],
              1,
              ['sk-tool-use'],
              'Tool descriptions are prompt text and are read as such. If two of them could plausibly cover the same request, the model will sometimes pick either — that is a specification problem, not a sampling problem. Say what each is *not* for, or collapse them.',
            ),
            multi(
              'Which are true of tool use? (Select all)',
              [
                'Tool results consume context-window tokens',
                'The model executes the function itself once it decides to',
                'Authorisation checks belong in application code, not the prompt',
                'A tool’s description materially affects how often it is chosen correctly',
              ],
              [0, 2, 3],
              ['sk-tool-use'],
              'The model only ever emits a request. Everything else — execution, authorisation, rate limiting, auditing — happens in code you control, which is the only place it can be enforced.',
            ),
            trueFalse(
              'Returning a tool’s full raw response to the model is usually the safest default.',
              false,
              ['sk-tool-use', 'sk-context-window'],
              'Raw responses are typically verbose, and every token competes with the reasoning for context. Return the fields the model needs, truncate lists, and summarise long bodies — a 50KB JSON blob can crowd out the task itself.',
            ),
          ],
        }),

        lesson({
          id: 'lesson-react',
          title: 'ReAct: Reasoning and Acting',
          summary: 'Interleave thinking with doing, and the agent can recover from being wrong.',
          level: 'expert',
          domain: 'agents',
          steps: [
            concept(
              'Plan-then-execute versus think-act-observe',
              'There are two ways to structure an agent, and they fail differently.\n\n**Plan-then-execute** asks for the full plan up front, then runs it. Predictable, cheap, auditable before anything happens — and brittle, because the plan was written before any evidence arrived. Step four assumed the file was CSV. It is not. The plan has no repair mechanism.\n\n**ReAct** interleaves instead: *thought → action → observation*, repeatedly. Each observation feeds the next thought, so a surprise at step four changes step five. The agent finds the file is JSON and adapts.\n\nThe gain is genuine and comes from one property: **the agent conditions on what actually happened rather than on what it predicted would happen.** Errors become information instead of derailments — a failed API call, an empty result, a permission denial all feed back in as observations.\n\nThe costs are equally real. More model calls, so higher latency and spend. Non-deterministic paths, so harder to test. And no plan to review before execution starts, which matters when the actions have consequences.\n\nIn practice most production agents are hybrids: plan at a coarse level so there is something to review, use ReAct within each step so failures can be absorbed.',
              { keyTerms: [{ term: 'ReAct', definition: 'An agent pattern interleaving reasoning traces with actions and their observations.' }] },
            ),
            interactive(
              'Run the loop, then break it',
              'agent-loop-sim',
              'Step through observe–think–act and watch context accumulate. Then inject a tool failure and see the agent adapt — and keep stepping until it hits the iteration limit, which is the failure you actually have to design for.',
            ),
            mcq(
              'What does ReAct give you that a plan-then-execute agent does not?',
              [
                'Lower cost per task',
                'The ability to change course based on what a step actually returned',
                'A plan you can review before execution',
                'Deterministic, repeatable runs',
              ],
              1,
              ['sk-react-pattern'],
              'Adaptivity is the whole point, and the other three are exactly what you trade for it. Plan-then-execute is cheaper, reviewable and more repeatable — which is why it remains the right choice for high-consequence actions.',
            ),
            concept(
              'Three limits every agent loop needs',
              'An agent loop without limits is an infinite loop with a credit card.\n\n**A step limit.** Hard-cap the iterations — 10 to 20 for most tasks. Hitting it is not a crash; it is a defined outcome that hands back partial results and a clear "did not finish". Agents that loop are common: two tools that undo each other, a search that never finds anything, a retry that always fails the same way.\n\n**A budget limit.** Track cumulative tokens and tool calls, and stop at a ceiling. Without this a single pathological run can cost more than a month of normal traffic.\n\n**A no-progress detector.** Track whether state actually changed. An agent repeating the same failing call with the same arguments is not going to succeed on the fourth attempt — detect the repeat and either change strategy or stop.\n\nAnd design the **timeout path** deliberately. What the user sees when an agent gives up is part of the product: partial results plus an honest account of what was attempted beats a spinner that never resolves, and beats a confident summary of work that did not happen.',
            ),
            multi(
              'Which limits belong in a production agent loop? (Select all)',
              [
                'A maximum number of iterations',
                'A cumulative token and tool-call budget',
                'Detection of repeated no-progress actions',
                'A rule that the agent must always produce a final answer',
              ],
              [0, 1, 2],
              ['sk-react-pattern', 'sk-agent-loop'],
              'The first three are containment. The fourth is a trap — forcing an answer when the agent has not actually succeeded is how you get a confident fabrication instead of an honest failure.',
            ),
            shortAnswer(
              'Why does an agent that repeats the same failing tool call need detecting separately from a step limit?',
              ['no progress', 'same', 'repeat', 'waste', 'earlier', 'state'],
              'Because a step limit only stops it eventually, after burning the full budget on calls that cannot work. Detecting that state has not changed between iterations catches the loop immediately, and lets you change strategy — different tool, different arguments, or stop and report — rather than waiting out twenty identical failures.',
              ['sk-react-pattern'],
              'The pattern generalises: a limit bounds the damage, a detector avoids it.',
            ),
          ],
        }),
      ],
    },

    // -----------------------------------------------------------------------
    {
      id: 'unit-agents-3',
      title: 'Systems of Agents',
      description: 'More than one agent, and how to tell whether any of them worked.',
      lessons: [
        lesson({
          id: 'lesson-multi-agent',
          title: 'Multi-Agent Systems',
          summary: 'Sometimes several specialists beat one generalist. Usually they do not.',
          level: 'expert',
          domain: 'agents',
          steps: [
            concept(
              'Why split an agent at all',
              'Multi-agent architectures give each agent its own prompt, its own tools, and often its own model. There are three honest reasons to do it.\n\n**Context isolation.** Each sub-agent works in its own window. A research task that would blow a single context can be split across five agents whose summaries are the only thing that comes back.\n\n**Tool separation.** A sub-agent with three tools chooses correctly far more often than one with thirty. Narrowing the tool surface per agent is a genuine accuracy lever.\n\n**Parallelism.** Independent sub-tasks run at once, so wall-clock time is the slowest branch rather than the sum.\n\nThe standard shapes: **supervisor** (one orchestrator delegating to specialists and composing results — the most common and the easiest to debug), **pipeline** (fixed hand-offs, essentially prompt chaining with tools), and **debate** (several agents critique each other, which improves reasoning tasks and costs several times more).\n\nAnd the honest caveat: **most multi-agent systems would be better as one agent with better tools.** Every hand-off loses information, error rates compound across agents, and debugging goes from reading one trace to reconstructing a distributed conversation. Split when a single agent has demonstrably hit a wall — not because the architecture diagram looks better.',
              { keyTerms: [{ term: 'Supervisor pattern', definition: 'One orchestrating agent delegating sub-tasks to specialists and composing their results.' }] },
            ),
            mcq(
              'What is the strongest argument for splitting one agent into several?',
              [
                'It makes the system easier to debug',
                'Each sub-agent gets its own context window and a narrow, unambiguous tool set',
                'It reduces total token cost',
                'It removes the need for iteration limits',
              ],
              1,
              ['sk-multi-agent'],
              'Context isolation and tool narrowing are the real wins. The other three are actively false: multi-agent systems are harder to debug, cost more in total tokens, and still need every containment limit a single agent needs.',
            ),
            match(
              'Match each architecture to what it is for.',
              [
                { left: 'One orchestrator delegating to specialists', right: 'Supervisor' },
                { left: 'Fixed sequence of hand-offs', right: 'Pipeline' },
                { left: 'Agents critiquing each other before answering', right: 'Debate' },
                { left: 'Independent sub-tasks running at once', right: 'Parallel fan-out' },
              ],
              ['sk-multi-agent'],
              'Supervisor is the default for a reason: there is one place that knows the whole task, which makes both composition and debugging tractable.',
            ),
            trueFalse(
              'Adding more agents generally reduces the overall error rate of the system.',
              false,
              ['sk-multi-agent'],
              'Errors compound across hand-offs. Five agents at 90% reliability give roughly 59% end-to-end if each depends on the last. Multi-agent designs buy context and tool clarity, and they pay for it in reliability unless each hand-off is validated.',
            ),
            numeric(
              'Five agents run in sequence, each independently succeeding 90% of the time, and each needs the previous one’s output. What is the end-to-end success rate, as a percentage, to one decimal place?',
              59.0,
              ['sk-multi-agent'],
              '0.9⁵ = 0.59049, so about 59.0%. This is why validation between hand-offs matters so much — an unchecked chain degrades geometrically, and each added stage costs more than it looks like it should.',
              { tolerance: 0.2, unit: '%' },
            ),
          ],
        }),

        lesson({
          id: 'lesson-agent-evaluation',
          title: 'Evaluating and Containing Agents',
          summary: 'The answer was right. Did it get there by a route you would sign off?',
          level: 'expert',
          domain: 'agents',
          steps: [
            concept(
              'Outcome is not enough',
              'Evaluating a chatbot means judging one output. Evaluating an agent means judging a **trajectory** — the whole sequence of thoughts, calls, and observations.\n\nOutcome-only evaluation misses things that matter. An agent can reach the right answer having made 40 calls where 4 would do, or having read records it had no business reading, or by getting lucky after four wrong turns. All three pass an outcome check and all three are problems.\n\nSo evaluate on several axes:\n\n- **Outcome** — did it achieve the goal? Necessary, insufficient.\n- **Efficiency** — steps, tokens, wall-clock, cost per task. The number that decides whether it can ship.\n- **Trajectory validity** — were the calls sensible? Did it repeat itself, or take a path a reviewer would reject?\n- **Safety** — did it stay inside its permissions and touch only what it needed?\n- **Recovery** — when a tool failed, did it adapt or flail? Test this deliberately by injecting failures.\n\nThat last one deserves emphasis: **inject failures on purpose.** Make a tool return an error, an empty list, malformed JSON, a timeout. Agents that look excellent on the happy path frequently fall apart the first time reality does not cooperate, and you would rather learn that in an eval than in production.',
              {
                keyTerms: [
                  { term: 'Trajectory', definition: 'The full sequence of reasoning, actions, and observations in one agent run.' },
                  { term: 'Fault injection', definition: 'Deliberately failing tools during evaluation to test recovery behaviour.' },
                ],
              },
            ),
            multi(
              'Which should an agent evaluation measure beyond task success? (Select all)',
              [
                'Number of steps and total cost per task',
                'Whether the sequence of tool calls was sensible',
                'Whether it stayed within its granted permissions',
                'How confident the final answer sounded',
              ],
              [0, 1, 2],
              ['sk-agent-eval'],
              'Confidence is not a quality signal — models are fluent whether or not they are right, and a confident tone on a wrong answer is worse than a hedged one. The other three are what separates an agent you can operate from one that merely demos well.',
            ),
            concept(
              'Containment: permissions, approval, and reversibility',
              'An agent is a language model with the ability to act, so the safety question is entirely about **what it is able to act on.**\n\n**Least privilege, per agent.** Scope credentials to the specific agent and task. An agent that reads calendars should not hold a token that can also send email. This is ordinary security engineering and it does all the heavy lifting.\n\n**Classify actions by reversibility.** Reading is free. Writing to a draft is cheap to undo. Sending an email, moving money, or deleting a record is not. Gate on that axis rather than on a vague sense of risk.\n\n**Human approval on the irreversible ones.** Present what will happen in concrete terms — the recipient, the amount, the exact record — not "the agent wants to proceed". An approval step where the reviewer cannot see what they are approving is theatre, and people click through it within a week.\n\n**Dry-run mode.** Let the agent produce the full plan of writes without executing any of them. This is both an excellent evaluation tool and a genuinely good production feature.\n\n**Log the whole trajectory.** Every thought, call, argument, and result. When an agent does something unexpected — and it will — the trajectory is the only thing that explains it. Treat it as an audit record, not a debug log.\n\nOne thing not on this list: **prompt-level restrictions.** "Never delete anything" in a system prompt is a preference, not a control. If deletion must not happen, the agent should not hold a credential that can delete.',
            ),
            categorize(
              'Sort each action by the containment it warrants.',
              ['Run freely', 'Log and review after', 'Require explicit human approval'],
              [
                { item: 'Search an internal knowledge base', category: 'Run freely' },
                { item: 'Read a customer record the ticket already references', category: 'Run freely' },
                { item: 'Create a draft reply for a human to send', category: 'Log and review after' },
                { item: 'Update a record’s status field', category: 'Log and review after' },
                { item: 'Issue a refund to a payment method', category: 'Require explicit human approval' },
                { item: 'Delete a production database row', category: 'Require explicit human approval' },
              ],
              ['sk-human-in-the-loop'],
              'Reversibility is the axis that does the work. Reads cannot be undone but also cannot do harm; drafts are trivially reversible; money movement and deletion are neither.',
            ),
            mcq(
              'Which is the weakest way to stop an agent from taking a destructive action?',
              [
                'Not granting it a credential that can perform the action',
                'Instructing it in the system prompt never to do it',
                'Requiring human approval before the action executes',
                'Running in dry-run mode and executing the plan separately',
              ],
              1,
              ['sk-human-in-the-loop', 'sk-prompt-injection'],
              'A system prompt is text in the same context as untrusted input, and an injection can override it. The other three are enforced outside the model, where they cannot be argued with.',
            ),
            shortAnswer(
              'Why should agent evaluations deliberately make tools fail?',
              ['recovery', 'happy path', 'failure', 'adapt', 'production', 'error'],
              'Because production tools fail routinely — timeouts, empty results, malformed responses, permission errors — and an agent that only ever saw the happy path has never demonstrated it can recover. Injecting failures is the only way to find out whether it adapts, retries sensibly, or loops until it hits its limit.',
              ['sk-agent-eval'],
              'The same argument as chaos engineering, applied to a system whose error handling is emergent rather than written down.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-agents-3',
        title: 'Agents Checkpoint',
        passingScore: 0.7,
        exercises: [
          mcq(
            'Where should authorisation for a tool call be enforced?',
            [
              'In the system prompt',
              'In application code, before the call executes',
              'In the tool’s description',
              'By lowering the model’s temperature',
            ],
            1,
            ['sk-tool-use', 'sk-human-in-the-loop'],
            'The model only ever emits a request. Code decides whether it runs, and code is the only place a rule can actually be enforced.',
          ),
          trueFalse(
            'An agent that reaches the correct answer has passed evaluation.',
            false,
            ['sk-agent-eval'],
            'Trajectory, cost, permissions, and recovery all matter. A right answer reached in 40 steps through records it should not have touched is a failure that an outcome check calls a success.',
          ),
          mcq(
            'What is the main reason to give a sub-agent only three tools instead of thirty?',
            [
              'It reduces memory usage',
              'Models choose far more accurately among few, clearly distinct tools',
              'It makes the agent faster to train',
              'It removes the need for a step limit',
            ],
            1,
            ['sk-multi-agent', 'sk-tool-use'],
            'Tool selection accuracy degrades as options multiply and overlap. Narrowing the surface per agent is one of the few reliable wins in agent design.',
          ),
        ],
      },
    },
  ],
};
