/**
 * Track 25 — Theory of Computation.
 *
 * The questions that have answers regardless of hardware: what can be
 * computed at all, what can be computed efficiently, and what to do about the
 * enormous class of useful problems that fall outside both.
 */

import type { Track } from '../../domain/types';
import { categorize, concept, fill, interactive, lesson, match, mcq, multi, order, shortAnswer, trueFalse } from '../builders';

export const theoryTrack: Track = {
  id: 'track-theory',
  title: 'Theory of Computation',
  tagline: 'What is computable, what is tractable, and what to do otherwise',
  description:
    'Automata, grammars, Turing machines, undecidability, and the P versus NP question — presented as tools rather than trivia. Ends where practice actually lands: recognising an intractable problem and choosing a good enough answer on purpose.',
  domain: 'computer-science',
  level: 'expert',
  icon: '🧠',
  gradient: ['#A78BFA', '#22D3EE'],
  prerequisites: ['track-dsa'],
  outcomes: [
    'Trace a finite automaton and say what class of pattern it can recognise',
    'Explain why regular expressions cannot match balanced brackets',
    'State what a Turing machine models and why the halting problem is undecidable',
    'Distinguish P, NP, and NP-complete precisely, and say what a reduction shows',
    'Choose between exact, approximate, and heuristic answers with reasons',
  ],
  units: [
    // -----------------------------------------------------------------------
    {
      id: 'unit-theory-1',
      title: 'Machines and Languages',
      description: 'The simplest useful model of computation, and where it runs out.',
      lessons: [
        lesson({
          id: 'lesson-automata',
          title: 'Finite Automata and Regular Languages',
          summary: 'A machine with a fixed amount of memory, and exactly what that buys.',
          level: 'intermediate',
          domain: 'computer-science',
          free: true,
          steps: [
            concept(
              'States, transitions, and no memory at all',
              'A **finite automaton** is the simplest machine worth studying. It has a finite set of states, one start state, some accepting states, and a transition for each state and input symbol. It reads input left to right, moves between states, and at the end either accepts or rejects.\n\nThe critical constraint: **the current state is its entire memory**. Not a counter, not a stack — just "which of these five states am I in". Everything a finite automaton can do must be expressible with a fixed, finite amount of remembering.\n\nThat sounds crippling and is surprisingly powerful. Validating an email shape, recognising a number literal, matching a keyword, running a tokeniser, driving a protocol state machine, a traffic light, a vending machine — all finite automata.\n\nThey are also *fast* in a way nothing else is: each input symbol is one table lookup, so recognition is O(n) with tiny constants and no backtracking. This is why lexers are built from automata rather than from general parsers.\n\nDeterministic (**DFA**) and non-deterministic (**NFA**) versions turn out to be equally powerful — any NFA can be converted into a DFA — which is a genuinely surprising result and the basis of how regular-expression engines compile patterns.',
              {
                keyTerms: [
                  { term: 'Finite automaton', definition: 'A machine whose only memory is its current state, drawn from a finite set.' },
                  { term: 'Accepting state', definition: 'A state in which the machine accepts the input consumed so far.' },
                ],
              },
            ),
            interactive(
              'Drive an automaton',
              'finite-automaton',
              'Feed symbols to the machine one at a time and watch it move. Try to find two different inputs that leave it in the same state — that equivalence is exactly what it means for the machine to have forgotten the difference.',
            ),
            mcq(
              'What is a finite automaton’s entire memory?',
              [
                'A stack of previously seen symbols',
                'Its current state, drawn from a fixed finite set',
                'The full input read so far',
                'A counter of symbols seen',
              ],
              1,
              ['sk-finite-automata'],
              'Nothing else is retained. Everything it can recognise must fit into finitely many "situations".',
            ),
            multi(
              'Which tasks can a finite automaton do?',
              [
                'Recognise a keyword in a token stream',
                'Validate that a string is a well-formed number literal',
                'Check that every opening bracket has a matching close, to any depth',
                'Drive a protocol state machine',
              ],
              [0, 1, 3],
              ['sk-finite-automata'],
              'Arbitrary nesting needs unbounded counting, which is precisely what a fixed state set cannot do.',
            ),
            concept(
              'Regular languages, and the pumping limit',
              'The set of languages a finite automaton can recognise is exactly the **regular languages** — and exactly what regular expressions describe. Three formalisms, one class: DFAs, NFAs, regexes.\n\nWhat makes the boundary sharp is the **pumping lemma**, which is really an argument about pigeonholes. A machine with *k* states, fed a string longer than *k*, must visit some state twice. The loop between those two visits can be repeated any number of times, and the machine cannot tell the difference — so if the language is regular, every sufficiently long string contains a section that can be pumped and stay in the language.\n\nApply that to balanced brackets. To accept `((((...))))` to arbitrary depth, the machine must count opens. With *k* states it cannot distinguish *k*+1 opens from some smaller number, so it will accept a string with mismatched brackets.\n\nHence the famous fact: **you cannot parse HTML with a regular expression.** Not "it is messy" — it is impossible, because nesting is unbounded and regular languages cannot count without bound.\n\nThe practical caveat: modern "regex" engines have added backreferences and recursion, which take them beyond regular. They pay for it — those features are what turn a linear-time matcher into one that can backtrack exponentially, which is the mechanism behind catastrophic-backtracking outages.',
              {
                keyTerms: [
                  { term: 'Regular language', definition: 'One recognisable by a finite automaton; equivalently, describable by a true regular expression.' },
                  { term: 'Pumping lemma', definition: 'A pigeonhole argument showing long strings in a regular language contain a repeatable section.' },
                ],
              },
            ),
            mcq(
              'Why can no regular expression match arbitrarily nested balanced brackets?',
              [
                'Regex syntax has no bracket operator',
                'It requires counting to unbounded depth, and a finite state set cannot distinguish arbitrarily many depths',
                'Brackets are reserved characters',
                'It would be too slow',
              ],
              1,
              ['sk-regular-languages'],
              'A hard impossibility from the pumping argument, not a limitation of any particular engine.',
            ),
            trueFalse(
              'DFAs, NFAs, and regular expressions all describe exactly the same class of languages.',
              true,
              ['sk-regular-languages'],
              'Three notations, one expressive power. The NFA-to-DFA construction is how engines exploit it.',
            ),
            mcq(
              'A production outage is traced to a regex taking exponential time on a crafted input. What feature is usually responsible?',
              [
                'Character classes',
                'Backtracking driven by features like backreferences that push the pattern beyond truly regular',
                'Case insensitivity',
                'Anchors',
              ],
              1,
              ['sk-regular-languages'],
              'A genuinely regular pattern can be matched in linear time with no backtracking. The extensions are what cost you.',
            ),
          ],
        }),
        lesson({
          id: 'lesson-grammars',
          title: 'Context-Free Grammars and Parsing',
          summary: 'Add a stack and nesting becomes possible. That is the whole upgrade.',
          level: 'expert',
          domain: 'computer-science',
          steps: [
            concept(
              'Rules that can refer to themselves',
              'A **context-free grammar** is a set of production rules where a symbol expands into other symbols, and crucially may expand into something containing itself:\n\n```\nexpr  → expr + term | term\nterm  → term * factor | factor\nfactor → ( expr ) | number\n```\n\nThat self-reference is what buys unbounded nesting. `factor → ( expr )` means an expression can contain a parenthesised expression, to any depth.\n\nThe machine model that matches is a **pushdown automaton**: a finite automaton plus a stack. The stack is the unbounded memory a finite automaton lacked, and it is exactly the right shape for nesting — push on the way in, pop on the way out.\n\nSo the hierarchy has a clear logic to it. Regular: finite memory. Context-free: a stack. Turing: unbounded read-write memory.\n\nGrammars are how every programming language is specified, and the grammar above also encodes **precedence**: because `term` sits below `expr`, multiplication binds tighter than addition, structurally. A grammar is **ambiguous** if some string has two valid parse trees — the classic dangling-else problem — which is a defect in a language specification, because it means two compilers can disagree while both being correct.',
              {
                figure: 'chomsky-hierarchy',
                keyTerms: [
                  { term: 'Context-free grammar', definition: 'Production rules that may be recursive, generating nested structure.' },
                  { term: 'Pushdown automaton', definition: 'A finite automaton with a stack — the machine model for context-free languages.' },
                ],
              },
            ),
            order(
              'Order these language classes from least to most powerful.',
              ['Regular', 'Context-free', 'Context-sensitive', 'Recursively enumerable'],
              ['sk-context-free'],
              'The Chomsky hierarchy. Each level adds memory: none, a stack, bounded tape, unbounded tape.',
            ),
            mcq(
              'What does a pushdown automaton add to a finite automaton?',
              ['More states', 'A stack, providing unbounded memory with nesting discipline', 'Randomness', 'Parallelism'],
              1,
              ['sk-context-free'],
              'Push on the way in, pop on the way out — exactly matched to nested structure.',
            ),
            mcq(
              'What does it mean for a grammar to be ambiguous?',
              [
                'It contains undefined symbols',
                'Some string has more than one valid parse tree, so the meaning is not determined by the grammar',
                'It is left-recursive',
                'It cannot be parsed',
              ],
              1,
              ['sk-context-free'],
              'A specification defect: two conforming implementations can disagree about what a program means.',
            ),
            fill(
              'Regular languages need finite memory; context-free languages need a ___; Turing-recognisable languages need ___ read-write memory.',
              [['stack'], ['unbounded', 'infinite', 'unlimited']],
              ['sk-context-free'],
              'The hierarchy is a hierarchy of memory models.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-theory-1',
        title: 'Languages Checkpoint',
        passingScore: 0.7,
        exercises: [
          mcq(
            'A finite automaton cannot recognise which of these?',
            [
              'Strings ending in "ing"',
              'Strings with an even number of a-characters',
              'Strings of n opening brackets followed by n closing brackets, for any n',
              'Strings containing the substring "error"',
            ],
            2,
            ['sk-finite-automata'],
            'Unbounded counting. The other three need only finitely many distinctions.',
          ),
          trueFalse(
            'HTML can be reliably parsed with a true regular expression.',
            false,
            ['sk-regular-languages'],
            'Nesting is unbounded; regular languages cannot count without bound.',
          ),
          mcq(
            'What machine model corresponds to context-free languages?',
            ['A finite automaton', 'A pushdown automaton', 'A Turing machine', 'A linear-bounded automaton'],
            1,
            ['sk-context-free'],
            'Finite control plus a stack.',
          ),
        ],
      },
    },
    // -----------------------------------------------------------------------
    {
      id: 'unit-theory-2',
      title: 'The Limits of Computation',
      description: 'A model general enough to define computing, and a question it cannot answer.',
      lessons: [
        lesson({
          id: 'lesson-turing',
          title: 'Turing Machines and Undecidability',
          summary: 'Some questions have no algorithm. Not "not yet" — never.',
          level: 'expert',
          domain: 'computer-science',
          steps: [
            concept(
              'A definition of computing',
              'A **Turing machine** is deliberately crude: an unbounded tape of cells, a head that reads and writes one cell, and a finite state machine deciding what to write, which way to move, and what state to enter next.\n\nIt is not a design for a computer. It is a definition of *computing*, chosen to be simple enough to reason about and general enough that nothing has ever been found to exceed it.\n\nThe **Church–Turing thesis** is the claim that anything effectively computable by any means is computable by a Turing machine. It is not a theorem — it relates a formal model to an informal intuition — but nine decades of attempts have produced nothing stronger. Lambda calculus, recursive functions, register machines, every programming language you have used: all exactly equivalent in power.\n\nSo "Turing complete" means "as powerful as computing gets". It is a low bar in a strange way — Conway’s Game of Life is Turing complete, and so, accidentally, are several configuration file formats.\n\nThe significance is what it lets you prove. Once one model captures all computation, showing that *this* model cannot solve a problem shows that **nothing** can.',
              {
                keyTerms: [
                  { term: 'Turing machine', definition: 'Unbounded tape, a read-write head, and finite control — a definition of computation.' },
                  { term: 'Church–Turing thesis', definition: 'Anything effectively computable is computable by a Turing machine.' },
                ],
              },
            ),
            mcq(
              'What does "Turing complete" mean?',
              [
                'Optimised for speed',
                'As computationally powerful as any model of computation we know of',
                'Able to run in finite memory',
                'Guaranteed to terminate',
              ],
              1,
              ['sk-turing-machines'],
              'The ceiling, not a compliment about efficiency. Plenty of accidental systems reach it.',
            ),
            concept(
              'The halting problem',
              'Here is the question: write a function `halts(program, input)` that returns true if the program eventually stops and false if it loops forever. No running it and waiting — a correct answer, always, for every input.\n\nIt cannot be done, and the proof is short.\n\nSuppose `halts` exists. Build:\n\n```\ndef paradox():\n    if halts(paradox, none):\n        loop_forever()\n    else:\n        return\n```\n\nDoes `paradox` halt? If `halts` says yes, it loops forever — so `halts` was wrong. If `halts` says no, it returns immediately — so `halts` was wrong. Both answers are wrong, so `halts` cannot exist.\n\nThis is **undecidable**: not unsolved, not hard, but provably without an algorithm. And by **Rice’s theorem** it generalises brutally — *any* non-trivial question about what a program *does* (rather than how it is written) is undecidable. Does it ever access this file? Is it equivalent to that program? Does it always return a positive number? All undecidable.\n\nThe practical consequences are everywhere and are usually mistaken for engineering failures. Static analysers report false positives *by necessity*. Type systems reject some programs that would have run fine. Compilers cannot detect all infinite loops. Antivirus cannot perfectly decide whether a program is malicious.\n\nWhich is why every one of those tools is a **sound approximation**: it answers a decidable weaker question, accepts false positives or false negatives, and is honest about which. The lesson is not despair; it is that the right response to an undecidable question is to solve a decidable neighbour of it.',
              {
                keyTerms: [
                  { term: 'Undecidable', definition: 'No algorithm can answer it correctly for all inputs — proven, not merely unknown.' },
                  { term: 'Rice’s theorem', definition: 'Every non-trivial semantic property of programs is undecidable.' },
                ],
              },
            ),
            mcq(
              'What does the halting problem being undecidable mean?',
              [
                'It is very hard to solve efficiently',
                'No algorithm can correctly decide it for all programs — this is proven, not an open question',
                'It requires too much memory',
                'It is only unsolvable for infinite inputs',
              ],
              1,
              ['sk-halting-problem'],
              'A proof of impossibility, not a statement about current technique.',
            ),
            mcq(
              'Why does a static analyser report warnings for code that is actually correct?',
              [
                'The analyser has bugs',
                'The questions it wants to answer are undecidable, so it soundly approximates and accepts false positives',
                'It has not been trained on enough code',
                'The code is badly formatted',
              ],
              1,
              ['sk-halting-problem'],
              'Rice’s theorem guarantees it. The tool trades precision for a decidable answer, deliberately.',
            ),
            multi(
              'Which of these are undecidable in general?',
              [
                'Whether a program halts on a given input',
                'Whether two programs compute the same function',
                'Whether a string is 40 characters long',
                'Whether a program ever writes to a particular file',
              ],
              [0, 1, 3],
              ['sk-halting-problem'],
              'Semantic questions about behaviour are undecidable; syntactic questions about the text are fine.',
            ),
            shortAnswer(
              'Someone proposes a tool that flags every infinite loop in a codebase with no false positives and no false negatives. What do you tell them?',
              ['halting', 'undecidable', 'impossible', 'approximate'],
              'That is the halting problem, which is provably undecidable — no algorithm can be both complete and sound for it. What is achievable is a sound approximation: flag patterns that are definitely loops and accept some false positives, or catch a decidable subset such as loops with no exit path and accept false negatives. The tool has to choose which kind of error it will make, and say so.',
              ['sk-halting-problem'],
              'The right response to an undecidable question is to solve a decidable neighbour and be explicit about the gap.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-theory-2',
        title: 'Computability Checkpoint',
        passingScore: 0.7,
        exercises: [
          trueFalse(
            'The halting problem is undecidable, meaning no algorithm can solve it for all inputs.',
            true,
            ['sk-halting-problem'],
            'Proven by contradiction with a self-referential program.',
          ),
          mcq(
            'Rice’s theorem says what?',
            [
              'All programs eventually halt',
              'Every non-trivial question about what a program does is undecidable',
              'Turing machines are the fastest model',
              'Type systems are complete',
            ],
            1,
            ['sk-halting-problem'],
            'Which is why every program analyser approximates.',
          ),
          mcq(
            'What is the significance of the Church–Turing thesis for impossibility proofs?',
            [
              'It shows Turing machines are fastest',
              'One model captures all computation, so showing that model cannot do something shows nothing can',
              'It proves P ≠ NP',
              'It defines complexity classes',
            ],
            1,
            ['sk-turing-machines'],
            'Universality is what makes an impossibility result universal.',
          ),
        ],
      },
    },
    // -----------------------------------------------------------------------
    {
      id: 'unit-theory-3',
      title: 'Hard Problems',
      description: 'Computable but expensive, and what to do when the exact answer is out of reach.',
      lessons: [
        lesson({
          id: 'lesson-complexity-classes',
          title: 'P, NP, and NP-Completeness',
          summary: 'Easy to check is not the same as easy to find.',
          level: 'expert',
          domain: 'computer-science',
          steps: [
            concept(
              'Two classes, one famous question',
              'Complexity classes group problems by the resources needed to solve them, on the *worst* input, as input size grows.\n\n**P** — solvable in polynomial time. Sorting, shortest paths, matrix multiplication. "Tractable", with the caveat that n¹⁰⁰ is polynomial and useless; in practice P problems that matter tend to be n³ or better.\n\n**NP** — a proposed solution can be *verified* in polynomial time. Note what this does and does not say. It says nothing about finding one.\n\nSudoku makes the asymmetry concrete. Handed a filled grid, you can check it in seconds. Finding the solution for a large generalised board is enormously harder. Factoring is the same shape: verifying that 61 × 53 = 3233 is trivial; factoring a 2048-bit number is the assumption RSA rests on.\n\nP ⊆ NP — if you can solve it quickly you can certainly check it quickly. Whether **P = NP** is the central open question in the field, unresolved since 1971 with a million-dollar prize attached. Nearly everyone expects P ≠ NP, and nobody can prove it.\n\nIt is worth appreciating how much would change if they were equal. Every problem whose solution is easy to recognise would be easy to find — which would break most modern cryptography, and would also mean that finding a proof is no harder than checking one. The consequences are implausible enough to be part of why people believe the answer is no.',
              {
                figure: 'p-vs-np',
                keyTerms: [
                  { term: 'P', definition: 'Problems solvable in polynomial time.' },
                  { term: 'NP', definition: 'Problems whose candidate solutions are verifiable in polynomial time.' },
                ],
              },
            ),
            mcq(
              'What does it mean for a problem to be in NP?',
              [
                'It cannot be solved',
                'A proposed solution can be verified in polynomial time',
                'It requires exponential time',
                'It is harder than every problem in P',
              ],
              1,
              ['sk-complexity-classes'],
              'Verification, not discovery. Every problem in P is also in NP.',
            ),
            trueFalse(
              'Every problem in P is also in NP.',
              true,
              ['sk-complexity-classes'],
              'If you can solve it in polynomial time, you can verify a candidate by solving it and comparing.',
            ),
            concept(
              'NP-complete: the hardest problems in NP',
              'A **reduction** transforms one problem into another. If you can convert any instance of A into an instance of B in polynomial time, then a fast algorithm for B gives you a fast algorithm for A. So B is at least as hard as A.\n\nA problem is **NP-complete** if it is in NP and *every* problem in NP reduces to it. These are the hardest problems in NP, and they are all equivalent: a polynomial algorithm for any single one would give polynomial algorithms for all of them, and prove P = NP.\n\nCook and Levin proved SAT — is there an assignment making this boolean formula true — is NP-complete in 1971. Everything since has been proved NP-complete by reduction from a known one, and the list is now thousands long and full of ordinary things:\n\n- **Travelling salesman** — the cheapest route visiting every city\n- **Graph colouring** — scheduling, register allocation, exam timetabling\n- **Knapsack** — resource allocation under a budget\n- **Set cover** — choosing the fewest sets to cover everything\n- **Bin packing** — fitting items into containers\n\nThe practical payoff is in recognising them. When a problem you have been handed reduces to one of these, you stop looking for an exact efficient algorithm — decades of very capable people have already tried — and you switch strategies. That recognition is worth more than any proof technique here.',
              {
                keyTerms: [
                  { term: 'Reduction', definition: 'A polynomial-time transformation showing one problem is at least as hard as another.' },
                  { term: 'NP-complete', definition: 'In NP, and every NP problem reduces to it — the hardest problems in the class.' },
                ],
              },
            ),
            mcq(
              'What would a polynomial-time algorithm for any one NP-complete problem imply?',
              [
                'Nothing beyond that problem',
                'That P = NP, since every NP problem reduces to it in polynomial time',
                'That the problem was not really NP-complete',
                'That the halting problem is decidable',
              ],
              1,
              ['sk-np-completeness'],
              'They stand or fall together. That is what makes the class so useful.',
            ),
            categorize(
              'Sort each problem.',
              ['In P', 'NP-complete'],
              [
                { item: 'Sorting a list', category: 'In P' },
                { item: 'Shortest path in a weighted graph', category: 'In P' },
                { item: 'Travelling salesman (optimal tour)', category: 'NP-complete' },
                { item: 'Graph colouring with k colours', category: 'NP-complete' },
              ],
              ['sk-np-completeness'],
              'Recognising which side of this line you are on decides what you build next.',
            ),
            mcq(
              'What does proving problem A reduces to problem B in polynomial time tell you?',
              [
                'A and B are equally easy',
                'B is at least as hard as A, because solving B efficiently would solve A efficiently',
                'A is harder than B',
                'Neither is in NP',
              ],
              1,
              ['sk-np-completeness'],
              'The direction matters and is easy to get backwards. Reduce *from* a known-hard problem to prove hardness.',
            ),
          ],
        }),
        lesson({
          id: 'lesson-approximation',
          title: 'Living With Intractable Problems',
          summary: 'You cannot have optimal, fast, and general. Pick which to give up.',
          level: 'expert',
          domain: 'computer-science',
          steps: [
            concept(
              'Four ways out',
              'Your problem is NP-complete. Nobody is going to hand you an efficient exact algorithm. You still have to ship something.\n\nThere are four honest exits, and choosing deliberately is the skill.\n\n**Give up optimality.** An **approximation algorithm** runs in polynomial time with a *proven bound* on how far from optimal it can be. Greedy set cover is within a factor of ln(n). Christofides gets within 1.5× optimal for metric TSP. You know exactly what you are sacrificing, which is what separates this from guessing.\n\n**Give up guarantees.** A **heuristic** — simulated annealing, genetic algorithms, beam search — usually does well with no proof at all. Often the right choice in practice, but you cannot say how bad it might be on the next input.\n\n**Give up generality.** The general problem is hard; *your* instances may not be. 2-SAT is in P while 3-SAT is NP-complete. Many graph problems are easy on trees or on planar graphs. Fixed-parameter tractability exploits a small parameter even when the input is large. Real instances are rarely adversarial.\n\n**Give up speed.** Exponential is fine when n is small. Branch and bound, integer programming solvers, and modern SAT solvers routinely handle instances with millions of variables — worst-case exponential, and yet industrially effective, because real inputs have structure.\n\nThe mature version of this knowledge is not "NP-complete means impossible". It is: stop searching for the exact efficient algorithm, decide which of the four you are trading away, and say so out loud in the design.',
              {
                keyTerms: [
                  { term: 'Approximation algorithm', definition: 'Polynomial time with a proven bound on the gap to optimal.' },
                  { term: 'Heuristic', definition: 'A method that usually works well, with no guarantee about the worst case.' },
                ],
              },
            ),
            match(
              'Match each strategy to what it gives up.',
              [
                { left: 'Approximation algorithm', right: 'Optimality, by a proven bounded factor' },
                { left: 'Heuristic search', right: 'Any guarantee at all' },
                { left: 'Restricting to planar graphs', right: 'Generality' },
                { left: 'Branch and bound', right: 'Worst-case running time' },
              ],
              ['sk-approximation'],
              'Four exits, four different costs. Naming which one you took is the difference between engineering and hoping.',
            ),
            mcq(
              'What distinguishes an approximation algorithm from a heuristic?',
              [
                'Approximation algorithms are faster',
                'An approximation algorithm has a proven bound on how far from optimal it can be; a heuristic has none',
                'Heuristics are always worse in practice',
                'Approximation algorithms are exact',
              ],
              1,
              ['sk-approximation'],
              'The guarantee is the whole distinction. Heuristics often perform better on real data while promising nothing.',
            ),
            mcq(
              'Modern SAT solvers handle instances with millions of variables despite SAT being NP-complete. Why is that not a contradiction?',
              [
                'They use quantum computing',
                'NP-completeness is a worst-case statement; real instances have structure solvers exploit',
                'They only solve 2-SAT',
                'They return approximate answers',
              ],
              1,
              ['sk-approximation'],
              'Worst case is not average case. A great deal of practical computing lives in that gap.',
            ),
            multi(
              'Which are reasonable responses to discovering your problem is NP-complete?',
              [
                'Look for an approximation algorithm with a proven bound',
                'Check whether your actual instances fall into a tractable special case',
                'Use an exact solver and accept exponential worst case if n is small',
                'Keep searching for a polynomial exact algorithm',
              ],
              [0, 1, 2],
              ['sk-approximation'],
              'The fourth has been attempted by the entire field for fifty years. Your afternoon is unlikely to settle it.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-theory-3',
        title: 'Complexity Checkpoint',
        passingScore: 0.7,
        exercises: [
          mcq(
            'NP is the class of problems for which what is true?',
            [
              'They cannot be solved',
              'A candidate solution can be verified in polynomial time',
              'They require exponential time',
              'They are undecidable',
            ],
            1,
            ['sk-complexity-classes'],
            'Verifiability, not solvability.',
          ),
          trueFalse(
            'An efficient algorithm for one NP-complete problem would give efficient algorithms for all of them.',
            true,
            ['sk-np-completeness'],
            'Every NP problem reduces to each NP-complete problem in polynomial time.',
          ),
          mcq(
            'What does an approximation algorithm guarantee that a heuristic does not?',
            ['Faster runtime', 'A proven bound on the gap to optimal', 'An exact answer', 'Lower memory use'],
            1,
            ['sk-approximation'],
            'The bound is the product.',
          ),
        ],
      },
    },
  ],
};
