/**
 * Track 30 — How the Web Works.
 *
 * The web is the delivery mechanism for most software, including most AI
 * products, and it is the platform people most often use daily without ever
 * being taught. Structure, style, the DOM, the event loop, and why a page feels
 * fast or slow.
 */

import type { Track } from '../../domain/types';
import { categorize, codeOutput, concept, interactive, lesson, match, mcq, multi, numeric, order, trueFalse } from '../builders';

export const webTrack: Track = {
  id: 'track-web',
  title: 'How the Web Works',
  tagline: 'From markup to pixels, and why pages feel slow',
  description:
    'HTML as meaning, CSS as layout, the DOM as a live tree, and the single-threaded event loop that decides whether a page responds. Ends with performance and accessibility — the two things users notice and engineers add last.',
  domain: 'web',
  level: 'intro',
  icon: '🕸️',
  gradient: ['#F59E0B', '#06B6D4'],
  prerequisites: ['track-programming'],
  outcomes: [
    'Write markup whose structure carries meaning, not just appearance',
    'Lay out a page with flexbox and grid and know which fits',
    'Explain what blocks the main thread and why the page freezes',
    'Trace a request through parse, layout, paint and composite',
    'Name the metric a slow page is failing and the fix that moves it',
    'Build interfaces that work with a keyboard and a screen reader',
  ],
  units: [
    // -----------------------------------------------------------------------
    {
      id: 'unit-web-1',
      title: 'Structure and Style',
      description: 'Markup that means something, and layout that survives a phone.',
      lessons: [
        lesson({
          id: 'lesson-html',
          title: 'HTML as Meaning',
          summary: 'Tags describe what something is. Everything else depends on that being true.',
          level: 'intro',
          domain: 'web',
          free: true,
          steps: [
            concept(
              'Semantics, not appearance',
              '**HTML** describes structure and meaning. It says *what* something is; CSS decides how it looks.\n\n```\n<article>\n  <h1>Why caches go stale</h1>\n  <p>Published <time datetime="2026-03-14">14 March</time></p>\n  <nav aria-label="Sections">\n    <ul><li><a href="#ttl">TTLs</a></li></ul>\n  </nav>\n</article>\n```\n\nEvery one of those tags could be a `<div>` with a class name and look identical. It would also be worse in four measurable ways:\n\n**Screen readers** navigate by landmark and heading. `<nav>` and `<h1>` are how a blind user skips to the part they want; a styled `<div>` offers nothing to skip to.\n\n**Keyboards** work for free on `<button>` and `<a>` — focusable, activated by Enter or Space, in the tab order. A clickable `<div>` has none of that until you reimplement all of it, usually incompletely.\n\n**Search engines and link previews** read the structure to decide what the page is about.\n\n**Browsers** supply behaviour: `<details>` opens and closes, `<input type="date">` gets a date picker, `<form>` validates.\n\nThe rule that follows: **choose the tag for what the thing is, then style it**. A heading that should look small is still a heading. Reaching for `<div>` should feel like a small failure — it is the tag that means "I have nothing to say about this".',
              {
                keyTerms: [
                  { term: 'Semantic HTML', definition: 'Using the tag that describes what the content is.' },
                  { term: 'Landmark', definition: 'A structural region — nav, main, header — used to navigate a page.' },
                ],
              },
            ),
            mcq(
              'Why is `<button>` better than a `<div>` with a click handler?',
              [
                'It is faster',
                'It is focusable, keyboard-activated, and announced as a button — all for free',
                'It looks better by default',
                'It can contain more elements',
              ],
              1,
              ['sk-html-semantics'],
              'A div needs tabindex, key handlers, a role, and pressed state added by hand, and usually gets two of the four.',
            ),
            categorize(
              'Which tag is right for each?',
              ['<nav>', '<article>', '<button>', '<table>'],
              [
                { item: 'The site’s main menu', category: '<nav>' },
                { item: 'A self-contained blog post', category: '<article>' },
                { item: 'Something that performs an action when clicked', category: '<button>' },
                { item: 'Rows and columns of related data', category: '<table>' },
              ],
              ['sk-html-semantics'],
              'Tables for data are correct and always have been; the advice against them was about using them for page layout.',
            ),
            multi(
              'What do you get from semantic markup that a div cannot give you?',
              [
                'Screen-reader navigation by landmark and heading',
                'Keyboard behaviour without writing any',
                'Built-in browser behaviour like form validation',
                'Faster rendering',
              ],
              [0, 1, 2],
              ['sk-html-semantics'],
              'Rendering cost is effectively identical. The difference is entirely in behaviour and meaning.',
            ),
            concept(
              'CSS: the box model and two layout systems',
              'Everything on a page is a box, and every box has four layers: **content**, **padding** inside the border, the **border**, and **margin** outside it.\n\nThe historical trap is that `width` by default means the *content* width, so padding and border are added on top — set `width: 300px; padding: 20px` and the element occupies 340. `box-sizing: border-box` makes `width` mean the whole box, which is what everyone expects, which is why nearly every codebase sets it globally on the first line.\n\nTwo layout systems then do almost all the work:\n\n**Flexbox** — one dimension. A row or a column. Ideal for toolbars, button groups, centring a thing, distributing space along an axis.\n\n```\n.toolbar { display: flex; gap: 8px; align-items: center; }\n```\n\n**Grid** — two dimensions at once. Rows and columns together. Ideal for page layout and card galleries.\n\n```\n.gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }\n```\n\nThat `auto-fill` / `minmax` line is worth knowing by heart: it fits as many columns of at least 220px as will fit and shares the remainder, which is a fully responsive gallery with no media queries at all.\n\nThe modern principle is **mobile first**: write the narrow layout as the default and add complexity at wider breakpoints. It is easier to add space than to take it away, and the narrow case is the majority of traffic.',
              {
                keyTerms: [
                  { term: 'Box model', definition: 'Content, padding, border, margin — the four layers of every element.' },
                  { term: 'border-box', definition: 'Sizing mode where width includes padding and border.' },
                ],
              },
            ),
            interactive(
              'The box model',
              'box-model',
              'Adjust padding, border and margin and watch the total size change. Toggle border-box and see the same numbers produce a different element — that switch is the most consequential one line of CSS most projects have.',
            ),
            numeric(
              'An element has width: 300px, padding: 20px, border: 5px, with the default content-box sizing. How many pixels wide is it on screen?',
              350,
              ['sk-css-layout'],
              '300 + 20×2 + 5×2 = 350. With `box-sizing: border-box` it would be exactly 300 and the content would shrink to fit.',
            ),
            mcq(
              'You need a gallery that fits as many cards per row as the width allows. Which?',
              ['Flexbox', 'CSS Grid with auto-fill and minmax', 'Absolute positioning', 'A table'],
              1,
              ['sk-css-layout'],
              'Two-dimensional and responsive with no breakpoints. Flexbox can approximate it but has to be told when to wrap.',
            ),
            mcq(
              'What does "mobile first" mean in practice?',
              [
                'Only supporting phones',
                'Writing the narrow layout as the default and adding complexity at wider breakpoints',
                'Testing on a phone last',
                'Using a separate mobile site',
              ],
              1,
              ['sk-responsive-design'],
              'Adding space as the viewport grows is far easier than clawing it back as the viewport shrinks.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-web-1',
        title: 'Markup and Layout Checkpoint',
        passingScore: 0.7,
        exercises: [
          mcq(
            'What does semantic HTML primarily provide?',
            ['Better styling', 'Meaning that assistive technology and browsers can act on', 'Faster loading', 'Smaller files'],
            1,
            ['sk-html-semantics'],
            'Structure that something other than a sighted mouse user can navigate.',
          ),
          numeric(
            'width: 200px, padding: 10px, border: 2px, content-box sizing. Total width in pixels?',
            224,
            ['sk-css-layout'],
            '200 + 20 + 4 = 224.',
          ),
          mcq(
            'Flexbox is best for what?',
            ['Two-dimensional page layout', 'One-dimensional arrangement along a row or column', 'Absolute positioning', 'Print layout'],
            1,
            ['sk-css-layout'],
            'One axis. Grid handles both at once.',
          ),
        ],
      },
    },
    // -----------------------------------------------------------------------
    {
      id: 'unit-web-2',
      title: 'The Living Page',
      description: 'The DOM, one thread, and everything that follows from that.',
      lessons: [
        lesson({
          id: 'lesson-dom-events',
          title: 'The DOM and the Event Loop',
          summary: 'One thread doing everything, and what happens when you block it.',
          level: 'intermediate',
          domain: 'web',
          steps: [
            concept(
              'The DOM is a live tree, not your HTML',
              'The browser parses HTML once into the **DOM** — a tree of node objects. From then on, the DOM is the truth. Change it and the page changes; your original HTML is history.\n\n```\nconst el = document.querySelector("#total");\nel.textContent = "£42.00";\nel.classList.add("updated");\n```\n\nThe expensive thing about the DOM is not reading or writing it — it is that some operations force the browser to recompute layout immediately. Reading `offsetHeight` after a write means the browser must lay out *now* to answer, and doing that inside a loop produces **layout thrashing**: a hundred forced layouts where one would do.\n\nThe fix is to batch: read everything you need, then write everything, rather than alternating.\n\n**Events** travel through the tree in three phases — capture down, target, bubble up. Bubbling is what makes **event delegation** possible: one listener on a container handles clicks on any of a thousand rows, including rows added later. A thousand individual listeners costs a thousand closures and breaks on new content.\n\n```\nlist.addEventListener("click", (e) => {\n  const row = e.target.closest("li");\n  if (row) select(row.dataset.id);\n});\n```',
              {
                keyTerms: [
                  { term: 'DOM', definition: 'The live object tree the browser renders from.' },
                  { term: 'Event delegation', definition: 'One listener on an ancestor handling events from many descendants.' },
                ],
              },
            ),
            mcq(
              'Why does reading offsetHeight inside a loop that also writes styles get slow?',
              [
                'It allocates memory',
                'Each read forces an immediate layout recalculation — layout thrashing',
                'It triggers network requests',
                'The DOM is single-threaded',
              ],
              1,
              ['sk-dom'],
              'Batch reads, then batch writes. The browser can then lay out once instead of once per iteration.',
            ),
            mcq(
              'A table has 5,000 rows that are added and removed. How should clicks be handled?',
              [
                'A listener on each row',
                'One listener on the table, using the bubbled event target',
                'Inline onclick attributes',
                'Polling for changes',
              ],
              1,
              ['sk-dom'],
              'Event delegation: one listener, works for rows that do not exist yet, nothing to clean up.',
            ),
            concept(
              'One thread, and the queues around it',
              'JavaScript in a browser runs on **one thread**, which also does layout, paint, and event handling. Anything that occupies it for long makes the page unresponsive — the spinner stops, clicks queue, scrolling stutters.\n\nThe **event loop** is what keeps that workable:\n\n1. Run the current task to completion (JavaScript is never interrupted mid-task).\n2. Drain the **microtask** queue completely — promise callbacks, `queueMicrotask`.\n3. Render, if it is time to.\n4. Take the next **macrotask** — a timer, an event, a network callback — and repeat.\n\nTwo consequences people meet the hard way. `setTimeout(fn, 0)` does not run immediately; it runs after the current task and all its microtasks. And promise callbacks always run before timers scheduled in the same turn, because microtasks drain first.\n\nAsynchrony is not parallelism. `await fetch(...)` does not run anything concurrently in your code — it yields the thread so other work can proceed, and resumes later. This is precisely the concurrency-versus-parallelism distinction from the systems track: an event loop is concurrency on a single core.\n\nFor work that genuinely needs a second core — parsing a huge file, image processing, anything CPU-bound — the answer is a **Web Worker**, which really does run on another thread and communicates by message. That is the same mechanism the code exercises in this app use to run your submissions without freezing the page.',
              {
                figure: 'event-loop-queues',
                keyTerms: [
                  { term: 'Event loop', definition: 'Task, then all microtasks, then maybe render, then next task.' },
                  { term: 'Web Worker', definition: 'A genuinely parallel thread that communicates by message passing.' },
                ],
              },
            ),
            interactive(
              'Watch the loop',
              'event-loop',
              'Queue timers and promises and step the loop. Watch every microtask drain before a single timer runs — that ordering is the answer to most "why did this log out of order" questions.',
            ),
            codeOutput(
              'In what order do these print?',
              'javascript',
              'console.log("A");\nsetTimeout(() => console.log("B"), 0);\nPromise.resolve().then(() => console.log("C"));\nconsole.log("D");',
              ['A B C D', 'A D C B', 'A D B C', 'A C D B'],
              1,
              ['sk-event-loop'],
              'Synchronous code first (A, D), then microtasks (C), then macrotasks (B). `setTimeout(…, 0)` means "after everything currently pending", not "now".',
            ),
            mcq(
              'A page freezes for three seconds during a calculation. What fixes it?',
              [
                'Wrapping it in setTimeout',
                'Moving the work to a Web Worker, or slicing it so the loop can breathe between chunks',
                'Making it async',
                'Adding more event listeners',
              ],
              1,
              ['sk-event-loop'],
              '`async` does not create a thread. Only a worker actually takes CPU work off the main thread.',
            ),
            trueFalse(
              'Marking a function `async` makes it run on another thread.',
              false,
              ['sk-event-loop'],
              'It lets the function yield at `await`. The work still happens on the one thread.',
            ),
          ],
        }),
        lesson({
          id: 'lesson-web-performance',
          title: 'Rendering, Performance, and Access',
          summary: 'What the browser does with your page, and who can actually use it.',
          level: 'intermediate',
          domain: 'web',
          steps: [
            concept(
              'Parse, layout, paint, composite',
              'Getting a page on screen is a pipeline, and knowing which stage your change triggers is most of front-end performance.\n\n**Parse** HTML into the DOM and CSS into rules. A `<script>` in the head without `defer` blocks this — the parser stops until the script downloads and runs, which is why script placement mattered so much historically and why `defer` exists.\n\n**Style** — work out which rules apply to which nodes.\n\n**Layout** (reflow) — compute the geometry of every box. Expensive; touches everything downstream.\n\n**Paint** — fill in pixels: colours, text, shadows.\n\n**Composite** — assemble the painted layers, on the GPU.\n\nThe practical payoff is that different CSS properties enter the pipeline at different stages:\n\n| Changing | Triggers |\n|---|---|\n| `width`, `top`, `font-size` | Layout → paint → composite |\n| `color`, `background` | Paint → composite |\n| `transform`, `opacity` | Composite only |\n\nThat last row is why smooth animation uses `transform` and `opacity` and nothing else. Animating `left` runs layout on every frame and janks; animating `transform` is handled by the compositor and holds 60fps.',
              {
                figure: 'render-pipeline',
                keyTerms: [
                  { term: 'Reflow', definition: 'Recomputing layout geometry — the expensive stage.' },
                  { term: 'Compositing', definition: 'Assembling pre-painted layers, typically on the GPU.' },
                ],
              },
            ),
            match(
              'Match each change to the cheapest stage it reaches.',
              [
                { left: 'transform: translateX(10px)', right: 'Composite only' },
                { left: 'opacity: 0.5', right: 'Composite only' },
                { left: 'background-color: red', right: 'Paint' },
                { left: 'width: 300px', right: 'Layout' },
              ],
              ['sk-browser-rendering'],
              'Animate the top row. The bottom row is why a "simple" animation drops frames.',
            ),
            mcq(
              'An animation is janky. It animates `left`. What is the fix?',
              [
                'Use a shorter duration',
                'Animate `transform: translateX` instead, so only compositing is involved',
                'Add will-change to everything',
                'Reduce the frame rate',
              ],
              1,
              ['sk-web-performance', 'sk-browser-rendering'],
              '`left` forces layout every frame; `transform` is handled by the compositor.',
            ),
            concept(
              'The three metrics that matter',
              'Web performance collapsed into three user-centred measurements, each naming a distinct complaint:\n\n**LCP** — Largest Contentful Paint. When does the main content appear? Target under 2.5s. Usually fixed by making the hero image or text render sooner: preload it, stop render-blocking resources, serve a smaller image.\n\n**INP** — Interaction to Next Paint. When you tap something, how long until anything visibly happens? Target under 200ms. This is the event loop again — long tasks blocking the thread. Fixed by breaking up work and moving heavy computation off the main thread.\n\n**CLS** — Cumulative Layout Shift. How much does content jump around as it loads? Target under 0.1. Almost always caused by images without dimensions, or ads and banners injected above existing content. Reserve the space.\n\nWhat makes these good metrics is that each corresponds to something a person actually notices and complains about: "it took ages to show up", "it didn’t respond when I tapped", "I tapped the wrong thing because it moved".\n\nAnd measure on real devices. A mid-range Android phone on a poor connection is the honest test; a developer laptop on office wifi flatters everything.',
              {
                keyTerms: [
                  { term: 'LCP', definition: 'Time until the main content is painted.' },
                  { term: 'CLS', definition: 'How much visible content shifts position during load.' },
                ],
              },
            ),
            match(
              'Match each complaint to its metric.',
              [
                { left: '"It took ages to show anything"', right: 'LCP' },
                { left: '"I tapped and nothing happened"', right: 'INP' },
                { left: '"It moved and I hit the wrong button"', right: 'CLS' },
                { left: '"The animation stutters"', right: 'Long frames from layout work' },
              ],
              ['sk-web-performance'],
              'Each metric exists because someone kept making that specific complaint.',
            ),
            mcq(
              'Content jumps as the page loads. What is the usual cause?',
              [
                'Slow JavaScript',
                'Images and embeds without reserved dimensions, so surrounding content moves when they arrive',
                'Too many fonts',
                'Large CSS files',
              ],
              1,
              ['sk-web-performance'],
              'Set width and height (or an aspect-ratio) so the space is held from the start.',
            ),
            concept(
              'Accessibility is not a feature',
              'Roughly one person in six lives with a disability. Building for them is not charity, and in many jurisdictions is not optional — but the practical argument is simpler: the same work makes the product better for everybody.\n\nThe four things that catch most problems:\n\n**Use the right elements.** Most of accessibility is semantic HTML, which is why it was the first lesson in this track. A real `<button>` is accessible; a div pretending to be one is a project.\n\n**Make it keyboard-navigable.** Tab through your interface. Everything interactive must be reachable, focus must be visible, and order must follow the visual layout. Removing focus outlines because they look untidy is the single most common accessibility regression there is.\n\n**Provide text alternatives.** `alt` on meaningful images; empty `alt=""` on decorative ones so screen readers skip them. Captions on video. Labels bound to inputs.\n\n**Check contrast.** 4.5:1 for body text. Light grey on white is the house style of inaccessible design.\n\nWhat it also buys you: keyboard navigation helps power users, captions help people in noisy places, high contrast helps in sunlight, and clear labels help everyone. Curb cuts were built for wheelchairs and are used by everyone with a suitcase.',
              {
                keyTerms: [
                  { term: 'Focus visible', definition: 'A clear indicator of which element the keyboard is on.' },
                  { term: 'Alt text', definition: 'A text alternative for an image, empty when decorative.' },
                ],
              },
            ),
            multi(
              'Which genuinely improve accessibility?',
              [
                'Using real button and link elements',
                'Keeping a visible focus indicator',
                'Meeting a 4.5:1 contrast ratio for body text',
                'Adding aria-label to every element on the page',
              ],
              [0, 1, 2],
              ['sk-web-accessibility'],
              'Over-applying ARIA usually makes things worse — it overrides the native semantics that were already correct. The first rule of ARIA is not to use ARIA.',
            ),
            trueFalse(
              'Removing the focus outline because it looks untidy is a common accessibility regression.',
              true,
              ['sk-web-accessibility'],
              'Keyboard users lose all sense of where they are. Restyle it if you must; never remove it.',
            ),
            concept(
              'State, storage, and rendering models',
              'Early web pages were documents. Applications need **state** — what is selected, what is loading, what the user typed — and where it lives shapes everything else.\n\nThe modern default is **declarative rendering**: you describe what the UI should look like for a given state, and the framework works out the DOM operations. React, Vue and Svelte differ in mechanism and agree on that principle. It is the declarative-versus-imperative distinction again: you stopped writing the steps and started writing the destination.\n\nWhere rendering happens is a separate axis:\n\n| Model | First paint | Interactivity | Suits |\n|---|---|---|---|\n| Static (SSG) | Fastest | Added after | Content that rarely changes |\n| Server-rendered (SSR) | Fast | Added after | Personalised content, SEO |\n| Client-rendered (SPA) | Slowest | Immediate after load | App-like, behind a login |\n\nAnd browser storage has three options with different lifetimes: **cookies** go to the server on every request (so keep them small, and mark them `HttpOnly` and `SameSite` — the CSRF lesson from the security track); **localStorage** persists per origin until cleared and is readable by any script on the page, so nothing sensitive; **sessionStorage** lasts for the tab.\n\nThe security consequence worth carrying: a token in `localStorage` is exposed to any XSS on the page. An `HttpOnly` cookie is not readable by script at all, which is why that remains the recommendation despite being older.',
              {
                keyTerms: [
                  { term: 'Declarative rendering', definition: 'Describing the UI for a state and letting the framework do the DOM work.' },
                  { term: 'HttpOnly cookie', definition: 'A cookie script cannot read, which limits what an XSS can steal.' },
                ],
              },
            ),
            mcq(
              'Why is an auth token in localStorage riskier than in an HttpOnly cookie?',
              [
                'localStorage is slower',
                'Any script on the page can read localStorage, so an XSS can exfiltrate the token',
                'Cookies are encrypted',
                'localStorage has a size limit',
              ],
              1,
              ['sk-web-storage'],
              'HttpOnly makes the cookie unreadable to JavaScript, so an injected script cannot steal it even if it runs.',
            ),
            mcq(
              'What does declarative rendering change about how you write UI?',
              [
                'It makes the page faster',
                'You describe the UI for a given state instead of writing the DOM operations to get there',
                'It removes the need for CSS',
                'It runs on the server',
              ],
              1,
              ['sk-frontend-state'],
              'The framework diffs the description against reality and performs the minimum change.',
            ),
            order(
              'Order the rendering pipeline.',
              ['Parse HTML and CSS', 'Compute styles', 'Layout', 'Paint', 'Composite'],
              ['sk-browser-rendering'],
              'Knowing where a change enters this pipeline is most of front-end performance work.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-web-2',
        title: 'Runtime and Performance Checkpoint',
        passingScore: 0.7,
        exercises: [
          mcq(
            'Which run first after the current task: promise callbacks or setTimeout callbacks?',
            ['setTimeout', 'Promise callbacks — microtasks drain before the next macrotask', 'Whichever was scheduled first', 'They interleave'],
            1,
            ['sk-event-loop'],
            'Microtasks drain completely before any timer runs.',
          ),
          mcq(
            'Which property pair animates without triggering layout?',
            ['width and height', 'transform and opacity', 'top and left', 'margin and padding'],
            1,
            ['sk-browser-rendering'],
            'Composite-only, which is what holds 60fps.',
          ),
          trueFalse(
            'Most accessibility comes from using the correct HTML elements rather than from adding ARIA.',
            true,
            ['sk-web-accessibility'],
            'Native semantics are already correct; ARIA most often overrides them incorrectly.',
          ),
        ],
      },
    },
  ],
};
