/**
 * Track 26 — Discrete Maths for Computer Science.
 *
 * The mathematics that computing is actually built on — logic, proof,
 * counting, graphs, modular arithmetic. Continuous maths lives in the Math for
 * AI track; this is the discrete half, and it is the half that shows up in
 * correctness arguments and complexity proofs.
 */

import type { Track } from '../../domain/types';
import { concept, fill, interactive, lesson, match, mcq, multi, numeric, order, shortAnswer, trueFalse } from '../builders';

export const discreteMathTrack: Track = {
  id: 'track-discrete-math',
  title: 'Discrete Maths for CS',
  tagline: 'Logic, proof, counting, and structure',
  description:
    'The discrete mathematics computing rests on: propositional logic, the three proof techniques you will actually use, induction, combinatorics, graph vocabulary, modular arithmetic, and the recurrences that give you the complexity of a recursive algorithm.',
  domain: 'computer-science',
  level: 'intermediate',
  icon: '🔢',
  gradient: ['#F472B6', '#8B5CF6'],
  prerequisites: ['track-foundations'],
  outcomes: [
    'Build a truth table and simplify a boolean condition with confidence',
    'Choose between direct proof, contrapositive, and contradiction',
    'Write an induction argument for a loop invariant or a recursive function',
    'Count arrangements and selections without double counting',
    'Solve a recurrence to get the complexity of a recursive algorithm',
  ],
  units: [
    // -----------------------------------------------------------------------
    {
      id: 'unit-dm-1',
      title: 'Logic and Proof',
      description: 'Making an argument that actually establishes something.',
      lessons: [
        lesson({
          id: 'lesson-logic',
          title: 'Propositional Logic',
          summary: 'Truth tables, implication, and the transformation that simplifies every tangled condition.',
          level: 'intro',
          domain: 'computer-science',
          free: true,
          steps: [
            concept(
              'Connectives, and the one that confuses people',
              'A **proposition** is a statement that is definitely true or definitely false. Connectives combine them:\n\n| Connective | Symbol | True when |\n|---|---|---|\n| AND | ∧ | both are true |\n| OR | ∨ | at least one is true (inclusive) |\n| NOT | ¬ | the operand is false |\n| IMPLIES | → | **not** (P true and Q false) |\n| IFF | ↔ | both have the same truth value |\n\nThe one worth dwelling on is **implication**. `P → Q` is false in exactly one case: P true and Q false. Which means when P is false, the whole implication is **true** regardless of Q — "if the moon is cheese then I am a teapot" is a true statement.\n\nThat feels wrong until you read it as a promise: the promise is only broken if the condition held and the conclusion did not. This is **vacuous truth**, and it is why `all([])` is `True` in Python. Every element of the empty list satisfies any property, because there is no element that fails to.\n\nIt also explains a common test bug: a validation loop over an empty collection reports success, because it never found a violation.',
              {
                keyTerms: [
                  { term: 'Implication', definition: 'False only when the antecedent is true and the consequent false.' },
                  { term: 'Vacuous truth', definition: 'A universal statement over an empty set is true, having no counterexample.' },
                ],
              },
            ),
            interactive(
              'Build a truth table',
              'truth-table',
              'Toggle the variables and watch each row evaluate. Compare `P → Q` against `¬P ∨ Q` row by row — they match everywhere, which is why the implication is usually removed before simplifying.',
            ),
            mcq(
              'When is `P → Q` false?',
              ['When P is false', 'Only when P is true and Q is false', 'When both are false', 'When they differ'],
              1,
              ['sk-propositional-logic'],
              'One row out of four. A false antecedent makes the implication vacuously true.',
            ),
            trueFalse(
              'In Python, `all([])` evaluates to True.',
              true,
              ['sk-propositional-logic'],
              'Vacuous truth: there is no element that fails the condition. Worth remembering when a validation loop reports success on empty input.',
            ),
            concept(
              'De Morgan, and simplifying conditions',
              'The most practically useful identities in the whole subject are De Morgan’s laws:\n\n```\n¬(P ∧ Q)  ≡  ¬P ∨ ¬Q\n¬(P ∨ Q)  ≡  ¬P ∧ ¬Q\n```\n\nNegating an AND gives an OR of negations, and vice versa. Every time you invert a condition in code, you are using this — and getting it wrong is a genuine source of bugs.\n\n```\nnot (is_admin and is_active)\n→ (not is_admin) or (not is_active)\n```\n\nIf you distribute the negation without flipping the connective, the condition is wrong in exactly the cases that matter.\n\nTwo more worth knowing. `P → Q` is equivalent to `¬P ∨ Q`, which lets you eliminate implications before simplifying. And the **contrapositive** `¬Q → ¬P` is equivalent to `P → Q` — a fact that becomes a proof technique in the next lesson.\n\nWatch out for the **converse** `Q → P`, which is *not* equivalent and is the most common reasoning error in the wild. "All fraud has an unusual pattern" does not give you "all unusual patterns are fraud", and a model or a rule built on that confusion produces false positives forever.',
              {
                keyTerms: [
                  { term: 'De Morgan’s laws', definition: 'Negating a conjunction gives a disjunction of negations, and vice versa.' },
                  { term: 'Contrapositive', definition: '¬Q → ¬P, logically equivalent to P → Q.' },
                ],
              },
            ),
            mcq(
              'What is `not (a or b)` equivalent to?',
              ['not a or not b', 'not a and not b', 'a and b', 'not (a and b)'],
              1,
              ['sk-propositional-logic'],
              'De Morgan: negating an OR gives an AND of negations.',
            ),
            fill(
              'The contrapositive of `P → Q` is ___ and it is ___ to the original.',
              [['¬Q → ¬P', 'not Q implies not P'], ['equivalent', 'logically equivalent']],
              ['sk-propositional-logic'],
              'The converse `Q → P` is the one that is not equivalent.',
            ),
            mcq(
              '"Every fraudulent transaction is unusual." What does this NOT let you conclude?',
              [
                'A typical transaction is not fraudulent',
                'An unusual transaction is fraudulent',
                'If it is not unusual, it is not fraudulent',
                'Fraud implies unusual',
              ],
              1,
              ['sk-propositional-logic'],
              'That is the converse, which does not follow. Confusing it with the contrapositive is the base-rate error in miniature.',
            ),
          ],
        }),
        lesson({
          id: 'lesson-proof',
          title: 'Proof Techniques and Induction',
          summary: 'Three ways to establish something, and the one that matches recursion.',
          level: 'intermediate',
          domain: 'computer-science',
          steps: [
            concept(
              'Direct, contrapositive, contradiction',
              'A proof is an argument that leaves no room for the statement to be false. Three techniques cover nearly everything you will need.\n\n**Direct proof.** Assume P, derive Q. To show that the sum of two evens is even: let a = 2m and b = 2n, then a + b = 2(m + n), which is even. Done.\n\n**Contrapositive.** Prove ¬Q → ¬P instead, which is equivalent. Use it when the negation is easier to work with. To show "if n² is even then n is even", the direct route is awkward; the contrapositive — if n is odd then n² is odd — is one line, since (2k+1)² = 4k² + 4k + 1.\n\n**Contradiction.** Assume the statement is false and derive an impossibility. This is how you prove √2 is irrational, and how the halting problem is proved undecidable.\n\nOne rule worth internalising: **a counterexample disproves, examples never prove.** A property holding for the first thousand integers says nothing about the rest. This is exactly why tests and proofs do different jobs — tests sample, proofs quantify — and why property-based testing, which samples far more aggressively, still is not a proof.',
              {
                keyTerms: [
                  { term: 'Proof by contradiction', definition: 'Assume the negation, derive an impossibility, conclude the original.' },
                  { term: 'Counterexample', definition: 'A single case disproving a universal claim.' },
                ],
              },
            ),
            match(
              'Match each technique to when it fits.',
              [
                { left: 'Direct proof', right: 'The hypothesis gives you something concrete to manipulate' },
                { left: 'Contrapositive', right: 'The negated form is easier to work with than the original' },
                { left: 'Contradiction', right: 'Assuming falsity leads somewhere impossible' },
                { left: 'Counterexample', right: 'You want to disprove a universal claim' },
              ],
              ['sk-proof-techniques'],
              'All four are routine; picking the convenient one is most of the skill.',
            ),
            trueFalse(
              'Verifying a property for the first 10,000 integers proves it holds for all integers.',
              false,
              ['sk-proof-techniques'],
              'Examples can only disprove. There are conjectures that first fail at astronomically large numbers.',
            ),
            concept(
              'Induction: the proof technique shaped like recursion',
              'To prove something for every natural number, you cannot check them all. **Induction** gets you there in two steps:\n\n**Base case.** Show it holds for the smallest value, usually n = 0 or n = 1.\n\n**Inductive step.** Show that *if* it holds for n, it must hold for n + 1.\n\nTogether these give every n. It holds at 1; the step carries it to 2; then 3; forever. The dominoes analogy is exact — you knock the first over and prove that each knocks over the next.\n\nExample: the sum 1 + 2 + ... + n = n(n+1)/2.\n\n*Base:* n = 1 gives 1 = 1·2/2 = 1. ✓\n\n*Step:* assume it holds for n. Then 1 + ... + n + (n+1) = n(n+1)/2 + (n+1) = (n+1)(n+2)/2, which is the formula at n+1. ✓\n\nInduction matters in computing because it is the *same shape as recursion*. A recursive function has a base case and a step that assumes the smaller call is correct — so proving a recursive function correct is an induction, structurally identical. The same argument establishes **loop invariants**: true before the loop, preserved by each iteration, therefore true at the end.\n\n**Strong induction** assumes the property for *all* values up to n rather than just n. Use it when the step depends on more than the immediately preceding case — merge sort, which recurses on halves rather than on n−1, needs it.',
              {
                keyTerms: [
                  { term: 'Inductive step', definition: 'Showing the property at n forces it at n+1.' },
                  { term: 'Loop invariant', definition: 'A condition true before the loop and preserved by each iteration.' },
                ],
              },
            ),
            order(
              'Order the parts of a proof by induction.',
              ['State the property P(n) to be proved', 'Prove the base case', 'Assume P(n) holds for an arbitrary n', 'Derive P(n+1) from that assumption', 'Conclude P(n) holds for all n'],
              ['sk-induction'],
              'The assumption in step three is the inductive hypothesis; using it is not circular, because the step only claims an implication.',
            ),
            mcq(
              'Why does merge sort’s correctness proof need strong induction?',
              [
                'It uses more memory',
                'It recurses on halves, so the step depends on all smaller cases rather than only n−1',
                'It is not recursive',
                'Its base case is complicated',
              ],
              1,
              ['sk-induction'],
              'Ordinary induction hands you only P(n) when proving P(n+1). Recursion on n/2 needs more than that.',
            ),
            numeric(
              'Using n(n+1)/2, what is the sum of the integers from 1 to 100?',
              5050,
              ['sk-induction'],
              '100 × 101 / 2 = 5050. The formula is proved by induction, not by adding them up.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-dm-1',
        title: 'Logic and Proof Checkpoint',
        passingScore: 0.7,
        exercises: [
          mcq(
            '`not (a and b)` is equivalent to what?',
            ['not a and not b', 'not a or not b', 'a or b', 'a and not b'],
            1,
            ['sk-propositional-logic'],
            'De Morgan. Flip the connective as you distribute the negation.',
          ),
          mcq(
            'What are the two parts of a proof by induction?',
            [
              'A counterexample and a generalisation',
              'A base case and an inductive step',
              'A hypothesis and a contradiction',
              'A direct proof and a contrapositive',
            ],
            1,
            ['sk-induction'],
            'One domino falls, and each knocks over the next.',
          ),
          trueFalse(
            'The converse of `P → Q` is logically equivalent to it.',
            false,
            ['sk-proof-techniques'],
            'The contrapositive is. The converse is a separate claim and assuming it is a common reasoning error.',
          ),
        ],
      },
    },
    // -----------------------------------------------------------------------
    {
      id: 'unit-dm-2',
      title: 'Counting and Structure',
      description: 'Sets, arrangements, graphs, clocks, and recursive costs.',
      lessons: [
        lesson({
          id: 'lesson-sets-counting',
          title: 'Sets, Counting, and the Pigeonhole',
          summary: 'How many arrangements, how many selections, and one principle that proves collisions.',
          level: 'intermediate',
          domain: 'computer-science',
          steps: [
            concept(
              'Sets and relations',
              'A **set** is an unordered collection with no duplicates — which is exactly why set operations are the right tool for deduplication and membership. Union, intersection, difference, and the fact that membership is O(1) in a hash set rather than O(n) in a list.\n\nA **relation** is a set of pairs: which elements relate to which. Three properties keep recurring:\n\n**Reflexive** — everything relates to itself (x = x).\n\n**Symmetric** — if a relates to b then b relates to a (siblinghood; "connected to" in an undirected graph).\n\n**Transitive** — if a→b and b→c then a→c (less-than; ancestry).\n\nA relation with all three is an **equivalence relation**, and it does something useful: it partitions a set into disjoint classes where everything in a class is equivalent. "Has the same remainder mod 5" partitions the integers into five classes. "Is in the same connected component" partitions a graph’s vertices.\n\nThat partitioning is behind more code than it looks. Union-find maintains exactly these classes incrementally; deduplication by a hash of normalised content is an equivalence relation; sharding by a key is a partition into classes.',
              {
                keyTerms: [
                  { term: 'Equivalence relation', definition: 'Reflexive, symmetric, and transitive — it partitions a set into disjoint classes.' },
                  { term: 'Partition', definition: 'A split into non-overlapping parts covering the whole set.' },
                ],
              },
            ),
            multi(
              'Which of these are equivalence relations?',
              [
                'Has the same remainder when divided by 7',
                'Is in the same connected component of a graph',
                'Is less than',
                'Is a sibling of (including oneself)',
              ],
              [0, 1, 3],
              ['sk-sets-relations'],
              '"Less than" is transitive but neither reflexive nor symmetric, so it partitions nothing.',
            ),
            concept(
              'Counting without double counting',
              'Two multiplication rules cover most counting.\n\n**Product rule.** Independent choices multiply. Three shirts and four trousers gives 12 outfits.\n\n**Sum rule.** Mutually exclusive alternatives add. Four buses or three trains gives 7 ways to travel.\n\nThen the two standard formulas, and the whole difficulty is telling them apart:\n\n**Permutations** — order matters. Arrangements of r items from n: `P(n,r) = n! / (n−r)!`. Choosing a president, then a secretary, from 10 people: 10 × 9 = 90.\n\n**Combinations** — order does not matter. `C(n,r) = n! / (r!(n−r)!)`. Choosing a committee of 2 from 10: 45, because each committee was counted twice in the 90.\n\nThe test is one question: *does swapping two choices give a different outcome?* Passwords yes, lottery numbers no.\n\nThis is the machinery behind complexity arguments that involve enumeration — why brute-forcing a travelling-salesman tour over n cities is (n−1)!/2, and why an 8-character password from a 95-character alphabet has 95⁸ ≈ 6.6 × 10¹⁵ possibilities, which is the calculation that makes the slow password hash from the security track worth its cost.',
              {
                keyTerms: [
                  { term: 'Permutation', definition: 'An ordered arrangement; swapping two elements gives a different one.' },
                  { term: 'Combination', definition: 'An unordered selection; only membership matters.' },
                ],
              },
            ),
            numeric(
              'How many ways can you choose a committee of 3 from 6 people, where order does not matter?',
              20,
              ['sk-combinatorics'],
              'C(6,3) = 6!/(3!·3!) = 20. If the three roles were distinct it would be P(6,3) = 120.',
            ),
            mcq(
              'Which situation calls for combinations rather than permutations?',
              [
                'Assigning first, second, and third place',
                'Picking 5 lottery numbers from 49',
                'Generating a 4-digit PIN',
                'Ordering tasks in a queue',
              ],
              1,
              ['sk-combinatorics'],
              'Lottery numbers are a set — drawing 3 then 7 is the same ticket as 7 then 3.',
            ),
            numeric(
              'How many distinct 3-character strings can be made from an alphabet of 10 characters, with repetition allowed?',
              1000,
              ['sk-combinatorics'],
              '10³ = 1000 by the product rule. Each position is an independent choice.',
            ),
            concept(
              'The pigeonhole principle',
              'Put n+1 items into n containers and some container holds at least two. It is close to embarrassingly obvious, and it proves things that are not obvious at all.\n\nIt is what makes **hash collisions inevitable**. A hash function maps an unbounded set of inputs to a finite set of digests, so by pigeonhole some inputs must collide. This is not a flaw to be engineered away — it is arithmetic. Everything hashing does is about making collisions *hard to find*, never about preventing them.\n\nIt is also the argument behind the pumping lemma from the theory track: a machine with k states, fed a longer string, must revisit a state.\n\nAnd it bounds **lossless compression**. There are fewer short strings than long ones, so no algorithm can compress every input — some inputs must get longer. Any compressor that helps on real data does so because real data is not uniformly random.\n\nThe generalised form: n items in k containers forces some container to hold at least ⌈n/k⌉. With 100 items in 7 buckets, some bucket has at least 15.',
              {
                keyTerms: [
                  { term: 'Pigeonhole principle', definition: 'More items than containers forces at least one container to hold several.' },
                ],
              },
            ),
            mcq(
              'What does the pigeonhole principle establish about hash functions?',
              [
                'That good hash functions have no collisions',
                'That collisions are unavoidable, since infinitely many inputs map to finitely many digests',
                'That hashing is reversible',
                'That longer digests are always faster',
              ],
              1,
              ['sk-pigeonhole'],
              'The goal is never preventing collisions; it is making them computationally infeasible to find.',
            ),
            numeric(
              'If 100 items are distributed among 7 buckets, at least how many items must some bucket contain?',
              15,
              ['sk-pigeonhole'],
              '⌈100/7⌉ = 15. Even perfectly even distribution cannot do better.',
            ),
          ],
        }),
        lesson({
          id: 'lesson-graphs-modular',
          title: 'Graphs, Modular Arithmetic, and Recurrences',
          summary: 'Three tools that show up constantly once you can name them.',
          level: 'intermediate',
          domain: 'computer-science',
          steps: [
            concept(
              'Graph vocabulary you need',
              'The DSA track used graphs as a data structure. The vocabulary is worth having precisely, because it is how problems get communicated.\n\nA graph is vertices and edges. Edges may be **directed** or not, **weighted** or not.\n\n**Degree** — how many edges touch a vertex. In a directed graph, in-degree and out-degree separately.\n\n**Path** — a sequence of vertices connected by edges. A **cycle** returns to its start.\n\n**Connected** — every vertex reachable from every other. A directed graph is **strongly connected** if that holds respecting direction.\n\n**Tree** — connected and acyclic. Always exactly n−1 edges for n vertices, and exactly one path between any two vertices. Both facts are proved by induction.\n\n**DAG** — directed acyclic graph. Admits a **topological order**, which is why build systems, task schedulers, and dependency resolvers are all the same problem. When one reports a cycle, it is reporting that no valid order exists.\n\n**Bipartite** — vertices split into two sets with edges only between them. Users and items in a recommender; jobs and machines in an assignment problem.\n\nTwo useful facts: the sum of all degrees is twice the number of edges (each edge contributes two endpoints), so the number of odd-degree vertices is always even.',
              {
                keyTerms: [
                  { term: 'DAG', definition: 'A directed graph with no cycles, admitting a topological ordering.' },
                  { term: 'Bipartite graph', definition: 'Vertices split in two, with edges only crossing between the halves.' },
                ],
              },
            ),
            numeric(
              'A tree has 12 vertices. How many edges does it have?',
              11,
              ['sk-graph-theory'],
              'Always n−1. Adding any edge creates a cycle; removing any disconnects it.',
            ),
            mcq(
              'A build system reports it cannot determine a build order. What has it found?',
              [
                'A bipartite graph',
                'A cycle in the dependency graph, so no topological order exists',
                'Too many vertices',
                'A disconnected graph',
              ],
              1,
              ['sk-graph-theory'],
              'Topological ordering exists exactly for DAGs. A cycle means the dependencies are mutually blocking.',
            ),
            concept(
              'Modular arithmetic: clock maths',
              '`a mod n` is the remainder after dividing by n. Arithmetic "wraps" at n — which is why it is called clock arithmetic: 10 o’clock plus 4 hours is 2 o’clock, because 14 mod 12 = 2.\n\nThe property that makes it useful is that it **distributes over arithmetic**:\n\n```\n(a + b) mod n = ((a mod n) + (b mod n)) mod n\n(a × b) mod n = ((a mod n) × (b mod n)) mod n\n```\n\nSo you can reduce as you go and never let intermediate values overflow. Every hash function and every big-number cryptographic routine depends on exactly this.\n\nWhere it appears in practice:\n\n- **Hash table buckets**: `hash(key) mod table_size`.\n- **Consistent hashing** for sharding across nodes.\n- **Cyclic buffers**: `index = (index + 1) mod capacity`.\n- **Checksums** like Luhn and ISBN.\n- **RSA**, which is modular exponentiation and rests on factoring being hard.\n\nOne language trap worth knowing: for negative operands, Python’s `%` returns a non-negative result while C and Java return a value with the dividend’s sign. `-7 % 3` is 2 in Python and −1 in Java. Mixing the two conventions produces off-by-one bugs in ring buffers that are unpleasant to find.',
              {
                keyTerms: [
                  { term: 'Modulo', definition: 'The remainder after division, wrapping values into a fixed range.' },
                ],
              },
            ),
            numeric(
              'What is (17 × 23) mod 5?',
              1,
              ['sk-modular-arithmetic'],
              '17 mod 5 = 2, 23 mod 5 = 3, 2 × 3 = 6, 6 mod 5 = 1. Reducing first avoids computing 391.',
            ),
            mcq(
              'Why can you reduce intermediate values mod n during a long calculation?',
              [
                'It is an approximation that is close enough',
                'Modular arithmetic distributes over addition and multiplication, so the final result is unchanged',
                'It only works for prime n',
                'It rounds toward zero',
              ],
              1,
              ['sk-modular-arithmetic'],
              'Exact, not approximate — which is what keeps cryptographic and hashing code free of overflow.',
            ),
            concept(
              'Recurrences: the cost of a recursive algorithm',
              'A **recurrence relation** defines a value in terms of smaller cases. `T(n) = T(n−1) + 1` with `T(1) = 1` gives `T(n) = n`.\n\nThis is how you get the complexity of a recursive algorithm — you write down what one call costs plus what the recursive calls cost, and solve.\n\nThe ones you will meet constantly:\n\n| Recurrence | Solution | Where |\n|---|---|---|\n| T(n) = T(n−1) + O(1) | O(n) | Linear recursion |\n| T(n) = T(n/2) + O(1) | O(log n) | Binary search |\n| T(n) = 2T(n/2) + O(n) | O(n log n) | Merge sort |\n| T(n) = 2T(n−1) + O(1) | O(2ⁿ) | Naive Fibonacci, Hanoi |\n\nThe **master theorem** handles the common divide-and-conquer form `T(n) = aT(n/b) + f(n)` by comparing f(n) against n^(log_b a): whichever dominates determines the answer, and if they match you pick up a log factor.\n\nMerge sort is the case worth internalising. There are log n levels of recursion, each doing O(n) total merging work, hence O(n log n) — and that argument is the whole proof, not a mnemonic.\n\nRecurrences are also where **dynamic programming** comes from. Naive Fibonacci is `T(n) = T(n−1) + T(n−2)`, which is exponential because subproblems are recomputed. Memoising makes each subproblem cost O(1) once, collapsing it to O(n). Same recurrence, different evaluation strategy, exponential difference.',
              {
                keyTerms: [
                  { term: 'Recurrence relation', definition: 'A definition of a value in terms of smaller instances of itself.' },
                  { term: 'Master theorem', definition: 'A rule solving divide-and-conquer recurrences by comparing split cost to combine cost.' },
                ],
              },
            ),
            match(
              'Match each recurrence to its solution.',
              [
                { left: 'T(n) = T(n/2) + O(1)', right: 'O(log n)' },
                { left: 'T(n) = T(n−1) + O(1)', right: 'O(n)' },
                { left: 'T(n) = 2T(n/2) + O(n)', right: 'O(n log n)' },
                { left: 'T(n) = 2T(n−1) + O(1)', right: 'O(2ⁿ)' },
              ],
              ['sk-recurrence-relations'],
              'Halving gives logs; branching without shrinking gives exponentials.',
            ),
            mcq(
              'Why does memoising naive Fibonacci change O(2ⁿ) into O(n)?',
              [
                'It uses a faster formula',
                'Each distinct subproblem is computed once instead of being recomputed on every branch',
                'It avoids recursion',
                'It uses less memory',
              ],
              1,
              ['sk-recurrence-relations'],
              'There are only n distinct subproblems. The exponential came entirely from repetition.',
            ),
            shortAnswer(
              'Explain why merge sort is O(n log n), using its recurrence.',
              ['recurrence', 'levels', 'log', 'merge', 'linear'],
              'Merge sort satisfies T(n) = 2T(n/2) + O(n): it splits the input in half, sorts each half recursively, then merges in linear time. Halving repeatedly gives log₂ n levels of recursion, and at every level the total merging work across all the subproblems is O(n), since together they cover the whole input. Multiplying the per-level cost by the number of levels gives O(n log n).',
              ['sk-recurrence-relations'],
              'log n levels, O(n) work per level. That product is the entire argument.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-dm-2',
        title: 'Counting and Structure Checkpoint',
        passingScore: 0.7,
        exercises: [
          numeric(
            'How many ways can you choose 2 items from 8, where order does not matter?',
            28,
            ['sk-combinatorics'],
            'C(8,2) = 8·7/2 = 28.',
          ),
          mcq(
            'What does the pigeonhole principle prove about lossless compression?',
            [
              'Every file can be compressed',
              'No algorithm compresses every input — some inputs must get longer',
              'Compression is always lossy',
              'Compression ratio is bounded by 2:1',
            ],
            1,
            ['sk-pigeonhole'],
            'There are fewer short strings than long ones, so the mapping cannot be injective downward.',
          ),
          mcq(
            'T(n) = 2T(n/2) + O(n) solves to what?',
            ['O(n)', 'O(n log n)', 'O(n²)', 'O(2ⁿ)'],
            1,
            ['sk-recurrence-relations'],
            'log n levels, O(n) per level — merge sort.',
          ),
        ],
      },
    },
  ],
};
