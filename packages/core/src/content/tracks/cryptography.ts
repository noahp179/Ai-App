/**
 * Track 35 — Cryptography.
 *
 * The security track covered what to do; this covers why it works. Defensive
 * throughout, and honest about the central practical lesson: understanding
 * these primitives is what tells you not to implement them yourself.
 */

import type { Track } from '../../domain/types';
import { categorize, concept, interactive, lesson, match, mcq, order, shortAnswer, trueFalse } from '../builders';

export const cryptographyTrack: Track = {
  id: 'track-cryptography',
  title: 'Cryptography',
  tagline: 'Why the padlock means anything',
  description:
    'Symmetric and public-key encryption, key exchange, signatures, authenticated encryption, and randomness — the primitives underneath TLS, signing and secure storage, plus a clear account of what quantum computing does and does not break.',
  domain: 'security',
  level: 'intermediate',
  icon: '🔑',
  gradient: ['#F43F5E', '#6366F1'],
  prerequisites: ['track-security'],
  outcomes: [
    'State Kerckhoffs’s principle and why proprietary crypto is a warning sign',
    'Explain why ECB mode leaks structure and what modes replaced it',
    'Describe how two parties agree a secret over a channel an attacker is reading',
    'Say what a signature proves that encryption does not',
    'Recognise why encryption without authentication is not enough',
    'Explain which algorithms quantum computing threatens and which it does not',
  ],
  units: [
    // -----------------------------------------------------------------------
    {
      id: 'unit-crypto-1',
      title: 'Shared Secrets',
      description: 'Symmetric encryption, modes, and where the randomness comes from.',
      lessons: [
        lesson({
          id: 'lesson-symmetric',
          title: 'Symmetric Encryption and Modes',
          summary: 'One key both ways, and why the mode matters more than the cipher.',
          level: 'intermediate',
          domain: 'security',
          free: true,
          steps: [
            concept(
              'Kerckhoffs’s principle',
              'In 1883 Auguste Kerckhoffs stated the rule that still governs the field: **a cryptosystem should remain secure even if everything about it except the key is public knowledge.**\n\nThe reasoning is practical. Algorithms leak — through reverse engineering, through employees, through published patents. Keys can be rotated; a design cannot. And an algorithm nobody has examined is not "unbroken", it is *untested*.\n\nWhich gives the single most useful heuristic in applied cryptography: **"proprietary military-grade encryption" is a warning label.** Real algorithms are published, attacked by specialists for years, and standardised only if they survive. AES was chosen through a five-year open competition with public cryptanalysis of every candidate.\n\nThe corollary for engineers is stronger than it sounds. **Do not implement cryptographic primitives.** Not because the mathematics is beyond you, but because the implementation has requirements that ordinary correctness does not: constant-time comparison so the duration does not leak the answer, careful memory handling so keys do not linger, and correct handling of every malformed input. Timing attacks have recovered keys from implementations that were mathematically perfect.\n\nUse a reviewed library. The purpose of learning this material is to use those libraries correctly and to recognise when something is wrong — not to write your own.',
              {
                keyTerms: [
                  { term: 'Kerckhoffs’s principle', definition: 'Security must rest on the key alone, not on the design being secret.' },
                  { term: 'Constant-time', definition: 'Code whose duration does not depend on secret values, so timing leaks nothing.' },
                ],
              },
            ),
            mcq(
              'Why is "proprietary encryption" a warning sign?',
              [
                'Proprietary code is always buggy',
                'Security should rest on the key alone; an unexamined algorithm is untested rather than unbroken',
                'It is more expensive',
                'It cannot be exported',
              ],
              1,
              ['sk-kerckhoffs'],
              'Public algorithms have survived years of expert attack. A secret one has survived nothing.',
            ),
            mcq(
              'Why should engineers not implement cryptographic primitives themselves?',
              [
                'The mathematics is too hard',
                'Implementation requires constant-time operations and careful key handling — a correct algorithm can still leak through timing',
                'It is illegal',
                'Libraries are faster',
              ],
              1,
              ['sk-crypto-practice'],
              'Keys have been recovered from mathematically flawless implementations by measuring how long a comparison took.',
            ),
            concept(
              'AES, and why the mode matters more',
              '**Symmetric encryption** uses one key for both directions. AES is the standard: a **block cipher** operating on 128-bit blocks, with 128- or 256-bit keys, and it is fast enough that modern processors have dedicated instructions for it.\n\nBut a block cipher only encrypts one block. Messages are longer than sixteen bytes, so you need a **mode of operation** — and the mode is where real systems break.\n\n**ECB** (electronic codebook) encrypts each block independently. Which means identical plaintext blocks produce identical ciphertext blocks. Encrypt an image in ECB and you can still see the picture: the outlines survive, because the structure survives. ECB is the canonical example of an encryption that hides values and not patterns, and it should never be used.\n\n**CBC** chains each block into the next and needs a random **initialisation vector** per message, so the same plaintext encrypts differently each time. Better, and vulnerable to padding-oracle attacks when used without authentication.\n\n**CTR** turns the block cipher into a stream by encrypting a counter. Parallelisable and seekable. Catastrophic if a counter is ever reused with the same key — XOR two such ciphertexts and the key material cancels out.\n\n**GCM** is CTR plus authentication, and is the modern default.\n\nThe lesson generalises: **the primitive is rarely the weak point.** AES has stood for twenty-five years. Systems built on it fail through mode choice, IV reuse, key management, and missing authentication.',
              {
                keyTerms: [
                  { term: 'Block cipher', definition: 'Encrypts fixed-size blocks; a mode extends it to real messages.' },
                  { term: 'Initialisation vector', definition: 'Per-message randomness so identical plaintexts encrypt differently.' },
                ],
              },
            ),
            mcq(
              'Why is ECB mode unsafe?',
              [
                'AES is broken in ECB',
                'Identical plaintext blocks produce identical ciphertext blocks, so structure and patterns leak',
                'It is too slow',
                'It needs a large key',
              ],
              1,
              ['sk-block-modes'],
              'The famous encrypted-penguin image is still recognisably a penguin. Values are hidden; the picture is not.',
            ),
            mcq(
              'What does an initialisation vector accomplish?',
              [
                'It strengthens the key',
                'It makes the same plaintext encrypt to different ciphertext each time',
                'It authenticates the message',
                'It compresses the data',
              ],
              1,
              ['sk-block-modes'],
              'Which is why an IV must be unpredictable and never reused with the same key.',
            ),
            mcq(
              'AES with a 128-bit key has stood for twenty-five years of public cryptanalysis. What does that tell you about a system built on it?',
              [
                'The system is secure',
                'Only that the cipher is sound — the mode, key management, randomness and authentication are all separate and are where systems actually fail',
                'The key size is too small',
                'It should be replaced',
              ],
              1,
              ['sk-symmetric-ciphers'],
              'The primitive is almost never the weak point. Twenty-five years of attack have not dented AES, while the systems built on it fail weekly through IV reuse, ECB mode, and keys in repositories.',
            ),
            categorize(
              'Sort each mode.',
              ['Never use', 'Use with authentication', 'Modern default'],
              [
                { item: 'ECB', category: 'Never use' },
                { item: 'CBC', category: 'Use with authentication' },
                { item: 'CTR', category: 'Use with authentication' },
                { item: 'GCM', category: 'Modern default' },
              ],
              ['sk-block-modes'],
              'GCM bundles authentication in, which removes an entire class of mistake.',
            ),
            concept(
              'Randomness is a security primitive',
              'Cryptography consumes randomness constantly — keys, IVs, nonces, salts. Bad randomness has broken more systems than bad algorithms.\n\nThe critical distinction:\n\n**PRNG** (`Math.random`, `random.random`) — statistically random, fast, and **predictable**. Given enough output, the internal state can be recovered and every future value predicted. Perfectly fine for shuffling a deck in a game, catastrophic for a session token.\n\n**CSPRNG** (`crypto.randomBytes`, `secrets`, `/dev/urandom`) — seeded from genuine physical entropy and designed so past output does not reveal future output.\n\nThe rule is absolute: **anything security-relevant uses a CSPRNG.** Session tokens, password reset links, API keys, IVs, salts. Every one.\n\nThe historical failures are instructive. A 2008 Debian patch reduced OpenSSL’s entropy pool to about 32,000 possible values, so every SSH key generated on affected systems for two years was one of a small enumerable set. In 2010 Sony’s PlayStation 3 signing code reused the same nonce for every ECDSA signature, which allowed anyone to solve for the private key. Neither was a broken algorithm. Both were randomness.\n\nAnd this is a place where "it looks random" is no evidence at all. Predictable sequences pass statistical tests easily; what matters is whether an adversary who has seen output can compute the next value.',
              {
                keyTerms: [
                  { term: 'CSPRNG', definition: 'A generator whose output cannot be predicted from previous output.' },
                  { term: 'Nonce', definition: 'A number used once — reuse frequently destroys the scheme entirely.' },
                ],
              },
            ),
            interactive(
              'One bit in, half the bits out',
              'hash-avalanche',
              'Change a single character and compare the digests. This is the property that makes a hash usable as a fingerprint — there is no notion of "close", so you cannot work backwards by getting warmer.',
            ),
            mcq(
              'Why is Math.random unsuitable for a session token?',
              [
                'It is too slow',
                'Its output is predictable from observed values — an attacker can recover the state and compute future tokens',
                'It produces floats',
                'It is not uniform',
              ],
              1,
              ['sk-randomness'],
              'Statistically random and cryptographically useless are entirely compatible.',
            ),
            trueFalse(
              'Reusing a nonce with the same key can reveal the key or the plaintext.',
              true,
              ['sk-randomness'],
              'In CTR mode XORing two ciphertexts cancels the keystream; in ECDSA a repeated nonce lets you solve directly for the private key. Sony learned this publicly.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-crypto-1',
        title: 'Symmetric Checkpoint',
        passingScore: 0.7,
        exercises: [
          mcq(
            'Kerckhoffs’s principle says security should rest on what?',
            ['The algorithm being secret', 'The key alone', 'The implementation language', 'Network isolation'],
            1,
            ['sk-kerckhoffs'],
            'Keys rotate; designs leak.',
          ),
          mcq(
            'What does ECB mode leak?',
            ['The key', 'Structure — identical plaintext blocks give identical ciphertext', 'The message length only', 'Nothing'],
            1,
            ['sk-block-modes'],
            'Patterns survive encryption entirely.',
          ),
          trueFalse(
            'Math.random is acceptable for generating a password reset token.',
            false,
            ['sk-randomness'],
            'Predictable output means guessable reset links. Use a CSPRNG.',
          ),
        ],
      },
    },
    // -----------------------------------------------------------------------
    {
      id: 'unit-crypto-2',
      title: 'Public Keys and Proofs',
      description: 'Agreeing a secret in public, proving who you are, and what quantum changes.',
      lessons: [
        lesson({
          id: 'lesson-public-key',
          title: 'Key Exchange and Public-Key Cryptography',
          summary: 'Agreeing a shared secret over a channel someone is reading.',
          level: 'expert',
          domain: 'security',
          steps: [
            concept(
              'The problem symmetric encryption cannot solve',
              'Symmetric encryption needs both parties to already share a key. How do you share a key with a server you have never met, over a network an attacker is reading?\n\nUntil 1976 the answer was: you do not — you meet in person or use a courier. Which is why encrypted communication was the preserve of governments and banks.\n\n**Diffie–Hellman** solved it, and the mechanism is startling. Two parties agree a shared secret in public, and an eavesdropper who has seen *every message* cannot compute it.\n\nThe usual analogy is paint mixing. Alice and Bob publicly agree a common colour. Each privately picks a secret colour and mixes it with the common one, then sends the *mixture*. Each adds their own secret to the mixture they received. Both now hold common + secretA + secretB. An observer has the common colour and both mixtures, and separating a mixture back into its components is the hard part.\n\nMathematically the one-way operation is modular exponentiation: computing gᵃ mod p is easy, and recovering `a` from the result — the **discrete logarithm problem** — is believed to be infeasible for large p.\n\nThe critical limitation: plain Diffie–Hellman gives you a shared secret with *someone*, and says nothing about who. An attacker in the middle can run the exchange separately with each side. That is why key exchange must be **authenticated** — which is exactly what the certificate in a TLS handshake is for, connecting this directly back to the security track.',
              {
                keyTerms: [
                  { term: 'Diffie–Hellman', definition: 'Agreeing a shared secret over a public channel.' },
                  { term: 'Discrete logarithm', definition: 'Recovering the exponent — easy to compute forward, believed infeasible to invert.' },
                ],
              },
            ),
            mcq(
              'What does Diffie–Hellman achieve?',
              [
                'Encrypting a message',
                'Two parties agreeing a shared secret over a channel an eavesdropper is reading',
                'Proving identity',
                'Compressing a key',
              ],
              1,
              ['sk-key-exchange'],
              'A shared secret, not an identity. Which is why it must be paired with authentication.',
            ),
            mcq(
              'Plain Diffie–Hellman is vulnerable to which attack?',
              [
                'Brute force',
                'A machine in the middle running the exchange separately with each side',
                'Replay',
                'Timing',
              ],
              1,
              ['sk-key-exchange'],
              'It gives you a secret with *someone*. Certificates are what tell you who.',
            ),
            concept(
              'Two keys, and what each direction means',
              '**Public-key cryptography** gives each party a mathematically linked pair: a **public key** anyone may have, and a **private key** that never leaves.\n\nThe pair works in both directions, and the two directions do completely different jobs:\n\n**Encrypt with the public key** → only the private key can decrypt. This gives confidentiality: anyone can send you a secret, only you can read it.\n\n**Encrypt with the private key** → anyone with the public key can decrypt. Useless for secrecy, and exactly what you want for proof: only the holder of the private key could have produced it. This is a **signature**.\n\nRSA rests on factoring being hard; elliptic curve cryptography rests on the discrete logarithm over a curve, and gets equivalent security from much smaller keys — a 256-bit EC key is roughly comparable to a 3072-bit RSA key, which is why modern systems default to elliptic curves.\n\nPublic-key operations are orders of magnitude slower than symmetric ones, so nothing bulk is ever encrypted with them. Real protocols are **hybrid**: use public-key cryptography to authenticate and agree a symmetric key, then use AES for the data. That is precisely the TLS handshake — public key for the introduction, symmetric key for the conversation.',
              {
                figure: 'tls-handshake',
                keyTerms: [
                  { term: 'Hybrid encryption', definition: 'Public-key for key agreement, symmetric for the bulk data.' },
                ],
              },
            ),
            match(
              'Match each operation to what it provides.',
              [
                { left: 'Encrypt with the recipient’s public key', right: 'Confidentiality — only they can read it' },
                { left: 'Sign with your private key', right: 'Authenticity — only you could have made it' },
                { left: 'Diffie–Hellman exchange', right: 'A shared symmetric key' },
                { left: 'AES-GCM on the data', right: 'Fast bulk encryption, authenticated' },
              ],
              ['sk-public-key', 'sk-signatures'],
              'Every real protocol combines all four, because each does one job.',
            ),
            concept(
              'Signatures and non-repudiation',
              'A **digital signature** proves three things at once:\n\n**Authenticity** — it came from the holder of the private key.\n**Integrity** — it has not been altered since.\n**Non-repudiation** — the signer cannot plausibly deny it, since nobody else could have produced it.\n\nMechanically: hash the message, then encrypt the hash with the private key. Verifying means decrypting with the public key and comparing against a fresh hash of the received message. Hashing first is why signatures are fast and constant-size regardless of message length.\n\nThis is the mechanism behind a great deal of infrastructure you rely on daily. TLS certificates are signed by a CA. Software updates are signed so a compromised mirror cannot serve a modified binary. Git commits can be signed. JSON Web Tokens are signed so a server can trust a claim it issued without storing session state.\n\nThe distinction worth keeping sharp: a **MAC** (like HMAC) also proves integrity and authenticity, but uses a shared symmetric key — so either party could have produced it, and it therefore provides no non-repudiation. MACs are faster and right for two parties who already share a key. Signatures are right when third parties must verify, or when the signer must not be able to deny it.\n\nAnd the general rule, which bundles this unit together: **encryption without authentication is not enough.** An attacker who cannot read your message may still be able to modify it usefully. Authenticated encryption — GCM, or encrypt-then-MAC — is the default for this reason.',
              {
                keyTerms: [
                  { term: 'Digital signature', definition: 'Authenticity, integrity and non-repudiation via a private key.' },
                  { term: 'MAC', definition: 'Symmetric-key integrity and authenticity, with no non-repudiation.' },
                ],
              },
            ),
            mcq(
              'What does a digital signature provide that an HMAC does not?',
              [
                'Integrity',
                'Non-repudiation — only one party holds the private key, so the signer cannot deny it',
                'Speed',
                'Confidentiality',
              ],
              1,
              ['sk-signatures', 'sk-mac-aead'],
              'With a shared symmetric key, either party could have produced the MAC, so it proves nothing to a third party.',
            ),
            mcq(
              'Why is encryption without authentication insufficient?',
              [
                'It is slower',
                'An attacker who cannot read the message may still be able to modify it in a useful way',
                'Keys expire faster',
                'It cannot be decrypted',
              ],
              1,
              ['sk-mac-aead'],
              'Bit-flipping attacks on unauthenticated CTR-mode ciphertext change the plaintext predictably. Authenticated encryption closes this.',
            ),
            order(
              'Order what happens in a TLS handshake.',
              [
                'The server presents its certificate',
                'The client verifies the certificate chain to a trusted root',
                'Both sides run an authenticated key exchange',
                'A symmetric session key is derived',
                'Application data flows under authenticated symmetric encryption',
              ],
              ['sk-public-key', 'sk-key-exchange'],
              'Public-key for the introduction and the identity check, symmetric for everything after — hybrid by design.',
            ),
            concept(
              'What quantum computing actually breaks',
              'The quantum threat is real, specific, and routinely overstated. Two algorithms matter.\n\n**Shor’s algorithm** factors large integers and computes discrete logarithms in polynomial time on a sufficiently large quantum computer. That breaks **RSA, Diffie–Hellman and elliptic curve cryptography completely** — not weakens, breaks. All of public-key cryptography as currently deployed.\n\n**Grover’s algorithm** searches an unstructured space in √n instead of n. Against symmetric cryptography this is a **quadratic** speedup, which effectively halves the key length: AES-256 retains roughly 128 bits of security. That is an inconvenience, not a catastrophe — double the key size and you are fine.\n\nSo the summary is clean: **symmetric cryptography and hashing survive with larger parameters; public-key cryptography as deployed today does not.**\n\nThe machines capable of this do not exist. Current devices have hundreds of noisy qubits; breaking RSA-2048 needs millions of error-corrected ones. Estimates range from a decade to never.\n\nThe reason to act now is **harvest now, decrypt later**: an adversary can record encrypted traffic today and decrypt it when the hardware arrives. Anything that must stay secret for twenty years is already at risk.\n\nHence **post-quantum cryptography** — algorithms based on lattices, hashes and codes, which resist both classical and quantum attack. NIST standardised the first set in 2024, and the migration has started with hybrid schemes that run a classical and a post-quantum exchange together, so the result is secure if *either* holds.',
              {
                keyTerms: [
                  { term: 'Shor’s algorithm', definition: 'Quantum factoring and discrete logs — breaks deployed public-key cryptography.' },
                  { term: 'Harvest now, decrypt later', definition: 'Recording traffic today to decrypt once the hardware exists.' },
                ],
              },
            ),
            categorize(
              'What does quantum computing do to each?',
              ['Breaks it', 'Weakens it — use a larger parameter'],
              [
                { item: 'RSA', category: 'Breaks it' },
                { item: 'Elliptic curve cryptography', category: 'Breaks it' },
                { item: 'AES-256', category: 'Weakens it — use a larger parameter' },
                { item: 'SHA-256', category: 'Weakens it — use a larger parameter' },
              ],
              ['sk-post-quantum'],
              'Shor is exponential and specific to the structure public-key cryptography relies on. Grover is merely quadratic and applies to everything.',
            ),
            mcq(
              'Why migrate to post-quantum algorithms before quantum computers exist?',
              [
                'They are faster',
                'Traffic recorded today can be decrypted later, so long-lived secrets are already exposed',
                'They use less memory',
                'Regulations require it now',
              ],
              1,
              ['sk-post-quantum'],
              'Harvest now, decrypt later. The clock on a twenty-year secret started when it was transmitted.',
            ),
            shortAnswer(
              'A vendor offers "unbreakable proprietary 4096-bit military-grade encryption". What is wrong with that sentence?',
              ['kerckhoffs', 'proprietary', 'public', 'review', 'audit', 'unbreakable'],
              'Almost every word. "Proprietary" violates Kerckhoffs’s principle — an unexamined algorithm is untested, not unbroken, and security must rest on the key alone. "Unbreakable" is not a claim serious cryptographers make about anything. "Military-grade" is marketing with no technical meaning. And key size alone says nothing: a 4096-bit key in ECB mode, or with a predictable random number generator, or with no authentication, is broken regardless. I would ask which standardised algorithms and modes it uses, and who has publicly audited the implementation.',
              ['sk-kerckhoffs', 'sk-crypto-practice'],
              'Every phrase in that sentence is a signal to look harder, and the key size is the least informative part of it.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-crypto-2',
        title: 'Public Key Checkpoint',
        passingScore: 0.7,
        exercises: [
          mcq(
            'Signing uses which key?',
            ['The recipient’s public key', 'Your private key', 'A shared symmetric key', 'The CA’s key'],
            1,
            ['sk-signatures'],
            'Only you hold it, so only you could have produced the signature.',
          ),
          mcq(
            'Which does Shor’s algorithm break?',
            ['AES', 'SHA-256', 'RSA and elliptic curve cryptography', 'HMAC'],
            2,
            ['sk-post-quantum'],
            'Public-key cryptography specifically. Symmetric algorithms are only weakened.',
          ),
          trueFalse(
            'Encryption alone is enough — authentication is optional.',
            false,
            ['sk-mac-aead'],
            'An attacker who cannot read a message may still modify it usefully. Use authenticated encryption.',
          ),
        ],
      },
    },
  ],
};
