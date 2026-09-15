/**
 * Track 24 — Security Fundamentals.
 *
 * Defensive, and deliberately practical. The aim is not to make anyone a
 * security specialist but to make the common failures — bad password storage,
 * unparameterised queries, secrets in a repository — feel obviously wrong on
 * sight.
 */

import type { Track } from '../../domain/types';
import { categorize, concept, interactive, lesson, match, mcq, multi, order, shortAnswer, trueFalse } from '../builders';

export const securityTrack: Track = {
  id: 'track-security',
  title: 'Security Fundamentals',
  tagline: 'The failures that account for most real breaches',
  description:
    'Threat modelling, authentication, what hashing is for, why untrusted input is the root of most vulnerabilities, and how to handle secrets and dependencies. Defensive throughout — the goal is recognising a bad pattern before it ships.',
  domain: 'security',
  level: 'intro',
  icon: '🔐',
  gradient: ['#EF4444', '#F59E0B'],
  prerequisites: ['track-foundations'],
  outcomes: [
    'Threat model a feature: what is valuable, who wants it, what would they try',
    'Separate authentication from authorisation and place each correctly',
    'Explain why passwords are hashed with a slow function and never encrypted',
    'Recognise injection and XSS patterns and name the structural fix',
    'Keep secrets out of repositories and assess dependency risk',
  ],
  units: [
    // -----------------------------------------------------------------------
    {
      id: 'unit-sec-1',
      title: 'Thinking Like an Attacker',
      description: 'What you are protecting, from whom, and how much access anything needs.',
      lessons: [
        lesson({
          id: 'lesson-threat-modelling',
          title: 'Threat Modelling and Least Privilege',
          summary: 'Four questions, asked before you write the feature.',
          level: 'intro',
          domain: 'security',
          free: true,
          steps: [
            concept(
              'Four questions',
              'Security is not a feature you add. It is a property of decisions made throughout, and threat modelling is the cheap habit that makes those decisions visible.\n\nFor any feature, ask four questions:\n\n**What are we building?** Draw the data flow. Where does data enter, where is it stored, who reads it.\n\n**What can go wrong?** The usual taxonomy is STRIDE — Spoofing (pretending to be someone), Tampering (changing data), Repudiation (denying an action), Information disclosure (leaking), Denial of service, Elevation of privilege.\n\n**What are we doing about it?** Per threat: mitigate, transfer, accept, or remove the feature.\n\n**Did we do it well enough?** Revisit when the design changes.\n\nThe useful mental shift is from "is this secure?" — unanswerable — to "what would an attacker try, and what stops them?" — which has concrete answers.\n\nAnd be honest about who the attacker is. For most systems it is not a nation state; it is an automated scanner, a credential-stuffing bot, or an employee clicking a convincing email. Defending against realistic adversaries first is not cynicism, it is where the risk actually is.',
              {
                keyTerms: [
                  { term: 'Threat model', definition: 'An explicit account of what you protect, from whom, and how.' },
                  { term: 'STRIDE', definition: 'Spoofing, Tampering, Repudiation, Information disclosure, DoS, Elevation of privilege.' },
                ],
              },
            ),
            match(
              'Match each STRIDE category to an example.',
              [
                { left: 'Spoofing', right: 'Logging in as another user with stolen credentials' },
                { left: 'Tampering', right: 'Modifying a price in a request before it reaches the server' },
                { left: 'Information disclosure', right: 'An error page leaking a database connection string' },
                { left: 'Elevation of privilege', right: 'A normal user reaching an admin-only endpoint' },
              ],
              ['sk-threat-modelling'],
              'The taxonomy exists to make you enumerate systematically instead of imagining one attack and stopping.',
            ),
            mcq(
              'Why is "is this secure?" a poor question?',
              [
                'Security is not important at this stage',
                'It has no concrete answer; "what would an attacker try and what stops them" does',
                'Only specialists can answer it',
                'It depends on the programming language',
              ],
              1,
              ['sk-threat-modelling'],
              'Reframing to specific threats and specific mitigations makes the work tractable.',
            ),
            concept(
              'Least privilege and blast radius',
              'Every component should have the minimum access needed to do its job, and no more. Stated that way it sounds obvious; in practice almost everything is over-permissioned because over-permissioning is never what breaks.\n\nThe reasoning is about **blast radius**. You cannot prevent every compromise. What you can control is how much a single compromise is worth.\n\nA service that only reads from one table, using a database account that can only read that table, is a much smaller prize than the same service using an account that can drop schemas. Same bug, different outcome.\n\nThis shapes concrete choices:\n\n- Database accounts scoped per service, read-only where reads are all that is needed.\n- API tokens scoped to specific permissions and specific resources, with an expiry.\n- Cloud roles attached to workloads, not long-lived keys copied into config.\n- Admin capability separated from everyday capability, even for the same person.\n\nThe related principle is **defence in depth**: assume any single control will fail, and make sure something else is still standing. Input validation *and* parameterised queries. Network restrictions *and* authentication. Neither is redundant, because the assumption is that one of them will not hold.',
              {
                keyTerms: [
                  { term: 'Least privilege', definition: 'Granting only the access strictly required, for as long as required.' },
                  { term: 'Blast radius', definition: 'How much damage a single compromise can reach.' },
                ],
              },
            ),
            mcq(
              'A reporting service needs to read three tables. What database account should it use?',
              [
                'The application owner account, for simplicity',
                'An account with SELECT on exactly those three tables',
                'A read-write account scoped to the schema',
                'The same account every service uses',
              ],
              1,
              ['sk-least-privilege-security'],
              'If that service is compromised, the attacker gets three tables of reads — not the ability to modify anything.',
            ),
            trueFalse(
              'Validating input and using parameterised queries is redundant — one of them is enough.',
              false,
              ['sk-least-privilege-security'],
              'Defence in depth assumes one control will fail. Parameterisation is the structural fix; validation is the layer that still helps when something is missed.',
            ),
          ],
        }),
        lesson({
          id: 'lesson-authn-authz',
          title: 'Authentication and Authorisation',
          summary: 'Who are you, and what are you allowed to do. Two questions, two systems.',
          level: 'intro',
          domain: 'security',
          steps: [
            concept(
              'Two different questions',
              '**Authentication** establishes identity: are you who you claim to be? Passwords, tokens, hardware keys, biometrics.\n\n**Authorisation** establishes permission: given that you are Alice, may you do this? Roles, policies, ownership checks.\n\nConflating them causes a specific and very common bug class. A request arrives with a valid session, the code confirms the user is logged in, and then acts on `/orders/4471` **without checking whether that order belongs to this user**. That is authentication passing and authorisation missing — an *insecure direct object reference*, and it is one of the most frequently exploited web vulnerabilities precisely because the code looks fine.\n\nThe rule that prevents it: **authorise on every request, at the point of data access, against the specific object.** Not "is this user an admin" at the edge, but "may this user read *this row*" where the row is fetched.\n\nAuthentication factors come in three kinds — something you know (password), something you have (a phone, a security key), something you are (fingerprint). Multi-factor means factors from *different* kinds; two passwords are not two factors. And because password reuse is universal, a second factor is the single highest-value control available for account takeover, far outweighing password complexity rules.',
              {
                keyTerms: [
                  { term: 'Authentication', definition: 'Establishing who the requester is.' },
                  { term: 'Authorisation', definition: 'Deciding whether that requester may perform this action on this object.' },
                ],
              },
            ),
            mcq(
              'A logged-in user changes the id in /orders/4471 to /orders/4472 and sees someone else’s order. What failed?',
              [
                'Authentication',
                'Authorisation — the code never checked that this order belongs to this user',
                'Encryption',
                'Session management',
              ],
              1,
              ['sk-authn-authz'],
              'An insecure direct object reference. Authorise against the specific object at the point of access.',
            ),
            categorize(
              'Sort each check.',
              ['Authentication', 'Authorisation'],
              [
                { item: 'Verifying a password hash', category: 'Authentication' },
                { item: 'Validating a session token', category: 'Authentication' },
                { item: 'Confirming the user owns this document', category: 'Authorisation' },
                { item: 'Checking the role includes admin', category: 'Authorisation' },
              ],
              ['sk-authn-authz'],
              'Identity first, permission second, and the second must be per-object.',
            ),
            multi(
              'Which pairs count as genuine multi-factor authentication?',
              [
                'Password plus a code from a hardware key',
                'Password plus a security question',
                'Password plus a push approval on a registered phone',
                'Two different passwords',
              ],
              [0, 2],
              ['sk-authn-authz'],
              'Factors must come from different kinds. A security question is another thing you know.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-sec-1',
        title: 'Access Checkpoint',
        passingScore: 0.7,
        exercises: [
          mcq(
            'What does least privilege primarily limit?',
            ['The number of bugs', 'The blast radius of a compromise', 'Network latency', 'The number of users'],
            1,
            ['sk-least-privilege-security'],
            'You cannot prevent every compromise; you can decide how much one is worth.',
          ),
          trueFalse(
            'Confirming a user is logged in is sufficient before returning a record they requested by id.',
            false,
            ['sk-authn-authz'],
            'That is authentication only. You must also check they are permitted to read that specific record.',
          ),
          mcq(
            'Which STRIDE category covers a normal user reaching an admin endpoint?',
            ['Spoofing', 'Tampering', 'Elevation of privilege', 'Repudiation'],
            2,
            ['sk-threat-modelling'],
            'Gaining capabilities beyond the ones granted.',
          ),
        ],
      },
    },
    // -----------------------------------------------------------------------
    {
      id: 'unit-sec-2',
      title: 'Cryptography You Will Actually Use',
      description: 'Hashing versus encryption, storing passwords, and what a certificate proves.',
      lessons: [
        lesson({
          id: 'lesson-hashing',
          title: 'Hashing, and Storing Passwords',
          summary: 'One-way by design. Slow on purpose.',
          level: 'intro',
          domain: 'security',
          steps: [
            concept(
              'Hashing and encryption solve different problems',
              'These get conflated constantly, and the confusion causes real breaches.\n\n**Encryption** is two-way. You encrypt so that someone with the key can decrypt. Use it for data you need to read back — a stored API token, a message in transit, a database at rest.\n\n**Hashing** is one-way. A fixed-size fingerprint from which the input cannot be recovered. Use it when you need to *verify* something without storing it.\n\nA cryptographic hash has three properties that matter:\n\n**Deterministic** — the same input always gives the same digest.\n\n**Avalanche** — change one bit of input and roughly half the output bits flip. There is no "close" — similar inputs produce completely unrelated digests, which is why you cannot work backwards by getting warmer.\n\n**Collision resistant** — finding two inputs with the same digest is computationally infeasible.\n\nSo passwords are **hashed, never encrypted**. Encrypted passwords can be decrypted, which means a key compromise reveals every password in plaintext. Hashed passwords cannot be — verification works by hashing the submitted password and comparing digests. If a system can email you your existing password, it stored it recoverably, and that is a reportable design flaw.',
              {
                keyTerms: [
                  { term: 'Hash function', definition: 'A one-way map from arbitrary input to a fixed-size digest.' },
                  { term: 'Avalanche effect', definition: 'A one-bit input change flips about half the output bits.' },
                ],
              },
            ),
            interactive(
              'Watch the avalanche',
              'hash-avalanche',
              'Change a single character of the input and compare the two digests bit by bit. Note the proportion that flips — and that there is no relationship at all between how similar the inputs were and how similar the outputs are.',
            ),
            mcq(
              'Why are passwords hashed rather than encrypted?',
              [
                'Hashing is faster',
                'Encryption is reversible, so a stolen key would expose every password; hashes cannot be reversed',
                'Hashes are shorter',
                'Encryption is not supported by most databases',
              ],
              1,
              ['sk-hashing-vs-encryption'],
              'You never need to read a password back — only to check a submitted one. So do not store something readable.',
            ),
            trueFalse(
              'A service that can email you your current password is storing it securely.',
              false,
              ['sk-hashing-vs-encryption'],
              'If it can recover the plaintext, so can anyone who takes the database and the key.',
            ),
            concept(
              'Salt, and why slow is the point',
              'Hashing alone is not enough. Two further problems have to be solved.\n\n**Identical passwords produce identical hashes.** An attacker sees which users share a password, and can precompute hashes of common passwords once and look every user up at once (a rainbow table).\n\nThe fix is a **salt**: a unique random value per user, stored alongside the hash and mixed into it. Now identical passwords hash differently, and any precomputation must be redone per user. Salts are not secret — their job is uniqueness, not concealment.\n\n**General-purpose hashes are too fast.** SHA-256 is designed for speed; a GPU computes billions per second, so brute-forcing a weak password is quick.\n\nThe fix is a **deliberately slow** password-hashing function: **bcrypt**, **scrypt**, or **Argon2**. They take a work factor you tune so that one hash costs ~100 ms. Imperceptible at login, and it makes a brute-force campaign ten million times more expensive. Argon2 and scrypt also demand a lot of *memory*, which specifically defeats the GPU and ASIC parallelism that makes attacks cheap.\n\nSo the modern answer is: Argon2id (or bcrypt), per-user salt, a work factor you raise as hardware improves. And never a bare SHA-256, however many times you loop it yourself.',
              {
                keyTerms: [
                  { term: 'Salt', definition: 'A unique per-user random value mixed into the hash to defeat precomputation.' },
                  { term: 'Work factor', definition: 'A tunable cost parameter making each hash deliberately expensive.' },
                ],
              },
            ),
            mcq(
              'What problem does a salt solve?',
              [
                'It makes the hash irreversible',
                'It makes identical passwords hash differently, defeating precomputed tables',
                'It encrypts the password',
                'It speeds up verification',
              ],
              1,
              ['sk-password-storage'],
              'Uniqueness, not secrecy. Salts are stored in the clear next to the hash.',
            ),
            mcq(
              'Why is bcrypt preferred over SHA-256 for passwords?',
              [
                'It produces a longer digest',
                'It is deliberately slow with a tunable work factor, making brute force orders of magnitude more expensive',
                'It is newer',
                'It does not need a salt',
              ],
              1,
              ['sk-password-storage'],
              'SHA-256 being fast is a feature everywhere except here.',
            ),
            multi(
              'Which belong in a correct password storage scheme?',
              [
                'A per-user random salt',
                'Argon2id, scrypt, or bcrypt',
                'A tunable work factor raised over time',
                'Encrypting the hash with a reversible cipher',
              ],
              [0, 1, 2],
              ['sk-password-storage'],
              'The last adds a key to steal without adding protection.',
            ),
          ],
        }),
        lesson({
          id: 'lesson-tls-pki',
          title: 'TLS, Certificates, and Trust',
          summary: 'Encryption is the easy half. Knowing who you encrypted to is the hard half.',
          level: 'intermediate',
          domain: 'security',
          steps: [
            concept(
              'What a certificate actually proves',
              'TLS does two things, and only one of them is obvious.\n\n**Encryption** stops an eavesdropper reading the traffic. Straightforward.\n\n**Authentication** establishes that the server you encrypted to is the one you meant. Without it, encryption is useless — an attacker in the middle happily negotiates an encrypted channel with you and another with the real server, reading everything in between.\n\nA **certificate** is the mechanism: it binds a domain name to a public key, signed by a **certificate authority**. Your machine ships with a set of root CAs it trusts. Verification walks the chain from the server’s certificate up to one of those roots, checks each signature, checks the name matches, and checks it has not expired or been revoked.\n\nThe handshake then uses the certified public key to agree a symmetric session key, and everything after that is symmetric — because public-key cryptography is far too slow for bulk data.\n\nWhich explains two things you have seen. A **self-signed certificate** warning means the chain ends somewhere your machine does not trust — encryption without any proof of identity. And **disabling certificate verification** to make an error go away removes the entire authentication half while leaving the reassuring padlock behaviour intact. That single line of code is one of the most common serious mistakes in production systems.',
              {
                keyTerms: [
                  { term: 'Certificate chain', definition: 'The signature path from a server certificate up to a trusted root.' },
                  { term: 'Man in the middle', definition: 'An attacker relaying traffic between two parties who think they are talking directly.' },
                ],
              },
            ),
            mcq(
              'Why is encryption without authentication insufficient?',
              [
                'It is slower',
                'An attacker in the middle can negotiate encryption with each side and read everything',
                'The keys expire',
                'It cannot carry HTTP',
              ],
              1,
              ['sk-tls-pki'],
              'Encrypting to the wrong party is not protection. The certificate is what makes encryption meaningful.',
            ),
            mcq(
              'A developer disables certificate verification to silence a TLS error. What has been lost?',
              [
                'Nothing, the traffic is still encrypted',
                'The authentication half — any man in the middle is now accepted silently',
                'Only performance',
                'Compression',
              ],
              1,
              ['sk-tls-pki'],
              'Encryption survives and protection does not. Fix the trust store or the certificate instead.',
            ),
            order(
              'Order the TLS setup.',
              ['The client connects and requests a secure channel', 'The server presents its certificate chain', 'The client verifies the chain against a trusted root and checks the name', 'A symmetric session key is agreed', 'Application data flows encrypted with the session key'],
              ['sk-tls-pki'],
              'Public-key work happens once to establish a fast symmetric key for everything after.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-sec-2',
        title: 'Cryptography Checkpoint',
        passingScore: 0.7,
        exercises: [
          mcq(
            'When should you hash rather than encrypt?',
            [
              'When the data must be read back later',
              'When you only need to verify a value, never recover it',
              'When the data is large',
              'When performance matters',
            ],
            1,
            ['sk-hashing-vs-encryption'],
            'Verification without storage is exactly the hashing use case.',
          ),
          trueFalse(
            'Salts must be kept secret.',
            false,
            ['sk-password-storage'],
            'They are stored beside the hash. Their job is uniqueness, which defeats precomputation.',
          ),
          mcq(
            'What does a valid certificate chain establish?',
            [
              'That the traffic is compressed',
              'That a trusted authority vouches for this public key belonging to this domain',
              'That the server is not compromised',
              'That the connection is fast',
            ],
            1,
            ['sk-tls-pki'],
            'It binds a name to a key. It says nothing about whether the server behind it is well run.',
          ),
        ],
      },
    },
    // -----------------------------------------------------------------------
    {
      id: 'unit-sec-3',
      title: 'Untrusted Input and Supply Chain',
      description: 'The single root cause behind most vulnerabilities, plus secrets and dependencies.',
      lessons: [
        lesson({
          id: 'lesson-injection',
          title: 'Injection, XSS, and CSRF',
          summary: 'All the same bug: data crossing into a position where it is read as instructions.',
          level: 'intermediate',
          domain: 'security',
          steps: [
            concept(
              'Injection is a confusion between data and code',
              'Build a command by concatenating a string, and any input that contains the syntax of that language becomes part of the command.\n\n```\nquery = "SELECT * FROM users WHERE name = " + name\n```\n\nSupply a name containing a quote and a semicolon and the rest of your input is parsed as SQL. The database is behaving correctly; it received a query that says what the attacker wanted it to say.\n\nThe structural fix is **parameterised queries**. You send the query and the values along separate channels:\n\n```\nSELECT * FROM users WHERE name = ?\n```\n\nThe database parses the query *first*, then binds the value into an already-parsed slot. There is no path by which the value can become syntax — not because it was cleaned, but because it never reached the parser.\n\nThat distinction is the whole lesson. **Escaping is a filter you can get wrong; parameterisation is a structure that cannot be wrong.** Every escaping scheme has eventually been bypassed by an encoding somebody forgot.\n\nThe same shape recurs everywhere: shell injection (pass an argument list, not a string), path traversal (`../../etc/passwd`), template injection, LDAP injection. And prompt injection in LLM applications is the identical failure with a model as the interpreter — untrusted text arriving where instructions are read.',
              {
                keyTerms: [
                  { term: 'Parameterised query', definition: 'Query text and values sent separately, so values can never become syntax.' },
                  { term: 'Prompt injection', definition: 'The same data-as-instructions confusion, with a language model as the interpreter.' },
                ],
              },
            ),
            mcq(
              'Why is a parameterised query safer than escaping the input?',
              [
                'It is faster',
                'The query is parsed before the value is bound, so the value can never become syntax',
                'It validates the input type',
                'It encrypts the value',
              ],
              1,
              ['sk-injection'],
              'Structure rather than filtering. Escaping schemes get bypassed; separate channels cannot be.',
            ),
            multi(
              'Which are injection vulnerabilities of the same underlying kind?',
              [
                'Building a SQL query by string concatenation',
                'Passing user input into a shell command string',
                'Rendering user text into an HTML page unescaped',
                'Storing a password with bcrypt',
              ],
              [0, 1, 2],
              ['sk-injection'],
              'Each puts untrusted data where an interpreter reads instructions.',
            ),
            concept(
              'XSS and CSRF: the browser variants',
              'The browser adds two variations worth knowing by name.\n\n**XSS** (cross-site scripting) is injection into a page. Untrusted text is rendered into HTML without escaping, so `<script>` in a comment executes in every other visitor’s browser — with their session, their cookies, their permissions.\n\nThe fix is **context-aware output encoding**: escape when rendering, and escape differently depending on where the value lands. HTML body, an attribute, a URL, and inside a `<script>` block all have different rules. Modern frameworks escape by default, which is why XSS now tends to appear exactly where someone reached for the escape hatch — `dangerouslySetInnerHTML` and its equivalents. A **Content Security Policy** is the defence-in-depth layer underneath.\n\n**CSRF** (cross-site request forgery) is different and often misunderstood. The attacker cannot read your data; they make *your browser* send a request to a site you are logged into. The browser helpfully attaches your cookies, and the server sees an authenticated request it has no way to distinguish from a real one.\n\nThe fix is to require something the attacker cannot supply: an anti-CSRF **token** tied to the session and sent in the request body or a header, and `SameSite` cookie attributes so the browser will not attach cookies to cross-site requests at all. Note that the vulnerability exists *because* cookie authentication is automatic — token-in-header schemes are not exposed to it in the same way.',
              {
                keyTerms: [
                  { term: 'XSS', definition: 'Attacker-controlled script executing in another user’s page context.' },
                  { term: 'CSRF', definition: 'A victim’s browser being induced to send an authenticated request the user did not intend.' },
                ],
              },
            ),
            match(
              'Match each vulnerability to its fix.',
              [
                { left: 'SQL injection', right: 'Parameterised queries' },
                { left: 'XSS', right: 'Context-aware output encoding plus CSP' },
                { left: 'CSRF', right: 'Anti-CSRF tokens and SameSite cookies' },
                { left: 'Path traversal', right: 'Resolving and validating the path against an allowed root' },
              ],
              ['sk-xss-csrf'],
              'Each fix makes the dangerous construction structurally impossible rather than filtering for it.',
            ),
            mcq(
              'What makes CSRF possible in the first place?',
              [
                'Weak passwords',
                'The browser automatically attaching cookies to requests, including ones initiated by another site',
                'Unencrypted traffic',
                'Missing input validation',
              ],
              1,
              ['sk-xss-csrf'],
              'Ambient authority. The server cannot tell an intended request from an induced one without a token the attacker cannot read.',
            ),
          ],
        }),
        lesson({
          id: 'lesson-secrets-supply-chain',
          title: 'Secrets and Dependencies',
          summary: 'Two ways to be compromised by something you did not write.',
          level: 'intermediate',
          domain: 'security',
          steps: [
            concept(
              'Secrets do not belong in a repository',
              'An API key committed to Git is exposed for the life of the repository. Deleting it in a later commit does nothing — it is still in the history, still in every clone, still in every fork, and automated scanners find keys in public repositories within *minutes* of a push.\n\nWhere secrets should live instead:\n\n**Environment variables** — the baseline, injected at deploy. Better than a file in the repo, but visible in process listings and easily leaked into logs.\n\n**A secret manager** — Vault, AWS Secrets Manager, and their equivalents. Central storage, access control, an audit trail of who read what, and rotation without redeploying.\n\n**Workload identity** — the best option where available. The workload proves what it is and receives short-lived credentials automatically. There is no long-lived secret to leak because there is no long-lived secret.\n\nTwo practices matter as much as storage. **Rotation**: a secret that has never changed has an unbounded exposure window, and you cannot know who has seen it. And **assume any committed secret is compromised** — rotate it, do not just remove it. Rewriting history does not recall the copies.\n\nAlso watch the accidental leaks: secrets in log lines, in error messages returned to users, in crash reports, and in the environment dumps some frameworks helpfully print on an unhandled exception.',
              {
                keyTerms: [
                  { term: 'Secret rotation', definition: 'Regularly replacing credentials to bound the window of exposure.' },
                  { term: 'Workload identity', definition: 'Short-lived credentials issued to a proven workload, removing the long-lived secret.' },
                ],
              },
            ),
            mcq(
              'An API key was committed last month and removed in a later commit. What should you do?',
              [
                'Nothing, it is removed',
                'Treat it as compromised and rotate it — it remains in history, clones, and forks',
                'Rewrite history and keep the key',
                'Add it to .gitignore',
              ],
              1,
              ['sk-secrets-management'],
              'You cannot un-publish. Rotation is the only response that actually changes your exposure.',
            ),
            order(
              'Order these secret-handling approaches from weakest to strongest.',
              ['Hardcoded in the repository', 'Environment variables injected at deploy', 'A secret manager with access control and rotation', 'Short-lived credentials from workload identity'],
              ['sk-secrets-management'],
              'Each step shortens the lifetime of the secret and narrows who can read it.',
            ),
            concept(
              'You are running a lot of code you did not write',
              'A modern application pulls in hundreds of transitive dependencies. Every one of them runs with your application’s privileges. That is an enormous trusted surface, and it has been attacked repeatedly in practice.\n\nThe realistic risks:\n\n**A compromised maintainer account.** A popular package gets a malicious version published. It reaches thousands of builds before anyone notices.\n\n**Typosquatting.** A package named one character away from the one you meant, waiting for a typo.\n\n**Abandoned packages.** Unmaintained code with known vulnerabilities and nobody to fix them.\n\n**Deep transitive risk.** You vetted your ten direct dependencies; you did not vet their four hundred.\n\nWhat actually helps:\n\n- **Lock files**, committed. Builds are then reproducible and a new version cannot appear without a visible diff.\n- **Automated vulnerability scanning** in CI, so a newly disclosed CVE surfaces as a build signal rather than a news article.\n- **Review dependency updates** like code. A lock file diff that changes forty packages deserves a look.\n- **Fewer dependencies.** A trivial package pulled in for one function is a permanent trust decision made for a few minutes of convenience.\n- **Pin base images by digest**, not by a floating tag.\n\nThe honest framing: you cannot audit hundreds of packages. You can reduce how many there are, make changes visible, and be quick to respond when something is disclosed.',
              {
                keyTerms: [
                  { term: 'Lock file', definition: 'A pinned record of exact dependency versions making builds reproducible.' },
                  { term: 'Transitive dependency', definition: 'A dependency of a dependency, which you never chose but still run.' },
                ],
              },
            ),
            multi(
              'Which meaningfully reduce supply-chain risk?',
              [
                'Committing a lock file so version changes are visible in a diff',
                'Running vulnerability scanning in CI',
                'Preferring fewer dependencies',
                'Always upgrading to the newest version immediately on release',
              ],
              [0, 1, 2],
              ['sk-supply-chain'],
              'Instant upgrades adopt a compromised release fastest. Visibility and a smaller surface are the levers.',
            ),
            mcq(
              'Why is a lock file a security control and not just a build concern?',
              [
                'It encrypts the dependencies',
                'It pins exact versions, so a new or malicious release cannot enter the build without appearing in a diff',
                'It reduces install time',
                'It verifies maintainer identity',
              ],
              1,
              ['sk-supply-chain'],
              'Reproducibility means changes are visible, and visible changes can be reviewed.',
            ),
            shortAnswer(
              'A teammate proposes adding a 40-line utility package as a dependency to avoid writing one function. What would you weigh?',
              ['dependency', 'transitive', 'maintain', 'risk', 'surface'],
              'The 40 lines are not the cost — the trust decision is. That package runs with full application privileges, brings its own transitive dependencies, and becomes something to monitor and update indefinitely. I would check what it pulls in, how actively it is maintained, and how widely it is used, and weigh that against simply writing and testing the function ourselves. For something this small, vendoring or writing it is usually cheaper over the life of the project than carrying a permanent supply-chain obligation.',
              ['sk-supply-chain'],
              'Every dependency is a permanent trust decision, not a one-time convenience.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-sec-3',
        title: 'Input and Dependencies Checkpoint',
        passingScore: 0.7,
        exercises: [
          mcq(
            'What is the structural fix for SQL injection?',
            [
              'Escaping quotes in the input',
              'Parameterised queries, so values are bound after parsing and can never become syntax',
              'Validating input length',
              'Encrypting the database',
            ],
            1,
            ['sk-injection'],
            'Escaping is a filter you can get wrong; parameterisation removes the path entirely.',
          ),
          mcq(
            'CSRF is possible because of what browser behaviour?',
            [
              'JavaScript execution',
              'Cookies being attached automatically, including on requests initiated by other sites',
              'Caching',
              'Same-origin policy',
            ],
            1,
            ['sk-xss-csrf'],
            'Ambient authority. Tokens and SameSite remove it.',
          ),
          trueFalse(
            'Removing a committed API key in a later commit is enough to secure it.',
            false,
            ['sk-secrets-management'],
            'It remains in history and in every clone. Rotate it.',
          ),
        ],
      },
    },
  ],
};
