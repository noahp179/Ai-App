/**
 * Track 39 — Robotics & Embedded Systems.
 *
 * Software that touches the physical world, where the constraints are harder
 * and the failures are not recoverable by refreshing. Also the clearest
 * illustration in the catalog of why control theory and probability matter.
 */

import type { Track } from '../../domain/types';
import { categorize, concept, interactive, lesson, match, mcq, multi, order, shortAnswer, trueFalse } from '../builders';

export const roboticsTrack: Track = {
  id: 'track-robotics',
  title: 'Robotics & Embedded',
  tagline: 'Software that has to survive physics',
  description:
    'Microcontrollers, noisy sensors, real-time constraints, feedback control and PID, state estimation, kinematics and mapping — plus the safety engineering that applies when a bug moves something heavy.',
  domain: 'robotics',
  level: 'intermediate',
  icon: '🤖',
  gradient: ['#F59E0B', '#10B981'],
  prerequisites: ['track-systems'],
  outcomes: [
    'Say what a microcontroller has that a computer does not, and vice versa',
    'Treat every sensor reading as a noisy estimate rather than a value',
    'Explain hard versus soft real time and why average latency is irrelevant',
    'Tune a PID controller and recognise what each term is doing',
    'Describe why estimation beats measurement, and what a filter is for',
    'Name what changes when a bug can injure someone',
  ],
  units: [
    // -----------------------------------------------------------------------
    {
      id: 'unit-rob-1',
      title: 'Talking to the World',
      description: 'Small computers, noisy senses, and deadlines that are real.',
      lessons: [
        lesson({
          id: 'lesson-embedded',
          title: 'Microcontrollers and Sensors',
          summary: 'A computer with no operating system, reading a world that will not sit still.',
          level: 'intro',
          domain: 'robotics',
          free: true,
          steps: [
            concept(
              'A different kind of computer',
              'A **microcontroller** is a whole computer on one chip: processor, memory, and peripherals to talk to the physical world. It is not a small laptop; it is a different design point.\n\n| | Microcontroller | Application processor |\n|---|---|---|\n| RAM | Kilobytes | Gigabytes |\n| Clock | 16–200 MHz | 2–5 GHz |\n| OS | Often none | Linux, Windows |\n| Power | Milliwatts | Watts |\n| Cost | Under a dollar | Tens to hundreds |\n| Timing | Predictable | Whatever the scheduler decides |\n\nThat last row is the important one, and it is why microcontrollers are not simply obsolete. Predictability is the product. An engine controller must respond within a bounded time, every time, and a general-purpose OS cannot promise that.\n\nWith no operating system, your code runs directly on the hardware — **bare metal**. There is no `malloc` you should trust, no filesystem, no process to crash back to. Which means a memory leak is not a slow degradation; it is a device that stops after four days, in a field, with nobody to restart it.\n\nThe peripherals are where the character lies. **GPIO** pins read or drive a voltage. **ADCs** convert an analogue voltage to a number. **PWM** fakes an analogue output by switching fast and varying the duty cycle — how motor speed and LED brightness are actually controlled. **Timers** and **interrupts** make precise timing possible without polling.\n\nInterrupts are the one that reshapes how you write code. A hardware event suspends what you were doing and runs a handler immediately. Handlers must be short and must not block, because the rest of the system is stopped while they run — and anything they share with the main loop is subject to exactly the race conditions from the systems track, with no debugger attached.',
              {
                keyTerms: [
                  { term: 'Bare metal', definition: 'Running with no operating system beneath you.' },
                  { term: 'Interrupt', definition: 'A hardware event that suspends normal execution to run a handler immediately.' },
                ],
              },
            ),
            mcq(
              'Why are microcontrollers still used when a full processor costs so little?',
              [
                'Nostalgia',
                'Predictable timing, very low power, and no OS scheduler deciding when your code runs',
                'They are faster',
                'They have more memory',
              ],
              1,
              ['sk-microcontrollers'],
              'An engine controller cannot be told "usually within 5ms". Determinism is the product.',
            ),
            mcq(
              'Why must an interrupt handler be short?',
              [
                'It has a memory limit',
                'The rest of the system is suspended while it runs, so a long handler delays everything else',
                'It runs on a separate core',
                'The compiler rejects long ones',
              ],
              1,
              ['sk-microcontrollers'],
              'And anything it shares with the main loop is a race condition waiting to happen.',
            ),
            concept(
              'Every sensor lies a little',
              'Software engineers are used to reading a value. In robotics you read a **noisy estimate of a value**, and treating it as fact is the most common beginner error.\n\nEvery sensor has:\n\n**Noise** — random variation between readings of an unchanging quantity.\n**Bias** — a systematic offset, often drifting with temperature.\n**Drift** — accumulating error over time. Integrating an accelerometer to get position is hopeless within seconds for exactly this reason.\n**Latency** — the reading describes the past, and the amount of past varies.\n**Quantisation** — a 10-bit ADC gives 1,024 levels and no more.\n**Range and saturation** — beyond the limits it reports the limit, not the truth.\n\nSo a single reading is nearly useless, and the practical responses form a toolkit:\n\n**Filter over time.** A moving average or an exponential filter trades responsiveness for noise reduction — and that trade is a real one, not a free win.\n\n**Fuse multiple sensors.** A gyroscope is accurate short-term and drifts; an accelerometer is noisy but has no long-term drift. Combined, each covers the other’s weakness. This is why every drone and phone runs sensor fusion.\n\n**Model the noise.** If you know the variance, you can weight readings by how much you trust them — which is exactly what a Kalman filter does.\n\n**Sanity check.** A distance sensor reporting 3 metres one sample after 0.2 metres is reporting a glitch, not a teleporting obstacle.',
              {
                keyTerms: [
                  { term: 'Drift', definition: 'Error that accumulates over time, fatal to naive integration.' },
                  { term: 'Sensor fusion', definition: 'Combining sensors whose weaknesses are complementary.' },
                ],
              },
            ),
            mcq(
              'Why can you not get reliable position by integrating an accelerometer?',
              [
                'Accelerometers are too slow',
                'Small biases integrate twice into a rapidly growing position error — drift',
                'They only measure gravity',
                'The sample rate is too low',
              ],
              1,
              ['sk-sensors-actuators'],
              'Double integration turns a tiny constant bias into an error growing with the square of time. Seconds, not minutes.',
            ),
            multi(
              'Which are sound responses to sensor noise?',
              [
                'Filtering over time, accepting some added latency',
                'Fusing sensors with complementary weaknesses',
                'Rejecting readings that are physically impossible',
                'Increasing the sample rate until the noise disappears',
              ],
              [0, 1, 2],
              ['sk-sensors-actuators'],
              'Sampling faster gives you more noisy readings. It helps only insofar as it lets you average more of them.',
            ),
            concept(
              'Real time means deadlines, not speed',
              '"Real-time" does not mean fast. It means **bounded** — a correct answer delivered after its deadline is a wrong answer.\n\n**Hard real time.** Missing a deadline is a failure. An airbag controller, an anti-lock braking system, a pacemaker. The system must be designed so that the deadline is provably met in the worst case.\n\n**Soft real time.** Missing a deadline degrades quality. Video playback drops a frame; audio glitches. Undesirable, not catastrophic.\n\nThe consequence that most surprises people from general software: **average latency is nearly irrelevant, and worst case is everything**. A controller averaging 1ms with an occasional 50ms spike is worse than one that always takes 8ms. Percentiles do not save you either — a guarantee is about the maximum.\n\nThis reshapes the engineering:\n\n- **No unbounded allocation.** Dynamic memory has unpredictable timing and can fragment. Embedded code often allocates everything up front and never frees.\n- **No garbage collector**, or a hard-real-time one, because an unpredictable pause is exactly the failure mode.\n- **Bounded loops.** Every loop needs a provable maximum iteration count.\n- **Priority-based preemptive scheduling**, so the critical task always wins.\n- **Watchdog timers.** A hardware counter the software must reset periodically; if it ever reaches zero, the device resets itself. The assumption is that the software will eventually hang, and the design makes that survivable.\n\nThat last one is worth dwelling on as a philosophy. Embedded engineering assumes failure and plans the recovery, rather than assuming correctness and hoping.',
              {
                keyTerms: [
                  { term: 'Hard real time', definition: 'A missed deadline is a system failure, not a slowdown.' },
                  { term: 'Watchdog timer', definition: 'A hardware timer that resets the device if the software stops resetting it.' },
                ],
              },
            ),
            categorize(
              'Hard or soft real time?',
              ['Hard real time', 'Soft real time'],
              [
                { item: 'Airbag deployment', category: 'Hard real time' },
                { item: 'Anti-lock braking', category: 'Hard real time' },
                { item: 'Video playback', category: 'Soft real time' },
                { item: 'A web page loading', category: 'Soft real time' },
              ],
              ['sk-real-time'],
              'The question is what happens when the deadline is missed: failure, or degradation.',
            ),
            mcq(
              'Which controller is better for a hard real-time task?',
              [
                'Average 1ms, occasional 50ms spike',
                'Always 8ms, never more',
                'Average 0.5ms, unbounded worst case',
                'Whichever has lower average latency',
              ],
              1,
              ['sk-real-time'],
              'Guarantees are about the worst case. An unbounded tail means no guarantee at all, whatever the average says.',
            ),
            mcq(
              'What is a watchdog timer for?',
              [
                'Measuring performance',
                'Resetting the device if the software stops periodically resetting the timer — surviving a hang',
                'Scheduling tasks',
                'Saving power',
              ],
              1,
              ['sk-real-time', 'sk-embedded-constraints'],
              'It assumes the software will eventually hang and makes that survivable rather than terminal.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-rob-1',
        title: 'Embedded Checkpoint',
        passingScore: 0.7,
        exercises: [
          mcq(
            'Real-time means what?',
            ['Fast', 'Bounded — a late answer is a wrong answer', 'Low average latency', 'Interrupt-driven'],
            1,
            ['sk-real-time'],
            'The deadline is part of correctness.',
          ),
          trueFalse(
            'Integrating accelerometer readings gives reliable position over minutes.',
            false,
            ['sk-sensors-actuators'],
            'Bias integrates twice and the error grows with the square of time.',
          ),
          mcq(
            'Why avoid dynamic allocation in hard real-time code?',
            ['It is slow', 'Its timing is unpredictable and it can fragment', 'It uses too much memory', 'It is unsupported'],
            1,
            ['sk-embedded-constraints'],
            'Unpredictable is the disqualifying property, not slow.',
          ),
        ],
      },
    },
    // -----------------------------------------------------------------------
    {
      id: 'unit-rob-2',
      title: 'Control and Estimation',
      description: 'Closing the loop, and knowing where you are.',
      lessons: [
        lesson({
          id: 'lesson-control',
          title: 'Feedback Control and PID',
          summary: 'Measure the error, act on it, repeat. Three terms and a great deal of behaviour.',
          level: 'intermediate',
          domain: 'robotics',
          steps: [
            concept(
              'Open loop and closed loop',
              '**Open-loop** control acts without checking the result. "Run the motor at 60% for two seconds." Simple, and it works only when the world cooperates — add a load, a slope, or a low battery and it silently does something else.\n\n**Closed-loop** control measures the outcome and corrects:\n\n```\nerror = target − measured\noutput = controller(error)\n```\n\nRepeat, often hundreds of times a second. That loop is why a cruise control holds speed up a hill, a thermostat holds a temperature, and a drone stays level in wind. None of them need to know about the hill, the weather, or the wind — they only need to measure the error.\n\nThat is the deep idea worth carrying out of this track: **feedback lets a simple controller handle disturbances it was never told about**. You do not model the world; you measure the discrepancy and correct.\n\nThe same structure appears throughout the catalog under other names. Gradient descent is feedback on a loss. Autoscaling is feedback on queue depth. A Kubernetes controller reconciling toward a desired state is feedback. Retry with backoff is feedback on failure rate. Once you can see the shape, it is everywhere.',
              {
                figure: 'control-loop',
                keyTerms: [
                  { term: 'Closed loop', definition: 'Measuring the outcome and correcting the error continuously.' },
                  { term: 'Setpoint', definition: 'The target value the controller is trying to hold.' },
                ],
              },
            ),
            concept(
              'P, I, and D',
              'A **PID controller** computes its output from three terms, each answering a different question about the error.\n\n**Proportional** — respond in proportion to the current error. *How wrong am I now?*\n\nAlone, it leaves **steady-state error**. A heater with proportional-only control settles below the target, because at the target the error is zero and so is the output — and with no output the temperature falls.\n\n**Integral** — accumulate the error over time. *How long have I been wrong?*\n\nThis eliminates steady-state error: a persistent small error builds up until the output is enough to close it. The cost is **integral windup** — if the actuator saturates, the integral keeps accumulating during the period it can do nothing, and then massively overshoots. Every practical implementation clamps it.\n\n**Derivative** — respond to the rate of change. *How fast is it changing?*\n\nThis damps oscillation by anticipating overshoot and easing off early. It is also extremely sensitive to noise, because differentiating a noisy signal amplifies the noise. Many real controllers are PI only, and most that use D filter the input first.\n\nTuning is choosing the three gains, and the symptoms are legible once you know them: oscillation means P is too high or D too low; slow approach means P too low; a persistent offset means I is too low; a violent overshoot after saturation means windup.',
              {
                keyTerms: [
                  { term: 'Steady-state error', definition: 'A persistent offset that proportional control alone cannot remove.' },
                  { term: 'Integral windup', definition: 'The integral accumulating while the actuator is saturated, causing a large overshoot.' },
                ],
              },
            ),
            interactive(
              'Tune a PID controller',
              'pid-tuner',
              'Raise P until it oscillates, then add D to damp it, then add I to close the remaining gap. Then add a disturbance and watch the loop reject it without ever being told it happened.',
            ),
            match(
              'Match each term to what it responds to.',
              [
                { left: 'Proportional', right: 'How large the error is right now' },
                { left: 'Integral', right: 'How long the error has persisted' },
                { left: 'Derivative', right: 'How fast the error is changing' },
                { left: 'Windup clamp', right: 'Stopping the integral accumulating while saturated' },
              ],
              ['sk-control-loops'],
              'Present, past, and predicted future. Each fixes a failure mode of the others.',
            ),
            mcq(
              'A proportional-only heater settles 2° below target. Which term fixes it?',
              ['More proportional gain', 'Integral', 'Derivative', 'A faster sample rate'],
              1,
              ['sk-control-loops'],
              'The integral accumulates the persistent error until the output is enough to close it. More P reduces the offset without removing it, and eventually oscillates.',
            ),
            mcq(
              'Why is the derivative term often omitted or filtered?',
              [
                'It is expensive to compute',
                'Differentiating a noisy signal amplifies the noise, producing a jittery output',
                'It causes steady-state error',
                'It only works at high speed',
              ],
              1,
              ['sk-control-loops'],
              'Many production controllers are PI only for exactly this reason.',
            ),
            multi(
              'Which are feedback control loops, in substance?',
              [
                'Gradient descent adjusting weights from a loss',
                'Autoscaling on queue depth',
                'A Kubernetes controller reconciling toward a desired state',
                'A compiler optimising code',
              ],
              [0, 1, 2],
              ['sk-control-loops'],
              'Each measures a discrepancy and acts to reduce it. The compiler does its work once and does not observe the result.',
            ),
          ],
        }),
        lesson({
          id: 'lesson-estimation',
          title: 'Estimation, Mapping, and Safety',
          summary: 'Combining what you expected with what you saw, and engineering when it matters.',
          level: 'expert',
          domain: 'robotics',
          steps: [
            concept(
              'Predict, then correct',
              'You cannot measure where a robot is; you can only measure things that depend on where it is, noisily. **State estimation** turns that into a usable answer.\n\nThe structure is two steps, repeated:\n\n**Predict.** Use a model of the dynamics to say where you should be now. "I was here, moving at this speed, so a tenth of a second later I am about there." Cheap, and its uncertainty grows every step.\n\n**Correct.** Take a measurement and blend it with the prediction, weighted by how much you trust each.\n\nThat weighting is the whole idea. A **Kalman filter** computes the optimal weighting given the noise characteristics of both, for linear systems with Gaussian noise. When the measurement is noisy it leans on the prediction; when the prediction has drifted it leans on the measurement. It also tracks the uncertainty itself, so you know how much to believe the answer.\n\nThe insight worth keeping: **the estimate is better than either input alone.** Not a compromise — genuinely more accurate than the measurement and more accurate than the prediction, because they fail in uncorrelated ways.\n\nReal systems are non-linear, so practice uses extended or unscented Kalman filters, or **particle filters** that represent the belief as a cloud of weighted hypotheses and handle multi-modal cases a Gaussian cannot — "I am either in corridor A or corridor B, and they look identical."\n\n**SLAM** — simultaneous localisation and mapping — is the chicken-and-egg version: build a map while working out where you are in it. It works because consistency across many observations constrains both, and **loop closure** — recognising a previously visited place — is what corrects accumulated drift in one go.',
              {
                keyTerms: [
                  { term: 'Kalman filter', definition: 'Optimal blending of prediction and measurement given their noise.' },
                  { term: 'Loop closure', definition: 'Recognising a revisited place, which corrects accumulated drift.' },
                ],
              },
            ),
            order(
              'Order one cycle of a state estimator.',
              [
                'Predict the new state from the motion model',
                'Grow the uncertainty to reflect model error',
                'Take a measurement',
                'Weight prediction and measurement by their uncertainties',
                'Produce a corrected estimate with reduced uncertainty',
              ],
              ['sk-state-estimation'],
              'Uncertainty grows on prediction and shrinks on measurement. Tracking it is what makes the weighting possible.',
            ),
            mcq(
              'Why is a filtered estimate better than the measurement alone?',
              [
                'It is smoother',
                'Prediction and measurement fail in uncorrelated ways, so combining them beats either',
                'It is faster to compute',
                'It removes all noise',
              ],
              1,
              ['sk-state-estimation'],
              'Genuinely more accurate than either input, not a compromise between them.',
            ),
            mcq(
              'What does loop closure do in SLAM?',
              [
                'Closes the control loop',
                'Recognises a previously visited place, correcting accumulated drift across the whole map',
                'Ends the mapping session',
                'Detects obstacles',
              ],
              1,
              ['sk-slam'],
              'One recognition constrains the entire trajectory, which is why maps visibly snap into alignment when it happens.',
            ),
            concept(
              'Kinematics: where the arm actually is',
              '**Kinematics** relates joint angles to positions in space, and it comes in two directions with very different difficulty.\n\n**Forward kinematics** — given the joint angles, where is the end of the arm? Compose the transforms for each link, using exactly the homogeneous matrices from the graphics track. One answer, computed directly.\n\n**Inverse kinematics** — given a target position, what joint angles get there? Much harder. There may be **no** solution (out of reach), **one**, **many** (a human arm can reach a point with the elbow anywhere on an arc), or infinitely many for a redundant arm. So it is an optimisation problem, usually solved iteratively, and usually with a secondary objective to choose among the solutions — minimise energy, avoid obstacles, stay away from joint limits.\n\nThe practical trouble is **singularities**: configurations where the arm loses a degree of freedom, such as a fully extended elbow. Near one, a small movement of the target demands enormous joint velocities, and a naive controller will try to deliver them. Detecting and avoiding singular configurations is a standard part of arm control rather than an exotic concern.\n\n**Coordinate frames** are the everyday discipline. Every sensor, joint and object has its own frame, and a large share of robotics bugs are transform errors — the right maths applied between the wrong pair of frames. Naming frames explicitly and being pedantic about which frame a quantity is expressed in is the habit that prevents them.',
              {
                keyTerms: [
                  { term: 'Inverse kinematics', definition: 'Finding joint angles for a desired end position — many solutions or none.' },
                  { term: 'Singularity', definition: 'A configuration where the arm loses a degree of freedom and velocities blow up.' },
                ],
              },
            ),
            mcq(
              'Why is inverse kinematics harder than forward kinematics?',
              [
                'It needs more computation per transform',
                'There may be no solution, or many, so it is an optimisation rather than a calculation',
                'The matrices are larger',
                'It requires sensors',
              ],
              1,
              ['sk-kinematics'],
              'Forward is a composition with one answer. Inverse is a search with a variable number of them.',
            ),
            concept(
              'Engineering when a bug can hurt someone',
              'Most software fails by being unavailable or wrong. Robotics software can fail by moving something heavy into a person, and that changes the engineering rather than just the seriousness.\n\nThe principles that follow:\n\n**Fail safe, not fail silent.** Decide what "safe" is for this machine — a stopped motor, a closed valve, a released brake — and make the failure path go there. A robot that stops on a fault is fine; one that continues with stale sensor data is not.\n\n**Physical safeguards outrank software.** An emergency stop should cut power in hardware, not request a shutdown politely. Force limits should be mechanical where possible. Software can have a bug; a mechanical limit cannot.\n\n**Redundancy on anything critical.** Two sensors disagreeing is information — you know something is wrong. One sensor lying looks exactly like the truth.\n\n**Bound everything.** Maximum speed, maximum force, maximum travel. Not as a policy but as a limit the system cannot exceed even when the controller asks it to.\n\n**Formal analysis where warranted.** Standards like ISO 26262 and IEC 61508 exist because "we tested it" is not an adequate argument when the failure mode is an injury. Hazard analysis, failure modes and effects analysis, and defined integrity levels are the tools.\n\n**Test the failures, not just the successes.** Unplug the sensor. Stall the motor. Corrupt the message. Cut the power mid-write. The behaviour under those conditions is the design, and if nobody has observed it, nobody knows what it is.\n\nThe cultural difference is the deepest part. Web engineering ships and iterates because the cost of a mistake is a rollback. Safety engineering front-loads the analysis because there is no rollback for a crushed hand — and knowing which regime you are in is the first thing to establish.',
              {
                keyTerms: [
                  { term: 'Fail safe', definition: 'A designed failure path that ends in a safe physical state.' },
                  { term: 'Hazard analysis', definition: 'Systematically enumerating what could go wrong and what prevents it.' },
                ],
              },
            ),
            multi(
              'Which belong in a safety-critical design?',
              [
                'An emergency stop that cuts power in hardware',
                'Redundant sensors on critical measurements',
                'Hard limits on speed and force the controller cannot exceed',
                'Extensive unit tests as the primary safety argument',
              ],
              [0, 1, 2],
              ['sk-safety-critical'],
              'Tests are necessary and are not a safety argument on their own — they show the cases you thought of behaved as expected.',
            ),
            mcq(
              'Two redundant sensors disagree. Why is that better than having one?',
              [
                'It averages out noise',
                'Disagreement is information: you know something is wrong. A single lying sensor is indistinguishable from the truth',
                'It is faster',
                'It uses less power',
              ],
              1,
              ['sk-safety-critical'],
              'Detecting the fault is the point, more than improving the estimate.',
            ),
            shortAnswer(
              'A mobile robot occasionally lurches when its main sensor briefly drops out. What would you change?',
              ['fail safe', 'stale', 'timeout', 'estimate', 'limit', 'degrade'],
              'The immediate bug is that stale or missing data is being treated as a valid reading. Every sensor input needs a timestamp and a freshness check, and the controller should degrade deliberately when data is stale — hold the last safe command briefly, then stop — rather than acting on nothing. Beyond that: a state estimator so a brief dropout is covered by the prediction rather than a gap, hard limits on commanded acceleration so no single bad input can produce a lurch, and a test that explicitly disconnects the sensor mid-motion so this path is exercised rather than discovered.',
              ['sk-safety-critical', 'sk-state-estimation'],
              'Stale data treated as fresh, no bounded fallback, and a failure path nobody had tested.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-rob-2',
        title: 'Control and Safety Checkpoint',
        passingScore: 0.7,
        exercises: [
          mcq(
            'Which PID term removes steady-state error?',
            ['Proportional', 'Integral', 'Derivative', 'None of them'],
            1,
            ['sk-control-loops'],
            'It accumulates the persistent error until the output closes it.',
          ),
          mcq(
            'A Kalman filter combines what?',
            [
              'Two sensors',
              'A model-based prediction and a measurement, weighted by their uncertainties',
              'Past and future measurements',
              'Position and velocity',
            ],
            1,
            ['sk-state-estimation'],
            'And the result beats either input alone.',
          ),
          trueFalse(
            'An emergency stop should cut power in hardware rather than request a software shutdown.',
            true,
            ['sk-safety-critical'],
            'Software can hang. A contactor cannot.',
          ),
        ],
      },
    },
  ],
};
