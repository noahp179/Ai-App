/**
 * Track 32 — Digital Logic & Hardware.
 *
 * The bottom of the stack. Every abstraction in this catalog eventually rests
 * on a switch that is either on or off, and the climb from one transistor to
 * something that executes an instruction is short enough to make in one track —
 * which is itself the most surprising thing about it.
 */

import type { Track } from '../../domain/types';
import { categorize, concept, fill, interactive, lesson, match, mcq, multi, numeric, order, shortAnswer, trueFalse } from '../builders';

export const hardwareTrack: Track = {
  id: 'track-hardware',
  title: 'Digital Logic & Hardware',
  tagline: 'From one switch to a working computer',
  description:
    'Transistors, gates, boolean algebra, adders, memory, and the datapath that ties them together. The whole climb from physics to instructions, in enough detail that "it is just electricity" stops being a hand-wave.',
  domain: 'hardware',
  level: 'intro',
  icon: '🔌',
  gradient: ['#64748B', '#0EA5E9'],
  prerequisites: [],
  outcomes: [
    'Explain how a switch becomes a logic gate and a gate becomes arithmetic',
    'Simplify a boolean expression and say what that saves in silicon',
    'Build a full adder from gates and chain it into an n-bit adder',
    'Say how a circuit remembers a bit, and what the clock is for',
    'Describe the path from source code to a signal on a wire',
    'Explain what Moore’s law was, what ended, and what followed',
  ],
  units: [
    // -----------------------------------------------------------------------
    {
      id: 'unit-hw-1',
      title: 'Switches and Logic',
      description: 'From a transistor to a circuit that can add.',
      lessons: [
        lesson({
          id: 'lesson-gates',
          title: 'Transistors and Gates',
          summary: 'A switch controlled by electricity, and the five things you can build from it.',
          level: 'intro',
          domain: 'hardware',
          free: true,
          steps: [
            concept(
              'A switch you can operate with a wire',
              'A **transistor** is a switch with no moving parts. It has three terminals: current flows between two of them when a voltage is applied to the third.\n\nThat is the entire physical basis of computing. Everything above it is arrangement.\n\nWhat makes it powerful is that the controlling signal is the *same kind of thing* as the controlled signal — electricity controlling electricity. So the output of one switch can operate the next, and you can compose them without limit. A mechanical switch operated by a finger cannot be chained; a transistor can.\n\nDigital circuits treat voltage as **two states**: above a threshold is 1, below is 0, and the band between is not used. That deliberate wastefulness is what makes digital reliable. An analogue signal accumulates noise at every stage; a digital one is snapped back to a clean 0 or 1 at every gate, so a hundred stages later it is still exactly the value you started with.\n\nThat single decision — throw away precision to gain noise immunity — is why a digital copy is perfect and a photocopy of a photocopy is not.\n\nA modern processor contains tens of billions of these switches, each a few dozen atoms across, switching billions of times a second.',
              {
                keyTerms: [
                  { term: 'Transistor', definition: 'An electrically controlled switch — the physical basis of all digital logic.' },
                  { term: 'Noise margin', definition: 'The unused voltage band between 0 and 1 that makes digital signals restorable.' },
                ],
              },
            ),
            mcq(
              'Why are digital circuits more noise-tolerant than analogue ones?',
              [
                'They use less power',
                'Every gate restores the signal to a clean 0 or 1, so noise does not accumulate across stages',
                'They run faster',
                'They use fewer components',
              ],
              1,
              ['sk-transistors'],
              'Precision is deliberately discarded in exchange for restorability — which is why a file copied a thousand times is bit-identical.',
            ),
            concept(
              'Gates: the five you need',
              'Wire transistors together and you get a **logic gate** — a circuit whose output is a boolean function of its inputs.\n\n| Gate | Output is 1 when |\n|---|---|\n| AND | both inputs are 1 |\n| OR | at least one input is 1 |\n| NOT | the input is 0 |\n| XOR | the inputs differ |\n| NAND | NOT (both are 1) |\n\nThese are the truth tables from the discrete maths track, implemented in silicon. The connection is exact rather than an analogy: boolean algebra was developed in 1847 and sat unused for ninety years until Claude Shannon noticed in 1937 that it described switching circuits.\n\nThe remarkable fact is **functional completeness**: NAND alone is enough. Any boolean function whatsoever can be built from NAND gates and nothing else — NOT is a NAND with both inputs tied together, AND is a NAND followed by that NOT, and everything else follows.\n\nThat matters industrially, not just theoretically. A fabrication process only has to be excellent at making one component. NAND is also naturally cheap in CMOS — four transistors — which is why chips are largely seas of NAND and NOR.\n\n**XOR** deserves its own mention because it keeps appearing: it is "these differ", which is addition without carry, which is parity, which is the basis of error detection and of one-time-pad encryption.',
              {
                keyTerms: [
                  { term: 'Logic gate', definition: 'A circuit computing a boolean function of its inputs.' },
                  { term: 'Functional completeness', definition: 'A set of gates sufficient to build every boolean function — NAND alone qualifies.' },
                ],
              },
            ),
            interactive(
              'Wire up some gates',
              'logic-gates',
              'Toggle the inputs and watch the outputs. Then try building NOT, AND and OR using only NAND — that is the whole proof of functional completeness, done by hand in about a minute.',
            ),
            match(
              'Match each gate to its behaviour.',
              [
                { left: 'AND', right: '1 only when both inputs are 1' },
                { left: 'OR', right: '1 when at least one input is 1' },
                { left: 'XOR', right: '1 when the inputs differ' },
                { left: 'NAND', right: '0 only when both inputs are 1' },
              ],
              ['sk-logic-gates'],
              'NAND is AND inverted — and on its own is enough to build every other gate.',
            ),
            mcq(
              'Why is NAND so important?',
              [
                'It is the fastest gate',
                'It is functionally complete — every boolean function can be built from NAND alone',
                'It uses no power',
                'It was invented first',
              ],
              1,
              ['sk-logic-gates'],
              'One cheap component that a fab can be excellent at making, from which everything else is composed.',
            ),
            numeric(
              'For a 3-input boolean function, how many rows does its truth table have?',
              8,
              ['sk-boolean-circuits'],
              '2³ = 8. Every extra input doubles the table, which is why exhaustive verification stops being practical quickly and why algebraic simplification matters.',
            ),
            concept(
              'Boolean algebra is circuit simplification',
              'Every boolean expression describes a circuit, and simpler expressions are literally smaller, cheaper, cooler and faster chips. Algebra here is not abstraction — it is cost reduction.\n\nThe identities that do most of the work:\n\n```\nA · 1 = A          A + 0 = A\nA · A = A          A + A = A\nA · Ā = 0          A + Ā = 1\nA + A·B = A                     (absorption)\nA·B + A·B̄ = A                   (combining)\n¬(A · B) = Ā + B̄               (De Morgan)\n```\n\nThat absorption law is the one worth internalising: whenever two terms differ in exactly one variable, that variable is irrelevant and drops out. A circuit with eight gates often collapses to three.\n\nAnd De Morgan is the same law you use to invert an `if` condition in code. The rule that lets you rewrite `!(a && b)` as `!a || !b` is the rule that lets a chip designer swap an AND-NOT arrangement for a NOR — same truth table, different transistor count.\n\nThis is a good moment to notice the pattern this whole track is built on. The maths did not arrive to describe the hardware; the hardware arrived and turned out to be described by maths that already existed.',
              {
                keyTerms: [
                  { term: 'Absorption', definition: 'A + A·B = A — a redundant term contributing nothing.' },
                  { term: 'Combining', definition: 'A·B + A·B̄ = A — a variable that appears both ways is irrelevant.' },
                ],
              },
            ),
            mcq(
              'Simplify `A·B + A·B̄`.',
              ['A', 'B', 'A·B', '0'],
              0,
              ['sk-boolean-circuits'],
              'B appears both asserted and negated, so it cannot affect the result — the expression is true whenever A is. Two gates become a wire.',
            ),
            fill(
              'De Morgan: ¬(A · B) equals ___ , and the same identity lets you rewrite `!(a && b)` in code as ___ .',
              [['Ā + B̄', 'not A or not B', '¬A + ¬B'], ['!a || !b', 'not a or not b']],
              ['sk-boolean-circuits'],
              'One law, two spellings — silicon and source code.',
            ),
          ],
        }),
        lesson({
          id: 'lesson-adders',
          title: 'Arithmetic From Gates',
          summary: 'Two gates make an adder. Chain it and you have a CPU’s arithmetic unit.',
          level: 'intermediate',
          domain: 'hardware',
          steps: [
            concept(
              'The half adder, then the full adder',
              'Adding two single bits has four cases, and the answer needs two output bits:\n\n| A | B | Sum | Carry |\n|---|---|---|---|\n| 0 | 0 | 0 | 0 |\n| 0 | 1 | 1 | 0 |\n| 1 | 0 | 1 | 0 |\n| 1 | 1 | 0 | 1 |\n\nLook at the Sum column: it is 1 exactly when the inputs differ. That is **XOR**. And Carry is 1 only when both are 1 — that is **AND**.\n\nSo a **half adder** is one XOR and one AND. Two gates, and you have arithmetic.\n\nIt is called *half* because it has nowhere to accept a carry coming in from the column to its right. A **full adder** takes three inputs (A, B, carry-in) and produces sum and carry-out. It is two half adders and an OR.\n\nChain n full adders, each one’s carry-out feeding the next one’s carry-in, and you can add two n-bit numbers. This is a **ripple-carry adder**, and it is exactly the column-by-column addition you were taught at school, in silicon.\n\nSubtraction needs no new circuit at all: from the architecture track, negating in two’s complement is inverting the bits and adding one, so `A − B` is `A + NOT(B) + 1`. Feed the inverted B and set the first carry-in to 1, and the adder subtracts. One circuit, both operations — which is precisely why two’s complement won.',
              {
                keyTerms: [
                  { term: 'Half adder', definition: 'XOR for the sum, AND for the carry — two bits in, two out.' },
                  { term: 'Ripple carry', definition: 'Chained full adders where each carry feeds the next column.' },
                ],
              },
            ),
            interactive(
              'Build an adder',
              'binary-adder',
              'Set the two input numbers and watch the carry ripple along the chain. Note how many stages the carry has to travel through before the top bit is correct — that delay is why real processors use cleverer adders.',
            ),
            mcq(
              'Which two gates make a half adder?',
              ['AND and OR', 'XOR and AND', 'NOT and OR', 'NAND and NOR'],
              1,
              ['sk-combinational'],
              'XOR gives the sum bit, AND gives the carry. Two gates and you have arithmetic.',
            ),
            mcq(
              'What is the drawback of a ripple-carry adder?',
              [
                'It cannot handle negative numbers',
                'The carry must propagate through every stage, so delay grows linearly with width',
                'It needs a clock',
                'It uses too much memory',
              ],
              1,
              ['sk-combinational'],
              'A 64-bit ripple adder waits for 64 stages. Carry-lookahead computes the carries in parallel instead, trading gates for speed.',
            ),
            trueFalse(
              'Subtraction needs a separate circuit from addition.',
              false,
              ['sk-combinational', 'sk-twos-complement'],
              'Invert the second operand and set carry-in to 1. Two’s complement was chosen precisely so one adder does both.',
            ),
            multi(
              'Which are built purely from combinational logic — no memory?',
              [
                'An adder',
                'A multiplexer that selects one of four inputs',
                'A counter that increments each clock tick',
                'A decoder that turns 3 bits into 8 select lines',
              ],
              [0, 1, 3],
              ['sk-combinational'],
              'A counter must remember its current value, which needs the sequential logic in the next unit. The others compute their output purely from their present inputs.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-hw-1',
        title: 'Logic Checkpoint',
        passingScore: 0.7,
        exercises: [
          mcq(
            'What makes NAND special?',
            ['It is fastest', 'Every boolean function can be built from NAND alone', 'It uses one transistor', 'It never fails'],
            1,
            ['sk-logic-gates'],
            'Functional completeness.',
          ),
          numeric(
            'How many rows in the truth table of a 4-input function?',
            16,
            ['sk-boolean-circuits'],
            '2⁴ = 16.',
          ),
          mcq(
            'The sum output of a half adder is which gate?',
            ['AND', 'OR', 'XOR', 'NOT'],
            2,
            ['sk-combinational'],
            'The sum bit is 1 exactly when the inputs differ.',
          ),
        ],
      },
    },
    // -----------------------------------------------------------------------
    {
      id: 'unit-hw-2',
      title: 'Memory and Machines',
      description: 'Circuits that remember, and the datapath they feed.',
      lessons: [
        lesson({
          id: 'lesson-sequential',
          title: 'Remembering a Bit',
          summary: 'Feed an output back into an input and the circuit acquires a past.',
          level: 'intermediate',
          domain: 'hardware',
          steps: [
            concept(
              'Feedback is memory',
              'Every circuit so far has been **combinational**: the output depends only on the current inputs. Such a circuit has no past.\n\nConnect an output back to an input and something new appears. Two NOR gates cross-coupled — each one’s output feeding the other’s input — form a **latch**, which is stable in either of two states and stays there when the inputs go quiet. It remembers.\n\nThat is the entire trick: **feedback is memory**. One bit of storage from two gates.\n\nUncontrolled latches are awkward because they change the instant their inputs do, and in a large circuit different signals arrive at different times. The fix is a **flip-flop**, which only updates on the edge of a **clock** signal.\n\nThe clock is the heartbeat, and its job is to make time discrete. Between ticks, combinational logic settles; on the tick, every flip-flop captures the settled value simultaneously. Without it, signals racing through paths of different lengths would produce whatever the physics happened to deliver.\n\nThis is why clock speed has a ceiling: the clock period must exceed the longest combinational delay between two flip-flops — the **critical path**. Raise the frequency past that and some flip-flop captures a value that had not finished computing. That is exactly what overclocking risks, and why chip designers spend so much effort shortening one specific path.',
              {
                keyTerms: [
                  { term: 'Latch', definition: 'Cross-coupled gates stable in two states — one bit of memory.' },
                  { term: 'Critical path', definition: 'The longest settling delay, which sets the maximum clock frequency.' },
                ],
              },
            ),
            mcq(
              'What turns a combinational circuit into one that can remember?',
              ['A clock', 'Feedback — routing an output back to an input', 'More gates', 'A capacitor'],
              1,
              ['sk-sequential-logic'],
              'Two cross-coupled NOR gates are stable in either state and hold it. The clock controls *when* it updates, not whether it can.',
            ),
            mcq(
              'What sets the maximum clock frequency of a chip?',
              [
                'The number of transistors',
                'The critical path — the longest settling delay between two flip-flops',
                'The memory size',
                'The instruction set',
              ],
              1,
              ['sk-sequential-logic'],
              'The clock period must be longer than the slowest path, or a flip-flop latches an unfinished value.',
            ),
            concept(
              'How a bit is physically stored',
              'Different storage technologies make different trades, and the trades explain the memory hierarchy from the systems track entirely.\n\n**SRAM** — six transistors per bit, cross-coupled as above. Fast, holds its value as long as power is applied, and expensive in area. This is what caches are made of, which is why L1 is measured in kilobytes.\n\n**DRAM** — one transistor and one capacitor per bit. Far denser and far cheaper, but the capacitor leaks, so every row must be read and rewritten thousands of times a second. That **refresh** costs power and time, and is why DRAM is slower. This is main memory.\n\n**Flash** — charge trapped on a floating gate, which persists without power. Dense and non-volatile, but writing requires erasing a whole block first, and each cell wears out after a bounded number of erase cycles. Hence wear levelling, and hence SSD write amplification.\n\n| | Per bit | Speed | Volatile | Used for |\n|---|---|---|---|---|\n| SRAM | 6 transistors | Fastest | Yes | Caches |\n| DRAM | 1T + 1C | Medium | Yes, needs refresh | Main memory |\n| Flash | 1 floating gate | Slow writes | No | SSDs |\n\nThe hierarchy is not a design preference. It is these three physical facts, arranged in the only order that makes sense.',
              {
                keyTerms: [
                  { term: 'SRAM', definition: 'Six-transistor cell — fast, large, used for caches.' },
                  { term: 'Refresh', definition: 'Periodically rewriting DRAM rows before their charge leaks away.' },
                ],
              },
            ),
            categorize(
              'Sort each property by technology.',
              ['SRAM', 'DRAM', 'Flash'],
              [
                { item: 'Six transistors per bit', category: 'SRAM' },
                { item: 'Needs periodic refresh', category: 'DRAM' },
                { item: 'Retains data with no power', category: 'Flash' },
                { item: 'Used for CPU caches', category: 'SRAM' },
                { item: 'Must erase a block before writing', category: 'Flash' },
              ],
              ['sk-memory-cells'],
              'Three physical trades, which together produce the entire memory hierarchy.',
            ),
            mcq(
              'Why is DRAM slower than SRAM?',
              [
                'It is further from the CPU',
                'Its charge leaks, so it must be refreshed, and reading is destructive and needs a rewrite',
                'It uses more transistors',
                'It is non-volatile',
              ],
              1,
              ['sk-memory-cells'],
              'Density is bought with a capacitor that will not hold its charge, and everything else follows from that.',
            ),
          ],
        }),
        lesson({
          id: 'lesson-datapath',
          title: 'The Whole Stack',
          summary: 'Gates into a processor, and the abstraction ladder that hides it.',
          level: 'expert',
          domain: 'hardware',
          steps: [
            concept(
              'Building a processor from the pieces',
              'You now have everything a simple processor needs.\n\n**Registers** — flip-flops in groups, each holding one word.\n\n**An ALU** — the adder, plus AND/OR/XOR units, plus a multiplexer selecting which result to pass through. The operation code *is* the multiplexer’s select input, which is a genuinely satisfying realisation: an instruction is partly just wiring.\n\n**A register file** — a decoder converting a register number into a select line, so "register 5" addresses the right flip-flops.\n\n**A program counter** — a register plus an incrementer.\n\n**Control logic** — combinational logic decoding the instruction into the select signals for everything above.\n\nOne clock tick then does the fetch–decode–execute cycle from the architecture track: the PC addresses memory, the instruction comes back, control logic decodes it into select lines, the register file produces operands, the ALU computes, and the result is written back — all of it settling within one clock period.\n\nThat is a working computer. Every further thing a modern CPU does — pipelining, caches, out-of-order execution, branch prediction, vector units — is an optimisation on top of this, not a different idea.',
              {
                figure: 'abstraction-stack',
                keyTerms: [
                  { term: 'ALU', definition: 'Arithmetic logic unit — the adder and logic units with a multiplexer choosing between them.' },
                  { term: 'Control logic', definition: 'Combinational logic decoding an instruction into select signals.' },
                ],
              },
            ),
            order(
              'Order the abstraction ladder from physics upward.',
              [
                'Electrons and semiconductor physics',
                'Transistors as switches',
                'Logic gates',
                'Adders, multiplexers and flip-flops',
                'A datapath executing instructions',
                'Machine code, then a compiler, then a language',
                'An operating system and applications',
              ],
              ['sk-abstraction-layers'],
              'Each layer is built entirely from the one below and hides it completely. You can work productively at any level knowing almost nothing about the next one down — which is the single most important idea in computing.',
            ),
            mcq(
              'In a simple ALU, what does the instruction’s operation code physically control?',
              [
                'The clock speed',
                'The multiplexer select lines choosing which unit’s result passes through',
                'The memory size',
                'The number of registers',
              ],
              1,
              ['sk-datapath'],
              'Every unit computes its result every cycle; the opcode simply selects which one is kept.',
            ),
            concept(
              'Moore’s law, and what actually ended',
              'In 1965 Gordon Moore observed that the number of transistors on a chip was doubling roughly every two years. It held, remarkably, for about fifty years.\n\nBut people usually mean something else by it — that computers get twice as fast every two years — and that was never Moore’s law. It was **Dennard scaling**: as transistors shrank, their power density stayed constant, so you could raise the clock frequency for free.\n\nDennard scaling ended around 2005. Below roughly 65nm, current leaks through gates too thin to insulate properly, and power density started rising. Clock speeds stopped at 3–4 GHz and have essentially stayed there ever since.\n\nWhat followed is the entire shape of modern computing:\n\n**Multiple cores**, because you could still add transistors but not make one core faster. Which is why the concurrency material in the systems track went from specialist knowledge to general knowledge.\n\n**Specialised hardware** — GPUs, TPUs, neural accelerators, video codecs. If you cannot make general computation faster, make specific computation faster. This is the single biggest reason the deep learning era happened when it did.\n\n**Dark silicon** — more transistors than you can power at once, so parts of the chip stay off.\n\nMoore’s law itself is now slowing too: the cost per transistor has stopped falling, and features are approaching atomic scale. The industry’s answer is architecture rather than physics — chiplets, 3D stacking, and hardware designed for one job.\n\nWhich means performance is increasingly something software has to earn, through locality and parallelism, rather than something that arrives on its own. That is the thread tying this track back to every other one in the catalog.',
              {
                keyTerms: [
                  { term: 'Dennard scaling', definition: 'Power density staying constant as transistors shrank — this is what ended.' },
                  { term: 'Dark silicon', definition: 'Transistors that cannot all be powered simultaneously within the thermal budget.' },
                ],
              },
            ),
            mcq(
              'Clock speeds stopped rising around 2005. What ended?',
              [
                'Moore’s law',
                'Dennard scaling — power density stopped staying constant as transistors shrank',
                'Transistor manufacturing',
                'Demand for faster chips',
              ],
              1,
              ['sk-moores-law'],
              'Transistor counts kept doubling for another decade. What stopped was getting frequency for free.',
            ),
            multi(
              'Which are direct consequences of the end of Dennard scaling?',
              [
                'Multi-core processors became the default',
                'Specialised accelerators like GPUs and TPUs became central',
                'Parts of a chip must stay powered off',
                'Transistors stopped shrinking immediately',
              ],
              [0, 1, 2],
              ['sk-moores-law'],
              'Shrinking continued for years afterwards. It was the free frequency that stopped.',
            ),
            shortAnswer(
              'Someone says "computers double in speed every two years". What is wrong with that, and what is true instead?',
              ['moore', 'transistor', 'dennard', 'clock', 'cores', 'parallel'],
              'Moore’s law was about transistor count doubling, not speed. The speed doubling came from Dennard scaling — constant power density as transistors shrank, which let clock frequency rise for free — and that ended around 2005. Since then transistor counts kept growing for a while but single-thread performance has improved slowly. The extra transistors went into more cores and specialised accelerators instead, which means the gains are now only available to software written to be parallel or to use the accelerator.',
              ['sk-moores-law'],
              'Two different laws, one of which ended twenty years ago. The consequence is that performance now has to be earned in software.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-hw-2',
        title: 'Memory and Machines Checkpoint',
        passingScore: 0.7,
        exercises: [
          mcq(
            'What gives a circuit memory?',
            ['A clock', 'Feedback from output to input', 'More gates', 'Higher voltage'],
            1,
            ['sk-sequential-logic'],
            'The clock decides when it updates; feedback is what lets it hold anything at all.',
          ),
          mcq(
            'Which technology needs periodic refresh?',
            ['SRAM', 'DRAM', 'Flash', 'All of them'],
            1,
            ['sk-memory-cells'],
            'Its capacitor leaks, which is the price of being one transistor instead of six.',
          ),
          mcq(
            'What ended around 2005, stalling clock speeds?',
            ['Moore’s law', 'Dennard scaling', 'Transistor shrinking', 'Cache improvements'],
            1,
            ['sk-moores-law'],
            'Power density stopped staying constant as features shrank.',
          ),
        ],
      },
    },
  ],
};
