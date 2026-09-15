/**
 * Track 16 — NLP Before Transformers.
 *
 * The `nlp` domain had skills but no track: tokenization was taught inside the
 * LLM track and everything before 2017 was missing entirely. That gap matters
 * pedagogically — attention is much easier to appreciate once you have felt the
 * bottleneck it removed.
 */

import type { Track } from '../../domain/types';
import { concept, fill, interactive, lesson, match, mcq, multi, numeric, order, shortAnswer, trueFalse } from '../builders';

export const nlpTrack: Track = {
  id: 'track-nlp',
  title: 'NLP Before Transformers',
  tagline: 'The ideas attention replaced — and why it had to',
  description:
    'Counting words, subword tokenization, word vectors, and the recurrent models that came before attention. Understand what the bottleneck was and the transformer stops being magic.',
  domain: 'nlp',
  level: 'intermediate',
  icon: '🔤',
  gradient: ['#14B8A6', '#6366F1'],
  prerequisites: ['track-foundations'],
  outcomes: [
    'Normalise and tokenize text, and say what each choice throws away',
    'Explain TF-IDF and what it cannot represent',
    'Describe how word vectors capture meaning as direction',
    'Explain why RNNs struggle with long sequences',
    'Say precisely what the seq2seq bottleneck was and how attention removed it',
  ],
  units: [
    // -----------------------------------------------------------------------
    {
      id: 'unit-nlp-1',
      title: 'Text Into Numbers',
      description: 'Every NLP system starts by throwing some information away.',
      lessons: [
        lesson({
          id: 'lesson-text-normalization',
          title: 'Counting Words',
          summary: 'Bag of words is crude, fast, and still competitive more often than you would think.',
          level: 'intro',
          domain: 'nlp',
          free: true,
          steps: [
            concept(
              'Normalisation is a series of deliberate losses',
              'Before a model sees text, something has to decide what counts as the same thing. Every one of those decisions destroys information on purpose.\n\n**Lowercasing.** `Apple` and `apple` become one token. Fewer types to learn — and you have just merged the company with the fruit, and lost the signal that a capitalised mid-sentence word is probably a name.\n\n**Punctuation removal.** Smaller vocabulary; `"Let\'s eat, Grandma"` and `"Let\'s eat Grandma"` are now identical.\n\n**Stop-word removal.** Dropping *the, a, is, of* cuts length substantially and barely affects topic classification. It is fatal for anything where function words carry the meaning — negation, sentiment, grammar.\n\n**Stemming and lemmatisation.** Collapse `running`, `runs`, `ran` to one form. Stemming is a crude rule-chopper (`studies` → `studi`); lemmatisation uses a dictionary and gets `better` → `good`. Slower, correct more often.\n\nThe framing worth carrying: **normalisation is not a preprocessing formality, it is a modelling decision.** Each step trades vocabulary size for distinctions you may need. Modern subword tokenizers mostly stopped doing any of it — they keep case and punctuation and let the model decide what matters, which is the right call when you have enough data.',
              {
                keyTerms: [
                  { term: 'Stop words', definition: 'Very frequent function words often removed. Sometimes the only words that matter.' },
                  { term: 'Lemmatisation', definition: 'Reducing a word to its dictionary form using vocabulary and morphology.' },
                ],
              },
            ),
            mcq(
              'For which task is stop-word removal most likely to destroy the signal?',
              [
                'Topic classification of news articles',
                'Detecting negation in clinical notes — "no evidence of fracture"',
                'Keyword search over product titles',
                'Clustering documents by subject',
              ],
              1,
              ['sk-text-normalization'],
              '"No", "not" and "without" are stop words in most standard lists, and in a clinical note they invert the meaning entirely. Removing them turns "no evidence of fracture" into "evidence fracture" — the opposite of what was written.',
            ),
            concept(
              'Bag of words and TF-IDF',
              '**Bag of words** represents a document as counts: a vector as long as the vocabulary, each entry the number of times that word appears. `"the cat sat on the mat"` becomes `{the: 2, cat: 1, sat: 1, on: 1, mat: 1}`.\n\nThe name is the honest description — **word order is gone.** "Dog bites man" and "man bites dog" are identical vectors.\n\n**TF-IDF** improves the weighting. Raw counts over-reward common words: *the* appears everywhere and distinguishes nothing. TF-IDF multiplies term frequency by **inverse document frequency** — `log(N / documents containing the term)` — so a word appearing in every document gets a weight near zero, and a word appearing in a handful gets a large one. The result is a vector dominated by the terms that make this document *unusual*.\n\nIt is 1970s technology and it is still worth reaching for. TF-IDF plus logistic regression trains in seconds, needs no GPU, is completely interpretable — you can read the coefficients — and on topic classification with plenty of labelled data it is often within a few points of a fine-tuned transformer.\n\nWhat it cannot do is the whole reason for everything that follows. **It has no notion of similarity between words.** `car` and `automobile` are as unrelated as `car` and `banana` — different columns, no shared structure. A document about automobiles scores zero against a query about cars. Word embeddings exist to fix exactly this.',
              {
                keyTerms: [
                  { term: 'TF-IDF', definition: 'Term frequency weighted down by how many documents contain the term.' },
                  { term: 'Sparse representation', definition: 'A long vector that is mostly zeros — one column per vocabulary word.' },
                ],
              },
            ),
            numeric(
              'A term appears in 100 of 10,000 documents. What is its IDF, using natural log?',
              4.605,
              ['sk-bag-of-words'],
              '`ln(10000/100) = ln(100) ≈ 4.605`. A term in all 10,000 documents would score `ln(1) = 0` — contributing nothing, which is exactly the intent.',
              { tolerance: 0.05, hint: 'IDF is log(total documents / documents containing the term).' },
            ),
            mcq(
              'What is the fundamental limitation of TF-IDF that word embeddings were invented to fix?',
              [
                'It is too slow on large corpora',
                'Every word is an independent column, so it has no way to represent that two words mean similar things',
                'It cannot handle documents of different lengths',
                'It requires labelled training data',
              ],
              1,
              ['sk-bag-of-words'],
              'Orthogonal columns mean zero similarity between distinct words. `car` and `automobile` share nothing, so a search for one misses documents using the other — and no amount of weighting fixes a representation with no shared structure.',
            ),
            multi(
              'When is TF-IDF plus a linear model still a reasonable choice? (Select all)',
              [
                'Topic classification with plenty of labelled examples',
                'When you need to explain which words drove a prediction',
                'When the task depends on word order and negation',
                'When there is no GPU and latency must be very low',
              ],
              [0, 1, 3],
              ['sk-bag-of-words'],
              'It remains genuinely competitive on bag-of-words-shaped tasks, and its interpretability and speed are real advantages. Order and negation are exactly where it falls apart, because that information was discarded at the representation step.',
            ),
          ],
        }),

        lesson({
          id: 'lesson-bpe',
          title: 'Subwords and Byte-Pair Encoding',
          summary: 'Neither characters nor words. The compromise everything uses now.',
          level: 'expert',
          domain: 'nlp',
          steps: [
            concept(
              'Both obvious options fail',
              '**Word-level tokenization** gives short sequences and meaningful units, and then breaks on contact with reality. Any vocabulary is finite, so everything outside it becomes `<UNK>` — and language generates new words constantly: names, typos, hashtags, compounds, morphology. A 50,000-word vocabulary still misses a great deal, and a 500,000-word one has an enormous embedding table where most entries are seen a handful of times.\n\n**Character-level tokenization** never encounters an unknown token and has a tiny vocabulary. It also makes sequences five to ten times longer — and attention cost is quadratic in sequence length — while forcing the model to rediscover that `c-a-t` is a unit.\n\n**Subword tokenization** takes the middle. Common words stay whole; rare words split into pieces that are themselves common. `tokenization` → `token` + `ization`. `Reykjavik` → several fragments. Nothing is ever unknown, because the fallback bottoms out at single bytes.\n\n**Byte-pair encoding** learns the split from data, greedily:\n\n1. Start with every character as its own token.\n2. Count all adjacent pairs across the corpus.\n3. Merge the most frequent pair into a new token.\n4. Repeat until the vocabulary reaches the target size.\n\nFrequent sequences become single tokens; rare ones stay in pieces. The merge list *is* the tokenizer — applying it in the same order reproduces the segmentation exactly.',
              {
                keyTerms: [
                  { term: 'Byte-pair encoding', definition: 'Iteratively merging the most frequent adjacent token pair to build a subword vocabulary.' },
                  { term: 'Out-of-vocabulary', definition: 'A word the tokenizer cannot represent. Subword schemes make it impossible.' },
                ],
              },
            ),
            interactive(
              'Watch text become tokens',
              'tokenizer',
              'Type ordinary words, then rare ones, then a name, then a number. Watch common words stay whole while unusual ones fragment — and notice how many tokens a long number costs.',
            ),
            order(
              'Order the steps of training a BPE tokenizer.',
              [
                'Initialise the vocabulary with every individual character in the corpus',
                'Count the frequency of every adjacent token pair',
                'Merge the single most frequent pair into one new token',
                'Repeat counting and merging until the vocabulary reaches its target size',
              ],
              ['sk-bpe'],
              'The ordered list of merges is the tokenizer. Replay it on new text and you get the same segmentation — which is why the tokenizer must be shipped and versioned with the model.',
            ),
            mcq(
              'Why do LLMs handle arithmetic on large numbers poorly, partly for tokenization reasons?',
              [
                'Numbers are removed during preprocessing',
                'A number may split into several tokens in inconsistent ways, so digit positions do not line up',
                'Tokenizers cannot represent digits',
                'Numbers are always single tokens, which loses their magnitude',
              ],
              1,
              ['sk-bpe', 'sk-tokenization'],
              '`1234` might be one token while `1235` is two, so the model has no consistent positional handle on digits. Some tokenizers now force digits to split individually for exactly this reason — a tokenizer choice materially affecting arithmetic ability.',
            ),
            multi(
              'Which are true of subword tokenization? (Select all)',
              [
                'It eliminates out-of-vocabulary tokens entirely',
                'Common words usually remain single tokens',
                'It produces shorter sequences than character-level tokenization',
                'The same text always uses the same number of tokens across different models',
              ],
              [0, 1, 2],
              ['sk-bpe'],
              'Token counts are tokenizer-specific — the same sentence can differ by 30% between models, which is why pricing and context limits are not directly comparable across providers.',
            ),
            trueFalse(
              'A language model and its tokenizer can be swapped independently.',
              false,
              ['sk-bpe', 'sk-tokenization'],
              'The embedding table is indexed by token id. Change the tokenizer and every id points at the wrong embedding — the model produces fluent nonsense rather than an error. Tokenizer and weights are one artefact.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-nlp-1',
        title: 'Text Checkpoint',
        passingScore: 0.7,
        exercises: [
          mcq(
            'For which task is stop-word removal most destructive?',
            [
              'Topic classification of news',
              'Detecting negation in clinical notes',
              'Keyword search over product titles',
              'Clustering documents by subject',
            ],
            1,
            ['sk-text-normalization'],
            '"No" and "not" are standard stop words, and removing them inverts the meaning of "no evidence of fracture".',
          ),
          mcq(
            'What does TF-IDF fundamentally fail to represent?',
            [
              'Document length',
              'That two different words can mean similar things',
              'Term frequency',
              'Rare terms',
            ],
            1,
            ['sk-bag-of-words'],
            'Every word is its own orthogonal column, so "car" and "automobile" share nothing at all. Embeddings exist to fix exactly this.',
          ),
          trueFalse(
            'A model’s tokenizer can be swapped without retraining the model.',
            false,
            ['sk-bpe'],
            'Token ids index the embedding table. A different tokenizer resolves every id to the wrong vector, and the model produces fluent nonsense rather than an error.',
          ),
        ],
      },
    },

    // -----------------------------------------------------------------------
    {
      id: 'unit-nlp-2',
      title: 'Meaning as Geometry',
      description: 'The idea that words can be points, and that direction means something.',
      lessons: [
        lesson({
          id: 'lesson-word2vec',
          title: 'Word Vectors and Semantic Space',
          summary: '"You shall know a word by the company it keeps" — turned into an algorithm.',
          level: 'intermediate',
          domain: 'nlp',
          steps: [
            concept(
              'The distributional hypothesis',
              'Firth, 1957: *"You shall know a word by the company it keeps."* Words appearing in similar contexts tend to mean similar things. `cat` and `dog` both show up near *pet, vet, feed, fur*; `cat` and `democracy` do not.\n\n**Word2Vec** (2013) turned that observation into a training objective, and the trick is that it needs no labels at all. Two variants:\n\n**Skip-gram.** Given a word, predict the words around it. Train a small network on that task over a large corpus and then throw the network away — **the hidden-layer weights are the embeddings.** The prediction task was only ever scaffolding for learning a representation.\n\n**CBOW.** The reverse: given the context, predict the missing word. Faster; slightly worse on rare words.\n\nWhat comes out is a few hundred dimensions per word, dense rather than sparse, where geometric distance tracks semantic similarity. And then the property that made it famous: **directions are meaningful.**\n\n`king − man + woman ≈ queen`\n\nThe vector from `man` to `woman` is roughly the same vector as from `king` to `queen`. Gender became a *direction* in the space. So did plurality, tense, and country-to-capital. Nobody designed this; it emerged from predicting neighbours.\n\nWord2Vec is the ancestor of every embedding in this curriculum. The pattern — train on a proxy task, keep the internal representation — is exactly what modern embedding models and self-supervised learning do at scale.',
              {
                keyTerms: [
                  { term: 'Distributional hypothesis', definition: 'Words in similar contexts have similar meanings.' },
                  { term: 'Skip-gram', definition: 'Predicting context words from a target word, to learn its embedding.' },
                ],
              },
            ),
            interactive(
              'Move through semantic space',
              'embedding-space',
              'Drag a point and watch its neighbours change. Then look for the directions — the offset between related pairs tends to repeat, which is the analogy property made visible.',
            ),
            mcq(
              'In Word2Vec, which part of the trained network is actually kept?',
              [
                'The output layer that predicts context words',
                'The hidden-layer weight matrix, one row per word — those rows are the embeddings',
                'The full network, used for inference',
                'The vocabulary counts',
              ],
              1,
              ['sk-word-embeddings'],
              'The prediction task is scaffolding. Once training is done the output layer is discarded and the hidden weights — one vector per word — are the product.',
            ),
            fill(
              'The relationship `Paris − France + Italy ≈ ___` demonstrates that ___ in embedding space carry meaning.',
              [['Rome'], ['directions', 'direction', 'offsets', 'vectors', 'vector offsets']],
              ['sk-word-embeddings'],
              'Country-to-capital is a consistent offset, so subtracting one country and adding another moves you to the corresponding capital. The regularity emerges from co-occurrence statistics alone.',
              'Think about what the vector from a country to its capital represents.',
            ),
            concept(
              'One vector per word — and why that was not enough',
              'Word2Vec gives every word exactly one vector, forever. That is its defining limitation.\n\n`bank` in "river bank" and `bank` in "savings bank" get the same embedding — an average of both senses that is a good representation of neither. Polysemy is everywhere in language, and a static vector cannot handle it.\n\nIt is also **order-blind** at the sentence level. Sum or average word vectors to represent a sentence and "the dog bit the man" matches "the man bit the dog" exactly.\n\nAnd it inherits every bias in the corpus with unsettling clarity. Bolukbasi et al. showed `man − woman ≈ computer programmer − homemaker` in embeddings trained on Google News. The geometry that makes analogies work also encodes stereotypes, because both are just co-occurrence statistics.\n\n**Contextual embeddings** — ELMo, then BERT, then every transformer since — fix the first two. The representation of a word is computed *from the sentence it is in*, so `bank` gets different vectors in different contexts and order is part of the input rather than discarded. The bias problem does not go away; it moves.',
            ),
            mcq(
              'What is the key difference between a Word2Vec embedding and a BERT embedding of the same word?',
              [
                'BERT vectors are shorter',
                'Word2Vec gives one fixed vector per word; BERT computes a different vector depending on the surrounding sentence',
                'Word2Vec requires labelled data and BERT does not',
                'BERT embeddings cannot be compared with cosine similarity',
              ],
              1,
              ['sk-word-embeddings', 'sk-embeddings'],
              'Static versus contextual. It is why BERT can distinguish the two senses of `bank` and Word2Vec structurally cannot — the context is an input rather than something averaged away during training.',
            ),
            trueFalse(
              'Averaging the word vectors in a sentence discards word order entirely.',
              true,
              ['sk-word-embeddings'],
              'Addition is commutative, so every permutation of the same words gives an identical vector. Recovering order is exactly what recurrent models, and later attention with positional encoding, were for.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-nlp-2',
        title: 'Word Vectors Checkpoint',
        passingScore: 0.7,
        exercises: [
          mcq(
            'In Word2Vec, which part of the trained network is kept?',
            [
              'The output layer that predicts context words',
              'The hidden-layer weight matrix — one row per word, and those rows are the embeddings',
              'The whole network, for inference',
              'The vocabulary counts',
            ],
            1,
            ['sk-word-embeddings'],
            'The prediction task is scaffolding. The representation learned along the way is the product — the same pattern as all self-supervised learning.',
          ),
          trueFalse(
            'Averaging a sentence’s word vectors produces a representation that preserves word order.',
            false,
            ['sk-word-embeddings'],
            'Addition is commutative, so every permutation gives the identical vector. Recovering order is what recurrence, and later positional encoding, were for.',
          ),
          mcq(
            'What is the key difference between a Word2Vec and a BERT embedding of the same word?',
            [
              'BERT vectors are shorter',
              'Word2Vec gives one fixed vector per word; BERT computes a different one per context',
              'Word2Vec needs labelled data',
              'BERT embeddings cannot be compared with cosine similarity',
            ],
            1,
            ['sk-word-embeddings'],
            'Static versus contextual — which is why BERT can separate the two senses of "bank" and Word2Vec structurally cannot.',
          ),
        ],
      },
    },

    // -----------------------------------------------------------------------
    {
      id: 'unit-nlp-3',
      title: 'Sequences',
      description: 'Recurrence, its limits, and the bottleneck that attention removed.',
      lessons: [
        lesson({
          id: 'lesson-rnn-lstm',
          title: 'RNNs and LSTMs',
          summary: 'Process one word at a time, carrying state. Elegant, and a dead end.',
          level: 'expert',
          domain: 'nlp',
          steps: [
            concept(
              'A loop over time',
              'A **recurrent neural network** reads a sequence one element at a time, maintaining a **hidden state** that carries everything so far:\n\n`hₜ = f(W · xₜ + U · hₜ₋₁ + b)`\n\nThe new state is a function of the current input and the previous state. The same weights are used at every step — weight sharing across time, the temporal counterpart of convolution\'s sharing across space. That is what lets an RNN handle sequences of any length with a fixed parameter count.\n\nElegant, and it has two structural problems.\n\n**Vanishing gradients over time.** Training unrolls the loop and backpropagates through every step. A 50-word sentence is a 50-layer network by another name, with the *same* matrix multiplied repeatedly — so gradients shrink or explode geometrically. In practice early words stop influencing the update at all, and a plain RNN\'s effective memory is roughly 5–10 steps.\n\n**No parallelism.** Step `t` needs `hₜ₋₁`. The loop cannot be unrolled across a GPU, so training time scales with sequence length no matter how much hardware you own.\n\n**LSTMs** (1997) fixed the first. Add a **cell state** that flows through with only additive updates, and three learned **gates** — forget (what to drop), input (what to add), output (what to expose). The additive path gives gradients a route that does not repeatedly multiply, which is the same insight as a residual connection, arrived at eighteen years earlier. LSTMs reliably hold information for hundreds of steps and ran production translation, speech recognition and text generation for two decades.\n\nWhat LSTMs did **not** fix was the second problem. Sequential computation is inherent to recurrence, and that — not accuracy — is why transformers displaced them.',
              {
                keyTerms: [
                  { term: 'Hidden state', definition: 'A fixed-size vector carrying information from all previous steps.' },
                  { term: 'Gate', definition: 'A learned sigmoid deciding how much information to let through.' },
                ],
              },
            ),
            mcq(
              'What did LSTM gates fix that plain RNNs could not do?',
              [
                'Parallel processing across the sequence',
                'Retaining information across long spans, by giving gradients an additive path that does not repeatedly multiply',
                'Handling variable-length inputs',
                'Reducing the parameter count',
              ],
              1,
              ['sk-rnn-lstm'],
              'The cell state flows forward with additive updates, so the gradient does not shrink geometrically. Parallelism was untouched — every step still waits for the one before it.',
            ),
            mcq(
              'Why is training an RNN on long sequences slow even on a large GPU?',
              [
                'The parameter count grows with sequence length',
                'Step t depends on step t−1, so the computation is inherently sequential and cannot be parallelised',
                'Recurrent layers cannot use batching',
                'Gradients must be computed twice per step',
              ],
              1,
              ['sk-rnn-lstm'],
              'Data dependency, not arithmetic. You can batch across examples but never across time within one sequence — and that single constraint is what made transformers, which see all positions at once, so much faster to train.',
            ),
            multi(
              'Which are true of LSTMs? (Select all)',
              [
                'They maintain a cell state updated additively',
                'They use learned gates to control what is kept and forgotten',
                'They process all positions in parallel',
                'They can retain information across hundreds of steps',
              ],
              [0, 1, 3],
              ['sk-rnn-lstm'],
              'Parallelism is precisely what they do not have. Everything else on the list is what made them the standard for twenty years.',
            ),
            match(
              'Match each LSTM gate to its job.',
              [
                { left: 'Decides what to discard from the cell state', right: 'Forget gate' },
                { left: 'Decides what new information to store', right: 'Input gate' },
                { left: 'Decides what to expose as this step’s output', right: 'Output gate' },
                { left: 'Carries information forward with additive updates', right: 'Cell state' },
              ],
              ['sk-rnn-lstm'],
              'Three sigmoids and a carry line. The additive carry is the whole reason gradients survive — the same idea residual connections rediscovered for depth rather than time.',
            ),
          ],
        }),

        lesson({
          id: 'lesson-seq2seq',
          title: 'Seq2Seq and the Bottleneck',
          summary: 'Compress a whole sentence into one vector. That was the problem attention solved.',
          level: 'expert',
          domain: 'nlp',
          steps: [
            concept(
              'Encoder, decoder, and one vector between them',
              '**Sequence-to-sequence** (2014) was the architecture that made neural machine translation work, and its shape is still everywhere.\n\nAn **encoder** RNN reads the source sentence and produces a final hidden state — a **context vector**. A **decoder** RNN is initialised from that vector and generates the target sentence one token at a time, feeding each output back in as the next input.\n\nIt was a genuine breakthrough: no alignment models, no phrase tables, no hand-built pipeline. Two networks, trained end to end on sentence pairs.\n\nAnd it had one glaring flaw. **The entire source sentence has to fit through a single fixed-size vector.** Every word, every relationship, every nuance, compressed into a few hundred numbers before the decoder sees anything.\n\nFor a short sentence, fine. For a 40-word sentence, the early words are long gone by the time the encoder finishes — and the empirical signature was unmistakable: **translation quality fell off sharply with source length**, in a way that had nothing to do with the difficulty of the sentence.\n\nThis is the bottleneck, and it is worth sitting with, because the fix is the whole of modern NLP.',
              { keyTerms: [{ term: 'Context vector', definition: 'The encoder’s final hidden state — in early seq2seq, the only channel to the decoder.' }] },
            ),
            mcq(
              'What was the empirical signature of the seq2seq bottleneck?',
              [
                'Training loss failed to converge',
                'Translation quality degraded sharply as source sentences got longer',
                'The model could not handle rare words',
                'Decoding was too slow to be practical',
              ],
              1,
              ['sk-seq2seq'],
              'Quality against source length was the smoking gun: it fell steeply past about 20 words regardless of difficulty. One fixed vector simply cannot hold a long sentence, and the failure scaled with length.',
            ),
            concept(
              'Attention removes the bottleneck',
              'Bahdanau et al. (2014) asked the obvious question: why should the decoder see only the *final* state? Keep every encoder state, and let the decoder choose which ones to look at, at each output step.\n\nAt every decoding step:\n\n1. Score the current decoder state against **every** encoder state.\n2. Softmax the scores into weights that sum to 1.\n3. Take the weighted sum of encoder states as this step\'s context.\n\nThe decoder now builds **a different context vector for every output token**, focusing on the source words that matter right now. The bottleneck is gone — not narrowed, removed — and translation quality stopped degrading with length.\n\nThe attention weights also turned out to be interpretable. Plot them as a matrix and you see soft alignment between source and target words, learned without ever being told that alignment exists.\n\nThree years later, *Attention Is All You Need* made the obvious next move: if attention is doing the work, drop the recurrence entirely. That removes the sequential dependency, every position can be computed in parallel, and training scales with hardware rather than sentence length.\n\nWhich is the through-line of this whole track. **Attention was invented to patch an RNN, and turned out to be the better idea on its own.**',
              { figure: 'attention-heads' },
            ),
            interactive(
              'Trace the alignment',
              'attention-matrix',
              'Follow which source positions each output token attends to. In the original seq2seq there was exactly one context vector for the whole sentence — this matrix is what replaced it.',
            ),
            order(
              'Order the steps of attention in a seq2seq decoder.',
              [
                'Score the current decoder state against every encoder hidden state',
                'Softmax the scores into weights summing to one',
                'Take the weighted sum of encoder states as this step’s context vector',
                'Generate the next output token from that context and the decoder state',
              ],
              ['sk-seq2seq', 'sk-attention'],
              'Score, normalise, combine, generate — repeated for every output token. Modern transformer attention is the same four steps with learned query, key and value projections.',
            ),
            shortAnswer(
              'Why did removing recurrence from the architecture matter so much, given attention had already fixed the quality problem?',
              ['parallel', 'sequential', 'training', 'speed', 'gpu', 'scale'],
              'Because recurrence forces sequential computation — each step waits for the previous one — so training time scales with sequence length regardless of available hardware. Attention alone has no such dependency, so every position can be computed simultaneously. That made it possible to train on far more data with far more compute, and scale is what produced the capabilities of modern language models.',
              ['sk-seq2seq'],
              'Quality per parameter was not the revolution. Trainability at scale was.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-nlp-3',
        title: 'NLP Checkpoint',
        passingScore: 0.7,
        exercises: [
          mcq(
            'What does TF-IDF fundamentally fail to represent?',
            [
              'Document length',
              'That two different words can mean similar things',
              'Word frequency',
              'Rare terms',
            ],
            1,
            ['sk-bag-of-words'],
            'Every word is its own orthogonal column, so `car` and `automobile` share nothing at all.',
          ),
          mcq(
            'What did transformers gain by dropping recurrence?',
            [
              'Fewer parameters',
              'All positions computable in parallel, so training scales with hardware rather than sentence length',
              'Support for longer vocabularies',
              'Lower memory use',
            ],
            1,
            ['sk-seq2seq'],
            'Attention had already solved quality. Parallelism is what unlocked scale.',
          ),
          trueFalse(
            'A model’s tokenizer can be replaced without retraining the model.',
            false,
            ['sk-bpe'],
            'Token ids index the embedding table. Swap the tokenizer and every id resolves to the wrong vector.',
          ),
        ],
      },
    },
  ],
};
