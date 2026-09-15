/**
 * Track 18 — Systems & Performance.
 *
 * The track the rest of the curriculum kept gesturing at. DSA teaches what an
 * algorithm costs in operations; this teaches why two algorithms with the same
 * operation count can differ by 50× on real hardware, and why the fix for a
 * slow program is usually structural rather than algorithmic.
 */

import type { Track } from '../../domain/types';
import { categorize, codeOutput, concept, fill, interactive, lesson, match, mcq, multi, numeric, order, shortAnswer, trueFalse } from '../builders';

export const systemsTrack: Track = {
  id: 'track-systems',
  title: 'Systems & Performance',
  tagline: 'Why the same code runs at two very different speeds',
  description:
    'Memory, concurrency, and the gap between what an algorithm costs on paper and what it costs on a machine. The layer that explains why training is slow, where GPUs fit, and why "just add threads" so often makes things worse.',
  domain: 'systems',
  level: 'intermediate',
  icon: '⚡',
  gradient: ['#F59E0B', '#EF4444'],
  prerequisites: ['track-dsa'],
  outcomes: [
    'Explain the memory hierarchy and predict when locality will dominate',
    'Say what lives on the stack, what lives on the heap, and why it matters',
    'Distinguish concurrency from parallelism, and I/O-bound from CPU-bound',
    'Recognise a race condition and name the smallest fix for it',
    'Profile before optimising, and reason about the ceiling Amdahl sets',
  ],
  units: [
    // -----------------------------------------------------------------------
    {
      id: 'unit-sys-1',
      title: 'How Memory Actually Works',
      description: 'The hierarchy underneath every data structure you have used.',
      lessons: [
        lesson({
          id: 'lesson-memory-hierarchy',
          title: 'The Memory Hierarchy',
          summary: 'Not one memory. Five, each 10× slower and 10× bigger than the last.',
          level: 'intro',
          domain: 'systems',
          free: true,
          steps: [
            concept(
              'Five tiers, each a different world',
              'Programs talk about "memory" as though it were one thing. It is a hierarchy, and the numbers between the tiers are not close.\n\n| Tier | Latency | Size |\n|---|---|---|\n| Register | ~0 cycles | bytes |\n| L1 cache | ~4 cycles | ~32 KB |\n| L2/L3 cache | ~12–40 cycles | KB–MB |\n| Main memory (RAM) | ~200 cycles | GB |\n| SSD | ~50,000 cycles | TB |\n\nThe gap between L1 and RAM is roughly **50×**. The gap between RAM and disk is another **250×**. A single mispredicted memory access can cost more than a hundred arithmetic operations.\n\nThis is why big-O is necessary and insufficient. Two O(n) loops over the same data can differ by an order of magnitude depending on whether the CPU can predict what you will touch next. Operation counts assume every memory access costs the same. None of them do.\n\nThe hardware tries to help. It **prefetches**: if you read address 100, then 108, then 116, it fetches ahead before you ask. Give it a predictable pattern and memory is nearly free. Give it pointer chasing and it is helpless.',
              {
                keyTerms: [
                  { term: 'Cache', definition: 'Small fast memory holding recently and nearby-used data.' },
                  { term: 'Prefetching', definition: 'The CPU fetching data ahead of a predictable access pattern.' },
                ],
              },
            ),
            numeric(
              'If an L1 hit costs 4 cycles and a RAM access costs 200, how many times slower is the RAM access?',
              50,
              ['sk-memory-hierarchy'],
              '200 / 4 = 50×. Which is why a cache miss can cost more than the arithmetic it was fetching operands for — the computation is not the bottleneck, the waiting is.',
            ),
            concept(
              'Cache lines: you never fetch one byte',
              'Memory does not move in bytes. It moves in **cache lines** — typically 64 bytes, so 16 four-byte integers at a time.\n\nAsk for `array[0]` and you get `array[0..15]` whether you wanted them or not. The next fifteen reads are then free. A sequential walk over a million integers costs **one miss per sixteen reads**.\n\nNow walk a linked list holding the same million integers. Each node sits wherever the allocator put it, so each `next` pointer is an unpredictable jump into a line nobody has fetched. **One miss per read**, and the prefetcher cannot help because it cannot guess the next address until it has read the current node.\n\nSame O(n). Sixteen times the misses, and each miss ~50× a hit.\n\nThis single fact explains a large share of real-world performance advice: prefer arrays of structs laid out contiguously, iterate in the order memory is laid out (row-major in C and NumPy, so loop rows outside and columns inside), and be suspicious of any structure whose elements are individually heap-allocated.',
              {
                keyTerms: [
                  { term: 'Cache line', definition: 'The unit of transfer between memory tiers — typically 64 bytes.' },
                  { term: 'Spatial locality', definition: 'Accessing addresses near ones you recently accessed.' },
                ],
              },
            ),
            interactive(
              'Count the misses yourself',
              'cache-locality',
              'Run the same 64 reads sequentially and shuffled, and compare the miss counts. Both are O(n). The cycle estimate is the number that decides which one ships.',
            ),
            mcq(
              'Two loops sum the same million integers — one over an array, one over a linked list. Both are O(n). Why is the array often 10× faster?',
              [
                'Arrays use less memory in total',
                'Sequential access fetches 16 values per cache line and the prefetcher stays ahead; pointer chasing misses on nearly every read',
                'Linked lists require more arithmetic per element',
                'The compiler cannot optimise linked lists',
              ],
              1,
              ['sk-cache-locality'],
              'The operation counts are identical. What differs is how many of those operations are spent waiting on memory — which big-O, by construction, does not model.',
            ),
            codeOutput(
              'Which loop order is faster for this row-major 2D array, and why?',
              'python',
              `# A is stored row-major: A[i][0..n-1] are contiguous.
# Loop 1
for i in range(n):
    for j in range(n):
        total += A[i][j]

# Loop 2
for j in range(n):
    for i in range(n):
        total += A[i][j]`,
              [
                'Loop 2 — the inner loop is shorter',
                'Loop 1 — it walks memory in the order it is laid out, so each cache line is used fully',
                'They are identical; the compiler reorders them',
                'Loop 2 — column access is better predicted',
              ],
              1,
              ['sk-cache-locality'],
              'Loop 1 walks contiguous memory. Loop 2 strides by a whole row each step, touching one value per cache line and discarding the other fifteen — the same instruction count, several times the runtime. This is the single most common accidental slowdown in numerical code.',
            ),
            trueFalse(
              'Two algorithms with the same big-O complexity will run in roughly the same time.',
              false,
              ['sk-memory-hierarchy', 'sk-big-o'],
              'Big-O counts operations and assumes each costs the same. Memory access costs vary by 50× within RAM and 250× more to disk, so access *pattern* routinely dominates operation count at the same complexity.',
            ),
          ],
        }),

        lesson({
          id: 'lesson-stack-heap',
          title: 'Stack, Heap, and References',
          summary: 'Two kinds of memory with completely different rules and costs.',
          level: 'intermediate',
          domain: 'systems',
          steps: [
            concept(
              'One is a stack of plates; the other is a warehouse',
              'Every running program has two regions it allocates from, and they behave nothing alike.\n\n**The stack.** Each function call pushes a **frame** holding its parameters, locals, and return address. The function returns, the frame pops, the memory is reclaimed. Allocation is moving a pointer — essentially free — and the memory is contiguous and cache-warm. The cost is rigidity: frames must be freed in reverse order of creation, sizes are usually known at compile time, and the whole thing is small (often 1–8 MB), which is why unbounded recursion overflows it.\n\n**The heap.** A large region you allocate from explicitly and free when finished. Any size, any lifetime, any order. The costs are all real: allocation requires finding a suitable block, the memory is scattered so it is cache-hostile, and *something* must decide when it is safe to free.\n\nThat last question is the whole design axis for a language. **Manual** (C: you call `free`, and getting it wrong gives you leaks or use-after-free). **Garbage collected** (Java, Python, Go: a runtime frees unreachable objects, at the cost of pauses and memory overhead). **Ownership** (Rust: the compiler proves when each value dies, giving you manual-level performance with compile-time safety, at the cost of a borrow checker you have to satisfy).\n\nNone is free. They trade programmer effort, runtime overhead, and failure mode.',
              {
                keyTerms: [
                  { term: 'Stack frame', definition: 'The block of memory holding one function call’s locals and return address.' },
                  { term: 'Garbage collection', definition: 'A runtime reclaiming heap memory no longer reachable from the program.' },
                ],
              },
            ),
            categorize(
              'Sort each item by where it typically lives.',
              ['Stack', 'Heap'],
              [
                { item: 'A loop counter inside a function', category: 'Stack' },
                { item: 'The return address of the current call', category: 'Stack' },
                { item: 'A list that grows during execution', category: 'Heap' },
                { item: 'An object returned from a function and kept afterwards', category: 'Heap' },
                { item: 'A large image buffer loaded at runtime', category: 'Heap' },
              ],
              ['sk-stack-vs-heap'],
              'The rule of thumb: known size and a lifetime bounded by the call goes on the stack; anything that must outlive its function, or whose size is decided at runtime, goes on the heap.',
            ),
            concept(
              'Values, references, and the aliasing surprise',
              'When you pass a variable to a function, one of two things happens.\n\n**By value** — the function gets a copy. Changes do not escape. Cheap for small things, expensive for large ones.\n\n**By reference** — the function gets a pointer to the same memory. Changes are visible to the caller. Cheap regardless of size, and it means two names now refer to one object.\n\nMost modern languages pass small primitives by value and objects by reference, which produces the single most common surprise in programming:\n\n```python\na = [1, 2, 3]\nb = a          # not a copy — another name for the same list\nb.append(4)\nprint(a)       # [1, 2, 3, 4]\n```\n\nTwo variables, one list. This is **aliasing**, and it is behind mutable default arguments in Python, shallow-copy bugs everywhere, and a great deal of concurrency trouble — because if two references can reach the same object, two *threads* can too.\n\nThe defences: copy explicitly when you need independence (deep copy if the contents are themselves mutable), prefer immutable values where you can, and treat "who else holds a reference to this?" as a question worth answering before you mutate anything.',
            ),
            codeOutput(
              'What does this print?',
              'python',
              `def add_item(items=[]):
    items.append("x")
    return items

print(len(add_item()))
print(len(add_item()))`,
              ['1 then 1', '1 then 2', '2 then 2', 'It raises an error'],
              1,
              ['sk-pointers-references'],
              '1 then 2. The default list is created once, when the function is defined, and every call without an argument shares that same heap object. It is the aliasing rule applied somewhere unexpected — and the reason the idiom is `items=None` with `if items is None: items = []`.',
            ),
            mcq(
              'Why does deep recursion crash while a deep loop does not?',
              [
                'Recursion uses more CPU',
                'Each pending call holds a stack frame, and the stack is a small fixed region',
                'The compiler cannot optimise recursion',
                'Loops reuse heap memory',
              ],
              1,
              ['sk-stack-vs-heap'],
              'A million pending frames on a few megabytes of stack overflows it. A loop reuses one frame. This is why deep recursion over data needs either tail-call elimination — which many languages do not have — or an explicit stack on the heap.',
            ),
            trueFalse(
              'Garbage collection removes the need to think about memory.',
              false,
              ['sk-stack-vs-heap'],
              'It removes use-after-free and double-free. It does not remove leaks — a reference you forgot to drop keeps an object alive forever — and it adds pause times and memory overhead that matter in latency-sensitive systems.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-sys-1',
        title: 'Memory Checkpoint',
        passingScore: 0.7,
        exercises: [
          mcq(
            'Why is a sequential array walk faster than a linked-list walk of the same length?',
            [
              'It executes fewer instructions',
              'Each cache line fetch serves 16 elements and the prefetcher stays ahead of a predictable pattern',
              'Arrays are stored in registers',
              'Linked lists use more total memory',
            ],
            1,
            ['sk-cache-locality'],
            'Same instruction count; far fewer stalls waiting on memory.',
          ),
          numeric(
            'A 64-byte cache line holds how many 4-byte integers?',
            16,
            ['sk-cache-locality'],
            '64 / 4 = 16. One miss, then fifteen free reads — if you actually use them.',
          ),
          trueFalse(
            'Two variables assigned from one another always hold independent copies.',
            false,
            ['sk-pointers-references'],
            'For objects, both usually name the same heap allocation. Mutating through one is visible through the other.',
          ),
        ],
      },
    },

    // -----------------------------------------------------------------------
    {
      id: 'unit-sys-2',
      title: 'Doing More Than One Thing',
      description: 'Concurrency, parallelism, and the bugs that only appear sometimes.',
      lessons: [
        lesson({
          id: 'lesson-concurrency',
          title: 'Processes, Threads, and Two Kinds of Work',
          summary: 'Concurrency and parallelism are not synonyms, and the difference decides your architecture.',
          level: 'intermediate',
          domain: 'systems',
          steps: [
            concept(
              'Dealing with many things, versus doing many things',
              'Rob Pike\'s framing is the one to keep: **concurrency is dealing with many things at once; parallelism is doing many things at once.**\n\nConcurrency is a structure — several tasks in flight, interleaved. It is achievable on a single core, by switching between tasks whenever one is waiting.\n\nParallelism is an execution property — several tasks genuinely running simultaneously, which requires several cores.\n\nA single-core machine can be highly concurrent and not parallel at all. That is not a limitation if your work is the right shape, which brings us to the distinction that actually decides what to do.\n\n**I/O-bound work** spends its time waiting — on a network response, a disk read, a database. The CPU is idle. Adding cores changes nothing; what helps is having many requests in flight so the waiting overlaps.\n\n**CPU-bound work** spends its time computing — matrix multiplication, image processing, compression. The CPU is saturated. Overlapping does not help; only more cores do.\n\nGet this wrong and your fix makes things worse. Threading a CPU-bound workload in Python gains nothing (the GIL serialises the bytecode anyway) while adding context-switch overhead. Spinning up processes for an I/O-bound workload costs megabytes each to do what async does with a single thread.',
              {
                keyTerms: [
                  { term: 'I/O-bound', definition: 'Limited by waiting on external systems. Fix with overlap.' },
                  { term: 'CPU-bound', definition: 'Limited by computation. Fix with more cores or less work.' },
                ],
              },
            ),
            categorize(
              'Sort each workload by what it is limited by.',
              ['I/O-bound', 'CPU-bound'],
              [
                { item: 'Fetching 500 web pages', category: 'I/O-bound' },
                { item: 'Waiting on database queries', category: 'I/O-bound' },
                { item: 'Reading many small files from disk', category: 'I/O-bound' },
                { item: 'Resizing 10,000 images', category: 'CPU-bound' },
                { item: 'Training a neural network', category: 'CPU-bound' },
                { item: 'Parsing a 2 GB JSON file', category: 'CPU-bound' },
              ],
              ['sk-io-vs-cpu-bound'],
              'The diagnostic is simple: watch CPU utilisation. Pinned at 100% on one core is CPU-bound. Near zero while the program is slow is I/O-bound, and the fix is concurrency, not cores.',
            ),
            concept(
              'Processes, threads, and async',
              'Three ways to have more than one thing in flight, in increasing order of sharing and decreasing order of isolation.\n\n**Processes.** Separate memory spaces. Genuinely parallel, crash-isolated, and expensive — megabytes of memory each, and communication means serialising data across a boundary. The right choice for CPU-bound work in a language with a global interpreter lock, and for anything where one task must not be able to corrupt another.\n\n**Threads.** Share one memory space within a process. Cheap to create, communicate by simply touching the same variables — which is exactly the problem, and the subject of the next lesson. Parallel only if the runtime allows it.\n\n**Async / event loop.** One thread, many tasks, cooperative switching at explicit `await` points. No parallelism at all, extremely cheap concurrency, and no data races *within* the loop because only one thing runs at a time. The catch is the word cooperative: a single blocking call — a synchronous HTTP request, a tight CPU loop — stalls every other task on the loop. In an async codebase, a blocking call is not slow, it is an outage.\n\nThe practical mapping most systems land on: **async for I/O, processes for CPU, threads when you need shared memory and are willing to reason about it.**',
            ),
            match(
              'Match each workload to the mechanism that fits it.',
              [
                { left: '10,000 concurrent HTTP requests', right: 'Async event loop' },
                { left: 'Resizing images across 8 cores', right: 'Process pool' },
                { left: 'A background task sharing a large in-memory cache', right: 'Threads' },
                { left: 'Isolating an untrusted plugin', right: 'Separate process' },
              ],
              ['sk-concurrency-parallelism', 'sk-processes-threads'],
              'Isolation and sharing are the axis. Processes give you the most isolation and the least sharing; threads the reverse; async sidesteps the question by never running two things at once.',
            ),
            mcq(
              'A Python program that resizes 10,000 images gets no faster with 8 threads. Why?',
              [
                'Threads are always slower than a single thread',
                'The work is CPU-bound and the GIL lets only one thread execute bytecode at a time — it needs processes',
                'Image resizing cannot be parallelised',
                'The images are too large for memory',
              ],
              1,
              ['sk-concurrency-parallelism', 'sk-io-vs-cpu-bound'],
              'Threads overlap *waiting*, and this workload never waits. A process pool gives real parallelism; so does a library that releases the GIL in native code, which is why NumPy-heavy loops behave differently from pure-Python ones.',
            ),
            trueFalse(
              'An async event loop provides parallelism.',
              false,
              ['sk-async-io'],
              'It provides concurrency on a single thread. Nothing runs simultaneously — which is why it never has data races, and why one blocking call freezes everything.',
            ),
          ],
        }),

        lesson({
          id: 'lesson-race-conditions',
          title: 'When Shared State Goes Wrong',
          summary: 'The bug that only happens sometimes, on the machine you cannot debug.',
          level: 'expert',
          domain: 'systems',
          steps: [
            concept(
              'One line of code, three operations',
              '`counter = counter + 1` looks atomic. It is not. The machine does three things:\n\n1. **Read** counter into a register.\n2. **Add** 1 in the register.\n3. **Write** the register back.\n\nTwo threads can interleave anywhere in that sequence. If both read before either writes, both compute 1, both write 1, and one increment vanishes. Nothing errors. Nothing logs. The count is simply wrong.\n\nThat is a **race condition**: correctness depending on the order two operations happen to land in, an order nothing guarantees. The defining misery is that it is **non-deterministic**. It passes your tests a thousand times and fails in production, on a busier machine, under a different scheduler, at 3am.\n\nThe requirements are always the same three, and removing any one of them removes the bug:\n\n- Two or more threads of execution,\n- touching **shared mutable** state,\n- with at least one of them writing.\n\nWhich gives you the three families of fix. **Do not share** — give each thread its own copy, or pass messages instead of memory. **Do not mutate** — immutable data can be read by any number of threads safely, which is a large part of why functional styles suit concurrency. Or **synchronise** — make the critical section atomic with a lock.',
              {
                keyTerms: [
                  { term: 'Race condition', definition: 'Behaviour depending on the unpredictable ordering of concurrent operations.' },
                  { term: 'Critical section', definition: 'Code touching shared state that must not be interleaved.' },
                ],
              },
            ),
            interactive(
              'Lose an update on purpose',
              'race-condition',
              'Step A-read, B-read, A-add, B-add, A-write, B-write. The counter ends at 1 instead of 2 — nothing crashed, an increment just disappeared. Then switch the lock on and try the same interleaving.',
            ),
            concept(
              'Locks, and the problems they introduce',
              'A **mutex** makes a critical section atomic: one thread holds it, others wait. It works, and it brings three new failure modes.\n\n**Deadlock.** Thread A holds lock 1 and wants lock 2; thread B holds lock 2 and wants lock 1. Neither will ever proceed, and the program does not crash â it stops. The standard prevention is **lock ordering**: every thread acquires locks in the same global order, which makes the cycle impossible by construction.\n\n**Contention.** If every thread needs the same lock, they serialise on it. You have written a concurrent program that runs like a single-threaded one, plus overhead. The fix is finer-grained locking â or a design where the shared thing is not shared.\n\n**Forgetting one.** A lock only works if *every* access takes it. One unguarded read somewhere else in the codebase and the guarantee is gone, silently. This is why languages that tie the lock to the data (Rust’s `Mutex<T>`, where you cannot reach the value without acquiring) are structurally safer than languages where the lock is a separate variable you are trusted to remember.\n\nThe alternatives worth knowing. **Atomics** â hardware-level compare-and-swap for single values, faster than a lock and much harder to compose. **Message passing** â channels and actors, where state is owned by one thread and others send requests; Go and Erlang are built on this, and the slogan is "do not communicate by sharing memory; share memory by communicating".\n\nAnd the honest advice: **the cheapest fix is nearly always to stop sharing.**',
            ),
            order(
              'Order these fixes from cheapest to most complex to get right.',
              [
                'Give each thread its own copy — no sharing at all',
                'Make the shared data immutable so no write can conflict',
                'Guard every access with a single lock',
                'Use fine-grained locks with a global acquisition order',
              ],
              ['sk-locks-deadlock', 'sk-race-conditions'],
              'Each step down the list buys throughput and costs correctness risk. Most concurrency bugs come from teams starting at the bottom.',
            ),
            mcq(
              'Thread A holds lock 1 and waits for lock 2; thread B holds lock 2 and waits for lock 1. What is the standard prevention?',
              [
                'Add a timeout to every lock acquisition',
                'Acquire locks in the same global order everywhere',
                'Use more threads',
                'Replace the locks with atomics',
              ],
              1,
              ['sk-locks-deadlock'],
              'A consistent acquisition order makes the waiting cycle impossible. Timeouts turn a deadlock into a livelock or a retry storm — they detect the problem rather than preventing it.',
            ),
            multi(
              'Which conditions must all hold for a data race? (Select all)',
              [
                'Two or more concurrent threads of execution',
                'Shared state reachable by both',
                'At least one of them writes',
                'The threads run on different physical cores',
              ],
              [0, 1, 2],
              ['sk-race-conditions'],
              'Different cores are not required — a single core switching between threads mid-sequence races just as happily. Remove any of the first three and the race is gone.',
            ),
            shortAnswer(
              'Why are race conditions so much harder to debug than ordinary bugs?',
              ['non-deterministic', 'timing', 'intermittent', 'reproduce', 'order', 'schedule'],
              'Because they depend on timing rather than on inputs. The same input produces the right answer almost every time, so the bug is not reproducible on demand, does not show up under a debugger that changes the timing, and passes tests repeatedly before failing under production load. You cannot bisect what you cannot reliably trigger.',
              ['sk-race-conditions'],
              'Which is why the real defence is structural — not sharing, or not mutating — rather than testing harder.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-sys-2',
        title: 'Concurrency Checkpoint',
        passingScore: 0.7,
        exercises: [
          mcq(
            'A program is slow and CPU sits near 0%. What is it limited by?',
            ['CPU-bound work', 'I/O-bound waiting', 'Memory bandwidth', 'Cache misses'],
            1,
            ['sk-io-vs-cpu-bound'],
            'Idle CPU while the program is slow means it is waiting. More cores will not help; overlapping the waits will.',
          ),
          trueFalse(
            'An async event loop cannot have data races within itself.',
            true,
            ['sk-async-io'],
            'Only one task runs at a time and switches happen at explicit await points, so no two tasks can interleave mid-operation. The trade is that a blocking call stalls everything.',
          ),
          mcq(
            'What is the cheapest reliable fix for a race condition?',
            [
              'Add a lock around every access',
              'Stop sharing the state, or stop mutating it',
              'Add retries',
              'Increase the thread count',
            ],
            1,
            ['sk-race-conditions'],
            'Removing sharing or mutation removes one of the three necessary conditions. Locks work but introduce deadlock, contention, and the requirement that nobody ever forgets one.',
          ),
        ],
      },
    },

    // -----------------------------------------------------------------------
    {
      id: 'unit-sys-3',
      title: 'Making It Fast',
      description: 'Measuring before changing, and the ceiling nobody can raise.',
      lessons: [
        lesson({
          id: 'lesson-profiling',
          title: 'Profile Before You Optimise',
          summary: 'Programmer intuition about where time goes is reliably wrong.',
          level: 'intermediate',
          domain: 'systems',
          steps: [
            concept(
              'You are guessing, and the guess is usually wrong',
              'The most common performance mistake is not choosing the wrong optimisation. It is optimising something that was never the problem.\n\nPrograms are overwhelmingly **non-uniform**: a small fraction of the code accounts for most of the time. Which fraction is not obvious from reading it. The hot spot is routinely a JSON parse in a loop, an accidental O(n²) from a list membership test, a synchronous call inside an async handler, or a query issued once per row — and essentially never the arithmetic someone spent a day hand-tuning.\n\nSo: **measure first, and measure the thing you actually ship.**\n\nThe tools, roughly in order of what to reach for:\n\n- **Sampling profilers** interrupt the program periodically and record the stack. Low overhead, safe in production, and they tell you where wall-clock time goes.\n- **Instrumenting profilers** time every call. Exact call counts, and enough overhead to distort what they measure — especially for small hot functions.\n- **Flame graphs** render the stack samples so a wide plateau is a hot path. The fastest way to find the answer visually.\n- **Tracing** records spans across services, which is the only thing that works once the latency is spread over a network.\n\nAnd two rules that save the most time. **Benchmark on realistic data** — the hot path on 100 rows is frequently not the hot path on 10 million. And **re-measure after every change**, because the bottleneck moves: fixing the top item just promotes the second one.',
              {
                keyTerms: [
                  { term: 'Sampling profiler', definition: 'Periodically records the call stack. Low overhead, production-safe.' },
                  { term: 'Flame graph', definition: 'A stack-sample visualisation where width is time spent.' },
                ],
              },
            ),
            mcq(
              'A sampling profiler shows 70% of wall-clock time inside a JSON parse called in a loop. What should you do first?',
              [
                'Rewrite the loop in a faster language',
                'Look at why the parse is in the loop at all — hoist it, cache it, or parse once',
                'Add threads to parallelise the loop',
                'Micro-optimise the arithmetic in the loop body',
              ],
              1,
              ['sk-profiling'],
              'The cheapest win is almost always removing work rather than speeding it up. Parallelising a redundant parse buys you the same waste on more cores.',
            ),
            mcq(
              'Why can an instrumenting profiler mislead on small, frequently called functions?',
              [
                'It cannot see them',
                'Its per-call overhead is comparable to the function, so it inflates their apparent cost',
                'It only samples one thread',
                'It rounds times to milliseconds',
              ],
              1,
              ['sk-profiling'],
              'Timing a 20ns function with 100ns of measurement machinery reports mostly measurement. Sampling profilers avoid this by not touching the function at all.',
            ),
            multi(
              'Which are sound profiling practice? (Select all)',
              [
                'Measure before changing anything',
                'Benchmark on data the size production actually sees',
                'Re-measure after each change because the bottleneck moves',
                'Optimise the code that looks most complicated',
              ],
              [0, 1, 2],
              ['sk-profiling'],
              'Complexity and slowness are unrelated. The hot path is usually something dull that runs a great many times.',
            ),
          ],
        }),

        lesson({
          id: 'lesson-amdahl',
          title: 'The Limits of Parallelism',
          summary: 'The part you cannot parallelise sets a ceiling you cannot buy your way past.',
          level: 'expert',
          domain: 'systems',
          steps: [
            concept(
              'Amdahl’s law',
              'Suppose 90% of a program parallelises perfectly and 10% is inherently serial. What is the most speedup infinite cores can buy?\n\n**Ten times.** Not a hundred, not a thousand. The serial 10% still takes 10% of the original time no matter how many cores you own, so the floor is 0.1× the runtime and the ceiling is 10×.\n\n`speedup ≤ 1 / (s + (1 − s)/N)` — with N cores and a serial fraction s. As N grows the second term vanishes and you are left with **1/s**.\n\nThe numbers are unforgiving:\n\n| Serial fraction | Ceiling |\n|---|---|\n| 1% | 100× |\n| 5% | 20× |\n| 10% | 10× |\n| 25% | 4× |\n\nA program that is 25% serial cannot reach 5× however much hardware you throw at it. Which reframes the engineering question: **reducing the serial fraction is worth more than adding cores**, and past a point adding cores is simply buying nothing.\n\nWhat is serial in practice? Startup and teardown. Reading the input. Combining results. Anything behind a single contended lock. Anything waiting on one shared resource — which is why a parallel pipeline bottlenecked on one database is not really parallel.\n\nThe honest counterweight is **Gustafson\'s law**: in practice people do not hold the problem fixed and add cores, they take the extra capacity and run a bigger problem. Amdahl bounds the speedup on a fixed workload; Gustafson observes that the workload usually grows. Both are true, and which applies depends on whether you are trying to finish faster or to do more.',
              {
                keyTerms: [
                  { term: 'Serial fraction', definition: 'The share of runtime that cannot be parallelised.' },
                  { term: 'Amdahl’s law', definition: 'Speedup is capped at 1/s, whatever the core count.' },
                ],
              },
            ),
            numeric(
              'A program is 20% serial. What is the maximum speedup with unlimited cores?',
              5,
              ['sk-amdahls-law'],
              '1 / 0.2 = 5×. The serial fifth is untouched by any amount of hardware, so the runtime can never fall below a fifth of the original.',
              { tolerance: 0.01, hint: 'The ceiling is one over the serial fraction.' },
            ),
            numeric(
              'A program is 95% parallel. Running on 8 cores, what speedup do you get? (One decimal place.)',
              5.9,
              ['sk-amdahls-law'],
              '1 / (0.05 + 0.95/8) = 1 / 0.16875 ≈ 5.9×. Already noticeably short of 8 — and doubling to 16 cores only reaches about 9.1×, which is the diminishing return that makes hardware a poor answer past a point.',
              { tolerance: 0.2 },
            ),
            mcq(
              'Your pipeline runs on 32 cores but every stage writes to one database. What limits you?',
              [
                'Cache misses',
                'The shared database is a serial section — the whole pipeline is bounded by its throughput',
                'Not enough threads',
                'Amdahl’s law does not apply to I/O',
              ],
              1,
              ['sk-amdahls-law'],
              'A contended shared resource is a serial fraction wearing different clothes. Thirty-two cores queueing on one writer gives you the throughput of one writer plus coordination overhead.',
            ),
            trueFalse(
              'Doubling the cores of a 90%-parallel program roughly doubles its speed.',
              false,
              ['sk-amdahls-law'],
              'At 8 cores it reaches about 4.7×; at 16, about 6.4×. Well short of doubling, and it converges on 10× no matter how far you go.',
            ),
            fill(
              'A program that is 10% serial has a maximum speedup of ___×, reached only with unlimited cores, so reducing the ___ fraction is worth more than adding hardware.',
              [['10', 'ten'], ['serial']],
              ['sk-amdahls-law'],
              '1/0.1 = 10. Once you are within a factor of two of the ceiling, more cores are close to free money spent on nothing.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-sys-3',
        title: 'Performance Checkpoint',
        passingScore: 0.7,
        exercises: [
          numeric(
            'A workload is 50% serial. Maximum speedup with unlimited cores?',
            2,
            ['sk-amdahls-law'],
            '1 / 0.5 = 2×. Half the work never parallelises, so half the time never goes away.',
            { tolerance: 0.01 },
          ),
          mcq(
            'What should you do before optimising anything?',
            [
              'Rewrite the slowest-looking function',
              'Profile on realistic data to find where time actually goes',
              'Add caching everywhere',
              'Increase the thread count',
            ],
            1,
            ['sk-profiling'],
            'Intuition about hot paths is unreliable, and the fix for the wrong bottleneck is wasted work.',
          ),
          trueFalse(
            'A sampling profiler is generally safe to run against production traffic.',
            true,
            ['sk-profiling'],
            'It interrupts periodically and records a stack, so overhead is low and roughly constant — which is exactly why it is the default for finding real bottlenecks.',
          ),
        ],
      },
    },
  ],
};
