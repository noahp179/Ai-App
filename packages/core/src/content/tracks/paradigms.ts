/**
 * Track 29 — Programming Paradigms.
 *
 * Once you can write code, the question becomes how to organise it. Objects,
 * functions, and types are three answers to the same problem — managing
 * complexity — and every real codebase uses a mixture. Presented as a set of
 * trade-offs rather than a set of camps.
 */

import type { Track } from '../../domain/types';
import { categorize, codeOutput, concept, fill, interactive, lesson, match, mcq, multi, order, shortAnswer, trueFalse } from '../builders';

export const paradigmsTrack: Track = {
  id: 'track-paradigms',
  title: 'Programming Paradigms',
  tagline: 'Objects, functions, and types as three answers to one problem',
  description:
    'Object-orientation, functional programming, and type systems — what each is actually for, where each stops helping, and why almost every modern codebase mixes all three rather than picking a side.',
  domain: 'programming',
  level: 'intermediate',
  icon: '🧬',
  gradient: ['#EC4899', '#6366F1'],
  prerequisites: ['track-programming'],
  outcomes: [
    'Choose composition over inheritance and say why in a specific case',
    'Identify a side effect and understand what purity buys you',
    'Use map, filter and reduce where they genuinely read better than a loop',
    'Argue both sides of static versus dynamic typing without caricature',
    'Explain why null is a design flaw and what replaced it',
  ],
  units: [
    // -----------------------------------------------------------------------
    {
      id: 'unit-para-1',
      title: 'Organising With Objects',
      description: 'State, encapsulation, and the inheritance trap.',
      lessons: [
        lesson({
          id: 'lesson-oop',
          title: 'Objects and Encapsulation',
          summary: 'Bundle state with the behaviour that maintains it.',
          level: 'intermediate',
          domain: 'programming',
          free: true,
          steps: [
            concept(
              'The invariant is the point',
              'An **object** bundles data with the operations that act on it. The usual explanation stops there, and misses what it is for.\n\nThe point is the **invariant** — a property that must always be true of the data. A `BankAccount` whose balance must never go negative can enforce that *if and only if* nothing outside can write the balance directly:\n\n```\nclass BankAccount {\n  #balance = 0;                    // private\n\n  deposit(amount) {\n    if (amount <= 0) throw new Error("must be positive");\n    this.#balance += amount;\n  }\n\n  withdraw(amount) {\n    if (amount > this.#balance) throw new Error("insufficient funds");\n    this.#balance -= amount;\n  }\n\n  get balance() { return this.#balance; }\n}\n```\n\nEvery path that changes the balance goes through a method that checks. **Encapsulation** is not about hiding for its own sake; it is about reducing the number of places a rule has to be enforced from "everywhere" to "here".\n\nThe corollary is that an object which is just public fields with getters and setters has bought you nothing. It has the shape of encapsulation with none of the substance — the invariant is still everyone’s problem.\n\nThe question to ask of any class: **what does this guarantee that a plain record would not?** If the answer is nothing, a plain record is the better design.',
              {
                keyTerms: [
                  { term: 'Invariant', definition: 'A property of the data that must hold at all times.' },
                  { term: 'Encapsulation', definition: 'Restricting access so an invariant can be enforced in one place.' },
                ],
              },
            ),
            mcq(
              'What does encapsulation primarily buy you?',
              [
                'Faster code',
                'An invariant can be enforced in one place rather than at every call site',
                'Smaller memory use',
                'Automatic serialisation',
              ],
              1,
              ['sk-encapsulation'],
              'Reducing the number of places a rule must hold is the whole return on the complexity.',
            ),
            trueFalse(
              'A class whose fields are all public with trivial getters and setters is properly encapsulated.',
              false,
              ['sk-encapsulation'],
              'Anyone can put it in an invalid state. It has the ceremony without the guarantee.',
            ),
            concept(
              'Inheritance, and why to reach for composition first',
              '**Inheritance** lets a class extend another, reusing its behaviour. It models "is a": a `Dog` is an `Animal`.\n\nIt is also the most over-used tool in object-orientation, and the failure is structural rather than stylistic.\n\nInheritance creates the **tightest possible coupling**. A subclass depends on its parent’s implementation, not merely its interface, so a change to the parent can break subclasses that never mentioned the changed code. This is the *fragile base class* problem.\n\nIt also forces a single hierarchy. Real things belong to several categories at once, and one tree cannot express that. You end up with `AbstractAsyncRetryingHttpClientBase` — a name that is itself the diagnosis.\n\nAnd the classic counter-example: a `Square` that inherits from `Rectangle` breaks every caller that assumed setting width and height independently works. `Square` genuinely *is a* rectangle in mathematics, and still must not inherit from one.\n\n**Composition** — holding another object and delegating — avoids all of this:\n\n```\n// instead of: class Duck extends Bird\nclass Duck {\n  constructor() {\n    this.flight = new Flying();\n    this.voice  = new Quacking();\n  }\n}\n```\n\nBehaviours become swappable at runtime, testable in isolation, and combinable in any mixture. The rule of thumb that has survived: **inherit to share an interface, compose to share behaviour.**',
              {
                keyTerms: [
                  { term: 'Composition', definition: 'Building behaviour by holding and delegating to other objects.' },
                  { term: 'Fragile base class', definition: 'A parent change breaking subclasses that never referenced it.' },
                ],
              },
            ),
            mcq(
              'Why is `class Square extends Rectangle` the classic counter-example?',
              [
                'Squares are not rectangles',
                'Callers who set width and height independently get behaviour that violates what Rectangle promised',
                'It is slower',
                'Rectangle cannot be subclassed',
              ],
              1,
              ['sk-inheritance-composition'],
              'The mathematical "is a" holds and the substitutability does not. Inheritance requires the second, not the first.',
            ),
            mcq(
              'You need a class to have retry behaviour, logging, and caching. What is the better structure?',
              [
                'A chain of three superclasses',
                'Compose three collaborators and delegate to them',
                'One class with three boolean flags',
                'Copy the code into each place',
              ],
              1,
              ['sk-inheritance-composition'],
              'Three orthogonal behaviours do not form a hierarchy. Composition lets them mix in any combination and be tested separately.',
            ),
            concept(
              'Polymorphism: one call, many implementations',
              '**Polymorphism** means a single call site works with several types. It is what lets you add a new case without editing existing code.\n\n```\nfunction render(shapes) {\n  for (const shape of shapes) {\n    shape.draw();          // circle, square, path — caller does not care\n  }\n}\n```\n\nThe alternative is a `switch` on a type tag, which must be found and edited every time a new shape appears — and there is never just one such switch.\n\nWhat matters is the **contract**: anything passed here must have a `draw()` that behaves as callers expect. Languages express that differently — interfaces in Java and Go, protocols in Swift, traits in Rust, duck typing in Python, structural types in TypeScript — but the idea is constant.\n\nThe discipline underneath is the **Liskov substitution principle**: a subtype must be usable anywhere the supertype is, without callers needing to know. Square-and-Rectangle violates it. A subtype that throws "not supported" for an inherited method violates it. When it is violated, callers start type-checking before they act, and the polymorphism you were paying for is gone.',
              {
                keyTerms: [
                  { term: 'Polymorphism', definition: 'One call site working across multiple implementing types.' },
                  { term: 'Liskov substitution', definition: 'A subtype must be usable wherever its supertype is expected.' },
                ],
              },
            ),
            mcq(
              'What does polymorphism let you avoid?',
              [
                'Writing tests',
                'A switch on type that must be edited everywhere a new case is added',
                'Memory allocation',
                'Function calls',
              ],
              1,
              ['sk-polymorphism'],
              'Adding a case becomes adding a type rather than editing every site that branches on type.',
            ),
            trueFalse(
              'A subclass that throws "not supported" for one inherited method is a sign the hierarchy is wrong.',
              true,
              ['sk-polymorphism'],
              'It breaks substitutability — callers must now know the concrete type, which is the thing polymorphism was supposed to buy.',
            ),
          ],
        }),
        lesson({
          id: 'lesson-functional',
          title: 'Functional Thinking',
          summary: 'Purity, immutability, and functions as values.',
          level: 'intermediate',
          domain: 'programming',
          steps: [
            concept(
              'Pure functions and the effects you can see',
              'A **pure function** returns the same output for the same input and changes nothing outside itself. No writes to globals, no I/O, no mutation of arguments.\n\n```\n// pure\nfunction totalWithTax(items, rate) {\n  return items.reduce((sum, i) => sum + i.price, 0) * (1 + rate);\n}\n\n// impure: reads a global, mutates its argument, writes a log\nfunction total(items) {\n  items.sort((a, b) => a.price - b.price);\n  console.log("totalling");\n  return items.reduce((s, i) => s + i.price, 0) * (1 + GLOBAL_RATE);\n}\n```\n\nPurity buys four concrete things:\n\n**Testable.** Call it with inputs, assert on the output. No setup, no mocks, no teardown.\n\n**Reasonable in isolation.** The behaviour is entirely in the signature and the body. You do not have to know what ran before it.\n\n**Cacheable.** Same input, same output means memoisation is always safe.\n\n**Parallelisable.** Nothing shared means no race conditions — the concurrency problems from the systems track simply do not arise.\n\nThe point is not that everything can be pure. A program with no effects does nothing observable. The point is to **push effects to the edges**: a thin impure shell that reads input and writes output, wrapped around a large pure core that does the thinking. That structure is what makes a system testable, and it is why the same advice appears under a dozen different names.',
              {
                keyTerms: [
                  { term: 'Pure function', definition: 'Same input, same output, no observable effect elsewhere.' },
                  { term: 'Side effect', definition: 'Any change outside the return value — I/O, mutation, globals.' },
                ],
              },
            ),
            categorize(
              'Which of these are pure?',
              ['Pure', 'Impure'],
              [
                { item: 'Math.max(a, b)', category: 'Pure' },
                { item: 'Date.now()', category: 'Impure' },
                { item: 'xs.map(x => x * 2)', category: 'Pure' },
                { item: 'xs.sort()', category: 'Impure' },
                { item: 'fetch(url)', category: 'Impure' },
              ],
              ['sk-pure-functions'],
              '`sort` mutates the array in place — the classic trap, because it *also* returns it, so it looks functional. `map` returns a new array and leaves the original alone.',
            ),
            mcq(
              'What is the architectural advice that follows from purity?',
              [
                'Never perform I/O',
                'Push effects to a thin edge and keep a large pure core',
                'Make everything a class',
                'Cache every function',
              ],
              1,
              ['sk-pure-functions'],
              'Functional core, imperative shell. The core is where the logic lives and where testing is cheap.',
            ),
            concept(
              'Immutability, and functions as values',
              '**Immutability** means not changing a value after creating it — you produce a new one instead.\n\n```\n// mutation\nitems.push(newItem);\n\n// new value\nconst updated = [...items, newItem];\n```\n\nThe cost is allocation. The return is that nothing changes underneath anyone: no aliasing surprises, no "who modified this?", trivially safe sharing across threads, and cheap undo because the old value still exists. Persistent data structures make this far less expensive than it looks by sharing the unchanged parts.\n\nThe second idea is that **functions are values**. They can be passed, returned and stored, which gives you three operations that replace most loops:\n\n```\nnums.map(n => n * 2)                    // transform each\nnums.filter(n => n % 2 === 0)           // keep some\nnums.reduce((a, b) => a + b, 0)         // collapse to one\n```\n\n`map` and `filter` say *what* is wanted; a `for` loop with an index and an accumulator says *how* to get it. That is the **declarative versus imperative** distinction, and it is the same distinction as SQL versus a manual scan, or a React component versus DOM manipulation.\n\nUse them where they read better, which is most simple transformations. Not everywhere: a `reduce` that builds three things at once with a nested ternary is a loop that has been made harder to read in order to avoid looking like a loop.',
              {
                keyTerms: [
                  { term: 'Immutability', definition: 'Producing new values rather than modifying existing ones.' },
                  { term: 'Higher-order function', definition: 'One that takes or returns a function.' },
                ],
              },
            ),
            match(
              'Match each operation to what it does.',
              [
                { left: 'map', right: 'Transform every element, same length out' },
                { left: 'filter', right: 'Keep the elements matching a predicate' },
                { left: 'reduce', right: 'Collapse the sequence to a single value' },
                { left: 'forEach', right: 'Run a side effect per element, returning nothing' },
              ],
              ['sk-higher-order'],
              '`forEach` is the odd one out — it exists only for effects, which is why it has no return value.',
            ),
            codeOutput(
              'What does this print?',
              'javascript',
              'const nums = [1, 2, 3, 4];\nconst r = nums.filter(n => n % 2 === 0).map(n => n * 10).reduce((a, b) => a + b, 0);\nconsole.log(r);',
              ['100', '60', '10', '20'],
              1,
              ['sk-higher-order'],
              'Filter to [2, 4], map to [20, 40], reduce to 60. Reading left to right as a pipeline is the point of the style.',
            ),
            mcq(
              'What is the main cost of immutability?',
              [
                'It is harder to read',
                'Allocation — you create new values instead of updating in place',
                'It cannot express loops',
                'It requires a special language',
              ],
              1,
              ['sk-immutability'],
              'Often much smaller than expected, because persistent structures share the parts that did not change.',
            ),
            categorize(
              'Declarative says what you want; imperative says how to get it. Sort each.',
              ['Declarative', 'Imperative'],
              [
                { item: 'SELECT name FROM users WHERE active', category: 'Declarative' },
                { item: 'A for loop with an index and an accumulator', category: 'Imperative' },
                { item: 'items.filter(isActive).map(toName)', category: 'Declarative' },
                { item: 'Manually appending nodes to the DOM', category: 'Imperative' },
                { item: 'Declaring three replicas and letting a controller reconcile', category: 'Declarative' },
              ],
              ['sk-declarative-imperative'],
              'The same distinction recurs at every level: SQL versus a scan, React versus DOM calls, Kubernetes versus a deploy script. In each case you gave up control over the steps and got to state the destination instead.',
            ),
            multi(
              'Which follow from a function being pure?',
              [
                'It can be memoised safely',
                'It can be called from multiple threads without locking',
                'It can be tested without any setup',
                'It runs faster',
              ],
              [0, 1, 2],
              ['sk-pure-functions', 'sk-immutability'],
              'Purity is about reasoning, not speed. An impure function can easily be faster.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-para-1',
        title: 'Objects and Functions Checkpoint',
        passingScore: 0.7,
        exercises: [
          mcq(
            'What is the usual advice on inheritance versus composition?',
            [
              'Always inherit — it is less code',
              'Inherit to share an interface, compose to share behaviour',
              'Never use either',
              'Compose only in functional languages',
            ],
            1,
            ['sk-inheritance-composition'],
            'Behaviour reuse through inheritance couples you to an implementation you did not write.',
          ),
          mcq(
            'Which is impure?',
            ['Math.abs(x)', 'xs.map(f)', 'xs.sort()', 'a + b'],
            2,
            ['sk-pure-functions'],
            '`sort` mutates in place, and returns the same array, which disguises it.',
          ),
          trueFalse(
            'A pure function can be memoised without changing behaviour.',
            true,
            ['sk-pure-functions'],
            'Same input, same output — so a cached result is indistinguishable from a fresh one.',
          ),
        ],
      },
    },
    // -----------------------------------------------------------------------
    {
      id: 'unit-para-2',
      title: 'Types as a Tool',
      description: 'What a type system catches, what it costs, and the billion-dollar mistake.',
      lessons: [
        lesson({
          id: 'lesson-types',
          title: 'Static, Dynamic, and Null',
          summary: 'When the machine checks your assumptions, and what happens when it cannot.',
          level: 'intermediate',
          domain: 'programming',
          steps: [
            concept(
              'Two places to find out you were wrong',
              'Every language checks types. The question is **when**.\n\n**Statically typed** (Rust, Go, Java, TypeScript): checked before the program runs. A whole class of error becomes impossible to ship. The type signature is documentation that cannot go stale, and the editor can rename, navigate and autocomplete reliably because it knows what things are.\n\n**Dynamically typed** (Python, Ruby, JavaScript): checked as the program runs. Less ceremony, faster to prototype, and some patterns are simply easier to express — which is not nothing, and is a large part of why Python won in data science.\n\nThe honest summary of the trade: static typing costs you keystrokes and some flexibility, and buys you errors found at build time, safer refactoring at scale, and machine-checked documentation. That trade gets better as a codebase grows and as more people touch it, which is why large dynamic codebases tend to acquire type annotations eventually — TypeScript over JavaScript, mypy over Python.\n\nWhat types do *not* do is worth stating, because it is over-claimed. A type checker cannot tell you the logic is right. `function add(a: number, b: number): number { return a - b; }` type-checks perfectly. Types eliminate a category of error, not error.',
              {
                keyTerms: [
                  { term: 'Static typing', definition: 'Types checked before execution, at compile time.' },
                  { term: 'Gradual typing', definition: 'Adding optional static types to a dynamic language.' },
                ],
              },
            ),
            categorize(
              'When is each error caught?',
              ['Before running', 'Only at run time'],
              [
                { item: 'Passing a string where a number was declared, in TypeScript', category: 'Before running' },
                { item: 'Calling a method that does not exist, in Python', category: 'Only at run time' },
                { item: 'Returning a − b from a function meant to add', category: 'Only at run time' },
                { item: 'Misspelling a field name, in a statically typed language', category: 'Before running' },
              ],
              ['sk-static-dynamic-typing'],
              'Note the third: a type checker confirms the shapes, never the meaning.',
            ),
            mcq(
              'When does static typing pay off most?',
              [
                'In a fifty-line script',
                'In a large codebase with many contributors and frequent refactoring',
                'When performance matters',
                'When the language is interpreted',
              ],
              1,
              ['sk-static-dynamic-typing'],
              'The return scales with size and with how many people can break each other’s assumptions.',
            ),
            concept(
              'Generics: types with holes',
              'Without **generics** you would write one list type per element type, or give up and use a list of "anything", losing the checking entirely.\n\nA generic is a type with a parameter:\n\n```\nfunction first<T>(xs: T[]): T | undefined {\n  return xs[0];\n}\n\nfirst([1, 2, 3])        // T is number\nfirst(["a", "b"])       // T is string\n```\n\nOne implementation, and the checker still knows that `first` on strings gives a string. This is **parametric polymorphism** — the same idea as the polymorphism above, moved into the type system.\n\nThe practical value is that containers, results and promises stay type-safe: `Map<UserId, User>`, `Result<Order, PaymentError>`, `Promise<Response>`. Without generics all of those degrade to "some object", and every use needs a cast that the compiler cannot verify.\n\nGenerics can also be over-used. A function with four type parameters and three constraints is usually solving a problem nobody has; the signature costs more to read than the duplication it avoided.',
              {
                keyTerms: [
                  { term: 'Generic', definition: 'A type or function parameterised by another type.' },
                ],
              },
            ),
            mcq(
              'What would you lose without generics?',
              [
                'The ability to write functions',
                'Type safety inside containers — a list would have to be a list of "anything"',
                'Inheritance',
                'Runtime performance',
              ],
              1,
              ['sk-generics'],
              'Every read from the container would need an unverifiable cast.',
            ),
            concept(
              'Null: the billion-dollar mistake',
              'Tony Hoare introduced the null reference in 1965 and later called it his billion-dollar mistake. The estimate is, if anything, modest.\n\nThe flaw is that **null is a member of every type**. A `String` is either a string or null, and nothing in the signature says which, so every caller must either check or gamble. Most gamble, which is why null-dereference crashes are among the most common failures in software.\n\nThe modern answer is to make absence **explicit in the type**:\n\n| Language | Mechanism |\n|---|---|\n| Rust | `Option<T>` — `Some(x)` or `None` |\n| Swift | `String?` — must be unwrapped |\n| Kotlin | Nullable types, checked by the compiler |\n| TypeScript | `strictNullChecks` |\n| Haskell | `Maybe a` |\n\nThe common move: you cannot use the value without acknowledging it might not be there. The check stops being something you must remember and becomes something the compiler insists on.\n\nThe same idea generalises to errors. `Result<T, E>` makes failure part of the type, so a caller cannot ignore it by forgetting — which is the "return the failure as a value" strategy from the fundamentals track, enforced rather than encouraged.\n\nThe lesson underneath is bigger than null: **make invalid states unrepresentable.** If a type cannot express the bad state, no amount of carelessness can produce it — and that is a stronger guarantee than any amount of checking.',
              {
                keyTerms: [
                  { term: 'Option type', definition: 'A type that explicitly represents "value or nothing".' },
                  { term: 'Make invalid states unrepresentable', definition: 'Design types so the bad case cannot be constructed.' },
                ],
              },
            ),
            mcq(
              'What is the design flaw in null?',
              [
                'It uses memory',
                'It is a member of every type, so nothing in a signature tells you a value might be absent',
                'It is slow to check',
                'It cannot be printed',
              ],
              1,
              ['sk-null-safety'],
              'The information the caller needs is missing from exactly the place they would look.',
            ),
            fill(
              'Rust represents possible absence as ___ and possible failure as ___.',
              [['Option', 'Option<T>'], ['Result', 'Result<T, E>']],
              ['sk-null-safety'],
              'Both make the unhappy path part of the type, so it cannot be skipped by forgetting.',
            ),
            order(
              'Order these from weakest to strongest guarantee about absent values.',
              [
                'Null with no checking convention',
                'Null plus a documented convention to check',
                'Compiler-enforced nullable types',
                'A type in which the absent case cannot be constructed at all',
              ],
              ['sk-null-safety'],
              'Each step moves the burden from the programmer remembering to the machine insisting.',
            ),
            shortAnswer(
              'An order can be draft, paid, or cancelled, and only paid orders have a payment reference. How would you model this so bad states cannot occur?',
              ['union', 'variant', 'state', 'type', 'invalid'],
              'Model it as a tagged union of three distinct types rather than one struct with optional fields. A DraftOrder has no payment reference at all; a PaidOrder has one that is required, not optional; a CancelledOrder carries a reason. That way "paid but no reference" and "draft with a reference" are not states you have to remember to check for — they cannot be constructed. One struct with three nullable fields permits eight combinations, of which five are nonsense.',
              ['sk-null-safety', 'sk-static-dynamic-typing'],
              'A tagged union per state, with each carrying exactly the data that state has. Invalid states become unrepresentable rather than merely unlikely.',
            ),
            interactive(
              'Coercion and comparison',
              'type-coercion',
              'Compare values across types and watch what each operator does. The cases that surprise people are worth dwelling on — they are the reason strict equality exists.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-para-2',
        title: 'Types Checkpoint',
        passingScore: 0.7,
        exercises: [
          mcq(
            'What can a type checker not tell you?',
            [
              'That a field name is misspelled',
              'That the logic is correct',
              'That an argument has the wrong type',
              'That a function returns the wrong type',
            ],
            1,
            ['sk-static-dynamic-typing'],
            'Shapes, not meaning. A subtraction in a function called add passes every check.',
          ),
          mcq(
            'Why is `Option<T>` better than nullable references?',
            [
              'It is faster',
              'Absence is visible in the type, so the compiler makes you handle it',
              'It uses less memory',
              'It allows more values',
            ],
            1,
            ['sk-null-safety'],
            'The check becomes mandatory rather than remembered.',
          ),
          trueFalse(
            'Generics let one container implementation stay type-safe for every element type.',
            true,
            ['sk-generics'],
            'One implementation, checked per use.',
          ),
        ],
      },
    },
  ],
};
