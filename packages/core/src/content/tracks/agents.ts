/** Track 7 — AI Agents & Applied Systems. Expert. */

import type { Track } from '../../domain/types';
import { concept, interactive, lesson, match, mcq, multi, order, shortAnswer, trueFalse } from '../builders';

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
  ],
};
