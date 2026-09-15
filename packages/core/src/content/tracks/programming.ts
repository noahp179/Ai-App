/**
 * Track 27 — Programming Fundamentals.
 *
 * The track the whole catalog quietly assumed. Every other track here says
 * "write a loop" or "call this function" as though that were settled; for a
 * large share of people arriving at AI from outside software, it is not.
 *
 * Taught in JavaScript because that is what the in-app runner executes, but
 * almost nothing here is about JavaScript — the ideas transfer to Python in an
 * afternoon, which the next track does.
 */

import type { Track } from '../../domain/types';
import { categorize, codeOutput, codeWrite, concept, fill, interactive, lesson, mcq, multi, numeric, order, shortAnswer, trueFalse } from '../builders';

export const programmingTrack: Track = {
  id: 'track-programming',
  title: 'Programming Fundamentals',
  tagline: 'From nothing to writing code that runs',
  description:
    'Variables, branching, loops, functions, collections, and failure — taught by writing code that actually executes against test cases in the app. No prior programming assumed, and nothing skipped because it "should be obvious".',
  domain: 'programming',
  level: 'intro',
  icon: '⌨️',
  gradient: ['#22C55E', '#06B6D4'],
  prerequisites: [],
  outcomes: [
    'Read a piece of code and say what it does, line by line',
    'Write a loop that terminates and touches every element exactly once',
    'Write a function with a clear contract and a return value',
    'Choose between a list, a map, and a set from the access pattern',
    'Predict what happens when two names refer to the same object',
    'Handle failure deliberately rather than letting it propagate silently',
  ],
  units: [
    // -----------------------------------------------------------------------
    {
      id: 'unit-prog-1',
      title: 'Values and Decisions',
      description: 'Naming things, and making the program choose.',
      lessons: [
        lesson({
          id: 'lesson-variables',
          title: 'Variables, Values, and Types',
          summary: 'A name, a box, and a thing in the box. Most early bugs live in the gap.',
          level: 'intro',
          domain: 'programming',
          free: true,
          steps: [
            concept(
              'A variable is a name bound to a value',
              'Programming is mostly moving values around. A **variable** gives a value a name so you can refer to it later.\n\n```\nlet score = 0;\nconst name = "Ada";\nscore = score + 10;\n```\n\nThree things are happening. `let` says "make a new name". `=` is **assignment**, not equality — it means "put this value in that name", which is why `score = score + 10` is sensible rather than a contradiction. And `const` says the name will never be re-bound.\n\nEvery value has a **type**, which decides what you can do with it:\n\n| Type | Example | What it is for |\n|---|---|---|\n| number | `42`, `3.14` | Arithmetic |\n| string | `"Ada"` | Text |\n| boolean | `true`, `false` | Decisions |\n| array | `[1, 2, 3]` | An ordered sequence |\n| object | `{ name: "Ada" }` | Named fields |\n| null / undefined | — | Deliberately nothing / not set yet |\n\nTypes matter because operations mean different things for different types. `1 + 1` is `2`; `"1" + "1"` is `"11"`. Neither is wrong; `+` means addition for numbers and joining for strings, and a surprising amount of debugging is discovering you had a string where you assumed a number.\n\nThe habit worth forming immediately: **name things for what they mean**, not what they are. `userCount` beats `n`, and `isEligible` beats `flag`. You will read this code far more often than you write it.',
              {
                keyTerms: [
                  { term: 'Variable', definition: 'A name bound to a value, which the program can read and sometimes change.' },
                  { term: 'Type', definition: 'What kind of value it is, which decides what operations mean.' },
                ],
              },
            ),
            interactive(
              'Watch the values change',
              'code-tracer',
              'Step through a short program one line at a time and watch each variable take its value. Try predicting the next state before you press step — the gap between your prediction and the machine is exactly where bugs come from.',
            ),
            codeOutput(
              'What does this print?',
              'javascript',
              'let a = 5;\nlet b = a;\na = 10;\nconsole.log(b);',
              ['10', '5', 'undefined', 'an error'],
              1,
              ['sk-variables-types'],
              '`b = a` copied the *value* 5 into b. Changing `a` afterwards does not reach back into b. This holds for numbers, strings and booleans — and, importantly, does not hold for arrays and objects, which is the subject of a later lesson.',
            ),
            codeOutput(
              'What does this print?',
              'javascript',
              'console.log(1 + 1);\nconsole.log("1" + "1");',
              ['2 then 2', '2 then 11', '11 then 11', 'an error'],
              1,
              ['sk-variables-types'],
              '`+` adds numbers and joins strings. `"1"` with quotes is text, not a number — which is why input from a form or a file almost always needs converting before you do arithmetic on it.',
            ),
            categorize(
              'Sort each value by type.',
              ['Number', 'String', 'Boolean', 'Array'],
              [
                { item: '42', category: 'Number' },
                { item: '"42"', category: 'String' },
                { item: 'true', category: 'Boolean' },
                { item: '[1, 2, 3]', category: 'Array' },
                { item: '3.14', category: 'Number' },
                { item: '"true"', category: 'String' },
              ],
              ['sk-variables-types'],
              'Quotes make it text. `"42"` and `"true"` are strings that happen to look like other things, and that resemblance is where the confusion starts.',
            ),
            mcq(
              'Which variable name is best?',
              ['x', 'temp2', 'daysUntilRenewal', 'dur'],
              2,
              ['sk-variables-types'],
              'It says what the value means. Someone reading `if (daysUntilRenewal < 7)` understands it without scrolling; `if (x < 7)` sends them hunting.',
            ),
            order(
              'You are asked: "find the most expensive item in a basket". Put the plan in order before writing any code.',
              [
                'Decide what to return when the basket is empty',
                'Keep a running "most expensive so far", starting with the first item',
                'Compare each remaining item against it',
                'Replace the running best when an item beats it',
                'Return the running best',
              ],
              ['sk-pseudocode'],
              'Writing the plan in plain language first is not a beginner\u2019s crutch — it is where the empty-basket decision gets made, which is the case that would otherwise be discovered by a crash in production.',
            ),
          ],
        }),
        lesson({
          id: 'lesson-control-flow',
          title: 'Making Decisions',
          summary: 'Conditions, branches, and the boolean logic underneath them.',
          level: 'intro',
          domain: 'programming',
          free: true,
          steps: [
            concept(
              'if, else, and the condition in between',
              'Without branching a program does the same thing every time. An **if statement** makes it respond to its input.\n\n```\nif (temperature > 30) {\n  advice = "Stay inside";\n} else if (temperature > 20) {\n  advice = "Lovely day";\n} else {\n  advice = "Bring a coat";\n}\n```\n\nThe thing in the parentheses is a **condition**: an expression that evaluates to true or false. The branches are checked **in order** and only the first match runs, which is why ordering them wrong is such a common bug — put `temperature > 20` first and the 35° case never reaches the right branch.\n\nComparison operators produce booleans:\n\n| Operator | Meaning |\n|---|---|\n| `===` | equal (and the same type) |\n| `!==` | not equal |\n| `<` `>` | less / greater than |\n| `<=` `>=` | or equal to |\n\nNote `===` for comparison against `=` for assignment. Using `=` inside an `if` is a classic error: it assigns instead of comparing, and the condition then reflects the assigned value rather than any comparison.\n\nConditions combine with **and** (`&&`), **or** (`||`), and **not** (`!`) — which is the propositional logic from the discrete maths track, running on a machine.',
              {
                keyTerms: [
                  { term: 'Condition', definition: 'An expression evaluating to true or false, deciding which branch runs.' },
                  { term: 'Branch', definition: 'One of the alternative paths through an if statement.' },
                ],
              },
            ),
            codeOutput(
              'What is printed?',
              'javascript',
              'const age = 25;\nif (age > 65) {\n  console.log("senior");\n} else if (age > 18) {\n  console.log("adult");\n} else if (age > 12) {\n  console.log("teen");\n} else {\n  console.log("child");\n}',
              ['senior', 'adult', 'teen', 'adult then teen'],
              1,
              ['sk-control-flow'],
              'Branches are checked top to bottom and only the first true one runs. 25 fails the first test, passes the second, and the rest are never evaluated.',
            ),
            mcq(
              'A discount applies to members OR to orders over £50. Which condition is right?',
              [
                'isMember && total > 50',
                'isMember || total > 50',
                '!isMember || total > 50',
                'isMember && !(total > 50)',
              ],
              1,
              ['sk-control-flow'],
              '"Or" is `||`. Using `&&` would require both, which would deny the discount to a member spending £10 — and would be discovered by a customer rather than by you.',
            ),
            fill(
              'In most languages `=` means ___ and `===` means ___.',
              [['assignment', 'assign'], ['comparison', 'equality', 'compare']],
              ['sk-control-flow'],
              'Confusing them inside an `if` produces a condition that silently assigns and then tests the assigned value.',
            ),
            codeWrite({
              prompt:
                'Write `grade(score)`. Return "A" for 90 and above, "B" for 80–89, "C" for 70–79, and "F" below 70.',
              functionName: 'grade',
              starter: 'function grade(score) {\n  // Check the highest band first.\n\n  return "F";\n}',
              tests: [
                { args: [95], expected: 'A' },
                { args: [85], expected: 'B' },
                { args: [72], expected: 'C' },
                { args: [40], expected: 'F' },
              ],
              hiddenTests: [
                { args: [90], expected: 'A' },
                { args: [80], expected: 'B' },
                { args: [70], expected: 'C' },
                { args: [69], expected: 'F' },
              ],
              solution:
                'function grade(score) {\n  if (score >= 90) return "A";\n  if (score >= 80) return "B";\n  if (score >= 70) return "C";\n  return "F";\n}',
              skillIds: ['sk-control-flow', 'sk-off-by-one'],
              explanation:
                'Checking the highest band first means each later test only has to handle what fell through. The hidden cases are all exact boundaries — 90, 80, 70, 69 — because that is where this kind of code actually breaks: `>` where `>=` was meant silently misgrades every student on the line.',
              hint: 'Return as soon as a band matches; then the next line only sees scores that failed it.',
            }),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-prog-1',
        title: 'Values and Decisions Checkpoint',
        passingScore: 0.7,
        exercises: [
          mcq(
            'What does `"5" + 3` produce in JavaScript?',
            ['8', '"53"', 'an error', '15'],
            1,
            ['sk-variables-types'],
            'A string on the left makes `+` mean joining rather than adding.',
          ),
          mcq(
            'In an if / else-if chain, how many branches run?',
            ['All that match', 'Only the first that matches', 'Only the last that matches', 'Exactly one, always'],
            1,
            ['sk-control-flow'],
            'First match wins, and nothing after it is even evaluated.',
          ),
          trueFalse(
            '`=` assigns while `===` compares, which is why `if (x = 5)` is a classic bug.',
            true,
            ['sk-control-flow'],
            '`if (x = 5)` assigns 5 to x and then tests 5, which is truthy — so the branch always runs and x is silently clobbered. The assignment is a valid expression, so nothing complains; linters flag it precisely because the language will not.',
          ),
        ],
      },
    },
    // -----------------------------------------------------------------------
    {
      id: 'unit-prog-2',
      title: 'Repetition and Reuse',
      description: 'Loops that end, and functions that can be trusted.',
      lessons: [
        lesson({
          id: 'lesson-loops',
          title: 'Loops and Their Edges',
          summary: 'Doing something n times, and getting n right.',
          level: 'intro',
          domain: 'programming',
          steps: [
            concept(
              'Three ways to repeat',
              'Copy-pasting a line five times works until it is five hundred. A **loop** repeats a block while something holds.\n\n```\n// Count-controlled: run a known number of times\nfor (let i = 0; i < 5; i++) {\n  console.log(i);          // 0 1 2 3 4\n}\n\n// Condition-controlled: run until something changes\nwhile (queue.length > 0) {\n  process(queue.pop());\n}\n\n// Collection-controlled: visit each element\nfor (const item of basket) {\n  total = total + item.price;\n}\n```\n\nThe `for` loop has three parts separated by semicolons: **initialise** (`let i = 0`), **test before each pass** (`i < 5`), and **advance after each pass** (`i++`).\n\nIndices start at **0**, not 1. An array of 5 elements has indices 0 through 4, so the last index is always `length - 1`. This is not a quirk to memorise so much as a convention to internalise, because it shapes every boundary condition you will write.\n\nThe failure mode to fear is the loop that never ends: a `while` whose condition never becomes false, because nothing inside it changes the thing being tested. Every `while` loop needs you to be able to point at the line that eventually stops it.',
              {
                keyTerms: [
                  { term: 'Iteration', definition: 'One pass through the loop body.' },
                  { term: 'Zero-indexed', definition: 'The first element is at index 0, so the last is at length − 1.' },
                ],
              },
            ),
            codeOutput(
              'How many lines does this print?',
              'javascript',
              'for (let i = 0; i < 5; i++) {\n  console.log(i);\n}',
              ['4', '5', '6', 'infinitely many'],
              1,
              ['sk-loops'],
              'i takes 0, 1, 2, 3, 4 — five passes. It stops at 5 because the test runs *before* the body.',
            ),
            mcq(
              'An array `xs` has 8 elements. What is the index of the last one?',
              ['8', '7', '9', 'It depends on the contents'],
              1,
              ['sk-off-by-one'],
              '`length - 1`. Writing `i <= xs.length` instead of `i < xs.length` reads one past the end, which is the single most common loop bug there is.',
            ),
            mcq(
              'Why does this loop never end?  `let n = 10; while (n > 0) { console.log(n); }`',
              [
                'The condition is wrong',
                'Nothing inside the body changes n, so the condition stays true forever',
                'console.log blocks',
                'n should be a const',
              ],
              1,
              ['sk-loops'],
              'A while loop needs something in the body to move the condition toward false. Here `n` is never decremented.',
            ),
            codeWrite({
              prompt:
                'Write `sumEven(xs)`. Return the sum of the even numbers in the array. An empty array sums to 0.',
              functionName: 'sumEven',
              starter:
                'function sumEven(xs) {\n  let total = 0;\n  // Visit each element. A number is even\n  // when n % 2 === 0.\n\n  return total;\n}',
              tests: [
                { args: [[1, 2, 3, 4]], expected: 6 },
                { args: [[]], expected: 0 },
                { args: [[1, 3, 5]], expected: 0 },
                { args: [[2, 4, 6]], expected: 12 },
              ],
              hiddenTests: [
                { args: [[0]], expected: 0 },
                { args: [[-2, -3, -4]], expected: -6 },
                { args: [[7]], expected: 0 },
              ],
              solution:
                'function sumEven(xs) {\n  let total = 0;\n  for (const n of xs) {\n    if (n % 2 === 0) total += n;\n  }\n  return total;\n}',
              skillIds: ['sk-loops', 'sk-control-flow'],
              explanation:
                'An accumulator starting at 0, a loop, and a condition — the shape of an enormous number of small programs. Note that negatives work without any extra code: `-4 % 2` is 0, so the evenness test does not need a special case.',
              hint: 'The remainder operator `%` gives what is left after division.',
            }),
            codeWrite({
              prompt:
                'Write `countdown(n)`. Return an array counting down from n to 1. `countdown(0)` returns an empty array.',
              functionName: 'countdown',
              starter:
                'function countdown(n) {\n  const out = [];\n  // Make sure the loop actually terminates.\n\n  return out;\n}',
              tests: [
                { args: [3], expected: [3, 2, 1] },
                { args: [1], expected: [1] },
                { args: [0], expected: [] },
              ],
              hiddenTests: [
                { args: [5], expected: [5, 4, 3, 2, 1] },
                { args: [-2], expected: [] },
              ],
              solution:
                'function countdown(n) {\n  const out = [];\n  for (let i = n; i >= 1; i--) {\n    out.push(i);\n  }\n  return out;\n}',
              skillIds: ['sk-loops', 'sk-off-by-one'],
              explanation:
                'Counting down means the advance step decrements and the test is `>=` rather than `<`. The hidden case with a negative n checks that the loop simply never runs rather than spinning forever — which it would if you wrote `i !== 0` instead of `i >= 1`.',
            }),
          ],
        }),
        lesson({
          id: 'lesson-functions',
          title: 'Functions and Scope',
          summary: 'A named piece of behaviour with a contract, and where its names live.',
          level: 'intro',
          domain: 'programming',
          steps: [
            concept(
              'Inputs, a body, and one thing coming back',
              'A **function** packages behaviour behind a name so it can be reused and reasoned about separately.\n\n```\nfunction areaOfCircle(radius) {\n  return Math.PI * radius * radius;\n}\n\nconst a = areaOfCircle(3);\n```\n\n**Parameters** (`radius`) are the names the function uses for its inputs. **Arguments** (`3`) are the actual values at the call. **Return** hands a value back and exits immediately — any code after a `return` in the same branch never runs.\n\nA function with no `return` gives back `undefined`, which is a common surprise: forget the keyword and everything downstream quietly receives nothing.\n\nWhat makes a function *good* is the contract. Ideally it does one thing, its name says what, and the answer depends only on the arguments. `calculateTax(income, rate)` can be tested and trusted. `doStuff()` that reads three globals and writes a file can only be understood by reading all of it.\n\nThe practical test: could you describe what it does in one sentence, without "and"? If not, it is probably two functions.',
              {
                keyTerms: [
                  { term: 'Parameter', definition: 'The name a function gives one of its inputs.' },
                  { term: 'Return value', definition: 'What the call evaluates to; `undefined` if nothing is returned.' },
                ],
              },
            ),
            codeOutput(
              'What does this print?',
              'javascript',
              'function double(n) {\n  n * 2;\n}\nconsole.log(double(4));',
              ['8', 'undefined', '4', 'an error'],
              1,
              ['sk-functions'],
              'The expression is computed and thrown away — there is no `return`. A function without one evaluates to `undefined`, and the bug surfaces far from here.',
            ),
            concept(
              'Scope: where a name is visible',
              '**Scope** is the region of the program in which a name means something.\n\n```\nlet total = 0;                 // outer scope\n\nfunction addTax(amount) {\n  const rate = 0.2;            // inner scope\n  return amount * (1 + rate);\n}\n\nconsole.log(rate);             // error: rate is not defined here\n```\n\nNames declared inside a function are invisible outside it. This is what makes functions safe to use without reading them: `addTax` cannot accidentally collide with a `rate` you are using elsewhere.\n\nInner scopes can see outward but not the reverse, and a name declared inside **shadows** an outer one of the same name — which is occasionally useful and frequently confusing.\n\nThe idea that trips everyone once is the **closure**: a function remembers the scope it was created in, even after that scope has finished.\n\n```\nfunction makeCounter() {\n  let count = 0;\n  return function () {\n    count = count + 1;\n    return count;\n  };\n}\n\nconst next = makeCounter();\nnext();  // 1\nnext();  // 2\n```\n\n`makeCounter` has returned, and yet `count` is still alive, still private, still incrementing. That is a closure, and it is how callbacks, event handlers and most module patterns keep state without globals.',
              {
                keyTerms: [
                  { term: 'Scope', definition: 'The region in which a declared name is visible.' },
                  { term: 'Closure', definition: 'A function plus the surrounding variables it captured when it was created.' },
                ],
              },
            ),
            codeOutput(
              'What does this print?',
              'javascript',
              'function makeCounter() {\n  let count = 0;\n  return function () { count++; return count; };\n}\nconst a = makeCounter();\nconst b = makeCounter();\na(); a();\nconsole.log(a(), b());',
              ['3 3', '3 1', '1 1', '2 1'],
              1,
              ['sk-scope-closures'],
              'Each call to `makeCounter` creates a *separate* `count`. `a` has been called three times and `b` once — they do not share state, which is exactly the point of the pattern.',
            ),
            trueFalse(
              'A variable declared inside a function can be read from outside it.',
              false,
              ['sk-scope-closures'],
              'That containment is what lets you use a function without reading its body.',
            ),
            codeWrite({
              prompt:
                'Build a counter with a closure. `tally(times)` should create a counter whose count starts at 0, call it `times` times, and return the final count. The count must live inside the closure, not in a global.',
              functionName: 'tally',
              starter:
                'function tally(times) {\n  function makeCounter() {\n    // Keep the count in here, and return a\n    // function that increments and returns it.\n    return function () { return 0; };\n  }\n\n  const next = makeCounter();\n  let last = 0;\n  for (let i = 0; i < times; i++) last = next();\n  return last;\n}',
              tests: [
                { args: [3], expected: 3 },
                { args: [1], expected: 1 },
                { args: [0], expected: 0 },
              ],
              hiddenTests: [
                { args: [10], expected: 10 },
                { args: [2], expected: 2 },
              ],
              solution:
                'function tally(times) {\n  function makeCounter() {\n    let count = 0;\n    return function () {\n      count = count + 1;\n      return count;\n    };\n  }\n\n  const next = makeCounter();\n  let last = 0;\n  for (let i = 0; i < times; i++) last = next();\n  return last;\n}',
              skillIds: ['sk-scope-closures', 'sk-functions'],
              explanation:
                'The `count` declared inside `makeCounter` survives after `makeCounter` has returned, because the function it returned still refers to it. Nothing outside can reach that variable — it is private by construction rather than by convention, which is the whole appeal of the pattern.',
              hint: 'Declare the count inside makeCounter, above the returned function.',
            }),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-prog-2',
        title: 'Loops and Functions Checkpoint',
        passingScore: 0.7,
        exercises: [
          numeric(
            'How many times does the body of `for (let i = 0; i < 7; i++)` run?',
            7,
            ['sk-loops'],
            'i takes 0 through 6.',
          ),
          mcq(
            'A function with no return statement evaluates to what?',
            ['0', 'null', 'undefined', 'The last expression'],
            2,
            ['sk-functions'],
            'Which then propagates silently into whatever used the result.',
          ),
          mcq(
            'What is a closure?',
            [
              'A function that closes a file',
              'A function together with the surrounding variables it captured when it was created',
              'A loop that has terminated',
              'A private class method',
            ],
            1,
            ['sk-scope-closures'],
            'The captured scope outlives the call that created it.',
          ),
        ],
      },
    },
    // -----------------------------------------------------------------------
    {
      id: 'unit-prog-3',
      title: 'Data and Failure',
      description: 'Collections, references, text, and what to do when things go wrong.',
      lessons: [
        lesson({
          id: 'lesson-collections',
          title: 'Collections and References',
          summary: 'Lists, maps, sets — and the aliasing that surprises everyone once.',
          level: 'intermediate',
          domain: 'programming',
          steps: [
            concept(
              'Three shapes, three access patterns',
              'Nearly all everyday data fits one of three shapes, and picking the wrong one makes simple code slow or convoluted.\n\n**Array / list** — ordered, indexed, duplicates allowed. Use when order matters or you will iterate in sequence. Lookup by index is instant; searching for a value means scanning.\n\n**Map / object / dictionary** — key to value, unordered, keys unique. Use when you look things up *by* something. `usersById.get("a17")` is instant regardless of size.\n\n**Set** — membership only, no duplicates, unordered. Use for "have I seen this?" and for deduplicating.\n\n```\nconst scores = [90, 85, 72];               // array\nconst byName = { ada: 90, alan: 85 };      // object as map\nconst seen = new Set(["a17", "b04"]);      // set\n```\n\nThe rule is the one from the data structures track, in miniature: **pick the structure from how you will access it**, not from how the data arrives. A list you search by name a thousand times a second wanted to be a map, and turning it into one is usually a three-line change and a hundredfold speedup.',
              {
                keyTerms: [
                  { term: 'Map', definition: 'A collection addressed by key rather than position.' },
                  { term: 'Set', definition: 'A collection that answers membership and holds no duplicates.' },
                ],
              },
            ),
            categorize(
              'Which structure fits each job?',
              ['Array', 'Map', 'Set'],
              [
                { item: 'Steps of a recipe, in order', category: 'Array' },
                { item: 'Look up a user by their id', category: 'Map' },
                { item: 'Which article ids has this reader already seen', category: 'Set' },
                { item: 'Word count per word in a document', category: 'Map' },
                { item: 'The leaderboard, ranked', category: 'Array' },
              ],
              ['sk-collections'],
              'Order → array. Lookup by key → map. Membership → set.',
            ),
            concept(
              'Value versus reference: the aliasing trap',
              'Earlier, copying a number gave an independent copy. Arrays and objects behave differently, and this catches everybody once.\n\n```\nconst a = [1, 2, 3];\nconst b = a;\nb.push(4);\nconsole.log(a);   // [1, 2, 3, 4]\n```\n\n`b = a` did not copy the array. It copied a **reference** to it, so `a` and `b` are two names for one array. Mutating through either is visible through both.\n\nThis is not a flaw — copying a million-element array on every assignment would be ruinous — but it means you have to be deliberate. To get an independent copy:\n\n```\nconst copy = [...a];              // shallow copy of an array\nconst copyObj = { ...original };  // shallow copy of an object\n```\n\n**Shallow** is the word to notice. A copied array of objects holds references to the *same* objects, so mutating one of them is still visible through both arrays. Deep copying is available (`structuredClone`) and is rarely what you actually want.\n\nThe habit that avoids the whole category: **prefer creating new values over mutating existing ones**. `const updated = [...items, newItem]` cannot surprise anyone at a distance, which is why the functional style in the paradigms track leans on it so heavily.',
              {
                keyTerms: [
                  { term: 'Reference', definition: 'A value that points at an object rather than containing it.' },
                  { term: 'Aliasing', definition: 'Two names referring to the same underlying object.' },
                ],
              },
            ),
            codeOutput(
              'What does this print?',
              'javascript',
              'const a = { count: 1 };\nconst b = a;\nb.count = 99;\nconsole.log(a.count);',
              ['1', '99', 'undefined', 'an error'],
              1,
              ['sk-mutability'],
              'One object, two names. This is the mechanism behind a whole genre of bug where state changes "on its own" — something else held a reference to the same object.',
            ),
            mcq(
              'You copy an array of objects with `[...items]` and then change a field on one object. What does the original array show?',
              [
                'The old value — the copy is independent',
                'The new value — the copy is shallow, so both arrays hold the same objects',
                'An error',
                'It depends on the array length',
              ],
              1,
              ['sk-mutability'],
              'The array is new; the objects inside it are not. This is the most common misunderstanding about spread copying.',
            ),
            codeWrite({
              prompt:
                'Write `unique(xs)`. Return a new array with duplicates removed, keeping the first occurrence of each value in order.',
              functionName: 'unique',
              starter:
                'function unique(xs) {\n  const out = [];\n  // A Set is good at "have I seen this".\n\n  return out;\n}',
              tests: [
                { args: [[1, 2, 2, 3, 1]], expected: [1, 2, 3] },
                { args: [[]], expected: [] },
                { args: [['a', 'a', 'a']], expected: ['a'] },
              ],
              hiddenTests: [
                { args: [[3, 1, 2]], expected: [3, 1, 2] },
                { args: [[0, 0, 1]], expected: [0, 1] },
              ],
              solution:
                'function unique(xs) {\n  const out = [];\n  const seen = new Set();\n  for (const x of xs) {\n    if (!seen.has(x)) {\n      seen.add(x);\n      out.push(x);\n    }\n  }\n  return out;\n}',
              skillIds: ['sk-collections'],
              explanation:
                'The set makes each membership check O(1), so the whole function is O(n). Doing it with `out.includes(x)` instead also works and is O(n²) — fine for ten items, a problem at a hundred thousand, and the difference is one word.',
              hint: 'Track what you have already emitted.',
            }),
          ],
        }),
        lesson({
          id: 'lesson-text-errors',
          title: 'Text, Errors, and Reading Code',
          summary: 'Strings are harder than they look, and failure deserves a plan.',
          level: 'intermediate',
          domain: 'programming',
          steps: [
            concept(
              'A string is not a row of letters',
              'Text looks simple and is not. A string is a sequence of **code units**, and the relationship between those and what a human calls "a character" is not one to one.\n\n`"café".length` is 4 — or 5, if the é arrived as `e` plus a combining accent. `"👨‍👩‍👧".length` is 8. Emoji, accents, and most non-Latin scripts all break the assumption that one visible glyph is one unit.\n\nThe practical rules:\n\n- **Never assume length equals characters** for user-supplied text. Truncating by index will one day cut an emoji in half.\n- **Strings are immutable** in most languages: methods like `toUpperCase` return a *new* string rather than changing the old one. Forgetting to use the result is a classic no-op bug.\n- **Comparison is not obvious.** `"Straße"` and `"STRASSE"`, or the same character written two different ways, need normalisation before they compare equal.\n- **Encoding is a decision.** UTF-8 is the answer; mojibake is what happens when two parts of a system disagree.\n\nThis is the same territory as the tokenization lesson in the LLM track: a model that splits text into tokens is making exactly these decisions, which is why token counts do not match character counts and why some languages cost more per sentence.',
              {
                keyTerms: [
                  { term: 'Code unit', definition: 'The storage unit of a string, which may be less than one visible character.' },
                  { term: 'Immutable', definition: 'Cannot be changed in place; operations return a new value.' },
                ],
              },
            ),
            codeOutput(
              'What does this print?',
              'javascript',
              'let name = "ada";\nname.toUpperCase();\nconsole.log(name);',
              ['ADA', 'ada', 'undefined', 'an error'],
              1,
              ['sk-strings-text'],
              'Strings are immutable: `toUpperCase` returned a new string that was discarded. You need `name = name.toUpperCase()`.',
            ),
            trueFalse(
              'For any string, `.length` equals the number of characters a reader would count.',
              false,
              ['sk-strings-text'],
              'Emoji, combining accents and many scripts break this. It holds for plain ASCII, which is why the assumption survives right up until it meets a real user.',
            ),
            concept(
              'Failing on purpose',
              'Code fails. The network is down, the file is missing, the input is nonsense. What separates robust programs from fragile ones is not that they fail less — it is that they decide *in advance* what failure looks like.\n\nThree strategies, in rough order of preference:\n\n**Make it impossible.** Validate at the boundary so the bad state never gets in. A function that cannot receive a negative price does not need to handle one.\n\n**Return the failure as a value.** `{ ok: false, error: "..." }` or an optional. The caller cannot ignore it by accident, because they have to unpack the result to use it.\n\n**Throw an exception.** For genuinely exceptional cases — a programming error, an unrecoverable state. It unwinds until someone catches it.\n\n```\ntry {\n  const data = JSON.parse(input);\n  use(data);\n} catch (error) {\n  showMessage("That file is not valid JSON.");\n}\n```\n\nThe anti-pattern to avoid is the empty catch — `catch (e) {}` — which converts a loud failure into a silent wrong answer. If you truly want to ignore an error, say so in a comment and say why, because the next reader will otherwise assume you forgot.\n\nAnd catch **narrowly**. Wrapping two hundred lines in one try means you no longer know which of them failed, and a typo inside gets reported as a network error.',
              {
                keyTerms: [
                  { term: 'Exception', definition: 'A thrown failure that unwinds until something catches it.' },
                  { term: 'Empty catch', definition: 'Swallowing an error silently — a loud failure turned into a quiet wrong answer.' },
                ],
              },
            ),
            mcq(
              'Why is `catch (e) {}` with an empty body dangerous?',
              [
                'It is slow',
                'It converts a visible failure into a silent wrong result',
                'It cannot be nested',
                'It catches too few errors',
              ],
              1,
              ['sk-errors-exceptions'],
              'The program carries on with bad state and fails later, somewhere unrelated, with no trace of the cause.',
            ),
            order(
              'Order these failure strategies from most to least preferable.',
              [
                'Validate at the boundary so the bad state cannot occur',
                'Return the failure as a value the caller must unpack',
                'Throw an exception for a genuinely exceptional case',
                'Catch broadly and log',
              ],
              ['sk-errors-exceptions'],
              'Prevention beats handling; explicit beats implicit; narrow beats broad.',
            ),
            concept(
              'Reading code you did not write',
              'You will read far more code than you write, most of it written by someone who is no longer available to ask. That is a skill of its own, and it is not "read every line top to bottom".\n\nWhat works:\n\n**Start at the edges.** Find where the code is entered — a route handler, a `main`, a test — and follow one path through. One complete path teaches more than twenty functions skimmed.\n\n**Read the tests first.** They are executable documentation of what the author believed the code should do, including the cases they thought were tricky.\n\n**Follow the data, not the control.** Ask where this value comes from and where it goes. Call graphs are large; data paths are usually short.\n\n**Run it.** Add a print, or use a debugger, and watch actual values. Five minutes of observation beats an hour of inference — this is the debugging discipline from the engineering track applied to comprehension rather than to bugs.\n\n**Accept not understanding all of it.** The goal is almost never total comprehension. It is enough understanding to make the change safely, plus a clear sense of what you are still unsure about.',
              {
                keyTerms: [
                  { term: 'Entry point', definition: 'Where execution begins — the thread to pull on first.' },
                ],
              },
            ),
            multi(
              'Which help most when facing an unfamiliar codebase?',
              [
                'Reading the tests to learn the intended behaviour',
                'Following one complete path from an entry point',
                'Reading every file alphabetically',
                'Adding a print statement and running it',
              ],
              [0, 1, 3],
              ['sk-reading-code'],
              'Depth on one path beats breadth across all of them, and running the thing beats reasoning about it.',
            ),
            shortAnswer(
              'You are handed a 40,000-line codebase and asked to fix a bug in checkout. How do you start?',
              ['reproduce', 'test', 'entry', 'trace', 'path'],
              'Reproduce the bug first, so I know I can tell when it is fixed. Then find the entry point for checkout — a route or handler — and follow that one path through, reading the tests around it to learn what the author intended. I would add logging or a breakpoint to watch the real values rather than inferring them, and narrow down by bisecting the path until the point where the data stops being right. Total comprehension of 40,000 lines is not the goal; understanding the one path well enough to change it safely is.',
              ['sk-reading-code', 'sk-debugging'],
              'Reproduce, follow one path, read the tests, observe real values, narrow.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-prog-3',
        title: 'Data and Failure Checkpoint',
        passingScore: 0.7,
        exercises: [
          mcq(
            'Two names refer to the same array. One pushes an element. What does the other see?',
            ['The old array', 'The new element too — they are one array', 'An error', 'A copy'],
            1,
            ['sk-mutability'],
            'Assignment copies the reference, not the array.',
          ),
          mcq(
            'Which collection is right for "have I already processed this id?"',
            ['Array', 'Set', 'Ordered list', 'String'],
            1,
            ['sk-collections'],
            'Membership in constant time with no duplicates.',
          ),
          trueFalse(
            '`name.toUpperCase()` changes `name` in place.',
            false,
            ['sk-strings-text'],
            'Strings are immutable; it returns a new one that you have to keep.',
          ),
        ],
      },
    },
  ],
};
