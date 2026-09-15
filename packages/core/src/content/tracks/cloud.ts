/**
 * Track 31 — Cloud & Infrastructure.
 *
 * Where software actually runs, and who is responsible for which part of it
 * when something breaks. The operations half of the job, which is invisible
 * until the first incident and then is the whole job.
 */

import type { Track } from '../../domain/types';
import { categorize, concept, interactive, lesson, match, mcq, multi, numeric, order, shortAnswer, trueFalse } from '../builders';

export const cloudTrack: Track = {
  id: 'track-cloud',
  title: 'Cloud & Infrastructure',
  tagline: 'Where it runs, what it costs, and who gets paged',
  description:
    'Service models and what each still leaves you owning, virtual machines and orchestration, serverless and its trade-offs, infrastructure as code, observability, and cost as a first-class engineering constraint.',
  domain: 'cloud',
  level: 'intermediate',
  icon: '☁️',
  gradient: ['#0EA5E9', '#A78BFA'],
  prerequisites: ['track-os'],
  outcomes: [
    'Say what IaaS, PaaS and serverless each stop you having to run',
    'Choose between a VM, a container platform and a function, with reasons',
    'Describe infrastructure in code rather than in a console and a memory',
    'Instrument a service so an incident is diagnosable rather than mysterious',
    'Treat cost as a design constraint instead of a monthly surprise',
    'Set an RPO and an RTO and design backwards from them',
  ],
  units: [
    // -----------------------------------------------------------------------
    {
      id: 'unit-cloud-1',
      title: 'Where Code Runs',
      description: 'Service models, machines, containers, and functions.',
      lessons: [
        lesson({
          id: 'lesson-service-models',
          title: 'Service Models and Shared Responsibility',
          summary: 'Each layer you stop running is a layer you stop being able to fix.',
          level: 'intro',
          domain: 'cloud',
          free: true,
          steps: [
            concept(
              'The stack, and where the line is drawn',
              'Running software means a stack of concerns, and cloud service models differ only in where the provider’s responsibility stops and yours begins.\n\n| | You run | They run |\n|---|---|---|\n| On premises | Everything | Nothing |\n| IaaS | OS, runtime, app, data | Hardware, network, virtualisation |\n| PaaS | App, data | Everything below |\n| Serverless | Functions, data | Everything below, including capacity |\n| SaaS | Configuration | Everything |\n\nEach step up removes work and removes control, and both halves are real. On IaaS you can tune kernel parameters and you must patch the kernel. On a PaaS you cannot do either.\n\nThe idea that matters operationally is **shared responsibility**, because it is routinely misread. The provider secures the cloud; you secure what you put in it. AWS will not stop you making a storage bucket public, will not fix your SQL injection, and will not notice that your access key is in a public repository. Every large cloud breach of the last decade has been on the customer side of that line.\n\nThe corollary for choosing: pick the highest level that does what you need. Running your own Kubernetes cluster to serve a website is a decision to employ someone to run a Kubernetes cluster.',
              {
                figure: 'shared-responsibility',
                keyTerms: [
                  { term: 'Shared responsibility', definition: 'The provider secures the infrastructure; you secure your configuration and code.' },
                  { term: 'IaaS', definition: 'Rented machines — you still own the OS upward.' },
                ],
              },
            ),
            categorize(
              'Who is responsible?',
              ['The provider', 'You'],
              [
                { item: 'Physical datacentre security', category: 'The provider' },
                { item: 'Hypervisor patching', category: 'The provider' },
                { item: 'Your storage bucket being public', category: 'You' },
                { item: 'SQL injection in your application', category: 'You' },
                { item: 'An access key committed to a repository', category: 'You' },
              ],
              ['sk-service-models'],
              'Nearly every headline cloud breach sits on the right-hand column.',
            ),
            mcq(
              'What do you give up by moving from IaaS to PaaS?',
              [
                'Nothing',
                'Control over the OS and runtime — you can no longer tune or patch below your app',
                'The ability to scale',
                'Data ownership',
              ],
              1,
              ['sk-service-models'],
              'Which is usually a good trade, right up until you need something the platform does not expose.',
            ),
            concept(
              'Virtual machines, containers, and functions',
              'Three units of deployment, in descending order of what they carry:\n\n**Virtual machine.** A hypervisor slices physical hardware into machines, each with its own kernel. Strong isolation, any OS, full control. Boots in tens of seconds; carries a whole operating system.\n\n**Container.** A process on the host kernel with a restricted view — namespaces and cgroups, from the operating systems track. Starts in milliseconds, tens of megabytes, no second kernel. Weaker isolation because the kernel is shared, and it must match the host kernel’s family.\n\n**Function.** You provide code; the platform provides everything else including when to run it. Scales to zero, and to thousands, without you thinking about capacity.\n\nOnce you have more than a handful of containers you need **orchestration** — deciding which machine each runs on, restarting the failed ones, rolling out new versions without downtime, routing traffic. That is what Kubernetes does, and it is genuinely complicated because the problem is: a **declarative** control loop in which you state the desired state ("three replicas of this image") and the system continuously works to make reality match.\n\nThat control loop is the elegant idea worth taking away even if you never run a cluster. It is also why Kubernetes is over-adopted: a declarative control loop over three services is a lot of machinery to maintain for three services.',
              {
                keyTerms: [
                  { term: 'Orchestration', definition: 'Scheduling, healing and rolling out containers across machines.' },
                  { term: 'Desired state', definition: 'A declared target the system continuously reconciles reality toward.' },
                ],
              },
            ),
            match(
              'Match each unit to its defining property.',
              [
                { left: 'Virtual machine', right: 'Its own kernel, strongest isolation' },
                { left: 'Container', right: 'Shares the host kernel, starts in milliseconds' },
                { left: 'Function', right: 'Scales to zero, platform owns capacity' },
                { left: 'Orchestrator', right: 'Reconciles running state toward a declared desired state' },
              ],
              ['sk-virtual-machines', 'sk-orchestration'],
              'Isolation, startup time and who owns capacity are the three axes.',
            ),
            mcq(
              'What is the central idea of a Kubernetes-style orchestrator?',
              [
                'It runs containers faster',
                'You declare the desired state and a control loop continuously reconciles reality toward it',
                'It replaces the operating system',
                'It provides a database',
              ],
              1,
              ['sk-orchestration'],
              'Declarative reconciliation. Everything else — self-healing, rolling updates, autoscaling — falls out of that one mechanism.',
            ),
            concept(
              'Serverless and the cold start',
              '**Serverless** does not mean no servers; it means no servers *you* manage. You upload a function, the platform runs it on demand, and you pay per invocation and per millisecond rather than per hour of idle machine.\n\nWhat it is excellent at:\n\n- **Spiky or unpredictable load.** Zero traffic costs zero.\n- **Event-driven glue.** A file lands, resize it. A message arrives, process it.\n- **Small independent jobs** with no shared state.\n\nWhat it is bad at, and these are not minor:\n\n**Cold starts.** The first invocation after idleness has to initialise a runtime — tens of milliseconds for a small function, and seconds for a large one with a heavy framework or a model to load. This is why serverless inference for a multi-gigabyte model is usually the wrong shape: the model load dominates everything.\n\n**Long-running work.** Hard execution limits, typically minutes.\n\n**Statefulness.** No local state survives between invocations, so everything goes to an external store — and that round trip is now on your latency budget.\n\n**Cost at steady load.** Per-millisecond pricing is superb at 1% utilisation and considerably worse than a reserved machine at 80%.\n\nThe pattern that follows: serverless for bursty, event-driven, stateless work; long-lived containers for steady traffic and anything that has to keep something warm in memory.',
              {
                keyTerms: [
                  { term: 'Cold start', definition: 'Latency from initialising a runtime for an idle function.' },
                  { term: 'Scale to zero', definition: 'No instances and no cost when there is no traffic.' },
                ],
              },
            ),
            multi(
              'Which workloads suit serverless?',
              [
                'Resizing images when they are uploaded',
                'A webhook handler with unpredictable, bursty traffic',
                'Serving a 7B-parameter model with low latency',
                'A nightly report generated from a queue message',
              ],
              [0, 1, 3],
              ['sk-serverless'],
              'The model would reload on every cold start. Keep that one warm in a long-lived container.',
            ),
            mcq(
              'At steady high utilisation, how does serverless compare on cost to a reserved instance?',
              [
                'Always cheaper',
                'Usually more expensive — per-millisecond pricing wins on idle, not on saturation',
                'Identical',
                'Cheaper only for CPU-bound work',
              ],
              1,
              ['sk-serverless', 'sk-cloud-cost'],
              'You are paying a premium for elasticity you are no longer using.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-cloud-1',
        title: 'Platforms Checkpoint',
        passingScore: 0.7,
        exercises: [
          mcq(
            'Under shared responsibility, who owns a publicly exposed storage bucket?',
            ['The provider', 'You — it is your configuration', 'Shared equally', 'Nobody'],
            1,
            ['sk-service-models'],
            'They secure the cloud; you secure what you put in it.',
          ),
          mcq(
            'Why does a container start in milliseconds where a VM takes tens of seconds?',
            [
              'Containers are smaller files',
              'There is no second kernel to boot — it is a process on the host kernel',
              'Containers skip networking',
              'VMs are written in slower languages',
            ],
            1,
            ['sk-virtual-machines'],
            'No OS boot at all.',
          ),
          trueFalse(
            'Serverless is always cheaper than running your own instances.',
            false,
            ['sk-serverless', 'sk-cloud-cost'],
            'It wins on idle and loses on sustained saturation.',
          ),
        ],
      },
    },
    // -----------------------------------------------------------------------
    {
      id: 'unit-cloud-2',
      title: 'Running It Well',
      description: 'Reproducible infrastructure, visibility, money, and surviving failure.',
      lessons: [
        lesson({
          id: 'lesson-iac-observability',
          title: 'Infrastructure as Code and Observability',
          summary: 'Describe the system in a file, then be able to see inside it.',
          level: 'intermediate',
          domain: 'cloud',
          steps: [
            concept(
              'Click-ops does not survive contact with a second environment',
              'Configuring infrastructure by clicking in a console works exactly once. Then someone needs a staging environment that matches, or the person who set it up leaves, or an unrecorded change breaks production at 2am and nobody can say what changed.\n\n**Infrastructure as code** describes the desired infrastructure in files that live in version control:\n\n```\nresource "aws_instance" "api" {\n  instance_type = "t3.medium"\n  ami           = "ami-0abc123"\n  tags = { Name = "api-server" }\n}\n```\n\nThe benefits are the ones version control always brings, which is the point: the infrastructure is **reviewable** (a diff before it applies), **reproducible** (identical staging and production), **auditable** (who changed what, when, and why), and **recoverable** (re-apply to rebuild a region).\n\nTwo practices make it work in reality. Declare the desired state and let the tool compute the changes — the same reconciliation idea as an orchestrator. And treat servers as **cattle, not pets**: never fix an instance by hand, because that creates a machine no file describes. Change the code and replace the instance.\n\nThe failure mode to watch for is **drift**: someone makes an emergency manual change, the code no longer matches reality, and the next apply reverts their fix. Detecting drift is a routine job, not a rare one.',
              {
                keyTerms: [
                  { term: 'Infrastructure as code', definition: 'Infrastructure declared in version-controlled files.' },
                  { term: 'Drift', definition: 'Reality diverging from the declared configuration.' },
                ],
              },
            ),
            multi(
              'What does infrastructure as code give you?',
              [
                'A reviewable diff before a change is applied',
                'Staging that genuinely matches production',
                'An audit trail of who changed what and why',
                'Immunity to outages',
              ],
              [0, 1, 2],
              ['sk-iac'],
              'It makes outages diagnosable and recoverable. It does not prevent them.',
            ),
            mcq(
              'Someone SSHes in and fixes a production server by hand. What is the problem?',
              [
                'It is slower than automation',
                'Reality now differs from the declared configuration, and the next apply will revert the fix',
                'It requires a password',
                'It cannot be done at scale',
              ],
              1,
              ['sk-iac'],
              'Drift. The fix must go into the code, or it will be silently undone.',
            ),
            concept(
              'Three signals, and the question each answers',
              'When something breaks at 3am you need to answer "what is happening" fast. **Observability** is whether the system lets you.\n\n**Logs** — discrete events with context. "Order 4471 failed validation: missing postcode." Best for the specific question of what happened to one request. Expensive at volume, so sample and structure them (JSON, not prose, so they can be queried).\n\n**Metrics** — numbers over time. Request rate, error rate, p99 latency, queue depth. Cheap, aggregated, ideal for dashboards and alerts. They tell you *that* something is wrong, rarely *what*.\n\n**Traces** — one request’s path through every service, with timing per hop. The only thing that answers "which of these fourteen services made it slow", which is otherwise unanswerable in a distributed system.\n\nThe rule for alerting is to **alert on symptoms, not causes**. Page on "error rate above 1%" and "p99 latency above 2s" — things users feel. Do not page on "CPU above 80%", which is frequently fine and produces the alert fatigue that makes people ignore the one that mattered.\n\nAnd measure **percentiles, not averages**. An average latency of 200ms is consistent with 95% of requests at 50ms and 5% at 3 seconds. The average looks healthy and one user in twenty is having a terrible time. p50, p95 and p99 tell you the actual distribution, and p99 is where your angriest users live.',
              {
                keyTerms: [
                  { term: 'Trace', definition: 'One request followed across services, with per-hop timing.' },
                  { term: 'p99 latency', definition: 'The value 99% of requests come in under — where the worst experiences are.' },
                ],
              },
            ),
            match(
              'Match each signal to the question it answers best.',
              [
                { left: 'Logs', right: 'What exactly happened to this one request' },
                { left: 'Metrics', right: 'Is the error rate rising right now' },
                { left: 'Traces', right: 'Which service in the chain is slow' },
                { left: 'Alerts', right: 'Is a human needed immediately' },
              ],
              ['sk-observability'],
              'Three different questions. A system with only one of the three is diagnosable only by luck.',
            ),
            mcq(
              'Why report p99 latency rather than the mean?',
              [
                'It is easier to compute',
                'The mean hides a slow tail — 5% of users at 3s can sit behind a healthy-looking average',
                'p99 is always lower',
                'Averages need more storage',
              ],
              1,
              ['sk-observability'],
              'The tail is where the complaints come from, and the mean is specifically designed to conceal it.',
            ),
            mcq(
              'Which is the better alert?',
              [
                'CPU above 80% for 5 minutes',
                'Checkout error rate above 1% for 5 minutes',
                'Disk usage above 60%',
                'More than 100 requests per second',
              ],
              1,
              ['sk-observability'],
              'A symptom users feel. High CPU is often just a machine doing its job, and paging on it teaches people to ignore pages.',
            ),
          ],
        }),
        lesson({
          id: 'lesson-cost-resilience',
          title: 'Cost and Resilience',
          summary: 'Money is a design constraint, and so is the failure you have planned for.',
          level: 'intermediate',
          domain: 'cloud',
          steps: [
            concept(
              'Cost is an architectural property',
              'On-premises, capacity is a capital decision made once a year by someone else. In the cloud, every engineering choice has a price attached and the bill arrives monthly. That makes cost an architectural property, not a finance problem.\n\nWhere cloud bills actually go:\n\n**Idle capacity.** Instances provisioned for peak, running at 10% at 3am. Autoscaling and scheduled shutdown of non-production environments are the two highest-return changes most teams can make.\n\n**Egress.** Data *in* is usually free; data *out* is not, and cross-region and cross-AZ transfer is charged too. A chatty microservice architecture spread across availability zones can spend more on network than on compute.\n\n**Storage that nobody deletes.** Logs, snapshots, old model checkpoints. Lifecycle policies that tier to cold storage and expire are close to free money.\n\n**Managed-service premium.** Real and often worth it — a managed database costs more than the instance and saves an engineer’s week. Worth it, but know the number.\n\n**GPUs.** The dominant line item for any ML team. An idle GPU instance costs the same as a busy one, which is why the utilisation question from the architecture track is a financial question as much as a performance one.\n\nThe practices that work: tag everything so spend can be attributed to a team or feature; set budget alerts before you need them; use spot or preemptible instances for anything interruptible, including most training; and buy reserved capacity only for load you are confident is steady.',
              {
                keyTerms: [
                  { term: 'Egress', definition: 'Outbound data transfer, which is usually the charged direction.' },
                  { term: 'Spot instance', definition: 'Deeply discounted capacity that can be reclaimed at short notice.' },
                ],
              },
            ),
            interactive(
              'Where the bill goes',
              'cloud-cost',
              'Adjust instance size, utilisation, egress and storage and watch the monthly total move. Try dropping utilisation to 10% and see how much of the bill is capacity nobody is using.',
            ),
            multi(
              'Which reliably reduce a cloud bill?',
              [
                'Shutting down non-production environments outside working hours',
                'Lifecycle policies that expire old logs and snapshots',
                'Running training on spot instances with checkpointing',
                'Moving every service to a different region',
              ],
              [0, 1, 2],
              ['sk-cloud-cost'],
              'The fourth usually adds cross-region egress, which is a charge rather than a saving.',
            ),
            mcq(
              'An ML team’s bill is dominated by GPU instances at 30% utilisation. What is the highest-return fix?',
              [
                'Move to a cheaper region',
                'Raise utilisation — batch jobs onto fewer instances, and fix a starved input pipeline',
                'Buy reserved capacity for the current fleet',
                'Reduce logging',
              ],
              1,
              ['sk-cloud-cost'],
              'Reserving idle capacity locks in the waste. Getting to 80% utilisation cuts the fleet, and the usual cause of a starved GPU is the data loader.',
            ),
            concept(
              'Designing for the failure you expect',
              'Everything fails. Disks, machines, availability zones, occasionally whole regions, and — most often of all — deployments. Resilience is not preventing failure; it is deciding in advance which failures you will survive and how quickly.\n\nTwo numbers make that concrete, and they should be stated before anything is designed:\n\n**RPO** — recovery point objective. How much data may you lose? An RPO of one hour means hourly backups are enough. An RPO of zero means synchronous replication, and a latency cost on every write.\n\n**RTO** — recovery time objective. How long may recovery take? An RTO of a day means restoring from backup. An RTO of a minute means a warm standby already running.\n\nEverything else follows from those two numbers, and both cost money in proportion to how strict they are. Choosing them is a business decision that engineers should insist on having made explicitly, because otherwise they are chosen implicitly and discovered during an incident.\n\nThe patterns are the ones from the distributed systems track, seen from the operations side: redundancy across zones so one failure is survivable, health checks and automatic failover so it is survived without a human, graceful degradation so a failed recommendation service costs you recommendations rather than checkout, and circuit breakers so one struggling dependency does not take everything with it.\n\nAnd the practice that separates real resilience from documented resilience: **test the recovery**. A backup that has never been restored is not a backup. Game days and chaos engineering exist because the failover that has never been exercised does not work — and you will find that out at the worst possible moment.',
              {
                keyTerms: [
                  { term: 'RPO', definition: 'How much data loss is acceptable.' },
                  { term: 'RTO', definition: 'How long recovery may take.' },
                ],
              },
            ),
            match(
              'Match each requirement to what it forces.',
              [
                { left: 'RPO of zero', right: 'Synchronous replication, paid for on every write' },
                { left: 'RPO of 24 hours', right: 'Nightly backups are sufficient' },
                { left: 'RTO of one minute', right: 'A warm standby already running' },
                { left: 'RTO of one day', right: 'Restore from backup is acceptable' },
              ],
              ['sk-resilience'],
              'Both numbers price directly into the architecture, which is why they must be agreed before it is designed.',
            ),
            trueFalse(
              'A backup that has never been restored can be relied on.',
              false,
              ['sk-resilience'],
              'Untested recovery fails at the moment you need it. Restore drills are the only evidence.',
            ),
            numeric(
              'A service is deployed across 3 availability zones and must survive any single zone failure at full capacity. What fraction of total capacity must each zone be able to serve, as a percentage?',
              50,
              ['sk-resilience', 'sk-autoscaling'],
              'Losing one of three leaves two, which must carry 100% between them — so each needs 50%, meaning the fleet runs at 150% of peak demand. That overhead is the price of the guarantee, and it is a number worth stating out loud before promising it.',
            ),
            shortAnswer(
              'Your team is asked for "five nines" of availability. What do you need to establish before agreeing?',
              ['downtime', 'cost', 'dependencies', 'measure', 'rto'],
              'Five nines is about five minutes of downtime a year, including deployments and dependency failures, so the first thing to establish is what is actually being measured and over what window. Then whether every dependency can also meet it — your availability cannot exceed that of anything you require. Then the cost: multi-region active-active, automated failover with no human in the loop, and tested recovery drills. Usually that conversation ends with three or four nines and a much cheaper architecture, which is the right outcome.',
              ['sk-resilience', 'sk-cloud-cost'],
              'Define the measurement, check the dependency chain, price it. Most five-nines requests are three-nines requests stated aspirationally.',
            ),
            order(
              'Order these responses to a dependency outage, from first line of defence to last.',
              [
                'Retry with backoff and jitter',
                'Serve a cached or degraded response',
                'Trip the circuit breaker and fail fast',
                'Fail over to a standby region',
              ],
              ['sk-resilience'],
              'Each step is more disruptive than the last, so you want them in this order rather than jumping to the end.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-cloud-2',
        title: 'Operations Checkpoint',
        passingScore: 0.7,
        exercises: [
          mcq(
            'What does RPO specify?',
            ['How long recovery takes', 'How much data you can afford to lose', 'How many replicas you run', 'The backup frequency'],
            1,
            ['sk-resilience'],
            'RTO is the time; RPO is the data.',
          ),
          mcq(
            'Which signal answers "which service in the chain made this request slow"?',
            ['Logs', 'Metrics', 'Traces', 'Alerts'],
            2,
            ['sk-observability'],
            'One request followed across every hop with timings.',
          ),
          trueFalse(
            'Fixing a production server by hand rather than in code creates drift.',
            true,
            ['sk-iac'],
            'And the next apply will quietly revert it.',
          ),
        ],
      },
    },
  ],
};
