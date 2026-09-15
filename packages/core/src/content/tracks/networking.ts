/**
 * Track 22 — Networking & Distributed Systems.
 *
 * What happens between "the user clicked" and "the response rendered", and
 * what changes once one machine becomes several. The second half is the part
 * that bites: distributed systems fail partially, which is a failure mode
 * single machines simply do not have.
 */

import type { Track } from '../../domain/types';
import { categorize, concept, interactive, lesson, match, mcq, multi, numeric, order, shortAnswer, trueFalse } from '../builders';

export const networkingTrack: Track = {
  id: 'track-networking',
  title: 'Networking & Distributed Systems',
  tagline: 'From one request to many machines',
  description:
    'The path a request takes, what latency really costs, and what changes when a system spans machines that can fail independently. Covers CAP, consistency, idempotency, and the retry patterns that stop an outage from becoming a worse outage.',
  domain: 'networking',
  level: 'intermediate',
  icon: '🌐',
  gradient: ['#06B6D4', '#3B82F6'],
  prerequisites: ['track-foundations'],
  outcomes: [
    'Trace a request through DNS, TLS, and HTTP and say what each layer costs',
    'Distinguish latency from bandwidth and budget a request end to end',
    'Choose a caching layer and name how its entries become stale',
    'State the CAP trade-off precisely and pick a consistency model deliberately',
    'Make an operation idempotent and retry it without causing a thundering herd',
  ],
  units: [
    // -----------------------------------------------------------------------
    {
      id: 'unit-net-1',
      title: 'How a Request Travels',
      description: 'Layers, names, certificates, and the protocol on top.',
      lessons: [
        lesson({
          id: 'lesson-network-layers',
          title: 'Layers, DNS, and TLS',
          summary: 'Six things must happen before your server sees a single byte.',
          level: 'intro',
          domain: 'networking',
          free: true,
          steps: [
            concept(
              'Each layer hides the one below',
              'Networking is built as a stack, and each layer solves one problem so the layer above can ignore it.\n\n| Layer | Problem it solves | Example |\n|---|---|---|\n| Physical/Link | Getting bits to the next device | Ethernet, Wi-Fi |\n| Network (IP) | Routing across networks | IP addresses |\n| Transport (TCP/UDP) | Delivering to the right program | Ports, reliability |\n| Application | What the bytes mean | HTTP, SMTP |\n\n**IP** moves packets between machines and promises nothing — packets can be lost, duplicated, or arrive out of order.\n\n**TCP** builds reliability on top: it numbers the bytes, acknowledges them, retransmits what was lost, and reassembles in order. It also does congestion control, slowing down when the network is busy. That reliability costs a handshake (a round trip before any data moves) and head-of-line blocking (one lost packet stalls everything behind it).\n\n**UDP** skips all of it. No handshake, no retransmission, no ordering. This is the right choice when a late packet is worthless anyway — live video, games, DNS — because retransmitting a frame from 200 ms ago helps nobody.',
              {
                figure: 'network-layers',
                keyTerms: [
                  { term: 'TCP', definition: 'Reliable, ordered byte stream built on top of unreliable IP packets.' },
                  { term: 'UDP', definition: 'Fire-and-forget datagrams, for when retransmission would arrive too late to matter.' },
                ],
              },
            ),
            mcq(
              'Why does live video streaming often use UDP rather than TCP?',
              [
                'UDP has higher bandwidth',
                'A retransmitted frame would arrive after the moment it was needed, so dropping it beats stalling the stream',
                'UDP is encrypted by default',
                'TCP cannot carry video',
              ],
              1,
              ['sk-network-layers'],
              'TCP would stall every later frame waiting for one lost packet. For live media, a dropped frame is cheaper than a freeze.',
            ),
            categorize(
              'Sort each responsibility by layer.',
              ['Network (IP)', 'Transport (TCP)', 'Application'],
              [
                { item: 'Routing a packet toward its destination network', category: 'Network (IP)' },
                { item: 'Retransmitting a lost segment', category: 'Transport (TCP)' },
                { item: 'Delivering to the right port', category: 'Transport (TCP)' },
                { item: 'Deciding that this byte range is a JSON body', category: 'Application' },
              ],
              ['sk-network-layers'],
              'Each layer solves exactly one problem and hides it from the next.',
            ),
            concept(
              'Names and trust: DNS then TLS',
              'Before any request, two things must resolve.\n\n**DNS** turns a name into an address. Your resolver walks a hierarchy — root servers, then the `.com` servers, then the nameservers for your domain — and caches the answer for the record’s TTL. That TTL is why a DNS change takes time to propagate: you are waiting for other people’s caches to expire, and you cannot flush them.\n\n**TLS** then establishes an encrypted channel and, more importantly, an authenticated one. The server presents a certificate: its public key plus a signature from a certificate authority your machine already trusts. The chain is verified up to a root in your trust store, a session key is agreed, and everything afterwards is encrypted with it.\n\nThe cost is round trips. A cold connection needs a DNS lookup (up to ~50 ms), a TCP handshake (1 RTT), and a TLS handshake (1 RTT in TLS 1.3, 2 in TLS 1.2) — 100–200 ms before the first application byte moves on a typical connection.\n\nWhich is why connection reuse matters so much. HTTP keep-alive and connection pooling amortise that setup across many requests, and a client that opens a fresh connection per request pays it every single time.',
              {
                figure: 'request-path',
                keyTerms: [
                  { term: 'TTL', definition: 'How long a DNS answer may be cached before it must be looked up again.' },
                  { term: 'Certificate authority', definition: 'A trusted signer whose signature vouches for a server’s public key.' },
                ],
              },
            ),
            order(
              'Order what happens before the first byte of an HTTPS response arrives.',
              ['Resolve the hostname via DNS', 'Complete the TCP handshake', 'Complete the TLS handshake and verify the certificate', 'Send the HTTP request', 'Receive the first response byte'],
              ['sk-dns-tls'],
              'Three round-trip-bound steps before the request is even sent. Connection reuse skips the first three.',
            ),
            mcq(
              'Why does a DNS change not take effect immediately for everyone?',
              [
                'Root servers update slowly',
                'Resolvers worldwide cache the old answer until its TTL expires, and you cannot flush their caches',
                'DNS updates are batched hourly',
                'Certificates must be reissued first',
              ],
              1,
              ['sk-dns-tls'],
              'Lower the TTL *before* a planned change, not during it — the old TTL governs how long the old answer lingers.',
            ),
            trueFalse(
              'TLS provides encryption but not any assurance about who you are talking to.',
              false,
              ['sk-dns-tls'],
              'Certificate verification is the authentication half, and arguably the more important one. Encryption to an impostor is worthless.',
            ),
          ],
        }),
        lesson({
          id: 'lesson-http-apis',
          title: 'HTTP and API Design',
          summary: 'Methods and status codes mean things. Using them properly is free.',
          level: 'intro',
          domain: 'networking',
          steps: [
            concept(
              'Methods carry semantics',
              'HTTP methods are not interchangeable verbs. Each carries two properties that infrastructure relies on.\n\n**Safe** means it does not modify anything. **Idempotent** means doing it twice has the same effect as doing it once.\n\n| Method | Safe | Idempotent |\n|---|---|---|\n| GET | yes | yes |\n| PUT | no | yes |\n| DELETE | no | yes |\n| POST | no | **no** |\n| PATCH | no | usually not |\n\nThose columns are not documentation, they are contracts. Browsers, proxies, and CDNs cache GETs; clients and load balancers retry idempotent methods automatically. A GET that mutates state will be silently called by a link prefetcher and will corrupt something.\n\nStatus codes are similarly load-bearing. 2xx succeeded; 3xx go elsewhere; **4xx you got it wrong**; **5xx we got it wrong**. The 4xx/5xx line matters operationally: 5xx pages the on-call engineer, 4xx does not. Returning 500 for a validation error means your error budget and your alerts are both lying to you.',
              {
                keyTerms: [
                  { term: 'Idempotent', definition: 'Repeating the request has the same effect as making it once.' },
                  { term: 'Safe method', definition: 'A method that does not modify server state.' },
                ],
              },
            ),
            match(
              'Match each status code to its meaning.',
              [
                { left: '200', right: 'Success' },
                { left: '404', right: 'The client asked for something that does not exist' },
                { left: '429', right: 'The client is sending too many requests' },
                { left: '503', right: 'The server cannot handle it right now' },
              ],
              ['sk-http'],
              '4xx blames the client, 5xx blames the server. That boundary decides what wakes someone at 3am.',
            ),
            mcq(
              'Why is it a real problem for a GET endpoint to modify state?',
              [
                'GET requests are slower',
                'Caches, prefetchers, and retry logic all assume GET is safe, so they will call it without your intent',
                'GET has a body size limit',
                'It breaks TLS',
              ],
              1,
              ['sk-http'],
              'A link prefetcher will happily delete your records if you let DELETE hide behind a GET.',
            ),
            concept(
              'Designing a surface you can live with',
              'Good API design is mostly about making the obvious guess correct.\n\n**Model resources, not actions.** `POST /orders` and `DELETE /orders/42`, not `POST /createOrder` and `POST /deleteOrderById`. The verb is already in the method.\n\n**Be consistent.** If one endpoint returns `{"data": [...]}` and another returns a bare array, every client needs a special case for each. Pick one envelope and hold it everywhere.\n\n**Version from day one.** `/v1/` costs nothing now and is the only thing that lets you make a breaking change later without breaking everybody at once.\n\n**Paginate every collection.** An endpoint that returns all rows works fine until the table grows, then it times out — and it usually grows in production first. Cursor pagination beats offset pagination at scale, because `OFFSET 100000` still makes the database walk 100,000 rows.\n\n**Return structured errors.** `{"error": {"code": "insufficient_funds", "message": "..."}}` lets a client branch on the code. A bare string forces it to match on prose that you will inevitably reword.\n\nThe thread through all of these: an API is a contract you cannot unilaterally change once someone depends on it. Design for the version after this one.',
              {
                keyTerms: [
                  { term: 'Cursor pagination', definition: 'Paging by a pointer to the last item rather than an offset, so cost stays constant.' },
                ],
              },
            ),
            multi(
              'Which are sound API design choices?',
              [
                'DELETE /orders/42 rather than POST /deleteOrder',
                'Paginating every collection endpoint',
                'Returning 500 for validation failures',
                'Including a machine-readable error code alongside the message',
              ],
              [0, 1, 3],
              ['sk-api-design'],
              'Validation failures are the client’s error: 400 or 422. A 500 there pollutes your alerting.',
            ),
            mcq(
              'Why does cursor pagination outperform offset pagination on large tables?',
              [
                'Cursors are shorter strings',
                'OFFSET makes the database walk and discard every skipped row, so deep pages get progressively slower',
                'Cursors can be cached',
                'Offsets are not supported by all databases',
              ],
              1,
              ['sk-api-design'],
              'Page 5,000 with OFFSET reads 100,000 rows to return 20. A cursor seeks directly via the index.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-net-1',
        title: 'Request Path Checkpoint',
        passingScore: 0.7,
        exercises: [
          mcq(
            'What does TCP add on top of IP?',
            ['Encryption', 'Reliable, ordered delivery with retransmission', 'Name resolution', 'Compression'],
            1,
            ['sk-network-layers'],
            'IP promises nothing; TCP builds a reliable stream on top of it.',
          ),
          trueFalse(
            'POST is idempotent.',
            false,
            ['sk-http'],
            'Two POSTs usually create two resources. PUT and DELETE are the idempotent mutating methods.',
          ),
          mcq(
            'A cold HTTPS connection costs roughly how many round trips before the request is sent?',
            ['Zero', 'One', 'Two to three, counting DNS, TCP, and TLS', 'Ten'],
            2,
            ['sk-dns-tls'],
            'Which is why connection pooling and keep-alive matter so much for latency.',
          ),
        ],
      },
    },
    // -----------------------------------------------------------------------
    {
      id: 'unit-net-2',
      title: 'Latency and Scale',
      description: 'Budgets, caches, and spreading load across machines.',
      lessons: [
        lesson({
          id: 'lesson-latency-caching',
          title: 'Latency Budgets and Caching',
          summary: 'Bandwidth you can buy. Latency is bounded by physics.',
          level: 'intermediate',
          domain: 'networking',
          steps: [
            concept(
              'Latency and bandwidth are not the same resource',
              '**Bandwidth** is how much data per second. **Latency** is how long before the first byte arrives. Upgrading your connection improves the first and barely touches the second.\n\nLatency has a floor set by the speed of light. London to New York is 5,600 km; light in fibre covers it in about 28 ms one way, 56 ms round trip, and real routing makes it closer to 70. No amount of money reduces that.\n\nSo a request that makes ten sequential cross-Atlantic calls costs 700 ms *of pure waiting*, whatever your servers do. The fixes are structural, not financial:\n\n- **Parallelise.** Ten independent calls at once cost one round trip, not ten.\n- **Batch.** One request for 100 items beats 100 requests for one — this is the N+1 query problem, and it is the same shape as the syscall batching in the OS track.\n- **Move the data closer.** A CDN edge node turns a 150 ms trip into a 10 ms one.\n- **Do not make the call.** A cache hit costs zero round trips.\n\nSequential dependent calls are the thing to hunt for. They are usually invisible in code — a loop calling a function that happens to make a request — and they dominate the budget completely.',
              {
                keyTerms: [
                  { term: 'Round-trip time', definition: 'Time for a request to reach the server and the response to return.' },
                  { term: 'N+1 problem', definition: 'One query for a list, then one more per item — a latency disaster at any size.' },
                ],
              },
            ),
            interactive(
              'Build a latency budget',
              'latency-budget',
              'Assemble a request from DNS, TLS, server time, and database calls, then switch the dependent calls to parallel and watch the total collapse. The point is which changes matter and which are rounding errors.',
            ),
            numeric(
              'A request makes 8 sequential calls, each with a 40 ms round trip. How many milliseconds is spent waiting?',
              320,
              ['sk-latency-bandwidth'],
              '8 × 40 = 320 ms of pure network wait. Issued in parallel it would be 40 ms.',
            ),
            mcq(
              'Doubling your bandwidth has the least effect on which workload?',
              [
                'Downloading a 4 GB model checkpoint',
                'An API making many small sequential requests',
                'Streaming high-bitrate video',
                'Uploading a dataset',
              ],
              1,
              ['sk-latency-bandwidth'],
              'Small requests are latency-bound. The pipe was never full; you were waiting on round trips.',
            ),
            concept(
              'Caching, and the hard part of caching',
              'A cache stores a result so the expensive path is not repeated. They stack, and each layer has a different invalidation story:\n\n| Layer | Lives | Invalidation |\n|---|---|---|\n| Browser | On the user’s device | Cache-Control headers; you cannot reach it |\n| CDN | At edge locations | Purge API, or wait for TTL |\n| Application (Redis) | Near your servers | You control it directly |\n| Database buffer pool | In the database | Automatic |\n\nThe hard part is never storing. It is knowing when the stored value became wrong.\n\nThree strategies, all imperfect. **TTL** expiry is simple and means you serve stale data for up to the TTL. **Explicit invalidation** on write is precise and easy to miss a path for. **Write-through** updates cache and store together and adds latency to every write.\n\nTwo failure modes worth naming because they take systems down. A **cache stampede**: a hot key expires, a thousand concurrent requests all miss, and all thousand hit the database at once — fixed by locking so one request recomputes while the others wait, or by refreshing slightly early. And the **thundering herd** after a cache restart, when *everything* misses simultaneously.\n\nThe cost of a cache is always the same: you have accepted staleness in exchange for speed. Be explicit about how stale is acceptable, because that number is a product decision, not a technical one.',
              {
                keyTerms: [
                  { term: 'TTL expiry', definition: 'Entries expire after a fixed time, bounding staleness without tracking writes.' },
                  { term: 'Cache stampede', definition: 'Many concurrent misses on one expired hot key overwhelming the origin.' },
                ],
              },
            ),
            mcq(
              'A popular cache key expires and the database immediately spikes to 100% CPU. What happened?',
              [
                'The cache was too small',
                'A stampede — many concurrent requests all missed and recomputed the same value at once',
                'The TTL was too long',
                'Replication lag',
              ],
              1,
              ['sk-caching-layers'],
              'Let one request recompute while the rest wait on it, or refresh the entry before it expires.',
            ),
            multi(
              'Which are genuine costs of adding a cache?',
              [
                'Serving data that is out of date',
                'A new failure mode when the cache itself goes down',
                'Slower reads on a hit',
                'Invalidation logic that must cover every write path',
              ],
              [0, 1, 3],
              ['sk-caching-layers'],
              'Hits are faster; that is the point. Everything else on the list is the bill.',
            ),
          ],
        }),
        lesson({
          id: 'lesson-load-balancing',
          title: 'Load Balancing and Queues',
          summary: 'Spreading work across machines, and decoupling who does it from when.',
          level: 'intermediate',
          domain: 'networking',
          steps: [
            concept(
              'Horizontal scale needs statelessness',
              'Vertical scaling means a bigger machine. It is simple, and it ends — there is a largest machine, and it is expensive long before it is the largest.\n\nHorizontal scaling means more machines behind a **load balancer** that distributes requests. Round robin, least-connections, or hashing by a key.\n\nThe prerequisite is that your servers are **stateless**: any server can handle any request. Keep session data in server memory and a user’s second request may land elsewhere and find nothing. The fixes are sticky sessions (which undermine even distribution and break when a node dies) or, far better, putting session state in a shared store.\n\nA load balancer also needs **health checks**, and the check should exercise the real dependencies. A check that only proves the process is running will keep routing traffic to an instance whose database connection died. And it needs **drain on deploy** — stop sending new requests, let in-flight ones finish, then stop the instance — or every deploy drops requests.',
              {
                keyTerms: [
                  { term: 'Stateless server', definition: 'One that holds no per-user state between requests, so any instance can serve anyone.' },
                  { term: 'Health check', definition: 'A probe deciding whether an instance should receive traffic.' },
                ],
              },
            ),
            mcq(
              'Users are randomly logged out after you scale to four servers. What is the likely cause?',
              [
                'The load balancer is misconfigured',
                'Session state is held in server memory, so requests landing on a different instance find nothing',
                'TLS certificates differ per instance',
                'DNS is round-robining',
              ],
              1,
              ['sk-load-balancing'],
              'The classic first bug of horizontal scaling. Move sessions to a shared store rather than reaching for sticky sessions.',
            ),
            trueFalse(
              'A health check that only confirms the process is alive is sufficient.',
              false,
              ['sk-load-balancing'],
              'It will happily route traffic to an instance that cannot reach its database. Check the dependencies the request actually needs.',
            ),
            concept(
              'Queues: decoupling producer from consumer',
              'Some work does not need to happen inside the request. Sending an email, generating a thumbnail, running inference on an uploaded file — the user does not need to wait, and making them wait couples your response time to a slow dependency.\n\nA **queue** lets the request enqueue a job and return immediately. Workers consume at their own pace. Four things follow:\n\n**Absorbing spikes.** A traffic burst grows the queue instead of timing out requests. The queue is a shock absorber.\n\n**Independent scaling.** Ten web servers, two workers, or the reverse — whatever the load actually needs.\n\n**Isolation.** The email provider going down delays emails; it does not fail signups.\n\n**Retries.** A failed job goes back on the queue, and one that keeps failing lands in a dead-letter queue for a human, instead of vanishing.\n\nThe costs are real. The system is now **eventually consistent** — the user is told "we sent it" before it was sent. Debugging spans two systems. And delivery is **at-least-once** in nearly every real queue, so a job can run twice. Which is why the next lesson is about idempotency: if a handler cannot safely run twice, a queue will eventually corrupt your data.',
              {
                keyTerms: [
                  { term: 'Dead-letter queue', definition: 'Where a job goes after repeated failures, so it is inspected rather than lost.' },
                  { term: 'At-least-once delivery', definition: 'A message may be delivered more than once, so handlers must tolerate repeats.' },
                ],
              },
            ),
            multi(
              'Which are good candidates for moving out of the request path into a queue?',
              [
                'Sending a confirmation email',
                'Validating the submitted form',
                'Generating video thumbnails',
                'Re-indexing a document for search',
              ],
              [0, 2, 3],
              ['sk-queues-events'],
              'Validation must happen before you respond — its result changes the response. The rest can happen afterwards.',
            ),
            mcq(
              'Most queues guarantee at-least-once delivery. What does that require of your job handlers?',
              [
                'They must be fast',
                'They must be idempotent, because a job can be delivered and executed more than once',
                'They must run on a single worker',
                'They must be written in the same language as the producer',
              ],
              1,
              ['sk-queues-events'],
              'Exactly-once delivery is essentially unavailable. Exactly-once *effect* comes from idempotent handlers.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-net-2',
        title: 'Scale Checkpoint',
        passingScore: 0.7,
        exercises: [
          numeric(
            'Five sequential calls at 60 ms round trip each. How many milliseconds of network wait?',
            300,
            ['sk-latency-bandwidth'],
            '5 × 60 = 300 ms. Parallelised, 60 ms.',
          ),
          mcq(
            'What must be true before you can scale horizontally without sticky sessions?',
            [
              'All servers run the same OS',
              'Servers are stateless, with session data in a shared store',
              'The load balancer uses least-connections',
              'Each server has its own database',
            ],
            1,
            ['sk-load-balancing'],
            'Any server must be able to serve any request.',
          ),
          trueFalse(
            'Moving work into a queue makes the system eventually consistent from the user’s point of view.',
            true,
            ['sk-queues-events'],
            'You respond before the work is done. That is the trade you accepted for responsiveness.',
          ),
        ],
      },
    },
    // -----------------------------------------------------------------------
    {
      id: 'unit-net-3',
      title: 'Distributed Reality',
      description: 'Partial failure, the CAP trade-off, and retrying without making it worse.',
      lessons: [
        lesson({
          id: 'lesson-cap',
          title: 'CAP and Consistency Models',
          summary: 'The network will partition. You only get to choose what happens then.',
          level: 'expert',
          domain: 'networking',
          steps: [
            concept(
              'CAP, stated precisely',
              'The CAP theorem is usually stated as "pick two of consistency, availability, and partition tolerance", and that framing is misleading enough to be harmful.\n\nPartitions are not a choice. Networks drop packets, links fail, a switch reboots. If your system spans machines, partitions **will** happen. So P is not on the menu.\n\nThe real statement is narrower and more useful: *when a partition occurs*, you must choose between consistency and availability.\n\n**CP** — refuse to serve rather than risk returning wrong data. A bank ledger does this. During a partition, the minority side stops accepting writes.\n\n**AP** — keep serving from whatever you can reach and reconcile afterwards. A shopping cart or a social feed does this: showing a slightly stale like count is obviously better than showing an error page.\n\nAnd the choice is per-operation, not per-system. The same product can be CP for payments and AP for the recommendations sidebar. Framing it as a system-wide architectural stance is how teams end up paying consensus latency for a view counter.\n\nThe extension worth knowing is **PACELC**: during a Partition choose A or C, Else — in normal operation — choose between Latency and Consistency. Even with no partition, strong consistency across regions costs a round trip.',
              {
                keyTerms: [
                  { term: 'Partition', definition: 'A network failure splitting nodes into groups that cannot reach each other.' },
                  { term: 'PACELC', definition: 'CAP plus the latency-versus-consistency trade that applies even without a partition.' },
                ],
              },
            ),
            mcq(
              'What is the most accurate statement of CAP?',
              [
                'You can have any two of consistency, availability, and partition tolerance',
                'When a network partition occurs, you must choose between consistency and availability',
                'Distributed systems cannot be consistent',
                'Availability and consistency are the same property',
              ],
              1,
              ['sk-cap-theorem'],
              'Partitions are imposed on you. CAP is about what you do during one.',
            ),
            categorize(
              'Which behaviour would you want during a partition?',
              ['Prefer consistency (refuse)', 'Prefer availability (serve stale)'],
              [
                { item: 'Transferring money between accounts', category: 'Prefer consistency (refuse)' },
                { item: 'Decrementing the last unit of inventory', category: 'Prefer consistency (refuse)' },
                { item: 'Showing a post like count', category: 'Prefer availability (serve stale)' },
                { item: 'Serving a recommendations sidebar', category: 'Prefer availability (serve stale)' },
              ],
              ['sk-cap-theorem'],
              'Per-operation, not per-system. Wrong money is unacceptable; a stale like count is not.',
            ),
            concept(
              'The consistency spectrum',
              'Between "every read sees the latest write" and "reads see something, eventually" there is a useful middle ground, and most production systems live in it.\n\n**Strong (linearizable)** — every read sees the most recent committed write, as if there were one copy. Requires coordination, so it costs a round trip between replicas on every operation.\n\n**Sequential** — everyone sees operations in the same order, but not necessarily immediately.\n\n**Causal** — operations that are causally related appear in order everywhere. A reply never appears before the comment it replies to. Unrelated operations may be seen in different orders by different observers, and nobody notices.\n\n**Eventual** — replicas converge if writes stop. Cheapest, and weaker than people assume: without extra guarantees you can read your own write and not see it.\n\nTwo session guarantees are usually what teams actually need, and they are far cheaper than full linearizability. **Read-your-writes**: you always see your own changes. **Monotonic reads**: you never see time go backwards.\n\nMost "we need strong consistency" requirements dissolve on inspection into "the user must see their own edit". That is read-your-writes, and it is one routing rule rather than a consensus protocol.',
              {
                keyTerms: [
                  { term: 'Linearizable', definition: 'Behaves as though there were one copy and operations happened instantaneously.' },
                  { term: 'Read-your-writes', definition: 'A session guarantee that you always observe your own prior writes.' },
                ],
              },
            ),
            order(
              'Order these consistency models from strongest to weakest.',
              ['Linearizable', 'Sequential', 'Causal', 'Eventual'],
              ['sk-consistency-models'],
              'Each step down removes coordination and buys latency and availability.',
            ),
            mcq(
              'A user edits their bio and still sees the old one on refresh. Which guarantee is missing?',
              ['Linearizability', 'Read-your-writes', 'Monotonic reads', 'Causal consistency'],
              1,
              ['sk-consistency-models'],
              'Route a user’s reads to the primary (or to a replica known to be caught up) for a window after they write. Cheap, and it fixes the complaint.',
            ),
          ],
        }),
        lesson({
          id: 'lesson-reliability',
          title: 'Idempotency, Retries, and Backoff',
          summary: 'The request timed out. Did it happen? You cannot know.',
          level: 'expert',
          domain: 'networking',
          steps: [
            concept(
              'The two generals problem, every day',
              'You send a payment request. It times out. Did the payment go through?\n\nYou genuinely cannot tell. The request may never have arrived, or it may have been processed and the *response* lost. From the client, those are indistinguishable.\n\nRetry and you might charge twice. Do not retry and you might charge zero times.\n\nThe resolution is not cleverer networking — it is making retrying safe. An **idempotency key**: the client generates a unique id for the *intent* and sends it with the request. The server records the key with the result. On a repeat, it recognises the key and returns the stored result without doing the work again.\n\nThis is why Stripe, and every payments API worth using, requires an idempotency key on charges. The client can then retry freely, which is the only way to build reliability on an unreliable network.\n\nThe general principle: exactly-once *delivery* is impossible, but exactly-once *effect* is achievable, by making the operation idempotent and retrying until you get an answer.\n\nSome operations are naturally idempotent. `SET status = \'shipped\'` is; `increment counter` is not. Where you have the choice, prefer the absolute form over the relative one.',
              {
                keyTerms: [
                  { term: 'Idempotency key', definition: 'A client-supplied id letting the server recognise and deduplicate a retry.' },
                  { term: 'Exactly-once effect', definition: 'Achieved by idempotent handling plus retries, unlike exactly-once delivery.' },
                ],
              },
            ),
            mcq(
              'A payment request times out with no response. What is the safe way to retry?',
              [
                'Send the identical request again',
                'Send it again with the same idempotency key, so the server deduplicates if the first one landed',
                'Wait an hour and check manually',
                'Never retry payments',
              ],
              1,
              ['sk-idempotency'],
              'The key turns an unanswerable question into a safe one.',
            ),
            categorize(
              'Which operations are naturally idempotent?',
              ['Idempotent', 'Not idempotent'],
              [
                { item: 'SET status = shipped', category: 'Idempotent' },
                { item: 'DELETE /orders/42', category: 'Idempotent' },
                { item: 'Increment a view counter', category: 'Not idempotent' },
                { item: 'Append a row to a log table', category: 'Not idempotent' },
              ],
              ['sk-idempotency'],
              'Absolute assignments repeat harmlessly; relative changes accumulate.',
            ),
            concept(
              'Retry without causing the next outage',
              'Retrying is necessary. Retrying naively is how a brief blip becomes a sustained outage.\n\n**Immediate retries** hit a struggling service hardest exactly when it is least able to cope. **Fixed-interval retries** synchronise every client into waves.\n\nThe standard combination is three things together:\n\n**Exponential backoff** — wait 1s, 2s, 4s, 8s. Pressure falls off fast.\n\n**Jitter** — randomise each delay. Without it, a thousand clients that failed at the same moment retry at the same moment, forever, in lockstep. Jitter is the part people omit and the part that matters most.\n\n**A cap** — on both the delay and the attempt count. Infinite retries turn a failed job into a permanent load source.\n\nAbove that sits the **circuit breaker**. After N consecutive failures, stop trying entirely for a cooldown, failing fast instead. Then let a single probe request through; if it succeeds, close the circuit. This protects the struggling service from you *and* protects you from spending your own capacity waiting on timeouts.\n\nThe failure mode all of this prevents is the **thundering herd** — and note that it is the same pattern as the cache stampede. Many clients, one moment, one dependency.',
              {
                keyTerms: [
                  { term: 'Jitter', definition: 'Randomness added to backoff so clients do not retry in synchronised waves.' },
                  { term: 'Circuit breaker', definition: 'Failing fast after repeated failures, with periodic probes to test recovery.' },
                ],
              },
            ),
            mcq(
              'Why is jitter essential in a retry policy?',
              [
                'It makes retries faster',
                'Without it, all clients that failed together retry together, recreating the spike that caused the failure',
                'It reduces bandwidth',
                'It is required by HTTP',
              ],
              1,
              ['sk-retries-backoff'],
              'Backoff spreads retries in time; only jitter spreads them across clients.',
            ),
            multi(
              'Which belong in a production retry policy?',
              [
                'Exponential backoff',
                'Random jitter on each delay',
                'A maximum attempt count',
                'Retrying non-idempotent writes without an idempotency key',
              ],
              [0, 1, 2],
              ['sk-retries-backoff'],
              'The last one is how you charge a customer three times.',
            ),
            shortAnswer(
              'A downstream service slows down. Your service retries three times per request with no backoff, and both services collapse. Explain the cascade and what you would change.',
              ['retry', 'backoff', 'jitter', 'circuit', 'load'],
              'Each slow request became three, so the offered load tripled exactly when the downstream service was already struggling — and because your own threads were blocked waiting on timeouts, your service ran out of capacity too. I would add exponential backoff with jitter so retry pressure falls off and clients desynchronise, cap the attempts, and put a circuit breaker in front of the dependency so that after repeated failures we fail fast instead of queueing up on timeouts. Shorter timeouts would also stop one slow dependency from consuming all our request handlers.',
              ['sk-retries-backoff'],
              'Retry amplification plus resource exhaustion from blocked threads. Backoff, jitter, caps, a circuit breaker, and tighter timeouts.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-net-3',
        title: 'Distributed Systems Checkpoint',
        passingScore: 0.7,
        exercises: [
          mcq(
            'During a network partition, a CP system will do what?',
            [
              'Serve possibly stale data from both sides',
              'Refuse writes on the side that cannot reach a quorum, preserving correctness',
              'Merge conflicting writes automatically',
              'Shut down entirely',
            ],
            1,
            ['sk-cap-theorem'],
            'Consistency over availability: better to decline than to be wrong.',
          ),
          mcq(
            'What makes a retried payment safe?',
            [
              'Exponential backoff',
              'An idempotency key the server uses to recognise and deduplicate the repeat',
              'HTTPS',
              'A shorter timeout',
            ],
            1,
            ['sk-idempotency'],
            'Backoff controls when you retry; the key controls whether retrying is safe at all.',
          ),
          trueFalse(
            'Exponential backoff without jitter is sufficient to prevent a thundering herd.',
            false,
            ['sk-retries-backoff'],
            'It spreads retries over time but leaves every client synchronised with every other.',
          ),
        ],
      },
    },
  ],
};
