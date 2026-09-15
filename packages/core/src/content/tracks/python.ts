/**
 * Track 28 — Python for AI.
 *
 * Python is the language the rest of this catalog assumes without teaching.
 * This is not a language tour — it is the subset that shows up in machine
 * learning work, plus the specific ways Python surprises people who learned to
 * program somewhere else.
 */

import type { Track } from '../../domain/types';
import { codeOutput, concept, fill, interactive, lesson, match, mcq, multi, numeric, shortAnswer, trueFalse } from '../builders';

export const pythonTrack: Track = {
  id: 'track-python',
  title: 'Python for AI',
  tagline: 'The language every model is written in',
  description:
    'The Python that machine-learning work actually uses: idiomatic syntax, comprehensions and generators, the data model, NumPy broadcasting, DataFrames, environments — and the handful of Python behaviours that reliably cost people an afternoon.',
  domain: 'programming',
  level: 'intro',
  icon: '🐍',
  gradient: ['#3B82F6', '#FBBF24'],
  prerequisites: ['track-programming'],
  outcomes: [
    'Write idiomatic Python rather than another language transliterated',
    'Use comprehensions and generators, and know when a generator matters',
    'Predict what NumPy broadcasting will do before running it',
    'Reshape and aggregate a DataFrame with split-apply-combine',
    'Avoid the mutable-default and late-binding traps by recognising them',
    'Set up an environment whose results someone else can reproduce',
  ],
  units: [
    // -----------------------------------------------------------------------
    {
      id: 'unit-py-1',
      title: 'Python as Python',
      description: 'Idiom, comprehensions, and the object model underneath.',
      lessons: [
        lesson({
          id: 'lesson-python-basics',
          title: 'Idiomatic Python',
          summary: 'Indentation as syntax, and the style the language expects.',
          level: 'intro',
          domain: 'programming',
          free: true,
          steps: [
            concept(
              'Indentation is the block',
              'Python has no braces. **Indentation is the syntax** — the body of a function, loop or conditional is defined by being indented under it.\n\n```\ndef classify(score):\n    if score >= 0.5:\n        return "positive"\n    return "negative"\n\nfor row in rows:\n    total += row.amount\n```\n\nThis forces readable layout, and it means a misplaced indent is a *semantic* change rather than a cosmetic one. Mixing tabs and spaces is the classic way to produce code that looks right and runs wrong; use four spaces and let your editor enforce it.\n\nThe rest of the surface is small:\n\n| Python | Elsewhere |\n|---|---|\n| `elif` | `else if` |\n| `None` | `null` |\n| `True` / `False` | `true` / `false` |\n| `and` `or` `not` | `&&` `\\|\\|` `!` |\n| `#` | `//` |\n| f-strings: `f"{n} items"` | template literals |\n\nPython culture takes idiom seriously — there is usually one way a Python programmer expects something written, and departing from it reads as an accent. Iterate directly over a collection rather than over indices; unpack tuples instead of indexing them; use `enumerate` when you need the index as well.\n\n```\n# not this\nfor i in range(len(names)):\n    print(i, names[i])\n\n# this\nfor i, name in enumerate(names):\n    print(i, name)\n```',
              {
                keyTerms: [
                  { term: 'Idiomatic', definition: 'Written the way the language community expects, not merely correct.' },
                  { term: 'f-string', definition: 'A string literal that interpolates expressions: f"{x + 1}".' },
                ],
              },
            ),
            codeOutput(
              'What does this print?',
              'python',
              'names = ["ada", "alan", "grace"]\nfor i, name in enumerate(names):\n    if i == 1:\n        print(name)',
              ['ada', 'alan', 'grace', 'nothing'],
              1,
              ['sk-python-syntax'],
              '`enumerate` yields (index, value) pairs starting at 0, so index 1 is the second name.',
            ),
            mcq(
              'Which is the idiomatic way to loop over a list in Python?',
              [
                'for i in range(len(xs)): use xs[i]',
                'for x in xs: use x',
                'while i < len(xs)',
                'xs.forEach',
              ],
              1,
              ['sk-python-syntax'],
              'Iterate the collection, not the indices. Reach for `enumerate` only when you genuinely need the position too.',
            ),
            fill(
              'In Python, the null-like value is written ___ and the block structure is defined by ___.',
              [['None'], ['indentation', 'whitespace', 'indent']],
              ['sk-python-syntax'],
              'No braces at all — which is why consistent four-space indentation is not a style preference here.',
            ),
            concept(
              'Comprehensions and generators',
              'A **comprehension** builds a collection from an expression over an iterable. It is the single most recognisable piece of Python.\n\n```\nsquares = [n * n for n in range(10)]\nevens   = [n for n in nums if n % 2 == 0]\nlengths = {word: len(word) for word in words}\nunique  = {w.lower() for w in words}\n```\n\nList, dict, set — same shape, different brackets. They read left to right as "this expression, for each of these, where this holds", and they are faster than the equivalent loop with `.append` because the interpreter does not re-dispatch a method call each pass.\n\nThe rule of taste: **one comprehension, one idea**. Two nested `for` clauses and a condition is a loop wearing a costume; write the loop.\n\nSwap the brackets for parentheses and you get a **generator expression**, which does not build the collection at all:\n\n```\ntotal = sum(n * n for n in range(10_000_000))\n```\n\nThat computes one value at a time and holds one in memory. The list version allocates ten million integers first. For data that does not fit in memory — a log file, a stream of records, a dataset larger than RAM — generators are not an optimisation, they are the difference between working and not.\n\nThis is exactly why data loaders in PyTorch and TensorFlow are iterators: the training set is not supposed to be resident.',
              {
                keyTerms: [
                  { term: 'Comprehension', definition: 'Collection-building syntax: expression, iteration, optional filter.' },
                  { term: 'Generator', definition: 'Produces values lazily, one at a time, holding no full collection.' },
                ],
              },
            ),
            codeOutput(
              'What does this print?',
              'python',
              'nums = [1, 2, 3, 4, 5]\nresult = [n * 2 for n in nums if n % 2 == 1]\nprint(result)',
              ['[2, 4, 6, 8, 10]', '[2, 6, 10]', '[1, 3, 5]', '[]'],
              1,
              ['sk-comprehensions'],
              'Filter first (odds: 1, 3, 5), then apply the expression: 2, 6, 10.',
            ),
            mcq(
              'When does a generator expression beat a list comprehension?',
              [
                'Always — generators are faster',
                'When the sequence is large or infinite and you only need to consume it once',
                'When you need to index into the result',
                'When the expression is complicated',
              ],
              1,
              ['sk-comprehensions'],
              'You trade random access and reuse for constant memory. If you need to index it or loop over it twice, you wanted the list.',
            ),
            multi(
              'Which are true of comprehensions?',
              [
                'They can build lists, sets and dicts',
                'They can include a filtering condition',
                'They are always more readable than a loop',
                'Changing brackets to parentheses makes a lazy generator',
              ],
              [0, 1, 3],
              ['sk-comprehensions'],
              'Deeply nested comprehensions are less readable than the loop they replaced. One idea per comprehension.',
            ),
          ],
        }),
        lesson({
          id: 'lesson-python-model',
          title: 'The Data Model and Its Traps',
          summary: 'Dunder methods, and four behaviours that cost everyone an afternoon.',
          level: 'intermediate',
          domain: 'programming',
          steps: [
            concept(
              'Everything is an object with protocols',
              'Python has very few special cases. Syntax you think of as built in is almost always a method call on an object, and the methods have reserved names surrounded by double underscores — **dunder** methods.\n\n| You write | Python calls |\n|---|---|\n| `len(x)` | `x.__len__()` |\n| `x[i]` | `x.__getitem__(i)` |\n| `a + b` | `a.__add__(b)` |\n| `for x in xs` | `xs.__iter__()` |\n| `with f:` | `f.__enter__()` / `__exit__()` |\n| `print(x)` | `x.__str__()` |\n\nThe consequence is that your own types can participate in the language as first-class citizens. Define `__len__` and `__getitem__` and your object works with `len()`, indexing, slicing and `for` — no inheritance required. This is **duck typing**: what matters is the methods an object has, not what it claims to be.\n\nIt is also how NumPy and PyTorch feel native. `a + b` on two tensors is `Tensor.__add__`, dispatching to compiled kernels. The syntax is Python; almost none of the work is.',
              {
                keyTerms: [
                  { term: 'Dunder method', definition: 'A double-underscore method implementing a language protocol.' },
                  { term: 'Duck typing', definition: 'Compatibility decided by the methods present, not by declared type.' },
                ],
              },
            ),
            match(
              'Match the syntax to the method it calls.',
              [
                { left: 'len(x)', right: '__len__' },
                { left: 'x[0]', right: '__getitem__' },
                { left: 'a + b', right: '__add__' },
                { left: 'for x in xs', right: '__iter__' },
              ],
              ['sk-python-data-model'],
              'Implement the protocol and your type gets the syntax. That is the whole mechanism.',
            ),
            concept(
              'The four traps',
              'These are not obscure. Every Python programmer hits all four, usually in the first year.\n\n**1. Mutable default arguments.** The default is evaluated **once**, when the function is defined — not per call.\n\n```\ndef add_item(item, basket=[]):    # wrong\n    basket.append(item)\n    return basket\n\nadd_item("a")   # ["a"]\nadd_item("b")   # ["a", "b"]  ← the same list\n```\n\nThe fix is `basket=None` and `if basket is None: basket = []`.\n\n**2. Late binding in closures.** A closure captures the *variable*, not its value at the time.\n\n```\nfuncs = [lambda: i for i in range(3)]\n[f() for f in funcs]      # [2, 2, 2], not [0, 1, 2]\n```\n\nFix with a default argument: `lambda i=i: i`.\n\n**3. `is` versus `==`.** `is` asks "the same object?", `==` asks "equal value?". They coincide for small integers and interned strings because of caching, which makes `is` look like it works right up until it does not. Use `is` only for `None`, `True` and `False`.\n\n**4. Shallow copies.** `list(xs)` and `xs[:]` copy the list, not the objects in it. Mutating an element is still visible through both — the aliasing problem from the fundamentals track, with Python spelling.\n\nEach of these has the same root: Python evaluates and binds at times people assume it does not.',
              {
                keyTerms: [
                  { term: 'Mutable default', definition: 'A default argument evaluated once at definition and shared across calls.' },
                  { term: 'Late binding', definition: 'A closure reads the variable when called, not when created.' },
                ],
              },
            ),
            codeOutput(
              'What is the second call’s output?',
              'python',
              'def add(item, basket=[]):\n    basket.append(item)\n    return basket\n\nprint(add("a"))\nprint(add("b"))',
              ["['a'] then ['b']", "['a'] then ['a', 'b']", "['a'] then []", 'an error'],
              1,
              ['sk-python-gotchas'],
              'One list, created once at definition time, shared by every call that does not pass its own. Use None as the default and build a fresh list inside.',
            ),
            mcq(
              'When should you use `is` rather than `==`?',
              [
                'Always, it is faster',
                'Only when comparing against None, True or False',
                'When comparing strings',
                'When comparing small integers',
              ],
              1,
              ['sk-python-gotchas'],
              '`is` tests object identity. It appears to work for small ints and interned strings because those are cached, which makes the eventual failure baffling.',
            ),
            trueFalse(
              '`funcs = [lambda: i for i in range(3)]` produces functions returning 0, 1 and 2.',
              false,
              ['sk-python-gotchas'],
              'All three return 2. The lambdas capture the variable `i`, and by the time any of them is called the loop has finished.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-py-1',
        title: 'Python Language Checkpoint',
        passingScore: 0.7,
        exercises: [
          mcq(
            'What does `[n for n in range(6) if n % 3 == 0]` produce?',
            ['[0, 3]', '[3]', '[0, 1, 2, 3, 4, 5]', '[3, 6]'],
            0,
            ['sk-comprehensions'],
            '0 and 3 are the multiples of 3 below 6, and 0 % 3 is 0.',
          ),
          mcq(
            'Why is `def f(xs=[])` a bug waiting to happen?',
            [
              'Lists cannot be defaults',
              'The list is created once at definition and shared by every call',
              'It is slower than None',
              'It shadows the built-in list',
            ],
            1,
            ['sk-python-gotchas'],
            'State leaks between calls that never intended to share anything.',
          ),
          mcq(
            'Implementing `__len__` and `__getitem__` on your class gets you what?',
            [
              'Nothing without inheriting from list',
              'len(), indexing, slicing and iteration',
              'Automatic serialisation',
              'Type checking',
            ],
            1,
            ['sk-python-data-model'],
            'Protocols, not inheritance. This is duck typing doing real work.',
          ),
        ],
      },
    },
    // -----------------------------------------------------------------------
    {
      id: 'unit-py-2',
      title: 'The Scientific Stack',
      description: 'Arrays, frames, and an environment someone else can reproduce.',
      lessons: [
        lesson({
          id: 'lesson-numpy',
          title: 'NumPy and Broadcasting',
          summary: 'Leave the interpreter, and let shapes do the looping.',
          level: 'intermediate',
          domain: 'programming',
          steps: [
            concept(
              'Why arrays are not lists',
              'A Python list holds pointers to boxed objects scattered across the heap. A NumPy **array** holds raw values in one contiguous block, all the same type.\n\nThat difference buys three things, and they compound:\n\n**Speed.** Operations run as compiled, vectorised loops over contiguous memory instead of interpreted per-element dispatch — often 10–100×. This is the memory-locality lesson from the systems track with a number attached.\n\n**Memory.** A million float64 values take 8 MB in an array and roughly 30–80 MB as a Python list of floats.\n\n**Expressiveness.** `a * 2 + b` means what it says, elementwise, with no loop.\n\n```\nimport numpy as np\n\na = np.array([1, 2, 3])\nb = a * 2          # [2, 4, 6] — no loop written\nc = a + b          # [3, 6, 9]\nd = a @ b          # 28 — dot product\n```\n\nThe rule that follows: **if you are writing a Python `for` loop over array elements, you are usually doing it wrong.** Find the vectorised expression. The loop is not merely slower, it is a hundred times slower, and the vectorised version is generally shorter.',
              {
                keyTerms: [
                  { term: 'ndarray', definition: 'A dense, typed, contiguous n-dimensional array.' },
                  { term: 'Vectorised', definition: 'Expressed as a whole-array operation rather than an explicit loop.' },
                ],
              },
            ),
            concept(
              'Broadcasting: the rules, once',
              '**Broadcasting** is how NumPy combines arrays of different shapes without copying. It is one rule applied right to left:\n\nFor each dimension, starting from the last, the sizes must either **be equal** or **one of them must be 1**. A size-1 dimension is stretched (virtually, not in memory) to match.\n\n```\n(3, 4) + (4,)      → (3, 4)   ✓ the (4,) applies to every row\n(3, 4) + (3, 1)    → (3, 4)   ✓ the column applies to every column\n(3, 4) + (3,)      → error    ✗ 4 vs 3 in the last dimension\n(256, 256, 3) * (3,) → (256, 256, 3)  ✓ per-channel scaling\n```\n\nThis is why you can subtract a per-feature mean from a whole dataset in one expression, and why adding a bias vector to a batch of activations needs no loop over the batch.\n\nIt is also the single most common source of silent bugs in numerical code. A (n, 1) array and a (1, n) array broadcast together into an **(n, n)** array — no error, just an answer of the wrong shape that quietly consumes n² memory. If a computation is mysteriously slow or enormous, check the shapes before anything else.\n\nThe defensive habit: print `.shape` at every stage while developing, and assert the shape you expect at the boundaries of a function.',
              {
                keyTerms: [
                  { term: 'Broadcasting', definition: 'Implicitly stretching size-1 dimensions so shapes align.' },
                  { term: 'Shape', definition: 'The tuple of dimension sizes — the thing to check first when numbers look wrong.' },
                ],
              },
            ),
            interactive(
              'Trace the code',
              'code-tracer',
              'Step a short numerical program and watch the values and shapes update. Try a line that broadcasts unexpectedly and see the result change size.',
            ),
            mcq(
              'What shape results from adding arrays of shape (5, 1) and (1, 3)?',
              ['(5, 3)', '(5, 1)', '(1, 3)', 'An error — shapes do not match'],
              0,
              ['sk-numpy'],
              'Both size-1 dimensions stretch, producing a 5×3 outer combination. When this is not what you wanted it is a nasty bug: no error, just a bigger array.',
            ),
            mcq(
              'Arrays of shape (3, 4) and (3,) are added. What happens?',
              [
                'It broadcasts to (3, 4)',
                'It raises an error, because broadcasting aligns from the last dimension and 4 ≠ 3',
                'It broadcasts to (3, 3)',
                'It truncates to (3,)',
              ],
              1,
              ['sk-numpy'],
              'Right-to-left alignment compares 4 against 3. Reshaping to (3, 1) would work and means something different — per-row rather than per-column.',
            ),
            numeric(
              'A float64 array of 1,000,000 values occupies how many megabytes?',
              8,
              ['sk-numpy'],
              '8 bytes each × 1e6 = 8 MB. The equivalent Python list of floats is several times that, because each float is a separate heap object with a header.',
              { tolerance: 0.5 },
            ),
          ],
        }),
        lesson({
          id: 'lesson-pandas-envs',
          title: 'DataFrames and Environments',
          summary: 'Tabular work, and making it reproducible.',
          level: 'intermediate',
          domain: 'programming',
          steps: [
            concept(
              'Split, apply, combine',
              'A **DataFrame** is a table: named, typed columns sharing an index. Most data work is four operations on one.\n\n**Select** columns and **filter** rows:\n```\ndf[["user", "amount"]]\ndf[df.amount > 100]\n```\n\n**Derive** new columns:\n```\ndf["net"] = df.amount - df.fee\n```\n\n**Group and aggregate** — the pattern worth internalising, because it is most of analysis:\n```\ndf.groupby("country")["amount"].mean()\n```\n\nThat is **split-apply-combine**: split rows into groups, apply an aggregation to each, combine the results into a new frame. Once you see it, an enormous share of analytical questions turn out to be one line of it.\n\n**Join** frames on a key, with the same semantics as the SQL joins from the databases track:\n```\ndf.merge(users, on="user_id", how="left")\n```\n\nTwo warnings worth having early. Pandas will happily produce a `SettingWithCopyWarning` when you assign into a slice — that warning means your write may have gone to a temporary copy and vanished, so it is not decorative. And the index is not a column; `reset_index()` after a groupby is nearly always what you wanted.\n\nFor data too large to fit in memory, the same vocabulary exists in Polars, DuckDB and Spark — which is why learning the *pattern* matters more than learning the library.',
              {
                keyTerms: [
                  { term: 'Split-apply-combine', definition: 'Group rows, aggregate each group, reassemble.' },
                  { term: 'SettingWithCopyWarning', definition: 'A warning that an assignment may have gone to a temporary copy.' },
                ],
              },
            ),
            mcq(
              'Which operation answers "average order value per country"?',
              [
                'df.sort_values("country")',
                'df.groupby("country")["amount"].mean()',
                'df.merge(countries)',
                'df["amount"].mean()',
              ],
              1,
              ['sk-pandas'],
              'Split by country, apply the mean, combine. The last option gives one global number, which is a different question.',
            ),
            trueFalse(
              'A SettingWithCopyWarning is cosmetic and can be ignored.',
              false,
              ['sk-pandas'],
              'It means the assignment may have landed on a temporary copy, so your data silently does not change. It is one of the few warnings worth stopping for.',
            ),
            concept(
              'Environments, or: "it works on my machine"',
              'Python installs packages globally by default, which means two projects needing different versions of the same library are in conflict. A **virtual environment** gives each project its own isolated set.\n\n```\npython -m venv .venv\nsource .venv/bin/activate\npip install -r requirements.txt\n```\n\nFor reproducibility, the specification matters more than the tool:\n\n**Pin exact versions.** `numpy==1.26.4`, not `numpy>=1.26`. An unpinned dependency means the code that worked in March fails in June because something upstream released.\n\n**Commit the lock file.** The same argument as the supply-chain lesson in the security track — pinned, visible, reviewable.\n\n**Record the Python version too.** Not just the packages; language versions break things as readily.\n\n**Pin the random seed** in anything stochastic, and say so, or your results are not reproducible even by you.\n\nAnd a note on notebooks, since most ML work starts in one. A notebook has **hidden state**: the cells you see are not necessarily the cells that ran, nor in that order. A notebook that works only because a cell was run twice is not reproducible, and the giveaway is execution counts that do not increase down the page. Before you trust a result — and always before sharing one — restart the kernel and run all cells top to bottom.',
              {
                keyTerms: [
                  { term: 'Virtual environment', definition: 'An isolated per-project package set.' },
                  { term: 'Hidden state', definition: 'A notebook whose live variables no longer match the code on screen.' },
                ],
              },
            ),
            multi(
              'Which make an analysis reproducible by someone else?',
              [
                'Pinning exact package versions',
                'Recording the Python version',
                'Setting and recording the random seed',
                'Sharing the notebook exactly as it is, unrun',
              ],
              [0, 1, 2],
              ['sk-environments', 'sk-notebooks'],
              'The fourth is the problem, not the solution — an unrestarted notebook carries state you cannot see.',
            ),
            mcq(
              'What does "restart and run all" protect you from?',
              [
                'Slow execution',
                'A result that only works because cells were run out of order or twice',
                'Syntax errors',
                'Memory leaks',
              ],
              1,
              ['sk-notebooks'],
              'It is the only way to confirm that the code on screen actually produces the output on screen.',
            ),
            shortAnswer(
              'A colleague sends a notebook that "definitely worked" and it fails for you. List the things you would check.',
              ['version', 'environment', 'seed', 'order', 'path', 'data'],
              'First the environment: Python version and exact package versions, since an unpinned dependency is the usual culprit. Then whether the notebook actually runs top to bottom from a fresh kernel, because it may only have worked in their live session with out-of-order state. Then data: absolute paths that exist only on their machine, or a file that has since changed. And if results differ rather than erroring, whether a random seed was set at all.',
              ['sk-environments', 'sk-notebooks'],
              'Environment, execution order, data location, seeds. In that order, because that is roughly their frequency.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-py-2',
        title: 'Scientific Python Checkpoint',
        passingScore: 0.7,
        exercises: [
          mcq(
            'Adding arrays of shape (4, 1) and (1, 6) gives what shape?',
            ['(4, 6)', '(4, 1)', '(1, 6)', 'An error'],
            0,
            ['sk-numpy'],
            'Both size-1 dimensions stretch. Watch for this when you meant an elementwise add.',
          ),
          mcq(
            'Which is the split-apply-combine operation?',
            ['merge', 'groupby().agg()', 'sort_values', 'reset_index'],
            1,
            ['sk-pandas'],
            'Split into groups, apply an aggregation, combine the results.',
          ),
          trueFalse(
            'Pinning exact dependency versions is needed for a result to be reproducible months later.',
            true,
            ['sk-environments'],
            'Unpinned dependencies mean the same code runs against different libraries over time.',
          ),
        ],
      },
    },
  ],
};
