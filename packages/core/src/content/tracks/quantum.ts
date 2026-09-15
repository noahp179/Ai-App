/**
 * Track 37 — Quantum Computing.
 *
 * The most over-hyped subject in computing, and genuinely fascinating
 * underneath the hype. Written to leave someone able to tell a real claim from
 * a press release, which is a more useful outcome than a half-remembered
 * feeling that qubits are "both at once".
 */

import type { Track } from '../../domain/types';
import { categorize, concept, fill, interactive, lesson, match, mcq, numeric, order, shortAnswer, trueFalse } from '../builders';

export const quantumTrack: Track = {
  id: 'track-quantum',
  title: 'Quantum Computing',
  tagline: 'What it actually does, and what it does not',
  description:
    'Qubits, superposition, entanglement, measurement and interference — then the two algorithms that matter, why decoherence is the whole engineering problem, and a clear-eyed account of what quantum computers will and will not be good for.',
  domain: 'quantum',
  level: 'expert',
  icon: '⚛️',
  gradient: ['#8B5CF6', '#22D3EE'],
  prerequisites: ['track-math'],
  outcomes: [
    'Explain a qubit as an amplitude vector rather than as "both at once"',
    'Say what measurement does and why it is the constraint that shapes everything',
    'Describe entanglement without invoking faster-than-light communication',
    'Explain why interference, not parallelism, is the source of speedup',
    'State what Shor and Grover do and how much each actually buys',
    'Give an honest answer about timelines and applicability',
  ],
  units: [
    // -----------------------------------------------------------------------
    {
      id: 'unit-q-1',
      title: 'Qubits and Measurement',
      description: 'Amplitudes, the Bloch sphere, and the cost of looking.',
      lessons: [
        lesson({
          id: 'lesson-qubits',
          title: 'Superposition, Properly',
          summary: 'Not "both at once". A vector of amplitudes, which is stranger and more precise.',
          level: 'expert',
          domain: 'quantum',
          free: true,
          steps: [
            concept(
              'A qubit is a direction, not a coin',
              'The popular description — "a qubit is 0 and 1 at the same time" — is wrong in a way that blocks understanding. Here is the accurate version.\n\nA classical bit is 0 or 1. A **qubit** is described by two **amplitudes**, α and β, which are complex numbers:\n\n```\n|ψ⟩ = α|0⟩ + β|1⟩       with  |α|² + |β|² = 1\n```\n\nThose are not probabilities. They are complex numbers whose **squared magnitudes** are the probabilities of measuring 0 or 1. The constraint says the probabilities sum to one.\n\nWhy does the distinction matter so much? Because complex amplitudes can be **negative, or complex, and can therefore cancel**. Probabilities cannot. Two paths to the same outcome with amplitudes +0.5 and −0.5 cancel to zero — that outcome becomes impossible. Nothing in classical probability behaves like this, and it is the entire source of quantum advantage.\n\nGeometrically a qubit is a point on the surface of a sphere — the **Bloch sphere**. The north pole is |0⟩, the south pole is |1⟩, and everywhere else is a superposition. A classical bit can only be at a pole. Quantum gates rotate the point around the sphere.\n\nSo "superposition" means "somewhere else on the sphere", and the useful question is never "which is it really" but "where is it pointing, and what will a measurement along this axis give".',
              {
                keyTerms: [
                  { term: 'Amplitude', definition: 'A complex number whose squared magnitude gives a measurement probability.' },
                  { term: 'Bloch sphere', definition: 'The geometric picture of a single qubit’s state as a point on a sphere.' },
                ],
              },
            ),
            interactive(
              'Move a qubit around the sphere',
              'qubit-bloch',
              'Rotate the state and watch the measurement probabilities change. Note that the poles are the only states where a measurement is certain — everywhere else you are choosing odds rather than a value.',
            ),
            mcq(
              'What is wrong with "a qubit is 0 and 1 at the same time"?',
              [
                'Nothing, it is exactly right',
                'It suggests a hidden classical value, and it hides the amplitudes — which can be negative and cancel, unlike probabilities',
                'Qubits can only be 0',
                'It applies only to entangled qubits',
              ],
              1,
              ['sk-qubits'],
              'The cancellation is the whole point, and the popular phrasing loses it entirely.',
            ),
            numeric(
              'A qubit has amplitude α = 0.6 on |0⟩. What is the probability of measuring 0, as a percentage?',
              36,
              ['sk-qubits'],
              '|0.6|² = 0.36. The amplitude is not the probability; its squared magnitude is.',
            ),
            trueFalse(
              'Amplitudes can be negative, while probabilities cannot.',
              true,
              ['sk-qubits'],
              'Which is exactly why quantum paths can cancel and classical ones cannot.',
            ),
            concept(
              'Measurement destroys what you were using',
              'Here is the constraint that makes quantum computing hard, and it is the one popular accounts skip.\n\nWhen you **measure** a qubit you get one classical bit — 0 or 1 — with probability |α|² or |β|². And the superposition is gone: the state **collapses** to whatever you measured. Measure again and you get the same answer, because there is nothing left to be uncertain about.\n\nSo you cannot read out the amplitudes. You had two complex numbers and you got one bit.\n\nThe "quantum computers try all answers in parallel" story founders precisely here. Yes, n qubits can be in a superposition over 2ⁿ basis states. No, you cannot read them. Measure and you get **one** of them, at random.\n\nThis is why quantum algorithms are so hard to design and so few in number. A useful algorithm must arrange, before measurement, for the amplitude of the *right* answer to be large and the amplitudes of the wrong answers to cancel toward zero. Getting that arrangement is the entire art.\n\nAnd the **no-cloning theorem** removes the obvious workaround: an unknown quantum state cannot be copied. You cannot make a thousand copies and measure each. One shot, then it is gone.\n\nNo-cloning is not only an obstacle. It is what makes quantum key distribution work: an eavesdropper cannot copy the state in transit, and any attempt to measure it disturbs it detectably.',
              {
                keyTerms: [
                  { term: 'Collapse', definition: 'Measurement yields one classical outcome and destroys the superposition.' },
                  { term: 'No-cloning', definition: 'An unknown quantum state cannot be copied.' },
                ],
              },
            ),
            mcq(
              'Why can a quantum computer not simply "try all answers at once and read the best"?',
              [
                'It is too slow',
                'Measurement returns one basis state at random and destroys the superposition — you cannot read the amplitudes',
                'There are not enough qubits',
                'The answers are encrypted',
              ],
              1,
              ['sk-measurement'],
              'The parallelism is real and unreadable. Extracting anything useful requires interference to concentrate amplitude on the right answer first.',
            ),
            mcq(
              'What does the no-cloning theorem prevent?',
              [
                'Measuring a qubit',
                'Copying an unknown quantum state, so you cannot duplicate and measure repeatedly',
                'Entangling two qubits',
                'Building large circuits',
              ],
              1,
              ['sk-measurement'],
              'It also underpins quantum key distribution: an eavesdropper cannot copy the state without disturbing it.',
            ),
          ],
        }),
        lesson({
          id: 'lesson-gates-entanglement',
          title: 'Gates, Entanglement, and Interference',
          summary: 'Rotations, correlation that has no classical analogue, and the actual source of speedup.',
          level: 'expert',
          domain: 'quantum',
          steps: [
            concept(
              'Gates are rotations, and they are reversible',
              'A **quantum gate** transforms amplitudes. Geometrically it rotates the state on the Bloch sphere; mathematically it is a unitary matrix.\n\nThe ones worth naming:\n\n**X** — the quantum NOT. Swaps the amplitudes of |0⟩ and |1⟩.\n\n**H (Hadamard)** — creates superposition. Applied to |0⟩ it gives equal amplitudes on both. It is how essentially every algorithm starts.\n\n**Z** — flips the *sign* of the |1⟩ amplitude. It changes no measurement probability on its own, and it is indispensable, because sign is what makes cancellation possible.\n\n**CNOT** — two qubits: flip the second if the first is 1. This is what creates entanglement.\n\nOne property is worth pausing on: quantum gates are **reversible**. Every gate has an inverse, because unitary matrices do. Classical AND is not reversible — knowing the output is 0 does not tell you the inputs — and it is not a coincidence that irreversible classical operations dissipate heat while reversible ones need not. Landauer’s principle connects erasing information to a minimum energy cost, which is a genuine link between information theory and thermodynamics.\n\nSince a quantum computation must be reversible, quantum algorithms are built entirely from invertible steps, right up until the measurement at the end — which is the one irreversible act.',
              {
                keyTerms: [
                  { term: 'Hadamard gate', definition: 'Creates an equal superposition — how most algorithms begin.' },
                  { term: 'Reversible', definition: 'Every quantum gate has an inverse; only measurement is irreversible.' },
                ],
              },
            ),
            interactive(
              'Build a circuit',
              'quantum-circuit',
              'Apply gates to two qubits and watch the amplitudes. Put a Hadamard on the first and a CNOT across both — that two-gate circuit produces the entangled pair the next section is about.',
            ),
            match(
              'Match each gate to what it does.',
              [
                { left: 'X', right: 'Swaps the |0⟩ and |1⟩ amplitudes — quantum NOT' },
                { left: 'Hadamard', right: 'Creates an equal superposition' },
                { left: 'Z', right: 'Flips the sign of the |1⟩ amplitude' },
                { left: 'CNOT', right: 'Flips the second qubit if the first is 1, creating entanglement' },
              ],
              ['sk-quantum-gates'],
              'Z changes no probability by itself and is essential, because sign is what allows cancellation later.',
            ),
            trueFalse(
              'Every quantum gate is reversible.',
              true,
              ['sk-quantum-gates'],
              'They are unitary, so each has an inverse. Measurement is the only irreversible step in a quantum computation.',
            ),
            concept(
              'Entanglement: correlation with no classical shadow',
              'Apply a Hadamard to one qubit and then a CNOT across two, and you get:\n\n```\n(|00⟩ + |11⟩) / √2\n```\n\nRead that carefully. The amplitudes on |01⟩ and |10⟩ are **zero**. Measure the first qubit and you get 0 or 1 at random — and the second is then *guaranteed* to match, however far apart they are.\n\nThe temptation is to say they secretly agreed in advance, like two gloves posted to different cities. **Bell’s theorem** rules that out: measuring along different axes produces correlations stronger than any pre-agreed classical strategy can reproduce. This has been tested experimentally many times, most decisively in loophole-free experiments from 2015 onward, and it won the 2022 Nobel Prize in Physics.\n\nSo entanglement is genuinely not classical correlation.\n\nAnd yet it **cannot send information**. The outcome on your side is random, and you cannot choose it. Alice sees a random bit; Bob sees a random bit; only when they compare notes over an ordinary channel does the correlation become visible. No faster-than-light communication, ever — this is the **no-communication theorem**, and any headline suggesting otherwise is wrong.\n\nWhat entanglement is actually for is computational. Entangled states let a quantum computer represent correlations across 2ⁿ possibilities in n qubits, and interference between those correlated paths is what algorithms exploit. It is also the resource behind quantum teleportation, which despite the name moves a state using entanglement *plus two classical bits*, at no more than the speed of light.',
              {
                keyTerms: [
                  { term: 'Entanglement', definition: 'A joint state that cannot be described as two independent qubits.' },
                  { term: 'No-communication theorem', definition: 'Entanglement alone cannot transmit information.' },
                ],
              },
            ),
            mcq(
              'Can entanglement be used to send information faster than light?',
              [
                'Yes, that is its main use',
                'No — each side sees a random outcome, and the correlation only appears when results are compared over a classical channel',
                'Only over short distances',
                'Only with more than two qubits',
              ],
              1,
              ['sk-entanglement'],
              'The no-communication theorem. Anything claiming otherwise has misunderstood the randomness.',
            ),
            mcq(
              'What did Bell’s theorem establish?',
              [
                'That entanglement is impossible',
                'That the correlations exceed anything a pre-agreed classical strategy could produce',
                'That measurement is deterministic',
                'That qubits can be cloned',
              ],
              1,
              ['sk-entanglement'],
              'Experimentally confirmed, and the 2022 Nobel Prize. The "they agreed in advance" explanation is ruled out.',
            ),
            concept(
              'Interference is the whole trick',
              'Here is the thing to take away from this track if you take one thing.\n\nA quantum computer is not fast because it explores every branch. It is fast — on a small number of specific problems — because amplitudes can **cancel**.\n\nThe structure of every quantum algorithm is the same three moves:\n\n1. **Prepare** a superposition over all candidate answers, with Hadamards.\n2. **Compute** in a way that assigns each candidate an amplitude reflecting whether it is the answer.\n3. **Interfere** so that wrong answers’ amplitudes cancel and the right answer’s amplitude reinforces.\n\nThen measure, and get the right answer with high probability.\n\nStep three is where the difficulty lives, and it is why there are so few quantum algorithms. You need a problem with enough mathematical structure that a cancellation pattern exists and can be arranged. Factoring has that structure, through periodicity. Unstructured search has only a little, which is why Grover gets a quadratic speedup rather than an exponential one. Most problems have none at all.\n\nSo the honest summary: quantum computers are not "faster computers". They are a different computational model that is dramatically better at a small, structured set of problems and offers **no advantage whatsoever** on the vast majority of what computers do. Sorting, databases, web servers, rendering, and running a neural network are all unaffected.',
              {
                keyTerms: [
                  { term: 'Interference', definition: 'Amplitudes adding or cancelling — the actual mechanism of quantum speedup.' },
                ],
              },
            ),
            mcq(
              'What is the actual source of quantum speedup?',
              [
                'Trying every possibility in parallel',
                'Interference — arranging for wrong answers’ amplitudes to cancel and the right one’s to reinforce',
                'Faster clock speeds',
                'Entanglement alone',
              ],
              1,
              ['sk-quantum-interference'],
              'The parallelism exists and is unreadable. Cancellation is what makes the readout useful.',
            ),
            order(
              'Order the structure shared by quantum algorithms.',
              [
                'Prepare a superposition over candidate answers',
                'Compute so amplitudes encode which candidates are right',
                'Interfere so wrong answers cancel',
                'Measure, and read the answer with high probability',
              ],
              ['sk-quantum-interference'],
              'Step three is the hard part, and it needs a problem with enough structure for a cancellation pattern to exist.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-q-1',
        title: 'Quantum Basics Checkpoint',
        passingScore: 0.7,
        exercises: [
          mcq(
            'Measuring a qubit gives you what?',
            ['Both amplitudes', 'One classical bit, and the superposition is destroyed', 'The Bloch angle', 'Nothing'],
            1,
            ['sk-measurement'],
            'Two complex numbers in, one bit out.',
          ),
          trueFalse(
            'Entanglement produces correlated outcomes but cannot carry a message.',
            true,
            ['sk-entanglement'],
            'Each side sees purely random results; the correlation only appears once the two records are compared over an ordinary channel, which travels no faster than light. This is the no-communication theorem, and it is why quantum key distribution still needs a classical link.',
          ),
          mcq(
            'Quantum speedup comes from what?',
            ['Parallelism alone', 'Interference between amplitudes', 'Faster gates', 'More memory'],
            1,
            ['sk-quantum-interference'],
            'Cancellation of the wrong answers.',
          ),
        ],
      },
    },
    // -----------------------------------------------------------------------
    {
      id: 'unit-q-2',
      title: 'Algorithms and Reality',
      description: 'The two that matter, why the hardware is so hard, and an honest forecast.',
      lessons: [
        lesson({
          id: 'lesson-quantum-algorithms',
          title: 'Shor, Grover, and Decoherence',
          summary: 'What is actually on the list, and what is stopping it.',
          level: 'expert',
          domain: 'quantum',
          steps: [
            concept(
              'The two algorithms everyone cites',
              '**Shor’s algorithm** (1994) factors an n-bit integer in roughly n³ time, against the best classical algorithm’s sub-exponential but still infeasible time. That is an **exponential** speedup.\n\nThe insight is that factoring reduces to finding the **period** of a function, and a quantum Fourier transform finds periods efficiently by interference — periodic structure reinforces at the right frequency and cancels elsewhere. Factoring itself is not obviously quantum-friendly; periodicity is, and the reduction is the clever part.\n\nBecause RSA and elliptic-curve cryptography rest on factoring and discrete logarithms, Shor breaks essentially all deployed public-key cryptography, exactly as covered in the cryptography track.\n\n**Grover’s algorithm** (1996) searches an unstructured space of N items in √N steps instead of N. Searching a trillion items takes a million steps.\n\nThat sounds enormous and is a **quadratic** speedup, which is far less dramatic than it appears. Against a problem that classically takes 2¹²⁸ operations, Grover takes 2⁶⁴ — still infeasible. It halves exponents; it does not make exponential problems tractable. Its main practical consequence is that symmetric key sizes should double.\n\nAnd Grover is provably **optimal** for unstructured search, which is a useful piece of bad news: no future quantum algorithm will do better on a problem with no structure. Quantum advantage requires structure to exploit, and most problems do not have any.\n\nBeyond these two the list is short: quantum simulation of molecules and materials — which is arguably the most genuinely promising application, since simulating quantum systems is what quantum computers are natively good at — and a set of optimisation and linear-algebra proposals whose advantage over good classical methods remains contested.',
              {
                keyTerms: [
                  { term: 'Shor’s algorithm', definition: 'Exponential speedup for factoring and discrete logarithms.' },
                  { term: 'Grover’s algorithm', definition: 'Quadratic speedup for unstructured search, and provably optimal.' },
                ],
              },
            ),
            match(
              'Match each algorithm to its speedup.',
              [
                { left: 'Shor (factoring)', right: 'Exponential — breaks RSA and ECC' },
                { left: 'Grover (search)', right: 'Quadratic — √N instead of N' },
                { left: 'Quantum simulation', right: 'Natural fit; simulating quantum systems' },
                { left: 'Sorting a list', right: 'No quantum advantage at all' },
              ],
              ['sk-quantum-algorithms'],
              'The last row is most of computing.',
            ),
            numeric(
              'Grover searches an unstructured space of 1,000,000 items in about how many steps?',
              1000,
              ['sk-quantum-algorithms'],
              '√1,000,000 = 1,000. Impressive, and still only a square root — against 2¹²⁸ it gives 2⁶⁴, which is no help.',
              { tolerance: 1 },
            ),
            mcq(
              'Why is Grover being provably optimal significant?',
              [
                'It means quantum computers are fast',
                'No future quantum algorithm can beat √N on unstructured search — advantage requires structure',
                'It proves P = NP',
                'It makes encryption unbreakable',
              ],
              1,
              ['sk-quantum-algorithms'],
              'A hard ceiling, which is why the list of quantum algorithms is short rather than merely young.',
            ),
            concept(
              'Decoherence: the reason this is hard',
              'Quantum states are extraordinarily fragile. Any interaction with the environment — a stray photon, a vibration, a thermal fluctuation — measures the system and collapses it. This is **decoherence**, and it is the entire engineering problem.\n\nCurrent hardware holds coherence for microseconds to milliseconds. Gates take nanoseconds, so you get perhaps thousands of operations before the state is noise. Shor on RSA-2048 needs billions.\n\nThe mitigations are extreme: superconducting qubits at 10 millikelvin, colder than interstellar space; trapped ions in ultra-high vacuum; heavy electromagnetic shielding. And they are not enough on their own.\n\nThe real answer is **quantum error correction**, which is remarkable given that the obvious classical approach — copy the bit three times and take a majority — is forbidden by no-cloning. Quantum codes instead spread one **logical** qubit across many **physical** ones, so that errors can be detected by measuring *relationships* between qubits without measuring their values. The surface code is the leading approach and needs roughly 1,000 physical qubits per logical one, with some estimates higher.\n\nWhich sets the scale of the gap. Breaking RSA-2048 needs a few thousand logical qubits, so millions of physical ones. Current devices have hundreds to low thousands of physical qubits, all noisy.\n\nThat gap is why the honest forecast is wide. A decade is optimistic; several decades is plausible; never is a position held by serious people. Progress has been real and steady and is not close.',
              {
                keyTerms: [
                  { term: 'Decoherence', definition: 'Loss of quantum state through interaction with the environment.' },
                  { term: 'Logical qubit', definition: 'An error-corrected qubit built from roughly a thousand physical ones.' },
                ],
              },
            ),
            mcq(
              'Why can quantum error correction not simply copy each qubit three times?',
              [
                'It is too slow',
                'The no-cloning theorem forbids copying an unknown quantum state',
                'Qubits are too expensive',
                'Majority voting does not work',
              ],
              1,
              ['sk-decoherence'],
              'Quantum codes instead measure relationships between qubits, detecting errors without reading values.',
            ),
            numeric(
              'At roughly 1,000 physical qubits per logical qubit, how many physical qubits does a 4,000-logical-qubit machine need, in millions?',
              4,
              ['sk-decoherence'],
              '4,000 × 1,000 = 4 million. Current devices have hundreds to low thousands, all noisy. That is the scale of the gap.',
            ),
            concept(
              'An honest account of what to expect',
              'It is worth stating plainly, because the field is surrounded by claims that do not survive contact with the physics.\n\n**Likely to matter, eventually:**\n\n*Simulating quantum systems* — molecules, catalysts, superconductors, nitrogen fixation. This is the native application: simulating a quantum system on classical hardware costs exponentially, and on quantum hardware does not. Drug discovery and materials science are the plausible payoffs.\n\n*Breaking current public-key cryptography*, which is why post-quantum migration is happening now rather than later.\n\n*Some optimisation and sampling problems*, with advantage that is real but usually modest and frequently contested once classical methods are tuned properly.\n\n**Unlikely to matter, whatever you have read:**\n\n*General-purpose speedups.* Your database, web server and compiler get nothing.\n\n*Training neural networks.* Proposals exist; none currently beats a GPU, and the data-loading problem — getting classical data into a quantum state — often erases the theoretical advantage on its own.\n\n*Replacing classical computers.* They are co-processors for specific problems, like a GPU, not successors.\n\nTwo terms worth being able to decode. **"Quantum supremacy"** or **"quantum advantage"** means a quantum device performed *some* task faster than a classical computer — historically tasks chosen specifically to be quantum-friendly and of no practical use. It is a real milestone and not a product. And **"NISQ"** — noisy intermediate-scale quantum — names the current era: devices too noisy for error correction and too small for Shor. Useful research platforms, not useful computers.\n\nThe subject is genuinely one of the most interesting in science. It is also the one where the distance between the press release and the physics is widest.',
              {
                keyTerms: [
                  { term: 'Quantum advantage', definition: 'A quantum device beating classical hardware on some task, often a contrived one.' },
                  { term: 'NISQ', definition: 'The current noisy, uncorrected, intermediate-scale era.' },
                ],
              },
            ),
            categorize(
              'Which will quantum computing plausibly help with?',
              ['Plausible application', 'No meaningful advantage'],
              [
                { item: 'Simulating molecules for drug discovery', category: 'Plausible application' },
                { item: 'Breaking RSA', category: 'Plausible application' },
                { item: 'Running a web server', category: 'No meaningful advantage' },
                { item: 'Sorting a large list', category: 'No meaningful advantage' },
                { item: 'Training a neural network faster than a GPU', category: 'No meaningful advantage' },
              ],
              ['sk-quantum-reality'],
              'Structure is required. Most computing has none to exploit.',
            ),
            fill(
              'The current era is called ___ , meaning devices too noisy for error correction and too small for Shor.',
              [['NISQ', 'noisy intermediate-scale quantum']],
              ['sk-quantum-reality'],
              'Real research platforms; not useful computers yet.',
            ),
            shortAnswer(
              'A vendor claims their quantum computer will "revolutionise machine learning within two years". How would you assess that?',
              ['qubit', 'error', 'logical', 'noise', 'data', 'evidence'],
              'I would ask how many logical — not physical — qubits it has, since error correction costs roughly a thousand physical qubits per logical one and current devices have none to spare. Then which specific algorithm gives the advantage and against which tuned classical baseline, because most claimed advantages evaporate when the classical comparison is done properly. For machine learning specifically I would ask how classical data gets loaded into a quantum state, since that step alone frequently costs as much as the speedup saves. Two years is not a plausible timeline for anything requiring error correction.',
              ['sk-quantum-reality', 'sk-decoherence'],
              'Logical qubits, a named algorithm, a fair classical baseline, and the data-loading problem. Most claims fail at the first question.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-q-2',
        title: 'Algorithms and Reality Checkpoint',
        passingScore: 0.7,
        exercises: [
          mcq(
            'Grover gives what kind of speedup?',
            ['Exponential', 'Quadratic — √N instead of N', 'Linear', 'None'],
            1,
            ['sk-quantum-algorithms'],
            'And it is provably optimal for unstructured search.',
          ),
          mcq(
            'Roughly how many physical qubits per logical qubit does the surface code need?',
            ['2', '10', '1,000', '1,000,000'],
            2,
            ['sk-decoherence'],
            'Which is why machines with hundreds of physical qubits have no logical ones.',
          ),
          trueFalse(
            'Quantum computers will speed up most everyday computing tasks.',
            false,
            ['sk-quantum-reality'],
            'They are co-processors for a small set of structured problems.',
          ),
        ],
      },
    },
  ],
};
