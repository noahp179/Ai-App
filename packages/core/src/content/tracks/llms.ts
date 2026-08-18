/** Track 4 — Large Language Models. Intro → expert. */

import type { Track } from '../../domain/types';
import { concept, fill, interactive, lesson, match, mcq, multi, numeric, order, shortAnswer, trueFalse } from '../builders';

export const llmTrack: Track = {
  id: 'track-llms',
  title: 'Large Language Models',
  tagline: 'How ChatGPT-style models actually work',
  description:
    'Tokenization to attention to RLHF. By the end you will be able to explain what happens between typing a prompt and reading a response — and why these systems fail the way they do.',
  domain: 'llms',
  level: 'intermediate',
  icon: '💬',
  gradient: ['#F59E0B', '#EF4444'],
  prerequisites: ['track-deep-learning'],
  outcomes: [
    'Explain next-token prediction and why it produces such general behaviour',
    'Describe self-attention and multi-head attention in detail',
    'Reason about context windows, tokens, and inference cost',
    'Explain RLHF and why base models need it',
  ],
  units: [
    {
      id: 'unit-llm-1',
      title: 'Words Into Numbers',
      description: 'Tokenization, embeddings, and next-token prediction.',
      lessons: [
        lesson({
          id: 'lesson-tokenization',
          title: 'Tokenization',
          summary: 'Models do not see words. They see token ids.',
          level: 'intro',
          domain: 'nlp',
          free: true,
          steps: [
            concept(
              'Chopping text into pieces',
              'A language model cannot process text. It processes numbers. **Tokenization** is the conversion.\n\nWhy not one token per word? Vocabulary explodes, and every typo or rare name becomes an unknown. Why not one per character? Sequences become enormously long, and attention cost grows with the square of length.\n\nThe compromise is **subword tokenization**. Common words get one token; rare words split into pieces:\n\n- `"the"` → 1 token\n- `"tokenization"` → `["token", "ization"]`\n- `"Kubernetes"` → maybe 4 tokens\n\nRough English rule of thumb: **1 token ≈ 4 characters ≈ 0.75 words.** So 1,000 tokens is about 750 words.',
              {
                keyTerms: [
                  { term: 'Token', definition: 'The atomic unit of text a model processes. Usually a subword.' },
                  { term: 'Vocabulary', definition: 'The fixed set of tokens a model knows, typically 32k–200k entries.' },
                ],
              },
            ),
            interactive(
              'Tokenize it yourself',
              'tokenizer',
              'Type anything and watch it split. Try a common English word, an invented word, an emoji, and a phrase in another language — non-English text typically costs 2–3× more tokens per word, which is a real and under-discussed cost asymmetry.',
            ),
            numeric(
              'Roughly how many tokens is a 3,000-word English document?',
              4000,
              ['sk-tokenization'],
              '3,000 words ÷ 0.75 ≈ 4,000 tokens. Useful for estimating both context fit and API cost before you send anything.',
              { tolerance: 500, hint: 'About 0.75 words per token.' },
            ),
            concept(
              'Byte-pair encoding',
              'The dominant algorithm, **BPE**, builds its vocabulary from data rather than from a dictionary:\n\n1. Start with every individual byte as a token.\n2. Count adjacent token pairs across the training corpus.\n3. Merge the most frequent pair into a new token.\n4. Repeat until you hit your target vocabulary size.\n\nFrequency ends up determining granularity automatically. Common sequences become single tokens; rare ones stay fragmented. Nothing is ever out-of-vocabulary, because worst case you fall back to raw bytes.\n\nThis has visible consequences. Models are notoriously bad at counting letters in a word — `"strawberry"` may be three tokens, and the letters inside a token are simply not visible to the model as separate things. That is a tokenization artefact, not a reasoning failure.',
            ),
            mcq(
              'Why do LLMs often miscount the letters in a word?',
              [
                'They cannot count at all',
                'They see tokens, not characters — letters inside a token are not individually visible',
                'The training data was wrong',
                'They lack a mathematics module',
              ],
              1,
              ['sk-tokenization', 'sk-bpe'],
              'A word arriving as two or three tokens gives the model no direct access to its individual letters. It is a representational limitation from tokenization, which is why character-level tasks stay disproportionately hard.',
            ),
            trueFalse(
              'The same text costs the same number of tokens in every language.',
              false,
              ['sk-tokenization'],
              'Tokenizers are trained mostly on English-heavy corpora, so English is encoded most efficiently. The same meaning in Thai, Hindi, or Burmese can cost several times more tokens — meaning higher API cost and less usable context for those users.',
            ),
          ],
        }),

        lesson({
          id: 'lesson-embeddings',
          title: 'Embeddings',
          summary: 'Meaning as a direction in high-dimensional space.',
          level: 'intermediate',
          domain: 'deep-learning',
          steps: [
            concept(
              'Token ids carry no meaning',
              'After tokenization, `"cat"` might be id 9246 and `"dog"` id 3290. Those numbers are arbitrary labels — 9246 is not "more" than 3290 in any meaningful sense, and the model must not treat them as ordered.\n\nSo each id indexes into an **embedding table**: a learned vector of a few thousand dimensions. Those vectors are parameters, trained like everything else.\n\nWhat emerges is remarkable. Nothing instructs the model to place related words near each other, yet minimising prediction loss makes it do so — because words appearing in similar contexts need similar representations to predict similar continuations.',
              { keyTerms: [{ term: 'Embedding', definition: 'A learned dense vector representing a token, word, or document.' }, { term: 'Embedding dimension', definition: 'The length of that vector. Commonly 768–8192.' }] },
            ),
            concept(
              'Direction is meaning',
              'In a trained embedding space, *directions* correspond to semantic relationships. The classic demonstration:\n\n`king − man + woman ≈ queen`\n\nSubtract the "male" direction, add the "female" direction, and you land near the right word. Similar structure appears for tense, plurality, and country-capital pairs.\n\nSimilarity is measured with **cosine similarity** — the angle between vectors, ignoring magnitude:\n\n`cos(a, b) = (a · b) / (|a| |b|)`\n\nThe range is −1 to 1. Near 1 means near-identical direction; near 0 means unrelated. Magnitude is ignored deliberately, since it tends to track word frequency rather than meaning.\n\nThis is the machinery behind semantic search: embed the query, embed the documents, and rank by cosine similarity. Matching *meaning* rather than keywords.',
            ),
            interactive(
              'Explore the space',
              'embedding-space',
              'Move through a 2-D projection of a real embedding space. Notice that countries cluster, verb tenses form parallel offsets, and antonyms sit closer together than you might expect — they share almost all their context.',
            ),
            numeric(
              'Two unit vectors point in exactly the same direction. What is their cosine similarity?',
              1,
              ['sk-cosine-similarity'],
              'cos(0°) = 1. Perpendicular vectors give 0 (unrelated); opposite vectors give −1.',
              { tolerance: 0.01 },
            ),
            mcq(
              'Why is cosine similarity usually preferred over Euclidean distance for embeddings?',
              [
                'It is faster to compute',
                'It compares direction and ignores magnitude, which mostly reflects frequency rather than meaning',
                'It always yields positive values',
                'It works with any number of dimensions, unlike Euclidean distance',
              ],
              1,
              ['sk-cosine-similarity'],
              'Vector length correlates with token frequency and text length. Cosine strips that out and compares only orientation, which is where meaning lives.',
            ),
            mcq(
              'Antonyms like "hot" and "cold" often have high cosine similarity. Why?',
              [
                'The embedding model is broken',
                'They appear in nearly identical contexts, so they need similar representations',
                'Antonyms are semantically identical',
                'Cosine similarity cannot represent opposition',
              ],
              1,
              ['sk-word-embeddings'],
              'Embeddings encode distributional context — and "the coffee is hot/cold" are grammatically and topically interchangeable. Similar context yields similar vectors. Detecting opposition needs supervision beyond raw co-occurrence.',
            ),
          ],
        }),

        lesson({
          id: 'lesson-next-token',
          title: 'Next-Token Prediction',
          summary: 'One deceptively simple objective, one surprising result.',
          level: 'intro',
          domain: 'llms',
          free: true,
          steps: [
            concept(
              'That is the entire training objective',
              'A language model is trained to do one thing: **given a sequence of tokens, predict the next one.**\n\nThat is it. No grammar rules, no knowledge base, no reasoning module. Show it trillions of tokens with the next one masked, and penalise it via cross-entropy when it guesses wrong.\n\nThe output is not a single token but a **probability distribution over the entire vocabulary** — perhaps 100,000 numbers summing to 1. Generation then samples from that distribution, appends the chosen token, and runs the whole thing again. This loop is **autoregressive generation**.\n\nThe striking result is that this objective, at sufficient scale, produces translation, arithmetic, code generation, and apparent reasoning — none of which were trained for directly. Predicting text well enough requires modelling whatever produced the text.',
              { keyTerms: [{ term: 'Autoregressive', definition: 'Generating one token at a time, each conditioned on all previous tokens.' }, { term: 'Logits', definition: 'Raw pre-softmax scores over the vocabulary.' }] },
            ),
            order(
              'Order the steps of generating one token.',
              [
                'Tokenize the prompt into token ids',
                'Look up each id in the embedding table',
                'Run the sequence through the transformer stack',
                'Convert final-position logits into probabilities and sample one token',
              ],
              ['sk-language-modeling'],
              'That whole sequence produces exactly *one* token. To write a paragraph the model runs it hundreds of times, each pass conditioned on everything generated so far.',
            ),
            concept(
              'Temperature and sampling',
              'Always picking the highest-probability token (**greedy decoding**) produces repetitive, lifeless text. So we sample — and how we sample is controlled by a few parameters.\n\n**Temperature** rescales the logits before softmax. Below 1 sharpens the distribution toward the most likely tokens; above 1 flattens it. At 0 it is effectively greedy. Around 1.5+ it degenerates into noise.\n\n**Top-k** restricts sampling to the k highest-probability tokens.\n\n**Top-p (nucleus)** keeps the smallest set of tokens whose probabilities sum to p — typically 0.9. This adapts better than top-k: when the model is confident the set is tiny, and when it is uncertain the set widens.\n\nPractical guidance: **low temperature (0–0.3)** for extraction, classification, and code. **Moderate (0.7–1.0)** for writing and brainstorming.',
            ),
            interactive(
              'Turn the temperature dial',
              'temperature-sampler',
              'Watch the same probability distribution reshape as you move temperature. At 0.1 nearly all mass sits on one token; at 2.0 it is almost uniform and the output becomes incoherent.',
            ),
            interactive(
              'Greedy vs beam search',
              'beam-search',
              'Watch the same model decode with greedy selection and with beam width 3. Greedy commits to the best next token and can be trapped; beam keeps several partial sequences alive and often finds a better whole.',
            ),
            mcq(
              'You are extracting structured data from invoices. What temperature?',
              ['1.5', '1.0', 'Near 0', 'It makes no difference'],
              2,
              ['sk-sampling'],
              'Extraction has one correct answer. Randomness can only hurt, so you want near-deterministic decoding. Save higher temperatures for tasks where variety is the point.',
            ),
            trueFalse(
              'A model outputs a single word at each step.',
              false,
              ['sk-language-modeling'],
              'It outputs a probability distribution over its whole vocabulary. Sampling then picks one token — often a subword fragment rather than a full word.',
            ),
            shortAnswer(
              'Why does a model trained only to predict the next token end up able to translate and write code?',
              ['patterns', 'training data', 'predict', 'context', 'compress'],
              'Predicting text well requires modelling whatever regularities produced it. Translation pairs, code, and reasoning chains all appear in the training data, so representing those patterns is necessary to lower prediction loss. The capabilities emerge as a side effect of compressing text well.',
              ['sk-language-modeling'],
              'The objective is narrow; the data is not. Modelling text at scale means modelling the processes that generate it.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-llm-1',
        title: 'Tokens & Prediction Checkpoint',
        passingScore: 0.7,
        exercises: [
          numeric(
            'A 500-word English prompt is roughly how many tokens?',
            667,
            ['sk-tokenization'],
            '500 ÷ 0.75 ≈ 667 tokens. Worth estimating before sending — both context limits and billing run on tokens.',
            { tolerance: 120 },
          ),
          mcq(
            'What does temperature = 0 produce?',
            ['Random output', 'Effectively greedy, near-deterministic decoding', 'An error', 'Maximum creativity'],
            1,
            ['sk-sampling'],
            'Temperature 0 collapses the distribution onto its most likely token. Output becomes reproducible — useful for testing, dull for prose.',
          ),
          trueFalse(
            'Embeddings are hand-designed by linguists.',
            false,
            ['sk-embeddings'],
            'They are learned parameters. Semantic structure emerges from the prediction objective, not from a designed taxonomy.',
          ),
        ],
      },
    },

    {
      id: 'unit-llm-2',
      title: 'Attention & Transformers',
      description: 'The architecture behind every modern language model.',
      lessons: [
        lesson({
          id: 'lesson-attention',
          title: 'Self-Attention',
          summary: 'Letting every token look at every other token.',
          level: 'expert',
          domain: 'llms',
          steps: [
            concept(
              'The problem attention solves',
              '*"The animal didn\'t cross the street because **it** was too tired."*\n\nWhat does "it" refer to? The animal. Change "tired" to "wide" and "it" becomes the street. Resolving that requires connecting distant words based on meaning.\n\nRNNs handled this by passing a hidden state along the sequence, which had two fatal problems: information from far back degraded, and the sequential dependency made training impossible to parallelise.\n\n**Attention** discards the sequential path entirely. Every token looks directly at every other token in one operation — constant path length regardless of distance, and fully parallel across the sequence. That parallelism is what made training on trillions of tokens economically possible.',
              { figure: 'attention-heads' },
            ),
            concept(
              'Queries, keys, and values',
              'Each token projects into three vectors via learned matrices:\n\n**Query (Q)** — what this token is looking for.\n**Key (K)** — what this token offers.\n**Value (V)** — the content it contributes if attended to.\n\nA retrieval metaphor: the query is your search, keys are the index, values are the documents.\n\nThe computation:\n\n1. Score every query against every key with a dot product: `QKᵀ`. High score = relevant.\n2. Scale by `√dₖ`. Without this, dot products in high dimensions grow large, softmax saturates, and gradients vanish.\n3. Softmax each row into weights summing to 1.\n4. Take the weighted sum of value vectors.\n\nAll together:\n\n`Attention(Q, K, V) = softmax(QKᵀ / √dₖ) V`\n\nThat one line is the core of the entire architecture.',
              {
                keyTerms: [
                  { term: 'Query / Key / Value', definition: 'Three learned projections of each token, used for relevance scoring and content retrieval.' },
                  { term: 'Attention weights', definition: 'Softmax-normalized relevance scores. Each row sums to 1.' },
                ],
              },
            ),
            interactive(
              'Read the attention matrix',
              'attention-matrix',
              'Hover any token to see what it attends to. Notice that pronouns attend strongly to their referents, and that some heads specialise in purely syntactic relations like verb-to-subject.',
            ),
            mcq(
              'Why divide by √dₖ before the softmax?',
              [
                'To normalize the output length',
                'Dot products grow with dimension; without scaling softmax saturates and gradients vanish',
                'To make the computation faster',
                'To keep the weights positive',
              ],
              1,
              ['sk-attention'],
              'The dot product of two random d-dimensional vectors has variance proportional to d. Unscaled, large values push softmax into a near one-hot regime where its gradient is nearly zero and learning stalls.',
            ),
            order(
              'Order the self-attention computation.',
              [
                'Project each token into query, key, and value vectors',
                'Compute dot products between every query and every key',
                'Scale by √dₖ and apply softmax across each row',
                'Multiply the weights by the value vectors and sum',
              ],
              ['sk-attention'],
              'Project, score, normalize, aggregate. Every attention variant you will meet modifies one of these four steps.',
            ),
            concept(
              'Multi-head attention',
              'One attention operation can only capture one kind of relationship per position. Language has many simultaneously — syntactic agreement, coreference, topical association.\n\nSo run several attention operations in parallel, each with its own Q/K/V projections, on lower-dimensional slices. Concatenate the results and project back.\n\nThe heads specialise on their own. Interpretability work has found heads that track subject-verb agreement, heads that attend to the immediately previous token, and **induction heads** that detect and continue repeated patterns — the latter appear to underlie much of in-context learning.\n\nA model with dimension 512 and 8 heads gives each head 64 dimensions. Total compute is comparable to single-head attention at full width; the win is the diversity of relationships captured.',
            ),
            numeric(
              'Model dimension 4,096 with 32 attention heads. What is the dimension per head?',
              128,
              ['sk-multi-head-attention'],
              '4,096 / 32 = 128. Splitting the width across heads keeps total compute roughly constant while letting each head specialise.',
            ),
            concept(
              'Position has to be injected',
              'Attention is **permutation-invariant**. Shuffle the input tokens and the attention output shuffles identically — the mechanism has no notion of order at all. But "dog bites man" and "man bites dog" are different sentences.\n\nSo position is added explicitly:\n\n**Sinusoidal encodings** (original transformer) — fixed sine and cosine waves at varying frequencies, added to embeddings.\n\n**Learned positional embeddings** — a trainable vector per position. Simple, but cannot extrapolate past the trained length.\n\n**RoPE (rotary)** — rotates query and key vectors by an angle proportional to position, so the dot product depends on *relative* distance. This is the modern standard and extrapolates far better, which is central to how long-context models work.',
            ),
            trueFalse(
              'Without positional encoding, a transformer would treat "dog bites man" and "man bites dog" identically.',
              true,
              ['sk-positional-encoding'],
              'Self-attention is permutation-invariant, so word order is genuinely invisible until position information is injected.',
            ),
          ],
        }),

        lesson({
          id: 'lesson-transformer-block',
          title: 'The Transformer Block',
          summary: 'Attention, a feed-forward network, and two residual connections.',
          level: 'expert',
          domain: 'llms',
          steps: [
            concept(
              'One block, repeated N times',
              'Modern LLMs are one block stacked 32, 80, or 120 times. Each block:\n\n1. **Layer norm** (pre-norm).\n2. **Multi-head self-attention.**\n3. **Residual add** — the attention output is added back to the input.\n4. **Layer norm** again.\n5. **Feed-forward network** — expand to ~4× width, apply a nonlinearity, project back.\n6. **Residual add** again.\n\nAttention moves information *between* positions. The feed-forward network processes each position *independently*, and holds roughly two-thirds of the model\'s parameters. There is good evidence it functions as a key-value memory storing factual associations.\n\nThe residual connections are load-bearing. Without them a 96-layer stack simply does not train.',
              { figure: 'transformer-block' },
            ),
            match(
              'Match each component to its role.',
              [
                { left: 'Moves information between token positions', right: 'Self-attention' },
                { left: 'Processes each position independently', right: 'Feed-forward network' },
                { left: 'Gives gradients an unobstructed path', right: 'Residual connection' },
                { left: 'Keeps activation scales stable', right: 'Layer normalization' },
              ],
              ['sk-transformer-block'],
              'Attention mixes across positions; the FFN transforms within one. That alternation — mix, then process — is the entire pattern.',
            ),
            concept(
              'Causal masking',
              'For text *generation* the model must not see the future. During training, the whole sequence is present at once — so token 5 could trivially cheat by looking at token 6.\n\nThe fix is a **causal mask**: before the softmax, set all attention scores for future positions to −∞, so they receive zero weight.\n\nThis is what separates **decoder-only** models (GPT, Llama, Claude) — causally masked, built for generation — from **encoder-only** models (BERT) that see the full sequence bidirectionally and are built for understanding tasks like classification.\n\nMasking also makes training enormously efficient: every position predicts its own next token in a single parallel pass, so one sequence yields as many training signals as it has tokens.',
            ),
            mcq(
              'What does the causal mask prevent?',
              [
                'Overfitting to the training data',
                'A position attending to later positions',
                'Gradients from exploding',
                'The model from repeating itself',
              ],
              1,
              ['sk-transformer-block'],
              'It enforces that predictions depend only on what precedes them — which is required for the training objective to match how generation actually works at inference time.',
            ),
            concept(
              'Why inference gets expensive',
              'Attention compares every token to every other token, so cost scales with **O(n²)** in sequence length. Doubling the context quadruples the attention computation. This is the central constraint on long-context models.\n\nGeneration adds a second problem. Naively, producing token 1,000 means recomputing attention over all 999 previous tokens. Instead, the **KV cache** stores the key and value vectors of every processed token so each new token only computes its own.\n\nThat trades compute for memory — and the memory is substantial. For a 70B model at 8k context, the KV cache runs to several gigabytes *per concurrent request*, which is usually what actually limits how many users a GPU can serve.\n\nThis is why long context is priced the way it is, and why techniques like grouped-query attention, sliding windows, and FlashAttention matter commercially.',
              { keyTerms: [{ term: 'KV cache', definition: 'Stored key/value vectors for processed tokens, avoiding recomputation during generation.' }] },
            ),
            mcq(
              'Doubling the context length increases attention compute by roughly what factor?',
              ['2×', '4×', 'No change', '8×'],
              1,
              ['sk-kv-cache', 'sk-attention'],
              'Attention is quadratic in sequence length, so 2× the tokens is 4× the attention compute. That scaling is the reason long-context support was hard and why it is priced at a premium.',
            ),
            multi(
              'Which reduce the cost of long-context inference? (Select all)',
              [
                'KV caching',
                'Grouped-query attention (sharing key/value heads)',
                'Sliding-window attention',
                'Increasing the embedding dimension',
              ],
              [0, 1, 2],
              ['sk-kv-cache'],
              'The first three each cut redundant computation or memory. Widening embeddings increases cost across the board.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-llm-2',
        title: 'Transformer Checkpoint',
        passingScore: 0.75,
        exercises: [
          mcq(
            'In `softmax(QKᵀ/√dₖ)V`, what does QKᵀ compute?',
            [
              'The final output vectors',
              'Relevance scores between every query and every key',
              'The positional encodings',
              'The loss',
            ],
            1,
            ['sk-attention'],
            'It is an all-pairs relevance score matrix. Softmax turns each row into weights, and multiplying by V aggregates the corresponding content.',
          ),
          numeric(
            'A transformer block appears 80 times in a model. If each holds 200M parameters, roughly how many billion parameters in the stack?',
            16,
            ['sk-transformer-block'],
            '80 × 200M = 16B. Embedding and output layers add more on top, but the repeated blocks dominate.',
            { tolerance: 0.5 },
          ),
          trueFalse(
            'Self-attention inherently understands word order.',
            false,
            ['sk-positional-encoding'],
            'It is permutation-invariant. Order comes entirely from positional encodings added to the input.',
          ),
        ],
      },
    },

    {
      id: 'unit-llm-3',
      title: 'From Base Model to Assistant',
      description: 'Pretraining, instruction tuning, RLHF, and what still goes wrong.',
      lessons: [
        lesson({
          id: 'lesson-training-stages',
          title: 'The Three Training Stages',
          summary: 'A base model is not an assistant.',
          level: 'intermediate',
          domain: 'llms',
          steps: [
            concept(
              'Pretraining',
              'Stage one: next-token prediction over trillions of tokens of web text, books, and code. Months of compute across thousands of GPUs, at a cost in the tens of millions of dollars.\n\nWhat comes out is a **base model**. It has absorbed grammar, facts, reasoning patterns, and code — but it is a *text continuer*, not an assistant. Ask it "What is the capital of France?" and a plausible continuation is another list of quiz questions, because that is what such text looks like in the wild.\n\nBase models are also perfectly happy to continue harmful text, since nothing in the objective distinguishes text you want from text you do not.',
            ),
            concept(
              'Supervised fine-tuning',
              'Stage two: fine-tune on tens of thousands of high-quality (instruction, response) pairs written or curated by humans.\n\nThis is where the model learns the *format* of being an assistant — that a question gets an answer, that instructions should be followed, that responses have a beginning and an end.\n\nSFT is cheap relative to pretraining, hours rather than months. It teaches behaviour, not knowledge: essentially everything the model knows was already there after pretraining. SFT teaches it how to present that knowledge on request.',
            ),
            concept(
              'RLHF and preference tuning',
              'Stage three fixes what SFT cannot. There are many valid responses to a prompt, and writing a demonstration for every one is impossible — but humans can easily *compare* two responses.\n\n1. Sample multiple responses per prompt.\n2. Humans rank them.\n3. Train a **reward model** to predict those rankings.\n4. Optimise the language model against the reward model with reinforcement learning (PPO), with a KL penalty anchoring it near the SFT model.\n\nThe KL term is essential. Without it the policy finds adversarial inputs that score highly on the reward model while being nonsense — **reward hacking**, the practical face of the alignment problem.\n\n**DPO** (Direct Preference Optimization) skips the separate reward model and optimises preferences directly. Simpler, more stable, and increasingly the default. **Constitutional AI** replaces much of the human labelling with model-generated critiques against a written set of principles.',
              {
                figure: 'rlhf-pipeline',
                keyTerms: [
                  { term: 'Reward model', definition: 'A model trained to predict human preference between responses.' },
                  { term: 'Reward hacking', definition: 'Scoring highly on the proxy objective while failing the actual goal.' },
                ],
              },
            ),
            order(
              'Order the stages of building a modern assistant.',
              [
                'Pretrain on a large corpus with next-token prediction',
                'Supervised fine-tuning on curated instruction-response pairs',
                'Collect human preference comparisons between responses',
                'Optimise against those preferences with RLHF or DPO',
              ],
              ['sk-pretraining-finetuning', 'sk-rlhf'],
              'Knowledge comes from pretraining, format from SFT, and the finer judgement of "which answer is better" from preference optimisation.',
            ),
            mcq(
              'Why is a KL penalty applied during RLHF?',
              [
                'To speed up training',
                'To keep the policy near the SFT model, preventing reward hacking',
                'To reduce memory usage',
                'To increase output diversity',
              ],
              1,
              ['sk-rlhf'],
              'The reward model is a proxy, and an unconstrained optimizer will exploit its flaws rather than satisfy the underlying intent. Anchoring the policy near the SFT model keeps the proxy in the regime where it was actually trained to be accurate.',
            ),
            mcq(
              'Which stage does most of the model\'s factual knowledge come from?',
              ['Pretraining', 'Supervised fine-tuning', 'RLHF', 'Prompt engineering'],
              0,
              ['sk-pretraining-finetuning'],
              'Pretraining supplies essentially all the knowledge. The later stages shape behaviour and presentation — which is why fine-tuning is a poor way to add new facts, and retrieval is a better one.',
            ),
            shortAnswer(
              'Why can a base model not be shipped as a chatbot?',
              ['continue', 'assistant', 'instruction', 'format', 'harmful'],
              'A base model continues text rather than answering. It has no notion that a question should be answered, no consistent response format, and no reluctance to continue harmful content. SFT and preference tuning add all of that.',
              ['sk-pretraining-finetuning'],
              'Pretraining produces capability. Alignment stages produce usable, safe behaviour on top of it.',
            ),
          ],
        }),

        lesson({
          id: 'lesson-hallucination-rag',
          title: 'Hallucination and RAG',
          summary: 'Why models make things up, and what actually helps.',
          level: 'intermediate',
          domain: 'llms',
          steps: [
            concept(
              'Fabrication is the objective working correctly',
              'A model asked for a citation it does not have produces a **plausible-looking** one: real-sounding authors, a real journal, a fabricated title and DOI.\n\nThis is not a malfunction. The model was trained to produce likely continuations, and a plausible citation is exactly that. Nothing in next-token prediction distinguishes *true* from *statistically typical*.\n\nWorse, the training signal actively discourages hedging. Confident text is more common than uncertain text in the corpus, so confidence is the more likely continuation — regardless of whether the model has grounds for it.\n\nHallucination is therefore not a bug to be patched. It is a structural property of the objective, and it is managed rather than eliminated.',
            ),
            multi(
              'Which meaningfully reduce hallucination? (Select all)',
              [
                'Providing source documents in the prompt and asking for citations from them',
                'Telling the model "do not hallucinate"',
                'Letting the model say "I don\'t know" and rewarding that in training',
                'Retrieval-augmented generation over a trusted corpus',
              ],
              [0, 2, 3],
              ['sk-hallucination'],
              'Grounding in provided text, training for calibrated abstention, and retrieval all give the model something real to condition on. Instructing it not to hallucinate does approximately nothing — it cannot detect which of its outputs are fabricated.',
            ),
            concept(
              'Retrieval-augmented generation',
              'RAG grounds generation in documents retrieved at query time:\n\n1. **Index.** Split your corpus into chunks and embed each one into a vector database.\n2. **Retrieve.** Embed the user\'s question and find the nearest chunks by cosine similarity.\n3. **Augment.** Insert those chunks into the prompt as context.\n4. **Generate.** The model answers using the provided text, citing it.\n\nRAG beats fine-tuning for factual grounding on several axes: knowledge updates by re-indexing rather than retraining, answers carry citations, and access control can be enforced at retrieval time.\n\nIn practice retrieval quality dominates end quality. **Hybrid search** — combining semantic similarity with keyword BM25 — reliably outperforms pure vector search, because exact identifiers, product codes, and names are precisely what embeddings handle worst.',
              { figure: 'rag-pipeline' },
            ),
            order(
              'Order the RAG pipeline.',
              [
                'Chunk documents and embed them into a vector store',
                'Embed the incoming user query',
                'Retrieve the most similar chunks',
                'Insert the chunks into the prompt and generate a grounded answer',
              ],
              ['sk-rag'],
              'Index ahead of time; retrieve, augment, and generate per query. The first step happens once; the rest happen on every request.',
            ),
            mcq(
              'Your company policy documents change weekly. Fine-tune or RAG?',
              [
                'Fine-tune — the model will learn them properly',
                'RAG — re-index in minutes instead of retraining, and answers can cite the source',
                'Neither works for this',
                'Fine-tune weekly',
              ],
              1,
              ['sk-rag', 'sk-pretraining-finetuning'],
              'Frequently-changing facts are RAG\'s core use case. Fine-tuning is slow, expensive, unattributable, and gives you no way to revoke a fact once learned.',
            ),
            interactive(
              'Run a retrieval step',
              'rag-retrieval',
              'Type a question and watch chunks ranked by cosine similarity. Then switch to hybrid search and see which exact-match results semantic search alone was missing — usually the product codes and proper nouns.',
            ),
            mcq(
              'A RAG system returns confident but wrong answers. Where do you look first?',
              [
                'Fine-tune the generation model',
                'Check whether retrieval is returning the correct chunks at all',
                'Increase the temperature',
                'Use a larger model',
              ],
              1,
              ['sk-rag', 'sk-vector-databases'],
              'Most RAG failures are retrieval failures. If the right chunk never reaches the prompt, no amount of generation-side improvement can rescue the answer. Evaluate retrieval recall separately before touching the model.',
            ),
            trueFalse(
              'Semantic vector search always outperforms keyword search.',
              false,
              ['sk-vector-databases'],
              'Embeddings are weak on exact matches — product codes, error numbers, proper nouns. Hybrid retrieval combining vector and BM25 scores is the reliable default in production systems.',
            ),
          ],
        }),

        lesson({
          id: 'lesson-context-windows',
          title: 'Context Windows',
          summary: 'Everything the model can see at once.',
          level: 'intro',
          domain: 'llms',
          steps: [
            concept(
              'A hard limit on working memory',
              'The **context window** is the maximum number of tokens a model can process in one request — the system prompt, the conversation history, retrieved documents, and the response being generated, all counted together.\n\nWindows have grown from 2k tokens in 2020 to 200k–2M today. But the model has no memory *between* requests. In a chat interface, the entire conversation is resent every turn. That is why long conversations get slower and more expensive, and why the earliest messages eventually get dropped.\n\nRunning over the limit means truncation — and the middle of a long context is where models attend least reliably, so what falls out is often not what you would have chosen.',
              { keyTerms: [{ term: 'Context window', definition: 'Maximum tokens processed in one request, input and output combined.' }] },
            ),
            numeric(
              'A model has a 128,000-token window. Your system prompt is 2,000 tokens, retrieved docs are 40,000, and history is 30,000. How many tokens remain for the response?',
              56000,
              ['sk-context-window'],
              '128,000 − 2,000 − 40,000 − 30,000 = 56,000. Output shares the same budget as input, which is easy to forget until a long generation gets truncated.',
              { tolerance: 100 },
            ),
            concept(
              'Lost in the middle',
              'A larger window does not mean uniform attention across it. Models retrieve information from the **beginning and end** of a long context far more reliably than from the middle — the effect is well-documented and substantial.\n\nPractical consequences:\n\n- Put the most important instructions at the very start or very end.\n- Do not dump 100 documents in and hope; retrieve 5 good ones instead.\n- Restating the key question after a long block of context measurably improves grounding.\n\nAlso worth internalising: cost and latency both scale with context. A 200k-token request costs roughly 100× a 2k one, and takes far longer to process. Stuffing the window because it is available is a common and expensive mistake.',
            ),
            mcq(
              'You must include one critical instruction in a very long prompt. Where do you put it?',
              [
                'In the middle, surrounded by supporting context',
                'At the very beginning or very end',
                'Position makes no difference',
                'Split it into fragments throughout',
              ],
              1,
              ['sk-context-window'],
              'Attention to the middle of a long context is measurably weaker. Beginning and end positions are recovered far more reliably.',
            ),
            trueFalse(
              'Because the model remembers the conversation, later messages in a chat are cheaper to process.',
              false,
              ['sk-context-window'],
              'The model is stateless between requests. The whole history is resent each turn, so later messages are *more* expensive, not less. Prompt caching reduces the cost of the repeated prefix but does not eliminate it.',
            ),
          ],
        }),
        lesson({
          id: 'lesson-before-and-beyond',
          title: 'Before Transformers, and Making Models Cheaper',
          summary: 'What attention replaced, and how huge models are made servable.',
          level: 'expert',
          domain: 'llms',
          steps: [
            concept(
              'RNNs and the memory bottleneck',
              'Before attention, sequences were handled by **recurrent neural networks**. An RNN reads one token at a time, maintaining a hidden state that carries everything it has seen so far.\n\nElegant, and it had two fatal problems.\n\n**Information decay.** The hidden state is a fixed-size vector. Everything from the start of a long sequence must survive being repeatedly overwritten, and it does not. Gradients over long chains vanish for the same reason we saw in deep networks.\n\n**No parallelism.** Step 50 cannot be computed until step 49 finishes. Training time scales with sequence length and no amount of GPU throws at it helps.\n\n**LSTMs** and **GRUs** attacked the first problem with gating — learned gates deciding what to keep, forget, and output. This genuinely helped and powered a decade of production NLP. It did nothing for the second problem, and that is what killed the architecture.',
              { keyTerms: [{ term: 'Hidden state', definition: 'A fixed-size vector carrying an RNN\'s memory of everything seen so far.' }, { term: 'Gating', definition: 'Learned mechanisms controlling what an LSTM retains, forgets, and emits.' }] },
            ),
            mcq(
              'What was the decisive advantage of transformers over LSTMs?',
              [
                'Fewer parameters',
                'The whole sequence is processed in parallel, so training scales with hardware',
                'They need no training data',
                'They have no vanishing gradient problem at all',
              ],
              1,
              ['sk-rnn-lstm', 'sk-attention'],
              'LSTM gating had largely addressed long-range memory. The unfixable problem was sequential computation — transformers process every position at once, which is what made training on trillions of tokens feasible.',
            ),
            concept(
              'Sequence-to-sequence and the origin of attention',
              'Translation needs an input sequence mapped to an output sequence of different length. The **encoder-decoder** design handled this: an encoder compresses the source sentence into a vector, a decoder generates the target from it.\n\nThe flaw was immediate. One fixed vector had to carry an entire sentence, and quality collapsed as sentences got longer.\n\nThe fix, in 2014, was **attention**: let the decoder look back at *all* encoder states and weight them by relevance at each output step. Translating a particular word, it could attend to the corresponding source word.\n\nThat was originally a patch on top of RNNs. The 2017 insight — "Attention Is All You Need" — was that the RNN could be deleted entirely and attention alone would suffice. The patch turned out to be the architecture.',
            ),
            multi(
              'Which problems did the original encoder-decoder architecture have? (Select all)',
              [
                'A single fixed-size vector had to represent the entire input',
                'Quality degraded sharply on longer sequences',
                'Sequential processing prevented parallel training',
                'It could not handle variable-length outputs',
              ],
              [0, 1, 2],
              ['sk-seq2seq'],
              'The bottleneck vector, length degradation, and sequential computation were all real. Variable-length output was the one thing the design handled well — that was the point of it.',
            ),
            concept(
              'Quantization and distillation',
              'A 70B-parameter model in 16-bit precision needs about 140GB just to hold its weights. Making that servable is its own engineering discipline.\n\n**Quantization** stores weights at lower precision. 8-bit roughly halves memory with negligible quality loss; 4-bit halves it again with a modest but real cost. Modern methods (GPTQ, AWQ) are *calibration-aware* — they use sample data to decide which weights tolerate precision loss, which is why 4-bit is now usable rather than merely small.\n\nThe win is not only memory. Inference on large models is usually **memory-bandwidth bound**, not compute bound, so moving fewer bytes per weight makes generation faster.\n\n**Distillation** trains a small "student" model to reproduce a large "teacher" model\'s output distribution. The teacher\'s full probabilities carry more information than hard labels — the relative probabilities of the wrong answers encode learned similarity structure. Students routinely reach most of teacher quality at a fraction of the size.\n\nThese compose: distil, then quantize.',
              { keyTerms: [{ term: 'Quantization', definition: 'Storing weights at reduced numerical precision to cut memory and bandwidth.' }, { term: 'Distillation', definition: 'Training a small model to imitate a large model\'s output distribution.' }] },
            ),
            interactive(
              'Drop the precision',
              'quantization',
              'Move from 32-bit to 4-bit and watch memory footprint, throughput, and per-weight error all change together. The quality cost stays small far longer than most people expect.',
            ),
            mcq(
              'Why does 4-bit quantization often speed up generation, not just reduce memory?',
              [
                'It reduces the number of parameters',
                'Inference is typically memory-bandwidth bound, so fewer bytes per weight means faster token generation',
                'It skips layers',
                'It reduces the vocabulary size',
              ],
              1,
              ['sk-quantization'],
              'Every generated token requires reading the weights. When bandwidth is the bottleneck — which it usually is for large models at low batch size — halving the bytes read is close to halving the time.',
            ),
            mcq(
              'Why does distillation on the teacher\'s full probability distribution beat training on hard labels alone?',
              [
                'It is faster to compute',
                'The relative probabilities of the wrong answers encode similarity structure the teacher learned',
                'It requires no training data',
                'Hard labels cannot be used with neural networks',
              ],
              1,
              ['sk-quantization'],
              'A teacher assigning 0.7 to "cat", 0.2 to "tiger" and 0.001 to "truck" is communicating that cats resemble tigers. A one-hot label throws that away — those "dark knowledge" gradients are most of why distillation works.',
            ),
            concept(
              'Mixture of experts',
              'A dense model uses every parameter for every token. **Mixture of experts** replaces the feed-forward block with many parallel "expert" networks plus a small **router** that sends each token to just a few of them — typically 2 of 8, or 8 of 64.\n\nThe result is a model with a very large *total* parameter count but a much smaller *active* count per token. A model might hold 400B parameters while using 40B for any given token — near the quality of a huge dense model at a fraction of the compute.\n\nThe costs are real and mostly operational. All experts must be resident in memory even though most are idle, so the memory footprint is that of the full model. Routing must be balanced — a collapsed router that sends everything to two experts wastes the rest, so training needs an explicit load-balancing loss. And distributing experts across devices makes serving considerably more complex.\n\nMoE is now standard in frontier models precisely because inference compute, not memory, is usually the binding cost.',
              { keyTerms: [{ term: 'Router', definition: 'A small learned network choosing which experts process each token.' }, { term: 'Active parameters', definition: 'The subset actually used per token, as opposed to total parameters.' }] },
            ),
            interactive(
              'Route tokens to experts',
              'moe-router',
              'Send tokens through the router and watch which experts activate. Track active parameters against total, and try to unbalance the router — then see why a load-balancing loss is required during training.',
            ),
            mcq(
              'What is the main advantage of a mixture-of-experts model?',
              [
                'It uses less memory than a dense model of equal quality',
                'Very large total capacity with much lower compute per token',
                'It needs no training data',
                'It removes the need for attention',
              ],
              1,
              ['sk-mixture-of-experts'],
              'MoE trades memory for compute. All experts must be in memory, but only a couple run per token — so the compute cost tracks the active parameters, not the total.',
            ),
            trueFalse(
              'A mixture-of-experts model needs less memory than a dense model with the same total parameter count.',
              false,
              ['sk-mixture-of-experts'],
              'Memory is comparable — every expert must be resident even when idle. The saving is in compute per token, which is a different resource.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-llm-3',
        title: 'LLM Systems Checkpoint',
        passingScore: 0.75,
        exercises: [
          mcq(
            'Which best explains why LLMs hallucinate?',
            [
              'Bugs in the inference code',
              'They are trained to produce likely text, and nothing in that objective separates true from plausible',
              'The training data was entirely false',
              'The context window is too small',
            ],
            1,
            ['sk-hallucination'],
            'It follows directly from the objective. Plausibility is what is optimised; truth is not represented separately.',
          ),
          multi(
            'Genuine advantages of RAG over fine-tuning for factual knowledge? (Select all)',
            [
              'Knowledge updates without retraining',
              'Answers can cite their sources',
              'Access control can be enforced at retrieval time',
              'It always produces a smaller model',
            ],
            [0, 1, 2],
            ['sk-rag'],
            'The first three are RAG\'s real advantages. Model size is unchanged — RAG adds a retrieval system alongside it.',
          ),
          trueFalse(
            'RLHF adds substantial new factual knowledge to the model.',
            false,
            ['sk-rlhf'],
            'RLHF shapes behaviour and judgement. Knowledge comes from pretraining.',
          ),
        ],
      },
    },
  ],
};
