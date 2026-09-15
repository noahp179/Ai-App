/**
 * Track 17 — Data Structures & Algorithms.
 *
 * The first track here that is not about AI. It earns its place twice over:
 * the ML engineering path runs straight into complexity analysis the moment
 * anyone asks why a nested loop over a million rows is a bad idea, and the
 * people arriving from outside software need somewhere to learn this that does
 * not assume a degree.
 *
 * Bias throughout: cost first, structures second, algorithms third. Knowing
 * what a hash table *costs* is more useful more often than knowing how to
 * implement one.
 */

import type { Track } from '../../domain/types';
import { categorize, codeOutput, codeWrite, concept, fill, interactive, lesson, match, mcq, multi, numeric, order, shortAnswer, trueFalse } from '../builders';

export const dsaTrack: Track = {
  id: 'track-dsa',
  title: 'Data Structures & Algorithms',
  tagline: 'What things cost, and why it matters at scale',
  description:
    'The computer-science core, taught as a cost model rather than a catalogue. Big-O from first principles, the structures every language ships, and the four ways to design an algorithm — with enough hands-on work that the numbers on screen are ones you produced.',
  domain: 'computer-science',
  level: 'intro',
  icon: '🧮',
  gradient: ['#22C55E', '#0EA5E9'],
  prerequisites: [],
  outcomes: [
    'Read a piece of code and state its time and space complexity',
    'Choose the right structure for an access pattern, and justify it',
    'Explain why a hash table is O(1) on average and O(n) at worst',
    'Traverse a graph and say when BFS beats DFS',
    'Recognise when a problem is dynamic programming and when greedy is enough',
  ],
  units: [
    // -----------------------------------------------------------------------
    {
      id: 'unit-dsa-1',
      title: 'Measuring Cost',
      description: 'Before any data structure: how to say what something costs.',
      lessons: [
        lesson({
          id: 'lesson-big-o',
          title: 'Big-O From First Principles',
          summary: 'Not a grade. A statement about what happens when the input grows.',
          level: 'intro',
          domain: 'computer-science',
          free: true,
          steps: [
            concept(
              'Count the operations, then throw most of it away',
              'Timing code tells you about your laptop. **Big-O** tells you about the algorithm.\n\nThe method is simple: count how many basic operations run as a function of the input size `n`, then keep only the term that grows fastest and drop its coefficient.\n\n`3n² + 500n + 9000` becomes **O(n²)**.\n\nThat looks like vandalism. It is deliberate, and the justification is that at `n = 1,000,000` the `n²` term is 3 × 10¹² and everything else is a rounding error. The dropped parts decide which is faster *today, on this machine*; the surviving term decides which is faster *as the input grows*, on every machine, forever.\n\nThe ranking worth memorising, best to worst:\n\n**O(1)** → **O(log n)** → **O(n)** → **O(n log n)** → **O(n²)** → **O(2ⁿ)** → **O(n!)**\n\nThe gaps are not even. Between O(n) and O(n²) is the difference between a job finishing and a job never finishing. Between O(n log n) and O(n²) is the difference between sorting a million records in a second and sorting them over a weekend.',
              {
                keyTerms: [
                  { term: 'Big-O', definition: 'An upper bound on growth rate as input size increases, ignoring constants.' },
                  { term: 'n', definition: 'The size of the input — rows, characters, nodes, whatever is being scaled.' },
                ],
              },
            ),
            mcq(
              'An algorithm runs `2n³ + 1000n² + 50000` operations. What is its complexity?',
              ['O(1000n²)', 'O(n³)', 'O(2n³)', 'O(n³ + n²)'],
              1,
              ['sk-big-o'],
              'Keep the fastest-growing term, drop the coefficient: O(n³). The 1000n² looks intimidating and is irrelevant — at n = 10,000 it contributes 0.005% of the total.',
              'Which term wins as n gets very large?',
            ),
            interactive(
              'Watch the constant stop mattering',
              'big-o-explorer',
              'Give the O(n log n) algorithm a 200× constant penalty so it starts out far slower. Then drag n upward and find the crossover — past it the slower-per-step algorithm wins permanently, and by a widening margin. That crossover is the whole argument for asymptotic analysis.',
            ),
            numeric(
              'An O(n²) algorithm takes 4 seconds on 1,000 items. Roughly how many seconds on 10,000 items?',
              400,
              ['sk-big-o'],
              '10× the input means 10² = 100× the work: about 400 seconds. This is the arithmetic worth being able to do in your head — it turns "it is a bit slow" into "it will take seven minutes, and 11 hours at 100,000".',
              { tolerance: 1, unit: 's' },
            ),
            order(
              'Order these from fastest-growing to slowest-growing.',
              ['O(2ⁿ)', 'O(n²)', 'O(n log n)', 'O(n)', 'O(log n)', 'O(1)'],
              ['sk-big-o'],
              'Exponential dominates everything polynomial; among polynomials the exponent decides; logarithms grow slower than any positive power of n; constant does not grow at all.',
            ),
            trueFalse(
              'An O(n²) algorithm can beat an O(n) one on small inputs.',
              true,
              ['sk-big-o'],
              'Routinely. Big-O describes growth, not speed, and says nothing about the constants that dominate at small n. This is exactly why production sort implementations fall back to insertion sort below about 16 elements despite it being O(n²).',
            ),
          ],
        }),

        lesson({
          id: 'lesson-complexity-analysis',
          title: 'Reading a Loop’s Cost',
          summary: 'Analysing real code — nested loops, recursion, memory, and amortised cost.',
          level: 'intermediate',
          domain: 'computer-science',
          steps: [
            concept(
              'Four rules cover almost everything',
              '**Sequential statements add.** Two O(n) loops one after another is O(n) + O(n) = O(2n) = **O(n)**. A common misreading is that two passes are "twice as bad" in a way big-O cares about. It is not.\n\n**Nested loops multiply.** A loop over n containing a loop over n is **O(n²)**. A loop over n containing a loop over m is **O(nm)** — and keeping those separate matters, because n and m are often wildly different sizes.\n\n**Halving the search space is logarithmic.** Any loop where the range shrinks by a constant factor each step runs O(log n) times. Doubling does the same in reverse: the number of doublings to reach n is log₂ n.\n\n**Take the worst case, unless you say otherwise.** Big-O is a ceiling. `O` is the worst case, `Θ` (theta) is the tight bound when best and worst agree, and `Ω` (omega) is the floor. Papers are precise about this; most engineering conversation says "O" and means "the bad case".\n\nOne trap worth naming: **a loop that looks O(n) can hide an O(n) operation inside it.** Building a string by concatenation inside a loop copies the whole string each time, so the innocent-looking loop is O(n²). Same for `list.insert(0, x)` in a loop, or `x in some_list` on a list rather than a set.',
              {
                keyTerms: [
                  { term: 'Worst case', definition: 'The input that makes the algorithm do the most work. Big-O’s default.' },
                  { term: 'Θ (theta)', definition: 'A tight bound — the algorithm is both O(f) and Ω(f).' },
                ],
              },
            ),
            codeOutput(
              'What is the time complexity of this function?',
              'python',
              `def f(rows, targets):
    found = []
    for r in rows:          # n rows
        for t in targets:   # m targets
            if r == t:
                found.append(r)
    return found`,
              ['O(n)', 'O(n + m)', 'O(n × m)', 'O(n log m)'],
              2,
              ['sk-complexity-analysis'],
              'Nested loops multiply: O(n × m). Worth knowing the fix, because it is the single most common performance bug in data code — put `targets` in a set and the inner loop becomes an O(1) lookup, making the whole thing O(n + m).',
            ),
            mcq(
              'A loop halves its search range each iteration, starting from n. How many iterations does it run?',
              ['n / 2', 'log₂ n', '√n', 'n'],
              1,
              ['sk-complexity-analysis'],
              'log₂ n. At n = 1,000,000 that is about 20 iterations — the reason binary search over a million sorted records feels instant, and the reason balanced trees are worth the bookkeeping.',
            ),
            concept(
              'Space, and the trade you are always making',
              '**Space complexity** counts memory the same way time complexity counts operations, and it usually means *auxiliary* space — extra memory beyond the input.\n\nMerge sort is O(n log n) time and **O(n)** auxiliary space; quicksort is O(n log n) time and **O(log n)** space for its call stack. That difference is why quicksort is the in-place default and merge sort is the choice when stability matters or the data does not fit in memory.\n\nRecursion costs space even when nothing is allocated: every pending call holds a stack frame. A recursive function with depth n uses **O(n)** stack — which is why recursing once per element over a million-element list overflows the stack, and why the fix is either an explicit stack or an iterative rewrite.\n\nAnd then the trade that runs through the whole subject: **memory buys time.** A hash table is O(1) lookup instead of O(n) scanning, paid for with memory. Memoisation turns exponential into linear, paid for with a table. Database indexes turn full scans into lookups, paid for with disk and slower writes. Almost every optimisation you will make is this trade, made deliberately.',
              {
                keyTerms: [
                  { term: 'Auxiliary space', definition: 'Extra memory an algorithm needs beyond its input.' },
                ],
              },
            ),
            concept(
              'Amortised cost: the expensive step that is rare',
              'Appending to a dynamic array — a Python `list`, a Java `ArrayList`, a Go slice — is usually O(1). Occasionally the array is full, and then it allocates a bigger block and copies everything: **O(n)**.\n\nSo what is the cost of an append? Saying "O(n) worst case" is true and useless, because it happens once in a long while. **Amortised analysis** asks for the average cost per operation across a long sequence, and the answer is O(1).\n\nThe reason is the growth strategy. Implementations **double** the capacity rather than adding a fixed amount. Inserting n elements triggers copies at sizes 1, 2, 4, 8, … n, and those sum to about 2n — total O(n) copying across n appends, so **O(1) amortised** per append.\n\nChange doubling to "grow by 10" and the sum becomes O(n²). The constant-factor growth is not an implementation detail; it is the thing that makes the guarantee hold.\n\nAmortised is not the same as average-case. Average-case is a statement about random inputs; **amortised is a guarantee about any sequence of operations**, worst inputs included.',
              { keyTerms: [{ term: 'Amortised cost', definition: 'Average cost per operation over a sequence, guaranteed rather than probabilistic.' }] },
            ),
            mcq(
              'Why do dynamic arrays double their capacity rather than growing by a fixed amount?',
              [
                'Doubling uses less memory overall',
                'It makes the total copying work across n appends linear, so each append is O(1) amortised',
                'It avoids fragmentation',
                'Fixed growth is not possible in most languages',
              ],
              1,
              ['sk-amortised-analysis'],
              'Doubling makes the resize sizes a geometric series summing to about 2n. Fixed growth gives n/k resizes each copying O(n), which is O(n²) total — and the amortised guarantee evaporates.',
            ),
            multi(
              'Which of these quietly turn an O(n) loop into O(n²)? (Select all)',
              [
                'Building a result string with `s = s + item` inside the loop',
                'Checking `if x in my_list` where `my_list` is a list',
                'Checking `if x in my_set` where `my_set` is a set',
                'Calling `my_list.insert(0, x)` inside the loop',
              ],
              [0, 1, 3],
              ['sk-complexity-analysis', 'sk-space-complexity'],
              'String concatenation copies the accumulated string, list membership scans, and inserting at the front shifts every element — all O(n) inside an O(n) loop. Set membership is the O(1) one, and swapping a list for a set is often the entire fix.',
            ),
            numeric(
              'A recursive function calls itself once per list element, with no tail-call optimization. What is its auxiliary space complexity, expressed as the exponent of n (1 for O(n))?',
              1,
              ['sk-space-complexity'],
              'O(n) — one stack frame per pending call, so the exponent is 1. On a million-element list that is a million frames and a stack overflow, which is why deep recursion over data needs an explicit stack or an iterative rewrite.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-dsa-1',
        title: 'Complexity Checkpoint',
        passingScore: 0.7,
        exercises: [
          mcq(
            'What is the complexity of `5n log n + 200n`?',
            ['O(n)', 'O(n log n)', 'O(log n)', 'O(n²)'],
            1,
            ['sk-big-o'],
            'n log n grows faster than n, so it dominates; the coefficients go.',
          ),
          trueFalse(
            'Amortised O(1) allows an occasional expensive operation as long as the average stays constant.',
            true,
            ['sk-amortised-analysis'],
            'Appending to a dynamic array is the standard example: almost every append is O(1), and the occasional resize is O(n), but because resizes double the capacity they are rare enough that n appends cost O(n) in total. Amortised is a promise about the sequence, not about any single call.',
          ),
          numeric(
            'An O(n log n) sort handles 1,000 items in 10 ms. Roughly how many ms for 1,000,000 items? (Use log₂, and round to the nearest hundred.)',
            20000,
            ['sk-big-o'],
            'n grows 1,000×, and log₂ n goes from 10 to 20, so the work grows about 2,000× → roughly 20,000 ms, or 20 seconds. The same jump for an O(n²) sort would be 1,000,000× — about three hours.',
            { tolerance: 2000, unit: 'ms' },
          ),
        ],
      },
    },

    // -----------------------------------------------------------------------
    {
      id: 'unit-dsa-2',
      title: 'The Core Structures',
      description: 'Five structures that cover most of what you will ever need.',
      lessons: [
        lesson({
          id: 'lesson-arrays-lists',
          title: 'Arrays and Linked Lists',
          summary: 'Contiguous memory versus pointer-chasing — and why one usually wins.',
          level: 'intro',
          domain: 'computer-science',
          steps: [
            concept(
              'One block, or a chain of boxes',
              'An **array** is one contiguous block of memory. Element `i` lives at `start + i × size`, so reading any element is arithmetic: **O(1)**, regardless of position or length.\n\nThe cost is rigidity. Inserting or deleting in the middle shifts everything after it: **O(n)**. And the block has a fixed size, which is what dynamic arrays paper over with doubling and amortised O(1) appends.\n\nA **linked list** is nodes scattered anywhere in memory, each holding a value and a pointer to the next. Insertion and deletion are **O(1)** — rewire two pointers, nothing moves. Getting to element `i` means following i pointers: **O(n)**.\n\nOn paper linked lists look better for insert-heavy work. In practice they usually lose, for a reason big-O does not express: **cache locality**. Modern CPUs fetch memory in 64-byte lines and prefetch ahead. Walking an array is a stream the hardware predicts perfectly. Walking a linked list is a series of dependent, unpredictable jumps, each a potential cache miss costing ~100× a cache hit.\n\nSo the honest rule: **use the dynamic array.** Reach for a linked list when you specifically need O(1) splicing with a reference already in hand, or a structure that never invalidates its references — which is rarer than the textbook coverage suggests.',
              {
                keyTerms: [
                  { term: 'Random access', definition: 'Reaching any element in O(1). Arrays have it; linked lists do not.' },
                  { term: 'Cache locality', definition: 'How well an access pattern suits the CPU’s memory hierarchy. Not visible in big-O.' },
                ],
              },
            ),
            match(
              'Match each operation to its complexity on a dynamic array.',
              [
                { left: 'Read element at index i', right: 'O(1)' },
                { left: 'Append to the end', right: 'O(1) amortised' },
                { left: 'Insert at the front', right: 'O(n)' },
                { left: 'Find a value by scanning', right: 'O(n)' },
              ],
              ['sk-arrays-lists'],
              'The front insert is the one that catches people: it shifts every element, so building a list by prepending in a loop is O(n²).',
            ),
            mcq(
              'Linked lists have O(1) insertion. Why are dynamic arrays still the usual default?',
              [
                'Linked lists use more total memory',
                'Cache locality — arrays are sequential and prefetchable, while pointer-chasing causes unpredictable cache misses',
                'Linked lists cannot store objects',
                'Insertion is rarely needed',
              ],
              1,
              ['sk-arrays-lists'],
              'The O(1) is real but assumes you already hold a reference to the insertion point — finding it is O(n). And the constant factor from cache misses is large enough that arrays routinely win even where the asymptotics favour lists.',
            ),
            trueFalse(
              'Appending n items to a dynamic array one at a time is O(n) total work.',
              true,
              ['sk-arrays-lists', 'sk-amortised-analysis'],
              'True, thanks to capacity doubling: the resize copies form a geometric series summing to about 2n. O(1) amortised per append, O(n) overall.',
            ),
          ],
        }),

        lesson({
          id: 'lesson-hash-tables',
          title: 'Hash Tables',
          summary: 'The structure that makes lookup feel free — and the conditions on that.',
          level: 'intermediate',
          domain: 'computer-science',
          steps: [
            concept(
              'A function from key to slot',
              'A hash table stores key–value pairs in an array of **buckets**. A **hash function** turns a key into a number, that number modulo the bucket count gives an index, and you go straight there. Insert, lookup and delete are all **O(1)**.\n\nThe catch is that different keys can hash to the same bucket — a **collision** — and with 1,000 buckets and 1,000 keys collisions are not a possibility, they are a certainty. Two standard resolutions:\n\n**Chaining.** Each bucket holds a list. Collisions append. Simple, degrades gracefully, costs pointer-chasing.\n\n**Open addressing.** On collision, probe for the next free slot (linear probing being the simplest). Everything stays in one contiguous array, so it is cache-friendly — but deletions need tombstones and performance falls off a cliff as the table fills.\n\nThe number that governs all of it is the **load factor** α = entries / buckets. Below about 0.7 probe counts stay flat and small; above it they climb sharply. Every real implementation watches α and **resizes** — allocating a bigger array and rehashing everything — before it gets there.\n\nSo the honest statement of the complexity: **O(1) average, O(n) worst case.** The worst case is every key colliding, which good hash functions make vanishingly unlikely for ordinary data but which an attacker who knows your hash function can cause deliberately — the reason languages now seed their hashes randomly per process.',
              {
                keyTerms: [
                  { term: 'Load factor', definition: 'Entries divided by buckets. The single number that predicts probe cost.' },
                  { term: 'Collision', definition: 'Two distinct keys hashing to the same bucket.' },
                ],
              },
            ),
            interactive(
              'Fill it up and watch it degrade',
              'hash-table-probe',
              'Insert keys and watch the average and worst probe counts against the load factor. Keep going past 0.75 and see the worst case climb first — that gap between average and worst is exactly why implementations resize early rather than waiting until the table is full.',
            ),
            mcq(
              'Why is a hash table described as O(1) average but O(n) worst case?',
              [
                'Because resizing occasionally copies everything',
                'Because in the worst case every key collides into one bucket, turning lookup into a linear scan',
                'Because hashing itself takes O(n) on long keys',
                'Because deletion requires a full scan',
              ],
              1,
              ['sk-hash-tables'],
              'All keys in one bucket reduces the table to a list. Good hash functions make that astronomically unlikely by chance — but a deliberately chosen set of colliding keys was a real denial-of-service vector, which is why hash seeds are now randomised per process.',
            ),
            numeric(
              'A hash table has 64 buckets and 48 entries. What is its load factor, to two decimal places?',
              0.75,
              ['sk-hash-tables'],
              '48 / 64 = 0.75 — right at the threshold where most implementations trigger a resize. Past this point probe counts rise steeply and the worst case rises fastest.',
              { tolerance: 0.01 },
            ),
            multi(
              'Which are true of hash tables? (Select all)',
              [
                'Resizing requires rehashing every existing key',
                'Iteration order is generally not the insertion order',
                'Keys must be hashable and, in practice, immutable',
                'Lookup cost grows with the number of entries',
              ],
              [0, 1, 2],
              ['sk-hash-tables'],
              'Lookup cost depends on the *load factor*, not the entry count — a table with a million entries and two million buckets is as fast as one with ten. The mutability requirement is why you cannot use a list as a dict key in Python: mutate it and it hashes to a different bucket than the one it is sitting in.',
            ),
            fill(
              'A hash table resizes when its ___ factor crosses a threshold, because probe counts rise sharply beyond roughly ___.',
              [['load'], ['0.7', '0.75', '70%', '75%']],
              ['sk-hash-tables'],
              'Load factor, and around 0.7–0.75. The resize is O(n) but amortises to O(1) per insert, the same geometric argument as dynamic array growth.',
            ),
          ],
        }),

        lesson({
          id: 'lesson-stacks-queues-heaps',
          title: 'Stacks, Queues, and Heaps',
          summary: 'Three structures defined by which element you are allowed to take next.',
          level: 'intro',
          domain: 'computer-science',
          steps: [
            concept(
              'The restriction is the feature',
              'These three are all "a collection you add to and remove from". What distinguishes them is **which element comes out**, and that restriction is what makes each one useful.\n\n**Stack — last in, first out.** Push and pop at one end, both O(1). The call stack is one. So is undo history, bracket matching, and depth-first search — anywhere the most recent thing is the thing to deal with next.\n\n**Queue — first in, first out.** Enqueue at one end, dequeue at the other, both O(1) with the right implementation. Job queues, request buffers, and breadth-first search. Note that a naive array-backed queue that shifts on dequeue is O(n) — real queues use a ring buffer or a linked structure.\n\n**Heap — smallest (or largest) out first.** A **priority queue**: insert O(log n), remove-min O(log n), peek-min O(1). Implemented as a binary tree kept in an array, with the rule that every parent is smaller than its children. That rule is much weaker than full sorting, which is exactly why it is cheaper to maintain — and it is enough, because you only ever need the front.\n\nThe heap is the one worth dwelling on, because its cost profile is unusual and useful: **finding the minimum of a changing collection** would otherwise be O(n) every time. Dijkstra\'s algorithm, event simulation, top-k over a stream, and the scheduler in your operating system all rest on it.',
              {
                keyTerms: [
                  { term: 'LIFO / FIFO', definition: 'Last-in-first-out (stack) and first-in-first-out (queue).' },
                  { term: 'Heap property', definition: 'Every parent compares ≤ its children. Weaker than sorted, and far cheaper to maintain.' },
                ],
              },
            ),
            categorize(
              'Sort each task by the structure that fits it.',
              ['Stack', 'Queue', 'Heap'],
              [
                { item: 'Undo in a text editor', category: 'Stack' },
                { item: 'Checking that brackets are balanced', category: 'Stack' },
                { item: 'Serving print jobs in the order submitted', category: 'Queue' },
                { item: 'Breadth-first search frontier', category: 'Queue' },
                { item: 'Always processing the highest-priority alert next', category: 'Heap' },
                { item: 'Keeping the 10 largest values from a stream', category: 'Heap' },
              ],
              ['sk-stacks-queues', 'sk-heaps'],
              'The tell is always "which one do I need next": the most recent (stack), the oldest (queue), or the most extreme (heap).',
            ),
            mcq(
              'You need the smallest element of a collection that is constantly being added to. Which structure?',
              [
                'A sorted array, re-sorted after each insert',
                'A min-heap',
                'A hash table',
                'A queue',
              ],
              1,
              ['sk-heaps'],
              'A min-heap gives O(log n) insert and O(1) peek. Re-sorting is O(n log n) per insert, and a hash table has no notion of order at all. This exact requirement is why Dijkstra needs a priority queue.',
            ),
            numeric(
              'How many comparisons, at most, to insert into a heap holding 1,024 elements? (The tree height, using log₂.)',
              10,
              ['sk-heaps'],
              'log₂(1024) = 10. A new element bubbles up at most the height of the tree, and the tree stays balanced by construction because it is filled level by level.',
            ),
            trueFalse(
              'A heap orders each parent against its children and leaves siblings unordered.',
              true,
              ['sk-heaps'],
              'That weaker invariant is the whole point. Restoring a total order costs O(n log n); restoring the heap property costs O(log n) — and it is all you need when you only ever take from the front.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-dsa-2',
        title: 'Structures Checkpoint',
        passingScore: 0.7,
        exercises: [
          mcq(
            'Linked lists offer O(1) insertion. Why are dynamic arrays still the default?',
            [
              'Linked lists use more total memory',
              'Cache locality — arrays are sequential and prefetchable, pointer-chasing is not',
              'Linked lists cannot hold objects',
              'Insertion is rarely needed',
            ],
            1,
            ['sk-arrays-lists'],
            'The O(1) assumes you already hold the insertion point, and the constant factor from cache misses routinely outweighs the asymptotic advantage.',
          ),
          numeric(
            'A hash table has 32 buckets and 24 entries. What is its load factor, to two decimal places?',
            0.75,
            ['sk-hash-tables'],
            '24 / 32 = 0.75 — the threshold where most implementations resize, because probe counts climb steeply beyond it.',
            { tolerance: 0.01 },
          ),
          mcq(
            'You need the smallest element of a collection that keeps growing. Which structure?',
            ['A sorted array re-sorted on each insert', 'A min-heap', 'A hash table', 'A queue'],
            1,
            ['sk-heaps'],
            'O(log n) insert and O(1) peek. Re-sorting is O(n log n) per insert and a hash table has no order at all.',
          ),
        ],
      },
    },

    // -----------------------------------------------------------------------
    {
      id: 'unit-dsa-3',
      title: 'Trees and Graphs',
      description: 'Structures where the shape of the connections is the data.',
      lessons: [
        lesson({
          id: 'lesson-binary-search-trees',
          title: 'Binary Search and Trees',
          summary: 'Halving the problem, once as an algorithm and once as a structure.',
          level: 'intermediate',
          domain: 'computer-science',
          steps: [
            concept(
              'Binary search, and the invariant it depends on',
              'Look at the middle element of a **sorted** array. Too big? The answer is in the left half. Too small? The right. Repeat.\n\nEach step discards half the remaining candidates, so the search takes **O(log n)**. On a million sorted records that is 20 comparisons instead of a million — the difference between instant and noticeable.\n\nThe word doing the work is *sorted*. Binary search is not an algorithm you can apply to data; it is an algorithm you can apply to **an invariant you have already paid to maintain**. Sorting first costs O(n log n), so for a single lookup a linear scan is cheaper. For many lookups against the same data, sorting once and searching repeatedly wins decisively — and that trade is the entire argument for database indexes.\n\nTwo details that cause real bugs. The midpoint should be computed as `lo + (hi - lo) / 2` rather than `(lo + hi) / 2`, because the latter can overflow on large indices — a bug that sat in the JDK for nine years. And the loop bounds are genuinely fiddly; it is worth writing out whether `hi` is inclusive or exclusive before writing the loop rather than after.',
              {
                keyTerms: [
                  { term: 'Invariant', definition: 'A property maintained throughout — here, that the array stays sorted.' },
                ],
              },
            ),
            numeric(
              'How many comparisons does binary search need, at worst, on 1,000,000 sorted items?',
              20,
              ['sk-binary-search'],
              'log₂(1,000,000) ≈ 20. Each comparison halves the candidates: 1M → 500K → 250K → … → 1, which takes about twenty steps.',
              { tolerance: 1 },
            ),
            concept(
              'Trees: binary search as a structure',
              'A **binary search tree** turns that idea into a shape. Every node holds a value; everything in its left subtree is smaller, everything in its right subtree is larger. Search walks down from the root, going left or right at each node — the same halving, now on a structure that supports insertion without shifting anything.\n\nWhich gives O(log n) search, insert and delete — **provided the tree is balanced.**\n\nIt frequently is not. Insert sorted data into a plain BST and every node goes to the right of the last one: you have built a linked list with extra pointers, and every operation is **O(n)**. This is not a corner case; loading records in id order is the most natural thing in the world, and it produces exactly this degenerate tree.\n\nHence **self-balancing** trees. AVL and red-black trees detect imbalance during insertion and perform local **rotations** — rearranging a few nodes to restore height — so O(log n) holds for any insertion order. The details of the rotations matter if you implement one; what matters if you use one is that the guarantee is unconditional.\n\nThis is why `std::map`, Java\'s `TreeMap` and most database indexes are balanced trees (usually B-trees, a wider variant tuned for disk and cache lines) rather than hash tables: they give **ordered** traversal and range queries, which a hash table cannot do at any price.',
              {
                keyTerms: [
                  { term: 'Balanced tree', definition: 'One whose height stays O(log n) regardless of insertion order.' },
                  { term: 'Rotation', definition: 'A local rearrangement restoring balance without breaking the ordering invariant.' },
                ],
              },
            ),
            mcq(
              'You insert 1, 2, 3, …, 1000 in order into an unbalanced binary search tree. What have you built?',
              [
                'A perfectly balanced tree',
                'Effectively a linked list, with O(n) search',
                'A heap',
                'A tree of height log₂(1000)',
              ],
              1,
              ['sk-trees'],
              'Every value is larger than the last, so every node becomes the right child of its predecessor. Height 1000, search O(n) — and sorted input is common enough that this failure is the reason self-balancing trees exist.',
            ),
            mcq(
              'Why do databases index with B-trees rather than hash tables?',
              [
                'Hash tables use too much memory',
                'Trees keep keys in order, so range queries and sorted scans work; hash tables cannot do either',
                'Hash tables cannot store duplicate keys',
                'Trees are faster for single-key lookup',
              ],
              1,
              ['sk-trees'],
              'A hash table beats a tree on single-key lookup. It has no notion of order at all, so `WHERE date BETWEEN …` or `ORDER BY` gets no help from it — and those are most of what an index is asked to do.',
            ),
            trueFalse(
              'Binary search can be used on any array as long as you know the length.',
              false,
              ['sk-binary-search'],
              'It requires the array to be sorted on the key you are searching. Without that invariant, discarding half the range on each comparison discards the answer as often as not.',
            ),
            codeWrite({
              prompt:
                'Write binary search. Return the index of `target` in the sorted array `xs`, or −1 if it is not there.',
              functionName: 'binarySearch',
              starter:
                'function binarySearch(xs, target) {\n  let lo = 0;\n  let hi = xs.length - 1;\n\n  // Narrow the range until it is empty.\n\n  return -1;\n}',
              tests: [
                { args: [[1, 3, 5, 7, 9], 7], expected: 3 },
                { args: [[1, 3, 5, 7, 9], 1], expected: 0 },
                { args: [[1, 3, 5, 7, 9], 4], expected: -1 },
                { args: [[], 1], expected: -1 },
              ],
              hiddenTests: [
                { args: [[2], 2], expected: 0 },
                { args: [[2], 3], expected: -1 },
                { args: [[1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 10], expected: 9 },
                { args: [[-9, -4, 0, 3, 11], -4], expected: 1 },
              ],
              solution:
                'function binarySearch(xs, target) {\n  let lo = 0;\n  let hi = xs.length - 1;\n  while (lo <= hi) {\n    const mid = Math.floor((lo + hi) / 2);\n    if (xs[mid] === target) return mid;\n    if (xs[mid] < target) lo = mid + 1;\n    else hi = mid - 1;\n  }\n  return -1;\n}',
              skillIds: ['sk-binary-search'],
              explanation:
                'The three things that break implementations: the loop condition must be `lo <= hi` rather than `<`, or a single-element range is never examined; `mid` must be recomputed each pass; and both branches must move past `mid`, not to it, or the range stops shrinking and the loop never ends.',
              hint: 'Compare against the middle element, then discard the half that cannot contain the target.',
            }),
          ],
        }),

        lesson({
          id: 'lesson-graphs',
          title: 'Graphs and Traversal',
          summary: 'Nodes and edges — and the one-line difference between BFS and DFS.',
          level: 'expert',
          domain: 'computer-science',
          steps: [
            concept(
              'Two representations, and when each is right',
              'A **graph** is nodes joined by edges. Social networks, road maps, dependency graphs, web links, neural network topologies — anywhere relationships are the data rather than an attribute of it.\n\nTwo standard representations, and the choice is about density:\n\n**Adjacency list.** Each node holds a list of its neighbours. Space O(V + E). Finding a node\'s neighbours is O(degree). The default, because real graphs are overwhelmingly sparse — a social network with a billion users does not have a billion friends per user.\n\n**Adjacency matrix.** A V × V grid of booleans. Space O(V²), regardless of how few edges exist. Checking whether a specific edge exists is O(1), which is its one advantage, and it suits dense graphs and matrix-based algorithms.\n\nThe vocabulary worth having: **directed** (edges go one way — Twitter follows) versus **undirected** (mutual — Facebook friends); **weighted** (edges carry a cost — distance, latency) versus unweighted; **cyclic** versus **acyclic**. A **DAG** — directed acyclic graph — is the shape of build dependencies, task schedules and version histories, and it is the precondition for **topological sort**, which orders nodes so every edge points forward.',
              {
                keyTerms: [
                  { term: 'Adjacency list', definition: 'Per-node neighbour lists. O(V + E) space; the default for sparse graphs.' },
                  { term: 'DAG', definition: 'A directed graph with no cycles. What makes dependency ordering possible.' },
                ],
              },
            ),
            concept(
              'BFS and DFS differ by one data structure',
              'Both traversals do the same thing: keep a **frontier** of discovered-but-unexplored nodes, take one, mark it seen, push its unseen neighbours. The only difference is what "take one" means.\n\n**A queue → breadth-first search.** Explores in rings, all distance-1 nodes before any distance-2 node. Because of that ordering, **the first time BFS reaches a node it has found a shortest path** — in an unweighted graph. Space O(V) for the frontier, which on a wide graph can be large.\n\n**A stack → depth-first search.** Plunges down one path until it dead-ends, then backtracks. Cheaper on memory for deep graphs, natural to write recursively, and the basis of cycle detection and topological sort. It finds *a* path, usually not the shortest.\n\nBoth are **O(V + E)** — each node and edge handled once.\n\nAdd edge weights and BFS stops working, because the fewest edges is no longer the shortest distance. **Dijkstra\'s algorithm** fixes it by replacing the queue with a **min-heap** keyed on distance-so-far, always expanding the closest unfinished node: O((V + E) log V). And if edge weights can be negative, Dijkstra breaks too — Bellman-Ford handles that, more slowly.\n\nThe pattern is worth noticing: **queue, stack, priority queue — the same skeleton, three different algorithms.**',
            ),
            interactive(
              'Run both on the same maze',
              'graph-traversal',
              'Step BFS and watch it spread in rings; step DFS and watch it commit to a corridor. Count the expansions each needs, and compare the route each one returns — BFS gives the shortest path, DFS usually does not, and the only difference in the code is queue versus stack.',
            ),
            mcq(
              'Why does BFS find the shortest path in an unweighted graph while DFS does not?',
              [
                'BFS visits fewer nodes',
                'BFS explores all nodes at distance d before any at d + 1, so the first arrival is by a shortest route',
                'DFS cannot reach every node',
                'BFS uses a stack, which preserves order',
              ],
              1,
              ['sk-graph-traversal'],
              'The queue enforces exploration in order of distance. DFS commits to one branch and may reach a node by a long detour before ever seeing the short route. BFS often visits *more* nodes, which is the price of the guarantee.',
            ),
            match(
              'Match each frontier structure to the algorithm it produces.',
              [
                { left: 'Queue', right: 'Breadth-first search' },
                { left: 'Stack', right: 'Depth-first search' },
                { left: 'Min-heap keyed on distance', right: 'Dijkstra’s algorithm' },
                { left: 'Min-heap keyed on distance + heuristic', right: 'A* search' },
              ],
              ['sk-graph-traversal', 'sk-heaps'],
              'One skeleton, four algorithms. A* is Dijkstra with an admissible estimate of the remaining distance added to the priority, which focuses the search toward the goal.',
            ),
            mcq(
              'A graph has 1,000,000 nodes and about 3 edges each. Which representation should you use?',
              [
                'Adjacency matrix — O(1) edge checks',
                'Adjacency list — O(V + E) space instead of O(V²)',
                'Either; the space cost is similar',
                'A hash table of node pairs, for O(1) lookup',
              ],
              1,
              ['sk-graphs'],
              'The matrix would be 10¹² cells to hold 3 × 10⁶ edges — about 0.0003% occupied, and far beyond memory. Sparsity is the normal case, which is why adjacency lists are the default.',
            ),
            shortAnswer(
              'Why can Dijkstra’s algorithm not be replaced by BFS on a weighted graph?',
              ['weight', 'edges', 'shortest', 'distance', 'fewest', 'cost'],
              'Because BFS finds the path with the fewest edges, and on a weighted graph that is not the same as the lowest total cost. A two-edge route of weight 100 each is worse than a five-edge route of weight 1 each. Dijkstra expands by accumulated distance rather than edge count, which is why its frontier is a priority queue rather than a queue.',
              ['sk-graph-traversal'],
              'BFS is exactly Dijkstra on a graph where every edge has weight 1 — which is a nice way to remember why one generalises the other.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-dsa-3',
        title: 'Trees and Graphs Checkpoint',
        passingScore: 0.7,
        exercises: [
          numeric(
            'How many comparisons does binary search need, at worst, over 4,096 sorted items?',
            12,
            ['sk-binary-search'],
            'log₂(4096) = 12. Each comparison halves the remaining candidates.',
          ),
          mcq(
            'You insert already-sorted data into an unbalanced BST. What have you built?',
            ['A balanced tree', 'Effectively a linked list, with O(n) search', 'A heap', 'A trie'],
            1,
            ['sk-trees'],
            'Every value exceeds the last, so every node becomes a right child. Sorted input is common, which is why self-balancing trees exist.',
          ),
          mcq(
            'Why does BFS find a shortest path in an unweighted graph when DFS does not?',
            [
              'BFS visits fewer nodes',
              'It finishes every node at distance d before touching d + 1, so first arrival is by a shortest route',
              'DFS cannot reach every node',
              'BFS uses a stack',
            ],
            1,
            ['sk-graph-traversal'],
            'The queue enforces exploration in order of distance. BFS often visits more nodes — that is the price of the guarantee.',
          ),
        ],
      },
    },

    // -----------------------------------------------------------------------
    {
      id: 'unit-dsa-4',
      title: 'Designing Algorithms',
      description: 'Sorting, recursion, and the two techniques that turn exponential into fast.',
      lessons: [
        lesson({
          id: 'lesson-sorting',
          title: 'Sorting',
          summary: 'Why O(n log n) is a wall, and what you get by not comparing.',
          level: 'intermediate',
          domain: 'computer-science',
          steps: [
            concept(
              'The quadratic three, and the two that beat them',
              '**Bubble, insertion and selection sort** all work by repeatedly comparing nearby elements, and all do roughly n²/2 comparisons. At 32 elements that is about 500 operations; at 10,000 it is 50 million.\n\nThey are not useless. **Insertion sort is genuinely excellent on nearly-sorted input** — it does about n comparisons when the data is almost in order — and its constant factor is tiny, which is why production sorts switch to it below about 16 elements.\n\n**Merge sort** splits the array in half, sorts each half recursively, and merges the two sorted halves in one linear pass. O(n log n) always — best, average and worst — and **stable**, meaning equal elements keep their original relative order. It needs O(n) extra space, and it is the natural choice when the data does not fit in memory, because merging is sequential.\n\n**Quicksort** picks a pivot, partitions everything around it, and recurses on both sides. O(n log n) average, in-place, with a smaller constant than merge sort — usually the fastest in practice. Its worst case is O(n²) when the pivot is consistently terrible, which a sorted array plus a naive first-element pivot produces exactly. Random or median-of-three pivots make that vanishingly unlikely.\n\nWhat your language actually ships is a hybrid: **Timsort** (Python, Java objects) exploits existing runs and falls back to insertion sort on small pieces; **introsort** (C++) runs quicksort and switches to heapsort if the recursion gets too deep, capping the worst case.',
              {
                keyTerms: [
                  { term: 'Stable sort', definition: 'Preserves the relative order of equal elements. Required for multi-key sorting.' },
                  { term: 'In-place', definition: 'Uses O(1) or O(log n) extra space rather than a second array.' },
                ],
              },
            ),
            interactive(
              'Count the comparisons yourself',
              'sorting-visualizer',
              'Run each algorithm on the same array and watch the comparison counter, not the bars. Then reshuffle until you get a nearly-sorted array and step insertion sort — it finishes in almost n comparisons, which is exactly why real library sorts fall back to it.',
            ),
            concept(
              'The O(n log n) lower bound, and how to get under it',
              'No comparison-based sort can beat O(n log n), and the proof is short enough to carry around.\n\nThere are n! possible orderings of n items. Each comparison has two outcomes, so k comparisons can distinguish at most 2ᵏ cases. To identify one ordering out of n! you need 2ᵏ ≥ n!, so k ≥ log₂(n!), which is Θ(n log n).\n\nThat is a statement about *information*, not about cleverness — no future algorithm will beat it while it only ever compares elements.\n\nThe escape is to stop comparing. **Counting sort** tallies occurrences of each value and rebuilds the array: **O(n + k)** for values in a range of size k. Sorting a million ages runs in about a million operations. **Radix sort** extends this to larger keys, digit by digit, and is what sorts fixed-width integers and strings fastest.\n\nThe catch is the range. Counting sort on 32-bit integers needs a 4-billion-entry tally array, so the technique lives or dies on k being small relative to n. It is the same trade as everywhere else in this track: **memory buys time.**',
            ),
            mcq(
              'Why can no comparison-based sort be faster than O(n log n)?',
              [
                'Because comparisons are slow',
                'There are n! orderings and each comparison halves the possibilities, so log₂(n!) = Θ(n log n) comparisons are needed',
                'Because of cache misses',
                'Because recursion has overhead',
              ],
              1,
              ['sk-sorting'],
              'It is an information-theoretic bound, not an engineering one. Counting and radix sort get under it precisely by not comparing — they use the values themselves as indices.',
            ),
            categorize(
              'Sort each property by the algorithm it describes.',
              ['Merge sort', 'Quicksort', 'Insertion sort'],
              [
                { item: 'O(n log n) in the worst case, guaranteed', category: 'Merge sort' },
                { item: 'Stable, and the usual choice for external sorting', category: 'Merge sort' },
                { item: 'In-place with the smallest constant factor in practice', category: 'Quicksort' },
                { item: 'O(n²) worst case on an unlucky pivot choice', category: 'Quicksort' },
                { item: 'Nearly O(n) on almost-sorted input', category: 'Insertion sort' },
              ],
              ['sk-sorting'],
              'No single algorithm wins on every axis, which is why the standard library ships a hybrid rather than a textbook implementation.',
            ),
            trueFalse(
              'Counting sort violates the O(n log n) lower bound for sorting.',
              false,
              ['sk-sorting'],
              'It does not violate the bound; it sits outside its scope. The bound applies only to algorithms that learn about the data through comparisons, and counting sort uses values directly as array indices.',
            ),
          ],
        }),

        lesson({
          id: 'lesson-recursion-dp',
          title: 'Recursion, Divide and Conquer, and DP',
          summary: 'The same subproblem solved a million times — and the one-line fix.',
          level: 'expert',
          domain: 'computer-science',
          steps: [
            concept(
              'Recursion is a base case plus a smaller version',
              'A recursive function has two parts: a **base case** that returns without recursing, and a **recursive case** that solves a smaller instance of the same problem. Miss the base case and you get a stack overflow; fail to actually shrink the problem and you get the same.\n\n**Divide and conquer** is the productive pattern: split the problem into independent subproblems, solve each recursively, combine. Merge sort splits in half and merges. Quicksort partitions and recurses. Binary search discards half.\n\nThe cost usually follows a recurrence. `T(n) = 2T(n/2) + O(n)` — two halves plus a linear merge — resolves to **O(n log n)**: log n levels of recursion, each doing O(n) total work. Drawing the recursion tree and asking "how many levels, and how much work per level" answers most of these without any formal machinery.\n\nAnd remember the space: recursion depth is stack. Depth log n is fine; depth n over a large collection is a crash waiting for the right input.',
              {
                keyTerms: [
                  { term: 'Base case', definition: 'The input small enough to answer without recursing.' },
                  { term: 'Recurrence', definition: 'An equation expressing a problem’s cost in terms of its subproblems.' },
                ],
              },
            ),
            codeOutput(
              'How many times is `fib(2)` evaluated when computing `fib(6)` with this code?',
              'python',
              `def fib(n):
    if n <= 1:
        return n
    return fib(n - 1) + fib(n - 2)`,
              ['1', '3', '5', '8'],
              2,
              ['sk-recursion'],
              'Five times. The call tree recomputes the same subproblems over and over — fib(30) evaluates fib(2) over 800,000 times. The work is O(2ⁿ) for a function whose answer needs only n additions, and that gap is exactly what memoisation closes.',
            ),
            concept(
              'Dynamic programming: stop recomputing',
              'Naive `fib` is exponential not because the problem is hard but because it **solves the same subproblems repeatedly**. Two conditions make a problem a dynamic programming problem:\n\n**Overlapping subproblems** — the same smaller instances recur.\n**Optimal substructure** — an optimal solution is built from optimal solutions to its subproblems.\n\nWhen both hold, there are two ways to exploit it, and they compute the same thing:\n\n**Memoisation (top-down).** Keep the recursion, cache each result, return the cache on a repeat. Usually a decorator or three lines. `fib` goes from O(2ⁿ) to **O(n)** — each value computed once — and it is one of the most dramatic changes you can make to a program without changing its logic.\n\n**Tabulation (bottom-up).** Drop the recursion; fill a table from the smallest subproblem upward. Same complexity, no stack depth, and it usually allows a space optimisation: `fib` only ever needs the previous two values, so the O(n) table collapses to **O(1)**.\n\nThe classic examples are worth recognising by shape: longest common subsequence (diffs), edit distance (spell-check, DNA alignment), knapsack (allocation under a budget), and — relevant here — the alignment algorithms underneath sequence models.\n\n**Greedy** algorithms are the neighbouring idea: take the locally best option and never reconsider. When it works it is faster and simpler than DP — Dijkstra is greedy, so is Huffman coding, so is making change with ordinary coin systems. When it does not work it fails silently, returning a plausible non-optimal answer. Coins of 1, 3 and 4 making 6: greedy takes 4 + 1 + 1 = three coins; optimal is 3 + 3 = two. **Greedy needs a proof, not a hunch.**',
              {
                keyTerms: [
                  { term: 'Memoisation', definition: 'Caching subproblem results so each is computed once.' },
                  { term: 'Optimal substructure', definition: 'Optimal solutions are composed of optimal sub-solutions.' },
                ],
              },
            ),
            mcq(
              'Adding memoisation to naive recursive Fibonacci changes its complexity from what to what?',
              ['O(n²) to O(n)', 'O(2ⁿ) to O(n)', 'O(n) to O(log n)', 'O(2ⁿ) to O(n log n)'],
              1,
              ['sk-dynamic-programming'],
              'Exponential to linear. Each of the n subproblems is computed once instead of being recomputed across a branching call tree — a cache turning an intractable function into an instant one.',
            ),
            multi(
              'Which indicate that a problem is a candidate for dynamic programming? (Select all)',
              [
                'The same subproblems recur across the recursion tree',
                'An optimal solution is built from optimal solutions to subproblems',
                'The input is sorted',
                'A naive recursive solution is exponential but the answer space is small',
              ],
              [0, 1, 3],
              ['sk-dynamic-programming'],
              'Overlapping subproblems and optimal substructure are the two formal conditions, and the third option is the practical smell that they hold. Sortedness is unrelated — that is the signal for binary search or a two-pointer sweep.',
            ),
            mcq(
              'With coin denominations 1, 3, and 4, how does a greedy "take the largest coin first" strategy do on the amount 6?',
              [
                'It finds the optimal 2-coin solution',
                'It returns 3 coins (4 + 1 + 1) where 2 (3 + 3) is optimal',
                'It fails to find any solution',
                'It is optimal but slower than dynamic programming',
              ],
              1,
              ['sk-greedy'],
              'Greedy commits to the 4 and then cannot do better than two 1s. It returns a valid, plausible, wrong answer with no warning — which is why greedy correctness has to be proved for the specific problem rather than assumed because it worked on the examples you tried.',
            ),
            shortAnswer(
              'Why is memoisation described as trading space for time?',
              ['memory', 'cache', 'store', 'table', 'space', 'recompute'],
              'Because it stores every subproblem result instead of recomputing it. The table costs O(number of distinct subproblems) in memory, and in exchange each subproblem is solved exactly once rather than once per path that reaches it — turning exponential recomputation into linear work.',
              ['sk-dynamic-programming', 'sk-space-complexity'],
              'The same trade as hash tables, database indexes and precomputed embeddings: memory bought time, deliberately.',
            ),
            codeWrite({
              prompt:
                'Write `fib(n)` so it returns the nth Fibonacci number — fib(0) = 0, fib(1) = 1 — and is fast enough for n = 60. A plain recursion will time out; memoise it.',
              functionName: 'fib',
              starter:
                'function fib(n, memo = {}) {\n  // Base cases first, then check the memo\n  // before doing any work.\n\n  return 0;\n}',
              tests: [
                { args: [0], expected: 0 },
                { args: [1], expected: 1 },
                { args: [10], expected: 55 },
                { args: [60], expected: 1548008755920, label: 'fib(60) → 1548008755920 (fast)' },
              ],
              hiddenTests: [
                { args: [2], expected: 1 },
                { args: [7], expected: 13 },
                { args: [50], expected: 12586269025 },
              ],
              solution:
                'function fib(n, memo = {}) {\n  if (n <= 1) return n;\n  if (memo[n] !== undefined) return memo[n];\n  memo[n] = fib(n - 1, memo) + fib(n - 2, memo);\n  return memo[n];\n}',
              skillIds: ['sk-dynamic-programming', 'sk-recursion'],
              explanation:
                'The naive version recomputes fib(50) tens of millions of times; the memo makes each of the n subproblems cost O(1) after the first, which is the whole of dynamic programming in four lines. Note that fib(60) finishing instantly is itself the test — correctness alone would pass without the memo, eventually, some time next week.',
              hint: 'Check the memo before recursing, and write to it before returning.',
            }),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-dsa-4',
        title: 'Algorithms Checkpoint',
        passingScore: 0.7,
        exercises: [
          mcq(
            'Which sort is stable and O(n log n) in the worst case?',
            ['Quicksort', 'Merge sort', 'Selection sort', 'Heapsort'],
            1,
            ['sk-sorting'],
            'Merge sort. Quicksort is neither stable nor worst-case O(n log n); heapsort is O(n log n) but not stable.',
          ),
          mcq(
            'Which frontier structure turns a graph traversal into Dijkstra’s algorithm?',
            ['A queue', 'A stack', 'A min-heap keyed on distance', 'A hash set'],
            2,
            ['sk-graph-traversal', 'sk-heaps'],
            'Always expanding the closest unfinished node is what makes it handle weights — and needing the minimum of a changing set is exactly what a heap is for.',
          ),
          trueFalse(
            'A greedy algorithm that produces optimal answers on your test cases is proven correct.',
            false,
            ['sk-greedy'],
            'Greedy failures are silent and input-specific — the coin system 1, 3, 4 breaks it at the amount 6. Correctness needs an argument, not a sample.',
          ),
        ],
      },
    },
  ],
};
