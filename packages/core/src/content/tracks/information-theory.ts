/**
 * Track 34 — Information Theory.
 *
 * One 1948 paper that turned out to underlie compression, error correction,
 * and — unexpectedly — the loss function of every classifier ever trained.
 * Placed here rather than in the maths track because it deserves the room.
 */

import type { Track } from '../../domain/types';
import { categorize, concept, fill, interactive, lesson, mcq, multi, numeric, order, shortAnswer, trueFalse } from '../builders';

export const informationTheoryTrack: Track = {
  id: 'track-information-theory',
  title: 'Information Theory',
  tagline: 'Measuring surprise, and what follows from it',
  description:
    'Entropy, compression, channel capacity and error correction — Shannon\u2019s framework, and the direct line from it to cross-entropy loss and the perplexity number every language model reports.',
  domain: 'math',
  level: 'intermediate',
  icon: '📡',
  gradient: ['#06B6D4', '#F472B6'],
  prerequisites: ['track-math'],
  outcomes: [
    'Compute the information content of an event and explain why it is a log',
    'Calculate entropy and predict how it moves as a distribution changes',
    'State the compression limit a source imposes and why it is a limit',
    'Build a Huffman code and say what makes it optimal',
    'Connect cross-entropy loss and perplexity back to entropy',
    'Explain how redundancy buys error detection and correction',
  ],
  units: [
    // -----------------------------------------------------------------------
    {
      id: 'unit-it-1',
      title: 'Measuring Information',
      description: 'Surprise, entropy, and the limit they set on compression.',
      lessons: [
        lesson({
          id: 'lesson-entropy',
          title: 'Surprise and Entropy',
          summary: 'Information is how much you did not expect it.',
          level: 'intermediate',
          domain: 'math',
          free: true,
          steps: [
            concept(
              'Why the measure has to be a logarithm',
              'How much information is in a message? Shannon\u2019s answer: exactly as much as it removes uncertainty.\n\n"The sun rose today" carries almost none — you knew. "The coin came up heads" carries one bit. "The lottery number is 04-17-23-31-38-42" carries a great deal.\n\nSo information must be a decreasing function of probability. Which function? Three requirements pin it down:\n\n1. An event of probability 1 carries zero information.\n2. Rarer events carry more.\n3. **Independent events add.** Learning two unrelated facts gives you the sum of their information.\n\nThat third requirement is the binding one. Independent probabilities *multiply*, and we need information to *add* — and the only function turning multiplication into addition is the logarithm.\n\n```\nI(x) = −log₂ P(x)     bits\n```\n\nA fair coin: −log₂(0.5) = **1 bit**. A fair die: −log₂(1/6) ≈ **2.58 bits**. An event of probability 1: −log₂(1) = **0 bits**.\n\nThe unit falls out of the base. Base 2 gives bits, and one bit is exactly the information in one fair coin flip — which is also exactly the number of yes/no questions needed to identify one of two equally likely outcomes. That correspondence between "bits of information" and "yes/no questions" is not a coincidence; it is the whole subject in miniature.',
              {
                keyTerms: [
                  { term: 'Self-information', definition: '−log₂ P(x) — how surprising an outcome is, in bits.' },
                  { term: 'Bit', definition: 'The information in one fair coin flip; one optimal yes/no question.' },
                ],
              },
            ),
            mcq(
              'Why must information be a logarithm of probability?',
              [
                'Logarithms are easy to compute',
                'Independent events must add their information, and probabilities multiply — only a log converts one to the other',
                'To keep values small',
                'It is an arbitrary convention',
              ],
              1,
              ['sk-information-content'],
              'The additivity requirement determines the form of the function completely.',
            ),
            numeric(
              'How many bits of information are in learning the outcome of one fair coin flip?',
              1,
              ['sk-information-content'],
              '−log₂(0.5) = 1. This is the definition of a bit.',
            ),
            numeric(
              'A fair 8-sided die is rolled. How many bits does the outcome carry?',
              3,
              ['sk-information-content'],
              '−log₂(1/8) = 3. Three yes/no questions identify one of eight equally likely outcomes.',
            ),
            concept(
              'Entropy: information on average',
              'Self-information measures one outcome. **Entropy** measures a whole distribution — the *expected* information per observation.\n\n```\nH(X) = −Σ P(x) log₂ P(x)\n```\n\nEach outcome\u2019s surprise, weighted by how often it occurs.\n\nThree cases worth knowing by heart:\n\n**Fair coin:** H = 1 bit. Maximum uncertainty for two outcomes.\n\n**Biased coin, P(heads) = 0.9:** H ≈ 0.47 bits. You mostly know the answer already, so observing it tells you less.\n\n**Certain outcome, P = 1:** H = 0. Nothing to learn.\n\nEntropy is maximised by the **uniform** distribution and minimised by a certain one. Which gives it a second reading: entropy is how *unpredictable* a source is.\n\nAnd a third, the practical one: entropy is the **average number of bits per symbol** needed to encode the source optimally. A source with 0.47 bits of entropy can, in principle, be stored in 0.47 bits per symbol.\n\nThat reading is what makes the subject engineering rather than philosophy. It is the same quantity used in the decision-tree lesson, where a split is chosen to reduce entropy the most — because reducing entropy is exactly reducing uncertainty about the label.',
              {
                keyTerms: [
                  { term: 'Entropy', definition: 'Expected self-information — average surprise per observation.' },
                  { term: 'Maximum entropy', definition: 'Achieved by the uniform distribution; minimum by a certain one.' },
                ],
              },
            ),
            mcq(
              'Which distribution over four outcomes has the highest entropy?',
              [
                '[0.25, 0.25, 0.25, 0.25]',
                '[0.7, 0.1, 0.1, 0.1]',
                '[0.97, 0.01, 0.01, 0.01]',
                '[1.0, 0, 0, 0]',
              ],
              0,
              ['sk-shannon-entropy'],
              'Uniform is maximally uncertain: 2 bits. The last has zero entropy — there is nothing to learn from an outcome you already know.',
            ),
            numeric(
              'What is the entropy in bits of a uniform distribution over 4 outcomes?',
              2,
              ['sk-shannon-entropy'],
              'log₂(4) = 2. For n equally likely outcomes, entropy is log₂ n.',
            ),
            trueFalse(
              'A heavily biased coin has lower entropy than a fair one.',
              true,
              ['sk-shannon-entropy'],
              'You can usually predict it, so each observation carries less information — and it compresses better.',
            ),
          ],
        }),
        lesson({
          id: 'lesson-compression',
          title: 'Compression and Its Limit',
          summary: 'Entropy is not a guideline. It is a floor no algorithm can go under.',
          level: 'intermediate',
          domain: 'math',
          steps: [
            concept(
              'The source coding theorem',
              'Shannon\u2019s **source coding theorem** says: a source with entropy H bits per symbol cannot be losslessly compressed below H bits per symbol on average, and can be compressed arbitrarily close to it.\n\nBoth halves matter. It is a hard limit — no future algorithm beats it, and a claim to have done so is equivalent to a claim of perpetual motion. And it is achievable, so the limit is not merely theoretical.\n\nThe practical mechanism is **variable-length coding**: give frequent symbols short codes and rare symbols long ones. English text compresses well because letter frequencies are wildly unequal — `e` is far more common than `z`, so `e` should not cost the same number of bits.\n\nThis also explains a fact that seems paradoxical. Compressed data does not compress again. A good compressor produces output that is nearly uniform — nearly maximum entropy — because all the predictable structure has been removed. There is nothing left to exploit.\n\nAnd by the **pigeonhole principle** from the discrete maths track, no lossless compressor can shrink every input. There are fewer short strings than long ones, so some inputs must get bigger. Compressors help on real data because real data is not random — it has structure, and structure is exactly what low entropy means.\n\n**Lossy** compression — JPEG, MP3, most video — sidesteps the theorem by not reproducing the input. It discards information a human will not miss, which is a perceptual question rather than an information-theoretic one.',
              {
                keyTerms: [
                  { term: 'Source coding theorem', definition: 'Entropy is the exact lower bound on lossless compression.' },
                  { term: 'Variable-length code', definition: 'Short codes for frequent symbols, long codes for rare ones.' },
                ],
              },
            ),
            mcq(
              'Why does compressing an already-compressed file not help?',
              [
                'The algorithm refuses',
                'Good compression leaves output near maximum entropy — the structure it could exploit is gone',
                'File formats prevent it',
                'It would corrupt the data',
              ],
              1,
              ['sk-source-coding'],
              'Compression removes predictability; what remains looks random, and random data is incompressible.',
            ),
            trueFalse(
              'A sufficiently clever algorithm could losslessly compress any file to half its size.',
              false,
              ['sk-source-coding'],
              'Pigeonhole: there are not enough short strings. Any compressor that shrinks some inputs must grow others.',
            ),
            concept(
              'Huffman codes',
              '**Huffman coding** builds an optimal variable-length code from symbol frequencies, and the algorithm is short enough to state completely:\n\n1. Make a leaf node for every symbol, weighted by its frequency.\n2. Repeatedly take the two lowest-weight nodes and join them under a new parent whose weight is their sum.\n3. Stop when one tree remains. Left branches are 0, right branches are 1.\n\nFor A=0.5, B=0.25, C=0.125, D=0.125:\n\n```\nA → 0      (1 bit)\nB → 10     (2 bits)\nC → 110    (3 bits)\nD → 111    (3 bits)\n```\n\nAverage: 0.5(1) + 0.25(2) + 0.125(3) + 0.125(3) = **1.75 bits** per symbol — which is exactly the entropy of that distribution. Optimal, and hitting the theoretical bound precisely.\n\nBecause codes sit at the leaves, no code is a **prefix** of another, so a stream decodes unambiguously with no separators. That property is what makes variable-length coding work at all.\n\nHuffman hits the bound exactly when every probability is a power of ½; otherwise it is within one bit per symbol, because it must use a whole number of bits. Arithmetic coding removes even that gap by encoding a whole message as one number, which is why modern formats use it.\n\nThe pattern to notice: this is a greedy algorithm from the DSA track that is *provably* optimal — unlike greedy coin change. That difference is exactly why greedy correctness has to be proved per problem.',
              {
                keyTerms: [
                  { term: 'Prefix-free code', definition: 'No codeword is a prefix of another, so a stream decodes unambiguously.' },
                ],
              },
            ),
            interactive(
              'Build a Huffman code',
              'huffman-tree',
              'Set symbol frequencies and watch the tree assemble from the two lightest nodes upward. Compare the resulting average code length against the entropy — they meet exactly when the probabilities are powers of one half.',
            ),
            order(
              'Order the steps of Huffman coding.',
              [
                'Create a leaf for each symbol weighted by frequency',
                'Take the two lowest-weight nodes',
                'Join them under a parent whose weight is their sum',
                'Repeat until one tree remains',
                'Read codes off the paths — left 0, right 1',
              ],
              ['sk-huffman'],
              'Greedy, and provably optimal for whole-bit codes — which is not something greedy usually manages.',
            ),
            numeric(
              'Symbols with probabilities 0.5, 0.25, 0.125, 0.125 get Huffman codes of lengths 1, 2, 3, 3. What is the average code length in bits?',
              1.75,
              ['sk-huffman'],
              '0.5(1) + 0.25(2) + 0.125(3) + 0.125(3) = 1.75, which equals the entropy exactly.',
              { tolerance: 0.01 },
            ),
            mcq(
              'Why must a variable-length code be prefix-free?',
              [
                'To save space',
                'So a stream can be decoded unambiguously without separators',
                'To make encoding faster',
                'To support Unicode',
              ],
              1,
              ['sk-huffman'],
              'If one code were a prefix of another the decoder could not tell where a symbol ends.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-it-1',
        title: 'Entropy Checkpoint',
        passingScore: 0.7,
        exercises: [
          numeric(
            'Entropy in bits of a uniform distribution over 16 outcomes?',
            4,
            ['sk-shannon-entropy'],
            'log₂(16) = 4.',
          ),
          mcq(
            'What does the source coding theorem establish?',
            [
              'A guideline for compression',
              'Entropy is the exact lower bound on lossless compression, achievable in the limit',
              'All data can be halved',
              'Lossy beats lossless',
            ],
            1,
            ['sk-source-coding'],
            'A hard floor, and a reachable one.',
          ),
          trueFalse(
            'Huffman coding is greedy and provably optimal for whole-bit codes.',
            true,
            ['sk-huffman'],
            'Unusual for a greedy algorithm, and the proof is specific to this problem.',
          ),
        ],
      },
    },
    // -----------------------------------------------------------------------
    {
      id: 'unit-it-2',
      title: 'Information and Learning',
      description: 'Cross-entropy, perplexity, dependence, and noisy channels.',
      lessons: [
        lesson({
          id: 'lesson-cross-entropy',
          title: 'Cross-Entropy, KL, and Perplexity',
          summary: 'Why every classifier minimises a quantity from a 1948 paper.',
          level: 'expert',
          domain: 'math',
          steps: [
            concept(
              'Encoding with the wrong distribution',
              'Entropy is the cost of encoding a source optimally. **Cross-entropy** is the cost of encoding it using a code built for a *different* distribution:\n\n```\nH(p, q) = −Σ p(x) log₂ q(x)\n```\n\nThe true distribution is p; your model is q. If q = p this is just entropy. If q is wrong, the cost is higher — always, and by an amount that measures how wrong.\n\nThat excess has its own name, the **Kullback–Leibler divergence**:\n\n```\nKL(p ‖ q) = H(p, q) − H(p) ≥ 0\n```\n\nThe extra bits per symbol you pay for believing q when the truth is p. Zero only when q = p. Not symmetric — KL(p‖q) ≠ KL(q‖p) — so it is a divergence rather than a distance, and the asymmetry matters: which argument goes first changes what the optimum looks like.\n\nAnd now the connection that makes this track load-bearing. Training a classifier, the true distribution puts probability 1 on the correct class and 0 elsewhere. Cross-entropy then collapses to:\n\n```\nloss = −log q(correct class)\n```\n\nWhich is exactly the cross-entropy loss every classifier is trained with. **Minimising cross-entropy is minimising the KL divergence between your model and reality**, because H(p) is fixed.\n\nSo the loss function was not chosen for convenience. It is the number of extra bits your model costs, and driving it to zero means your model has stopped being surprised by the truth.',
              {
                keyTerms: [
                  { term: 'Cross-entropy', definition: 'The cost of encoding p with a code optimised for q.' },
                  { term: 'KL divergence', definition: 'The excess cost of using q instead of p — zero only when they match.' },
                ],
              },
            ),
            mcq(
              'What does minimising cross-entropy loss actually minimise?',
              [
                'The number of parameters',
                'The KL divergence between the model\u2019s distribution and the true one',
                'The training time',
                'The variance of the gradient',
              ],
              1,
              ['sk-cross-entropy-loss'],
              'Since the true distribution\u2019s entropy is fixed, cross-entropy and KL differ by a constant.',
            ),
            trueFalse(
              'KL divergence is symmetric: KL(p‖q) = KL(q‖p).',
              false,
              ['sk-cross-entropy-loss'],
              'It is not, which is why it is a divergence and not a distance — and why the order of arguments changes what the fitted model looks like.',
            ),
            concept(
              'Perplexity, in plain terms',
              'Language models report **perplexity**, which is just exponentiated cross-entropy:\n\n```\nperplexity = 2^H(p, q)\n```\n\nThe reason for exponentiating is interpretability. Perplexity is the **effective number of equally likely choices** the model is deciding between at each step.\n\nA perplexity of 1 means perfect prediction — the model knows exactly what comes next. A perplexity of 100 means it is as uncertain as if choosing uniformly among 100 options. A uniform model over a 50,000-token vocabulary has perplexity 50,000.\n\nThis makes model comparisons legible in a way raw loss does not. Going from perplexity 30 to 20 means the model went from effectively choosing among 30 options to choosing among 20 — a real, describable improvement.\n\nTwo caveats that matter when reading a number someone quotes. Perplexity depends on the **tokenizer**: a model with a larger vocabulary makes fewer, harder predictions, so perplexities are only comparable across identical tokenization. And it depends heavily on the **evaluation corpus** — perplexity on Wikipedia and perplexity on code are different numbers about different things.\n\nAlso worth knowing: perplexity measures prediction, not usefulness. A model can have excellent perplexity and be unhelpful, which is the entire reason instruction tuning and preference optimisation exist.',
              {
                keyTerms: [
                  { term: 'Perplexity', definition: 'Exponentiated cross-entropy — the effective number of choices per step.' },
                ],
              },
            ),
            mcq(
              'A language model has perplexity 20. What does that mean?',
              [
                'It is 20% accurate',
                'At each step it is as uncertain as if choosing uniformly among 20 options',
                'It has 20 layers',
                'It was trained for 20 epochs',
              ],
              1,
              ['sk-perplexity'],
              'The effective branching factor of its predictions.',
            ),
            multi(
              'Why can two perplexity numbers be incomparable?',
              [
                'Different tokenizers change what a "prediction" is',
                'Different evaluation corpora make different tasks',
                'Different model sizes',
                'Different vocabulary sizes',
              ],
              [0, 1, 3],
              ['sk-perplexity'],
              'Model size is fine to compare across, provided tokenization and the corpus are held fixed.',
            ),
            concept(
              'Mutual information: how much one tells you about another',
              '**Mutual information** measures how much knowing one variable reduces uncertainty about another:\n\n```\nI(X; Y) = H(X) − H(X | Y)\n```\n\nYour uncertainty about X, minus your uncertainty about X once you know Y. Zero exactly when they are independent — knowing Y told you nothing.\n\nThree reasons it is worth having:\n\n**It catches non-linear dependence.** Correlation measures linear association and reports zero for a perfect quadratic relationship. Mutual information reports the dependence regardless of its shape, which makes it a far better general-purpose "are these related" measure.\n\n**Feature selection.** Ranking features by mutual information with the target finds the informative ones without assuming linearity.\n\n**Representation learning.** Several self-supervised objectives are explicitly maximising mutual information between two views of the same thing.\n\nThe cost is estimation: mutual information is hard to estimate reliably from a finite sample, especially in high dimensions, and naive binning-based estimators are biased in ways that are easy to miss. It is a clean concept and a fiddly measurement.',
              {
                keyTerms: [
                  { term: 'Mutual information', definition: 'The reduction in uncertainty about one variable from knowing another.' },
                ],
              },
            ),
            mcq(
              'What can mutual information detect that correlation cannot?',
              [
                'Linear relationships',
                'Non-linear dependence, such as a perfect quadratic relationship',
                'Causation',
                'Missing values',
              ],
              1,
              ['sk-mutual-information'],
              'Correlation reports zero for y = x² over a symmetric range, even though y is fully determined by x.',
            ),
            fill(
              'Mutual information is zero exactly when the two variables are ___ , and it measures dependence of any ___ .',
              [['independent'], ['shape', 'form', 'kind']],
              ['sk-mutual-information'],
              'Which is precisely where it improves on correlation.',
            ),
          ],
        }),
        lesson({
          id: 'lesson-channels',
          title: 'Noisy Channels and Error Correction',
          summary: 'Redundancy, bought deliberately, to survive a channel that corrupts.',
          level: 'expert',
          domain: 'math',
          steps: [
            concept(
              'Capacity: the second theorem',
              'Real channels corrupt. A wire picks up noise, a disk flips a bit, a radio link fades.\n\nShannon\u2019s **noisy channel coding theorem** is, if anything, more surprising than the first. Every channel has a **capacity** C, in bits per use. And:\n\n- Transmit below C and you can achieve an **arbitrarily small** error rate, with enough coding.\n- Transmit above C and you cannot, no matter what you do.\n\nThe first half is the shocking one. Before 1948 it was assumed that reliability had to be bought by slowing down — send everything three times and hope. Shannon proved you can have *near-perfect* reliability at *any* rate below capacity, and that the price is coding cleverness rather than speed.\n\nFor a binary symmetric channel that flips each bit with probability p:\n\n```\nC = 1 − H(p)\n```\n\nSo a channel flipping 1% of bits has capacity 1 − 0.081 ≈ **0.92** bits per use. You lose 8% of your throughput and can then be essentially error-free — a far better deal than triple redundancy, which costs 67%.\n\nA channel flipping exactly 50% of bits has capacity **zero**: the output is independent of the input, so nothing gets through. Notably, a channel flipping 100% of bits has capacity 1 — just invert everything.\n\nThe proof was non-constructive, which left an open engineering problem for fifty years. Turbo codes and LDPC codes, which approach capacity closely, arrived in the 1990s and are why modern wireless works as well as it does.',
              {
                keyTerms: [
                  { term: 'Channel capacity', definition: 'The maximum rate at which near-error-free communication is possible.' },
                ],
              },
            ),
            numeric(
              'A binary symmetric channel flips each bit with probability 0.5. What is its capacity in bits per use?',
              0,
              ['sk-channel-capacity'],
              'C = 1 − H(0.5) = 1 − 1 = 0. The output is independent of the input, so no information crosses.',
            ),
            mcq(
              'What was surprising about the noisy channel coding theorem?',
              [
                'That noise exists',
                'That near-perfect reliability is achievable at any rate below capacity, rather than requiring you to slow down indefinitely',
                'That capacity is finite',
                'That it was proved constructively',
              ],
              1,
              ['sk-channel-capacity'],
              'It replaced "repeat until it gets through" with "code cleverly and pay a fixed, small overhead".',
            ),
            concept(
              'Detection, then correction',
              'The mechanism is **redundancy**, added on purpose and structured so that corruption is detectable.\n\n**Parity** — one extra bit making the total number of 1s even. Detects any single flip; cannot locate it, and misses any even number of flips. One bit of overhead.\n\n**Checksums and CRCs** — a computed value sent alongside. Detects most corruption, including common burst patterns. Used in TCP and Ethernet, and in the file hashes that verify a download.\n\n**Hamming codes** — enough structured parity bits to identify *which* bit flipped, so the receiver repairs it without asking for a retransmission. This is ECC memory, correcting single-bit errors caused by cosmic rays in server RAM.\n\n**Reed–Solomon** — corrects whole runs of errors. QR codes still scan with a third of the symbol obscured because of this; CDs tolerate scratches for the same reason.\n\n**LDPC and turbo codes** — capacity-approaching, and the reason 5G and Wi-Fi achieve the rates they do.\n\nThe distinction to keep straight is **detection versus correction**. Detection is cheap and tells you to ask again — right for a network, where retransmitting is easy. Correction is more expensive and needs no second copy — right for storage, a deep-space probe, or a QR code on a wall, where there is nobody to ask.',
              {
                keyTerms: [
                  { term: 'Parity bit', definition: 'One redundant bit that detects any single flip.' },
                  { term: 'Error correction', definition: 'Enough redundancy to repair corruption without retransmission.' },
                ],
              },
            ),
            categorize(
              'Detects errors, or corrects them?',
              ['Detects only', 'Corrects'],
              [
                { item: 'A single parity bit', category: 'Detects only' },
                { item: 'A CRC in an Ethernet frame', category: 'Detects only' },
                { item: 'Hamming code in ECC memory', category: 'Corrects' },
                { item: 'Reed–Solomon in a QR code', category: 'Corrects' },
              ],
              ['sk-error-correction'],
              'Detection where you can ask again; correction where you cannot.',
            ),
            mcq(
              'Why do QR codes still scan when partly obscured?',
              [
                'They are printed twice',
                'Reed–Solomon error correction can reconstruct missing data from structured redundancy',
                'The scanner guesses',
                'They use large pixels',
              ],
              1,
              ['sk-error-correction'],
              'Up to about 30% of the symbol can be lost depending on the chosen level. There is nobody to request a retransmission from, so correction is the only option.',
            ),
            shortAnswer(
              'Why is error correction the right choice for a spacecraft and error detection the right choice for a local network?',
              ['retransmit', 'round trip', 'latency', 'correct', 'detect'],
              'Detection plus retransmission is cheaper in overhead but needs a return path and a fast round trip. On a local network a retransmission costs under a millisecond, so detecting and asking again is far more efficient than carrying correction overhead on every frame. A spacecraft has a round trip measured in minutes or hours, and sometimes no return path at all, so the redundancy has to travel with the data. The deciding factor is the cost of asking again.',
              ['sk-error-correction', 'sk-channel-capacity'],
              'The round-trip cost decides it. Cheap retransmission favours detection; expensive or impossible retransmission forces correction.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-it-2',
        title: 'Information and Learning Checkpoint',
        passingScore: 0.7,
        exercises: [
          mcq(
            'Cross-entropy loss is minimising what?',
            ['Variance', 'KL divergence between the model and the true distribution', 'Model size', 'Gradient norm'],
            1,
            ['sk-cross-entropy-loss'],
            'They differ by the true distribution\u2019s entropy, which is constant.',
          ),
          mcq(
            'Perplexity of 50 means what?',
            [
              '50% accuracy',
              'As uncertain as choosing uniformly among 50 options at each step',
              '50 tokens of context',
              '50 layers',
            ],
            1,
            ['sk-perplexity'],
            'The effective branching factor.',
          ),
          mcq(
            'Which is correction rather than detection?',
            ['Parity bit', 'CRC', 'Hamming code', 'Checksum'],
            2,
            ['sk-error-correction'],
            'It identifies which bit flipped, so it can be repaired in place.',
          ),
        ],
      },
    },
  ],
};
