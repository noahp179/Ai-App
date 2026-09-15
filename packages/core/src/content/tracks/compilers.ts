/**
 * Track 33 — Compilers & Interpreters.
 *
 * The theory track proved what a grammar can describe. This builds the thing
 * that reads one. Also the most useful track for demystifying the tools you
 * use every day — a type checker, a linter, a bundler and a query planner are
 * all the same machine with different back ends.
 */

import type { Track } from '../../domain/types';
import { categorize, codeOutput, concept, interactive, lesson, match, mcq, multi, numeric, shortAnswer, trueFalse } from '../builders';

export const compilersTrack: Track = {
  id: 'track-compilers',
  title: 'Compilers & Interpreters',
  tagline: 'How text becomes something that runs',
  description:
    'Lexing, parsing, semantic analysis, intermediate representations, optimisation and code generation — plus garbage collection and what a language runtime actually provides. The machinery behind every tool that reads your code.',
  domain: 'computer-science',
  level: 'expert',
  icon: '⚙️',
  gradient: ['#8B5CF6', '#10B981'],
  prerequisites: ['track-theory'],
  outcomes: [
    'Split source text into tokens and say why lexing is a separate phase',
    'Read a syntax tree and explain how precedence is encoded in a grammar',
    'Name what semantic analysis catches that parsing cannot',
    'Explain what an IR buys and why LLVM-style middles exist',
    'Describe three optimisation passes and what each assumes',
    'Compare tracing and reference-counting garbage collection honestly',
  ],
  units: [
    // -----------------------------------------------------------------------
    {
      id: 'unit-comp-1',
      title: 'Reading the Source',
      description: 'Characters to tokens to a tree, then to meaning.',
      lessons: [
        lesson({
          id: 'lesson-lexing-parsing',
          title: 'Lexing and Parsing',
          summary: 'Two phases, because one machine cannot do both well.',
          level: 'intermediate',
          domain: 'computer-science',
          free: true,
          steps: [
            concept(
              'Characters into tokens',
              'A compiler receives a flat string. The first job is **lexical analysis**: grouping characters into meaningful units called tokens.\n\n```\nlet total = price * 2;\n\n→ KEYWORD(let) IDENT(total) EQUALS\n  IDENT(price) STAR NUMBER(2) SEMI\n```\n\nThe lexer also throws away what carries no meaning — whitespace, comments — and it is where a numeric literal becomes an actual number rather than three characters.\n\nWhy is this a separate phase? Because the job is exactly a **regular language**, from the theory track, so a finite automaton handles it in one linear pass with no backtracking. The parser’s job is not regular — it needs a stack — and mixing the two would force the harder machine to do the easier work.\n\nThe practical payoff is that lexing is fast and simple and gets the messy character-level detail out of the way: string escapes, number formats, identifier rules, Unicode. By the time the parser runs it sees a clean stream of typed symbols.\n\nLexers are where a surprising amount of a language’s personality lives. Significant indentation means the Python lexer emits INDENT and DEDENT tokens; automatic semicolon insertion means the JavaScript lexer has rules about newlines that have surprised every JavaScript programmer at least once.',
              {
                keyTerms: [
                  { term: 'Token', definition: 'A meaningful lexical unit — keyword, identifier, literal, operator.' },
                  { term: 'Lexer', definition: 'A finite automaton turning characters into tokens in one pass.' },
                ],
              },
            ),
            interactive(
              'Lex a line',
              'lexer-tokens',
              'Watch a line of source split into tokens. Try adding a comment and whitespace and see them disappear — the parser never learns they were there.',
            ),
            mcq(
              'Why are lexing and parsing separate phases?',
              [
                'It runs faster',
                'Lexing is a regular language so a finite automaton suffices; parsing needs a stack',
                'Historical accident',
                'To support multiple languages',
              ],
              1,
              ['sk-lexing'],
              'Use the weakest machine that can do each job. That is the practical payoff of the Chomsky hierarchy.',
            ),
            multi(
              'Which does a lexer typically discard or transform?',
              [
                'Whitespace between tokens',
                'Comments',
                'A numeric literal, converted from text to a number',
                'Operator precedence',
              ],
              [0, 1, 2],
              ['sk-lexing'],
              'Precedence is structural and belongs to the parser — a lexer has no notion of nesting.',
            ),
            concept(
              'Tokens into a tree',
              '**Parsing** turns the flat token stream into an **abstract syntax tree** whose shape encodes the program’s structure.\n\n`2 + 3 * 4` becomes:\n\n```\n    (+)\n   /   \\\n  2    (*)\n      /   \\\n     3     4\n```\n\nThe tree says multiplication binds tighter, and it says so *structurally* — evaluating bottom-up gives 14 with no precedence rules consulted at evaluation time. Precedence was resolved once, by the grammar, and then baked into the shape.\n\nThat is why the grammar from the theory track is layered as `expr → expr + term`, `term → term * factor`. Putting `term` below `expr` is what makes multiplication bind tighter. The hierarchy in the grammar *is* the precedence table.\n\nTwo families of parser:\n\n**Recursive descent** — one function per grammar rule, calling each other. Easy to write by hand, easy to produce good error messages from, and used by most production compilers including GCC, Clang and TypeScript.\n\n**Table-driven (LR)** — generated from the grammar by a tool. Handles more grammars, and produces error messages that are notoriously hard to make friendly.\n\nAnd this is where a **syntax error** comes from: a token that no grammar rule can accept in this position. The reason such messages are often unhelpful is that the parser knows what it expected, not what you meant.',
              {
                keyTerms: [
                  { term: 'AST', definition: 'A tree whose structure encodes the program, with syntax noise removed.' },
                  { term: 'Recursive descent', definition: 'A hand-written parser with one function per grammar rule.' },
                ],
              },
            ),
            interactive(
              'Parse an expression',
              'ast-explorer',
              'Build a syntax tree from an expression and evaluate it bottom-up. Change the operators and watch the shape change — the tree is where precedence lives.',
            ),
            mcq(
              'How does a grammar encode operator precedence?',
              [
                'With a precedence table consulted at evaluation time',
                'Through rule layering — the tighter-binding operator sits lower in the hierarchy',
                'Alphabetically',
                'It does not; the evaluator handles it',
              ],
              1,
              ['sk-parsing-ast'],
              'Once parsed, the tree shape *is* the precedence. Nothing downstream needs to know the rules.',
            ),
            codeOutput(
              'Evaluating this tree bottom-up gives what?',
              'pseudocode',
              '    (-)\n   /   \\\n (+)    2\n /  \\\n10    4',
              ['8', '12', '16', '4'],
              1,
              ['sk-parsing-ast'],
              '10 + 4 = 14, then 14 − 2 = 12. The tree resolved the order before evaluation started.',
            ),
            concept(
              'Semantic analysis: what parsing cannot catch',
              'A parse tree says the program is *grammatical*. It does not say it is *meaningful*.\n\n```\nlet x: number = "hello";\nundefinedFunction();\nreturn 1 + {};\n```\n\nAll three parse perfectly. All three are wrong. Catching them is **semantic analysis**, and it does three jobs:\n\n**Name resolution.** Build a symbol table mapping each identifier to its declaration, respecting scope. This is what catches "cannot find name", and what powers go-to-definition and rename in an editor.\n\n**Type checking.** Infer or verify a type for every expression and check the operations are permitted. This is the whole of the static typing lesson from the paradigms track, implemented.\n\n**Other static rules.** Definite assignment, unreachable code, exhaustive switches, ownership and lifetimes in Rust.\n\nThe distinction is worth keeping straight because it explains the errors you see. A **syntax error** means "I could not parse this"; a **type error** means "I parsed it and it says something impossible". Syntax errors stop at the first one, type errors usually come in batches — because after parsing, the compiler still has a whole tree to inspect.\n\nAnd this is the phase that turns a compiler into a language server. Incremental name resolution and type inference over a changing file is exactly what autocomplete, hover documentation and inline errors are made of.',
              {
                keyTerms: [
                  { term: 'Symbol table', definition: 'The mapping from names to declarations, respecting scope.' },
                  { term: 'Type inference', definition: 'Deducing types that were not written down.' },
                ],
              },
            ),
            categorize(
              'Which phase catches each error?',
              ['Lexing', 'Parsing', 'Semantic analysis'],
              [
                { item: 'An unterminated string literal', category: 'Lexing' },
                { item: 'A missing closing brace', category: 'Parsing' },
                { item: 'Assigning a string to a number variable', category: 'Semantic analysis' },
                { item: 'Calling a function that does not exist', category: 'Semantic analysis' },
                { item: 'An invalid character in an identifier', category: 'Lexing' },
              ],
              ['sk-semantic-analysis'],
              'Each phase knows strictly more than the last, and can only catch what its own knowledge supports.',
            ),
            mcq(
              'Why do type errors often arrive in batches while syntax errors stop at the first?',
              [
                'Type checking is faster',
                'After parsing succeeds the compiler has a whole tree to inspect; a broken parse means it cannot reliably continue',
                'Syntax errors are more serious',
                'It is configurable',
              ],
              1,
              ['sk-semantic-analysis'],
              'A parser that cannot make sense of the structure would only produce noise if it carried on.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-comp-1',
        title: 'Front End Checkpoint',
        passingScore: 0.7,
        exercises: [
          mcq(
            'What does a lexer produce?',
            ['A syntax tree', 'A stream of tokens', 'Machine code', 'A symbol table'],
            1,
            ['sk-lexing'],
            'Characters in, typed tokens out, whitespace and comments gone.',
          ),
          mcq(
            'Where does operator precedence live after parsing?',
            ['In a lookup table', 'In the shape of the syntax tree', 'In the lexer', 'In the runtime'],
            1,
            ['sk-parsing-ast'],
            'Resolved once by the grammar, then structural.',
          ),
          mcq(
            'Which error is semantic rather than syntactic?',
            ['Missing semicolon', 'Unclosed bracket', 'Calling an undeclared function', 'Invalid character'],
            2,
            ['sk-semantic-analysis'],
            'It parses fine; it just does not mean anything.',
          ),
        ],
      },
    },
    // -----------------------------------------------------------------------
    {
      id: 'unit-comp-2',
      title: 'The Middle and the Back',
      description: 'Intermediate representations, optimisation, code generation, and the runtime.',
      lessons: [
        lesson({
          id: 'lesson-ir-optimisation',
          title: 'IR, Optimisation, and Code Generation',
          summary: 'A middle language, the passes that improve it, and the descent to machine code.',
          level: 'expert',
          domain: 'computer-science',
          steps: [
            concept(
              'Why there is a middle',
              'Compiling m languages to n architectures naively needs m × n compilers. With a shared **intermediate representation** it needs m front ends and n back ends — m + n.\n\nThat is why LLVM exists, and why a new language can target every processor on day one by emitting LLVM IR, and why a new processor gets Rust, Swift, Julia and Clang support at once.\n\nAn IR is deliberately simpler than any source language: no syntactic sugar, explicit control flow, typed operations, and usually **SSA form** — static single assignment, where every variable is assigned exactly once.\n\n```\n%1 = load i32 %price\n%2 = mul i32 %1, 2\nstore i32 %2, i32* %total\n```\n\nSSA sounds like a restriction and is an enormous simplification. Because each name has exactly one definition, "where did this value come from" has one answer rather than requiring dataflow analysis. Most optimisations become almost trivial to express, which is why nearly every serious compiler converts to SSA before optimising.\n\nThe same structure appears outside compilers: a database query planner turns SQL into a logical plan and optimises that; a deep learning framework turns a model into a graph IR and fuses operations in it. `torch.compile` is a compiler middle-end, and it works for the same reason.',
              {
                figure: 'compiler-pipeline',
                keyTerms: [
                  { term: 'IR', definition: 'A language-neutral middle representation, shared by front ends and back ends.' },
                  { term: 'SSA', definition: 'Every variable assigned exactly once, so each value has one definition.' },
                ],
              },
            ),
            numeric(
              'Supporting 6 languages on 5 architectures: how many compilers are needed with a shared IR (front ends plus back ends)?',
              11,
              ['sk-ir'],
              '6 + 5 = 11, against 30 without one. That ratio is the entire argument for LLVM.',
            ),
            mcq(
              'What does SSA form guarantee?',
              [
                'The program is correct',
                'Every variable is assigned exactly once, so each value has a single definition',
                'The program runs faster',
                'There are no loops',
              ],
              1,
              ['sk-ir'],
              'Which makes "where did this value come from" a lookup rather than an analysis — and most optimisations nearly trivial.',
            ),
            concept(
              'What an optimiser actually does',
              'Optimisation is a sequence of **passes**, each a small transformation that preserves meaning. They run repeatedly because each enables the others.\n\n**Constant folding** — compute what is knowable now. `2 * 60 * 60` becomes `7200` at compile time.\n\n**Dead code elimination** — remove what cannot affect the result. Often this is code you did not write: it appeared after inlining and folding made a branch unreachable.\n\n**Inlining** — replace a call with the body. Removes call overhead, and far more importantly exposes the body to every other pass with the caller’s context. Inlining is the pass that makes the others work, which is why it is usually first.\n\n**Loop-invariant code motion** — hoist work that does not change out of the loop.\n\n**Strength reduction** — replace expensive operations with cheap ones: `x * 8` becomes a shift.\n\n**Vectorisation** — turn an element-wise loop into SIMD instructions, from the architecture track.\n\nThe iron rule is the **as-if rule**: the observable behaviour must be unchanged. Which is precisely why an optimiser may reorder your floating-point arithmetic only if you let it — `(a + b) + c` and `a + (b + c)` differ in floating point, so that reordering is off by default.\n\nAnd it explains why undefined behaviour is so dangerous in C. If the standard says signed overflow cannot happen, the optimiser may assume it does not, and delete the check you wrote to detect it. The compiler is not being perverse; it is taking you at your word.',
              {
                keyTerms: [
                  { term: 'Inlining', definition: 'Substituting a function body at the call site, exposing it to other passes.' },
                  { term: 'As-if rule', definition: 'Any transformation is legal provided observable behaviour is unchanged.' },
                ],
              },
            ),
            match(
              'Match each pass to what it does.',
              [
                { left: 'Constant folding', right: 'Compute values known at compile time' },
                { left: 'Inlining', right: 'Substitute a function body at the call site' },
                { left: 'Loop-invariant code motion', right: 'Hoist unchanging work out of a loop' },
                { left: 'Strength reduction', right: 'Replace an expensive operation with a cheaper one' },
              ],
              ['sk-optimisation-passes'],
              'Each is simple; the power comes from running them repeatedly, since each creates opportunities for the others.',
            ),
            mcq(
              'Why is inlining usually run early?',
              [
                'It is the fastest pass',
                'It exposes the function body to every other pass with the caller’s context, enabling them',
                'It reduces binary size',
                'It is required by SSA',
              ],
              1,
              ['sk-optimisation-passes'],
              'The direct saving on call overhead is minor. Enabling constant folding and dead-code elimination inside the inlined body is the real win.',
            ),
            trueFalse(
              'A C compiler may delete an overflow check if the standard says that overflow cannot occur.',
              true,
              ['sk-optimisation-passes'],
              'Undefined behaviour licenses the optimiser to assume it never happens, so a check that only triggers on it is provably dead. This is the mechanism behind a long list of security bugs.',
            ),
            concept(
              'Code generation and register allocation',
              'The back end turns IR into instructions for a specific processor. Three jobs:\n\n**Instruction selection.** Map IR operations to real instructions, which is rarely one to one. A multiply-add is one instruction on many chips; an IR multiply followed by an add should become that one instruction, not two.\n\n**Instruction scheduling.** Reorder to keep the pipeline full — from the architecture track. Put independent work between an instruction and the one that consumes its result, so the processor does not stall.\n\n**Register allocation.** This is the hard one. A program has unlimited virtual registers; a processor has perhaps sixteen. Values that are live at the same time need different registers, and the rest can share.\n\nThat is **graph colouring**: build an interference graph where values are nodes and an edge means "live simultaneously", then colour it with as many colours as there are registers. And graph colouring is NP-complete, from the theory track — which is why compilers use heuristics, and why this phase dominates compile time in optimised builds.\n\nWhen colouring fails, a value is **spilled** to memory and reloaded. Spills are why a function with too many live variables can be dramatically slower than one that fits, and why hot inner loops are written to keep few things live at once.\n\nSo a complexity result you met as theory turns out to be the reason your release build is slow to produce. That is the recurring shape of this track.',
              {
                keyTerms: [
                  { term: 'Register allocation', definition: 'Assigning unlimited virtual registers to a finite physical set.' },
                  { term: 'Spilling', definition: 'Storing a value to memory when no register is free.' },
                ],
              },
            ),
            mcq(
              'Register allocation is usually formulated as which problem?',
              ['Sorting', 'Graph colouring', 'Shortest path', 'Binary search'],
              1,
              ['sk-codegen'],
              'Values that are live simultaneously interfere and need different colours. NP-complete, hence heuristics.',
            ),
            mcq(
              'What happens when there are not enough registers?',
              [
                'Compilation fails',
                'A value is spilled to memory and reloaded when needed',
                'The program uses the cache instead',
                'Registers are shared simultaneously',
              ],
              1,
              ['sk-codegen'],
              'Each spill is a store and a load, which is why keeping few values live in a hot loop matters.',
            ),
          ],
        }),
        lesson({
          id: 'lesson-runtime-gc',
          title: 'Runtimes and Garbage Collection',
          summary: 'What runs alongside your program, and how memory gets freed.',
          level: 'expert',
          domain: 'computer-science',
          steps: [
            concept(
              'The runtime is the part you did not write',
              'Compiled output is rarely self-sufficient. A **runtime** provides what the language promised but the hardware does not: memory management, exception unwinding, dynamic dispatch, reflection, threads and schedulers, and often a standard library.\n\nRuntimes differ enormously in weight, and the difference shows up as startup time and memory floor:\n\n| Language | Runtime | Consequence |\n|---|---|---|\n| C | Almost none | Instant start, you manage memory |\n| Rust | Minimal | Instant start, ownership handles memory |\n| Go | Moderate | Goroutine scheduler and GC built in |\n| Java | Large (JVM) | Slow start, excellent long-run performance |\n| Python | Large | Interpreter plus object model |\n\nThis is directly why serverless cold starts differ so much by language, from the cloud track: a function must initialise its runtime before your code runs.\n\nA managed runtime also enables things a bare binary cannot do — JIT compilation using observed types, precise heap profiling, and safe dynamic loading. The trade is the same one everywhere in this catalog: you gave up control and got capability.',
              {
                keyTerms: [
                  { term: 'Runtime', definition: 'The support code a language needs alongside your compiled program.' },
                ],
              },
            ),
            mcq(
              'Why do serverless cold starts vary so much between languages?',
              [
                'Network differences',
                'The runtime must initialise before your code runs, and runtimes differ in weight',
                'Function size limits',
                'Billing granularity',
              ],
              1,
              ['sk-runtime-systems'],
              'A JVM has more to do before your first line than a Rust binary does.',
            ),
            concept(
              'Two ways to free memory',
              'Someone must free heap allocations. Three strategies, each with a real cost.\n\n**Manual** (C). You call free. Fast and predictable, and the source of use-after-free, double-free and leaks — a large fraction of all security vulnerabilities in systems software.\n\n**Reference counting** (Python, Swift, C++ shared_ptr). Each object counts its references; at zero it is freed. Deterministic and incremental — memory is released at a predictable moment, which matters for files and sockets. Two costs: updating counts is not free, especially across threads, and **cycles leak**, because two objects referring to each other never reach zero. Python ships a separate cycle collector for exactly this.\n\n**Tracing GC** (Java, Go, JavaScript, C#). Periodically start from the roots — globals and stack — and mark everything reachable. Anything unmarked is garbage. Handles cycles naturally and has no per-operation cost, but runs at unpredictable times and historically paused the program while doing so.\n\nMost tracing collectors exploit the **generational hypothesis**: most objects die young. So the young generation is collected frequently and cheaply, and survivors are promoted to an old generation that is collected rarely. This works because it is empirically true across almost all programs.\n\nThe modern trade-off is **throughput versus latency**. A collector that pauses for 200ms can do more total work per second than one that keeps pauses under 1ms. Batch processing wants the first; an interactive service wants the second, which is why Go and modern JVM collectors are tuned relentlessly for short pauses.\n\nAnd **Rust’s ownership** is a fourth answer: the compiler determines statically where each value dies and inserts the free. No runtime cost, no pauses, no cycles by default — paid for entirely at compile time in what the borrow checker will accept.',
              {
                keyTerms: [
                  { term: 'Generational hypothesis', definition: 'Most objects die young, so collect the young generation often and cheaply.' },
                  { term: 'Tracing GC', definition: 'Mark everything reachable from the roots; sweep the rest.' },
                ],
              },
            ),
            interactive(
              'Collect some garbage',
              'gc-simulator',
              'Allocate objects, drop references, and run a collection. Build a reference cycle and watch reference counting fail to reclaim it while tracing succeeds.',
            ),
            categorize(
              'Sort each property by strategy.',
              ['Reference counting', 'Tracing GC', 'Ownership (Rust)'],
              [
                { item: 'Frees deterministically the moment the last reference goes', category: 'Reference counting' },
                { item: 'Leaks reference cycles without a separate collector', category: 'Reference counting' },
                { item: 'Handles cycles naturally', category: 'Tracing GC' },
                { item: 'Can pause the program at unpredictable times', category: 'Tracing GC' },
                { item: 'Decided entirely at compile time, no runtime cost', category: 'Ownership (Rust)' },
              ],
              ['sk-garbage-collection'],
              'Three answers to one question, each paying in a different currency: throughput, latency, or compile-time strictness.',
            ),
            mcq(
              'Why do generational collectors focus on young objects?',
              [
                'Young objects are larger',
                'Most objects die young, so a small frequent collection reclaims most garbage cheaply',
                'Old objects cannot be collected',
                'It simplifies the implementation',
              ],
              1,
              ['sk-garbage-collection'],
              'An empirical regularity that holds across almost all programs, which is why nearly every serious collector exploits it.',
            ),
            trueFalse(
              'Reference counting leaks cycles unless something else collects them.',
              true,
              ['sk-garbage-collection'],
              'Two objects referring to each other never reach a count of zero, however unreachable they are from the program. Python ships a cycle detector alongside its reference counting for exactly this reason.',
            ),
            shortAnswer(
              'A latency-sensitive service has occasional 300ms pauses. What would you suspect and what would you change?',
              ['garbage', 'collect', 'pause', 'allocation', 'generation'],
              'Garbage collection pauses are the first suspect, so I would check GC logs for pause durations and frequency and correlate them with the latency spikes. The usual causes are a high allocation rate promoting too much into the old generation, or an old-generation collection that is not concurrent. The fixes in order of cost: reduce allocation in the hot path so less is promoted, tune or switch to a low-pause collector, size the heap so young collections stay cheap, and only then consider moving the hot path to a language with no collector at all.',
              ['sk-garbage-collection'],
              'Measure the pauses, reduce allocation, then tune the collector. Throughput collectors trade exactly this for total work done.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-comp-2',
        title: 'Back End Checkpoint',
        passingScore: 0.7,
        exercises: [
          mcq(
            'What does a shared IR buy?',
            [
              'Faster compilation',
              'm front ends plus n back ends instead of m × n compilers',
              'Better error messages',
              'Smaller binaries',
            ],
            1,
            ['sk-ir'],
            'The whole argument for LLVM in one line.',
          ),
          mcq(
            'Register allocation maps to which classic problem?',
            ['Sorting', 'Graph colouring', 'Bin packing', 'Shortest path'],
            1,
            ['sk-codegen'],
            'Interference graph, colours equal to available registers.',
          ),
          mcq(
            'Which garbage collection strategy leaks reference cycles?',
            ['Tracing', 'Reference counting', 'Generational', 'Mark-and-sweep'],
            1,
            ['sk-garbage-collection'],
            'Counts never reach zero, so a separate cycle collector is required.',
          ),
        ],
      },
    },
  ],
};
