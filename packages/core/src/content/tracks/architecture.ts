/**
 * Track 19 — Computer Architecture.
 *
 * What the machine actually does with the code you wrote. Two halves: how
 * numbers are represented (and where that representation leaks into your
 * results), and how instructions are executed (and why the hardware that runs
 * deep learning looks nothing like the hardware that runs a web server).
 */

import type { Track } from '../../domain/types';
import { categorize, codeOutput, concept, fill, interactive, lesson, match, mcq, multi, numeric, order, shortAnswer, trueFalse } from '../builders';

export const architectureTrack: Track = {
  id: 'track-architecture',
  title: 'Computer Architecture',
  tagline: 'Numbers, instructions, and why GPUs exist',
  description:
    'How a machine represents a number and executes an instruction — and what leaks upward from both. This is where floating-point surprises, compiler behaviour, and the whole case for GPU training stop being folklore.',
  domain: 'systems',
  level: 'intermediate',
  icon: '🔩',
  gradient: ['#0EA5E9', '#6366F1'],
  prerequisites: ['track-foundations'],
  outcomes: [
    'Convert between binary, hex, and decimal, and predict integer overflow',
    'Explain why 0.1 + 0.2 is not 0.3 and when that actually matters',
    'Describe the fetch–decode–execute cycle and what a compiler changes about it',
    'Say why SIMD and GPUs speed up matrix maths but not branchy logic',
  ],
  units: [
    // -----------------------------------------------------------------------
    {
      id: 'unit-arch-1',
      title: 'Numbers in a Machine',
      description: 'Finite bits, infinite maths, and the gap between them.',
      lessons: [
        lesson({
          id: 'lesson-binary',
          title: 'Binary, Hex, and Overflow',
          summary: 'Every value is a fixed number of bits. Everything odd follows from "fixed".',
          level: 'intro',
          domain: 'systems',
          free: true,
          steps: [
            concept(
              'Positional notation, base two',
              'Decimal is positional: 407 means 4×10² + 0×10¹ + 7×10⁰. Binary is the same idea with two digits instead of ten. `1011` means 1×8 + 0×4 + 1×2 + 1×1 = **11**.\n\nHexadecimal is base 16, and it exists purely for human convenience: one hex digit is exactly four bits, so `1011 0110` reads as `B6` with no arithmetic. That is why colours are `#8B5CF6` and memory addresses are `0x7ffd`.\n\nThe number that matters most is the **width**. A value is not "an integer" — it is 8, 16, 32, or 64 bits. An 8-bit unsigned integer can hold 0 through 255 and no more. Not "and then it errors" — it wraps. 255 + 1 = 0.\n\nThis is not a historical curiosity. It is why a video game score rolls over, why timestamps break in 2038, and why a model trained in 8-bit quantisation needs its ranges chosen carefully.',
              {
                keyTerms: [
                  { term: 'Bit width', definition: 'How many bits a value occupies, which fixes its range.' },
                  { term: 'Overflow', definition: 'A result too large for the width, which wraps rather than growing.' },
                ],
              },
            ),
            numeric(
              'What is the decimal value of the binary number 1101?',
              13,
              ['sk-binary-representation'],
              '8 + 4 + 0 + 1 = 13.',
            ),
            numeric(
              'How many distinct values can an 8-bit number represent?',
              256,
              ['sk-binary-representation'],
              '2⁸ = 256. Unsigned that is 0–255; signed it is −128 to 127.',
            ),
            mcq(
              'Why is hexadecimal used so often in low-level contexts?',
              [
                'Computers store numbers in base 16 internally',
                'One hex digit maps exactly onto four bits, so conversion is mechanical',
                'It is more precise than binary',
                'It compresses the data',
              ],
              1,
              ['sk-binary-representation'],
              'Pure notation. The machine is still binary; hex is just a shorter way to write the same bits.',
            ),
            concept(
              'Two’s complement: how negatives are stored',
              'You could dedicate one bit to a sign. Almost nobody does, because then you get two zeros (+0 and −0) and subtraction needs its own circuit.\n\n**Two’s complement** instead defines −x as `NOT x + 1`. In 8 bits, −1 is `11111111`. The elegance is that ordinary binary addition now handles negatives for free: `00000001 + 11111111` overflows to `00000000`, which is exactly 1 + (−1) = 0.\n\nThe cost is an asymmetric range. 8 bits signed runs −128 to +127 — one more negative than positive, because zero takes a slot on the positive side. So `−(−128)` has no representable answer and silently returns −128.\n\nThe top bit is the sign bit: if it is 1, the value is negative. That is why casting an `int` to an `unsigned` can turn −1 into 4,294,967,295. The bits did not change; the interpretation did.',
              {
                keyTerms: [
                  { term: 'Two’s complement', definition: 'Negation as bitwise NOT plus one, so one adder handles both signs.' },
                ],
              },
            ),
            fill(
              'An 8-bit signed integer ranges from ___ to ___.',
              [['-128', '−128'], ['127']],
              ['sk-twos-complement'],
              'One extra negative value, because zero occupies a non-negative slot.',
            ),
            codeOutput(
              'What does this print?',
              'python',
              'x = 127  # stored as an 8-bit signed integer\nx = x + 1\nprint(x)',
              ['128', '-128', '0', 'an error is raised'],
              1,
              ['sk-twos-complement'],
              '`01111111 + 1 = 10000000`, whose signed reading is −128. The addition succeeded; the meaning wrapped. (Python’s own ints are unbounded — this is what happens in C, Rust, NumPy, and any fixed-width tensor dtype.)',
            ),
            trueFalse(
              'Integer overflow normally raises an error at runtime.',
              false,
              ['sk-twos-complement'],
              'In most fixed-width languages it wraps silently. That silence is what makes overflow bugs hard to find.',
            ),
          ],
        }),
        lesson({
          id: 'lesson-floating-point',
          title: 'Floating Point and Its Gaps',
          summary: 'Why 0.1 + 0.2 ≠ 0.3, and when you should actually care.',
          level: 'intermediate',
          domain: 'systems',
          steps: [
            concept(
              'Scientific notation in binary',
              'A float stores three things: a **sign**, an **exponent**, and a **mantissa** (the significant digits). It is scientific notation — 6.02 × 10²³ — done in base two.\n\nThat buys enormous range from few bits: a 32-bit float spans roughly 10⁻³⁸ to 10³⁸. It costs you exactness. The mantissa has a fixed number of bits, so only finitely many values are representable, and they are **not evenly spaced**. Near 1.0 consecutive float32 values differ by about 10⁻⁷. Near 1,000,000 they differ by about 0.06.\n\nAnd just as 1/3 has no finite decimal expansion, 0.1 has no finite *binary* one. What gets stored is the nearest representable value, which is 0.1000000000000000055511151231257827. Add that to a similarly-rounded 0.2 and the result is not the stored value of 0.3.\n\nSo `0.1 + 0.2 == 0.3` is false in essentially every language. The languages are not broken; the request was impossible.',
              {
                keyTerms: [
                  { term: 'Mantissa', definition: 'The significant digits of a float; its bit count sets the precision.' },
                  { term: 'Machine epsilon', definition: 'The gap between 1.0 and the next representable float.' },
                ],
              },
            ),
            interactive(
              'Where the gaps are',
              'float-precision',
              'Move the magnitude slider and watch the spacing between representable values. Notice that precision is relative: near zero the grid is fine, and by the time you reach a million it is coarser than a penny.',
            ),
            trueFalse(
              'In float32, the gap between representable values is the same everywhere on the number line.',
              false,
              ['sk-floating-point'],
              'The spacing scales with magnitude. Precision is relative, not absolute — roughly seven significant decimal digits wherever you are.',
            ),
            mcq(
              'What is the right way to compare two floats for equality?',
              [
                'Use ==, it is exact',
                'Round both to integers first',
                'Check that their absolute difference is below a small tolerance',
                'Convert both to strings and compare',
              ],
              2,
              ['sk-floating-point'],
              '`abs(a - b) < tol`. Choose the tolerance for the magnitudes involved — a fixed 1e-9 is meaningless at the scale of a million.',
            ),
            concept(
              'Where it actually bites: numerical stability',
              'Most float error is harmless — one part in ten million, swamped by every other source of noise in your problem. It becomes a bug when errors **compound**.\n\nThree classic amplifiers:\n\n**Catastrophic cancellation.** Subtracting two nearly-equal large numbers destroys the significant digits. `1000000.1 − 1000000.0` keeps only the noise. Variance computed as `E[x²] − E[x]²` blows up this way; the two-pass formula does not.\n\n**Underflow in products.** Multiply 500 probabilities of 0.01 and you reach zero, because the true answer is below the smallest representable float. This is why every likelihood computation in machine learning works in **log space**, turning the product into a sum.\n\n**The log-sum-exp trap.** `exp(1000)` overflows to infinity. Softmax over raw logits does exactly this. The fix is universal: subtract the max before exponentiating. It is mathematically a no-op and numerically the difference between a result and a `NaN`.\n\nThis is the direct reason your framework has `log_softmax` and `logsumexp` as primitives rather than leaving you to compose them.',
              {
                keyTerms: [
                  { term: 'Catastrophic cancellation', definition: 'Loss of significant digits when subtracting nearly-equal values.' },
                  { term: 'Log space', definition: 'Working with logarithms so products become sums and underflow is avoided.' },
                ],
              },
            ),
            mcq(
              'Why does softmax subtract the maximum logit before exponentiating?',
              [
                'It makes the result sum to 1',
                'It speeds up the exponential',
                'It prevents exp() from overflowing to infinity, without changing the result',
                'It centres the gradient',
              ],
              2,
              ['sk-numerical-stability'],
              'Softmax is invariant to a constant shift, so the output is identical — but every exponent is now ≤ 0 and cannot overflow.',
            ),
            multi(
              'Which of these are genuine numerical-stability techniques?',
              [
                'Working with log-probabilities instead of probabilities',
                'Subtracting the max before exp()',
                'Using == to compare floats',
                'Preferring the two-pass variance formula over E[x²] − E[x]²',
              ],
              [0, 1, 3],
              ['sk-numerical-stability'],
              'The first, second and fourth each avoid a known failure mode. Exact float equality is the failure mode.',
            ),
            shortAnswer(
              'Multiplying 500 probabilities together gives exactly 0.0. What is happening, and what is the standard fix?',
              ['underflow', 'small', 'log', 'sum'],
              'The true product is smaller than the smallest representable float, so it underflows to zero. The fix is to work in log space: take the log of each probability and sum them, which keeps the values in a comfortable range and turns the product into a sum.',
              ['sk-numerical-stability'],
              'Underflow, and log space. The same move underlies every log-likelihood in machine learning.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-arch-1',
        title: 'Numbers Checkpoint',
        passingScore: 0.7,
        exercises: [
          numeric(
            'What is the decimal value of binary 10010?',
            18,
            ['sk-binary-representation'],
            '16 + 2 = 18.',
          ),
          mcq(
            'An 8-bit signed value holding 127 is incremented. What does it hold now?',
            ['128', '0', '−128', 'It raises an overflow error'],
            2,
            ['sk-twos-complement'],
            'The bit pattern becomes 10000000, whose signed reading is −128.',
          ),
          trueFalse(
            '0.1 + 0.2 == 0.3 evaluates to false in most languages.',
            true,
            ['sk-floating-point'],
            'Neither 0.1 nor 0.2 is exactly representable in binary, so their sum is not the stored value of 0.3.',
          ),
        ],
      },
    },
    // -----------------------------------------------------------------------
    {
      id: 'unit-arch-2',
      title: 'How Code Becomes Motion',
      description: 'From source text to executed instruction, and the hardware built for width.',
      lessons: [
        lesson({
          id: 'lesson-instruction-cycle',
          title: 'What a CPU Executes',
          summary: 'Fetch, decode, execute — a few billion times a second.',
          level: 'intro',
          domain: 'systems',
          steps: [
            concept(
              'The loop under everything',
              'A CPU does one thing, forever: **fetch** the next instruction from memory, **decode** what it means, **execute** it, write the result back, advance the program counter. Repeat.\n\nThe instructions are astonishingly small. Not "sort this list" — more like "add these two registers", "compare these bytes", "jump to this address if the last comparison was zero". Your entire program is millions of those.\n\nModern CPUs then cheat, aggressively but invisibly. They **pipeline**, working on several instructions at different stages at once. They execute **out of order** when one instruction is stalled and a later one is ready. They **speculate** past branches, predicting which way an `if` will go and running ahead on that assumption.\n\nBranch prediction is why unpredictable branches are expensive: a mispredict throws away the speculative work and costs 15–20 cycles. It is also why sorting an array before a branchy loop over it can make the loop faster — the branch becomes predictable.',
              {
                keyTerms: [
                  { term: 'Pipelining', definition: 'Overlapping the stages of consecutive instructions to raise throughput.' },
                  { term: 'Branch prediction', definition: 'Guessing an unresolved branch and speculatively executing past it.' },
                ],
              },
            ),
            order(
              'Put one pass of the instruction cycle in order.',
              ['Fetch the instruction at the program counter', 'Decode it into an operation and operands', 'Execute the operation', 'Write the result back', 'Advance the program counter'],
              ['sk-instruction-cycle'],
              'Fetch, decode, execute, write back, advance. Pipelining overlaps these across instructions but does not change the order within one.',
            ),
            mcq(
              'Why can sorting an array before a branch-heavy loop make the loop faster?',
              [
                'Sorted data compresses better',
                'The branch becomes predictable, so the CPU stops mispredicting and flushing its pipeline',
                'Sorting reduces the number of iterations',
                'Sorted arrays are stored in cache',
              ],
              1,
              ['sk-instruction-cycle'],
              'The classic surprise benchmark. Same work, far fewer pipeline flushes.',
            ),
            concept(
              'Compiled, interpreted, and the middle ground',
              'Source code is text. Something has to turn it into instructions, and *when* that happens defines the language’s character.\n\n**Compiled ahead of time** (C, Rust, Go): translated to machine code before you run it. The compiler sees the whole function and can reorder, inline, vectorise, and delete work. Fast at runtime; you wait at build time; the binary is platform-specific.\n\n**Interpreted** (classic Python, Ruby): a program reads your code and does what it says, statement by statement, every time through the loop. Flexible and portable; roughly 10–100× slower for tight numeric loops.\n\n**JIT compiled** (JavaScript, the JVM, PyPy, `torch.compile`): starts by interpreting, watches which code is hot, then compiles that code with knowledge the ahead-of-time compiler never had — the actual types and values seen at runtime. Sometimes beats AOT for that reason.\n\nThis explains the single most important performance fact about Python: a `for` loop over a million elements is slow because it is interpreted, but `numpy.dot` on the same data is fast because it immediately hands off to compiled, vectorised code. The advice "vectorise your loops" is really "leave the interpreter sooner".',
              {
                keyTerms: [
                  { term: 'JIT', definition: 'Just-in-time compilation of hot code paths during execution.' },
                ],
              },
            ),
            categorize(
              'Sort each by when source becomes machine code.',
              ['Ahead of time', 'At runtime, per statement', 'Hot paths, during execution'],
              [
                { item: 'Rust', category: 'Ahead of time' },
                { item: 'Go', category: 'Ahead of time' },
                { item: 'CPython', category: 'At runtime, per statement' },
                { item: 'JavaScript in V8', category: 'Hot paths, during execution' },
                { item: 'The JVM', category: 'Hot paths, during execution' },
              ],
              ['sk-compilation-interpretation'],
              'AOT trades build time for run speed; interpretation trades run speed for flexibility; JIT tries to get both by waiting until it knows what is hot.',
            ),
            mcq(
              'Why is a NumPy vector operation far faster than the equivalent Python for-loop?',
              [
                'NumPy uses more threads',
                'The loop body runs as compiled, vectorised machine code instead of per-element interpreted bytecode',
                'NumPy arrays are stored on the GPU',
                'Python caches the result',
              ],
              1,
              ['sk-compilation-interpretation'],
              'One interpreter hop instead of a million. The arithmetic was never the expensive part.',
            ),
          ],
        }),
        lesson({
          id: 'lesson-parallel-hardware',
          title: 'SIMD, GPUs, and Why Deep Learning Runs There',
          summary: 'Hardware that is wide rather than clever — and the workload that suits it.',
          level: 'intermediate',
          domain: 'systems',
          steps: [
            concept(
              'One instruction, many data',
              'A normal instruction adds two numbers. A **SIMD** instruction — Single Instruction, Multiple Data — adds eight pairs of numbers in the same cycle, using a wide register that holds eight values side by side.\n\nNo cleverness, just width. And it costs nothing extra in instruction fetch, decode, or branch prediction, which is why it is close to free when it applies.\n\nIt applies when you are doing **the same operation to a lot of independent values**. Adding two arrays: perfect. Scaling every pixel: perfect. Walking a linked list where each step depends on the last: impossible, there is nothing to do in parallel.\n\nCompilers auto-vectorise simple loops, which is one more reason the compiled/interpreted distinction matters. A Python loop cannot be vectorised by anyone. A C loop over a flat array usually is, automatically.',
              {
                keyTerms: [
                  { term: 'SIMD', definition: 'One instruction applied to several values held in a wide register.' },
                  { term: 'Vectorisation', definition: 'Rewriting element-wise work so SIMD instructions can be used.' },
                ],
              },
            ),
            mcq(
              'Which loop is a good candidate for vectorisation?',
              [
                'Following a linked list until it hits null',
                'Multiplying every element of a flat float array by 2.5',
                'A recursive tree traversal',
                'A loop whose body calls a different function each iteration',
              ],
              1,
              ['sk-simd-vectorisation'],
              'Independent, identical, contiguous. The other three all have a dependency or a branch that forces one element at a time.',
            ),
            concept(
              'A GPU is that idea taken to an extreme',
              'A CPU is optimised for **latency**: finish any one task as fast as possible. It spends most of its transistors on caches, branch predictors, and out-of-order machinery — all of it in service of making unpredictable, sequential code fast.\n\nA GPU is optimised for **throughput**: finish an enormous number of identical tasks per second. It spends its transistors on thousands of simple arithmetic units instead. Each one is slow and dumb. There are thousands of them.\n\nSo the comparison is not "GPUs are faster". A GPU running one sequential, branchy task is *slower* than a CPU. It wins only when the work decomposes into thousands of identical independent pieces.\n\nMatrix multiplication is exactly that: every output cell is an independent dot product. And a neural network is matrix multiplications almost all the way down — forward pass, backward pass, attention, convolution. That is the entire story of why deep learning waited for GPUs, and why an H100 has high-bandwidth memory: with that much arithmetic available, **feeding** the arithmetic units becomes the bottleneck.\n\nIt is also why data loading so often limits training. If the GPU finishes a batch before the CPU has decoded the next one, all those cores idle.',
              {
                keyTerms: [
                  { term: 'Throughput', definition: 'Work completed per unit time, as opposed to the latency of any one task.' },
                  { term: 'Memory bandwidth', definition: 'How fast data can be moved to the compute units — usually the real GPU ceiling.' },
                ],
              },
            ),
            match(
              'Match each design to what it optimises for.',
              [
                { left: 'CPU', right: 'Latency on one unpredictable task' },
                { left: 'GPU', right: 'Throughput across thousands of identical tasks' },
                { left: 'Branch predictor', right: 'Hiding the cost of an unresolved if' },
                { left: 'High-bandwidth memory', right: 'Keeping arithmetic units fed' },
              ],
              ['sk-gpu-architecture'],
              'Two philosophies, two silicon budgets. Neither is universally better.',
            ),
            trueFalse(
              'A GPU will speed up any program that is currently slow.',
              false,
              ['sk-gpu-architecture'],
              'Only work that splits into thousands of identical independent pieces. Sequential, branchy code runs slower on a GPU than on a CPU.',
            ),
            mcq(
              'Training is slow and GPU utilisation sits at 30%. What is the most likely cause?',
              [
                'The model has too many parameters',
                'The learning rate is too low',
                'The input pipeline cannot supply batches fast enough to keep the GPU busy',
                'The GPU needs more cores',
              ],
              2,
              ['sk-gpu-architecture'],
              'Idle cores means starved cores. Profile the data loader before touching the model.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-arch-2',
        title: 'Execution Checkpoint',
        passingScore: 0.7,
        exercises: [
          mcq(
            'What does a JIT compiler know that an ahead-of-time compiler does not?',
            [
              'The source code',
              'The actual types and values observed at runtime, and which paths are hot',
              'The target CPU model',
              'The size of the binary',
            ],
            1,
            ['sk-compilation-interpretation'],
            'It waits until it has evidence, then compiles for the case that actually occurred.',
          ),
          trueFalse(
            'Vectorising a loop that follows a linked list gives a large speedup.',
            false,
            ['sk-simd-vectorisation'],
            'Each step depends on the previous one, so there is nothing to do simultaneously.',
          ),
          mcq(
            'Why did deep learning take off on GPUs specifically?',
            [
              'GPUs have more memory than CPUs',
              'Neural networks are mostly matrix multiplications, which decompose into thousands of independent identical operations',
              'GPUs run Python faster',
              'GPUs have better branch prediction',
            ],
            1,
            ['sk-gpu-architecture'],
            'The workload happened to match the hardware exactly.',
          ),
        ],
      },
    },
  ],
};
