/**
 * Track 20 — Operating Systems.
 *
 * The layer that lies to every program in a useful way: each one believes it
 * has the whole CPU and the whole address space. Understanding the lie
 * explains context switches, page faults, `fsync`, and what a container
 * actually is.
 */

import type { Track } from '../../domain/types';
import { concept, interactive, lesson, match, mcq, multi, numeric, order, shortAnswer, trueFalse } from '../builders';

export const operatingSystemsTrack: Track = {
  id: 'track-os',
  title: 'Operating Systems',
  tagline: 'The useful lies underneath every program',
  description:
    'Scheduling, virtual memory, files, and system calls — the machinery that lets a hundred programs share one machine and each believe it owns it. Ends with containers, which are this chapter applied rather than a separate technology.',
  domain: 'systems',
  level: 'intermediate',
  icon: '🧩',
  gradient: ['#10B981', '#0EA5E9'],
  prerequisites: ['track-systems'],
  outcomes: [
    'Say what the kernel does that user code cannot, and what a system call costs',
    'Predict how a scheduler divides CPU between competing processes',
    'Explain virtual memory, page faults, and why thrashing destroys throughput',
    'Reason about durability: when data has actually reached the disk',
    'Describe a container in terms of namespaces and cgroups rather than magic',
  ],
  units: [
    // -----------------------------------------------------------------------
    {
      id: 'unit-os-1',
      title: 'Sharing One Machine',
      description: 'What the kernel is for, and how CPU time gets divided.',
      lessons: [
        lesson({
          id: 'lesson-os-role',
          title: 'The Kernel Boundary',
          summary: 'Two privilege levels, one doorway, and why crossing it costs something.',
          level: 'intro',
          domain: 'systems',
          free: true,
          steps: [
            concept(
              'A referee for shared hardware',
              'There is one CPU, one disk, one network card, and a hundred programs that all want them. The operating system is the referee. It hands out CPU time, keeps each program’s memory separate, mediates access to devices, and stops any one program from taking everything.\n\nThe enforcement mechanism is hardware. The CPU runs in one of two modes:\n\n**User mode** — what your program runs in. It cannot touch the disk, the network, or another process’s memory. If it tries, the hardware traps.\n\n**Kernel mode** — what the OS runs in. Full access to everything.\n\nSo a program that wants to read a file cannot simply read it. It asks. That request is a **system call**: a controlled doorway where the CPU switches to kernel mode, the kernel checks whether you are allowed, does the work, and switches back.\n\nThis is why a crashed program does not take the machine down, and why a bug in a device driver — which *is* in kernel mode — can.',
              {
                keyTerms: [
                  { term: 'Kernel', definition: 'The privileged core of the OS, with direct hardware access.' },
                  { term: 'User mode', definition: 'The restricted mode ordinary programs run in.' },
                ],
              },
            ),
            mcq(
              'Why can a normal program not write directly to the disk?',
              [
                'Disks are too slow',
                'The CPU is in user mode and the hardware traps any direct device access; the program must ask the kernel',
                'The filesystem is encrypted',
                'It can, on most systems',
              ],
              1,
              ['sk-os-role'],
              'Hardware-enforced, not a convention. That enforcement is the whole basis of isolation.',
            ),
            concept(
              'System calls are not free',
              'A function call inside your program costs a handful of cycles. A system call costs on the order of **1,000–2,000 cycles**: the CPU switches privilege level, saves state, the kernel validates arguments, does the work, and switches back.\n\nThat cost shapes real code:\n\n- Writing a file one byte at a time with a `write` syscall each time is catastrophically slow. Standard library I/O **buffers** — it accumulates in user memory and makes one syscall per few kilobytes.\n- Network servers use `epoll`/`kqueue` to wait on ten thousand sockets in one syscall rather than one syscall per socket.\n- `strace` counting syscalls is often the fastest way to find out why a program is slow for no visible reason.\n\nThe general shape: batch your crossings of any expensive boundary. It is the same instinct as batching database queries or batching GPU work.',
              {
                keyTerms: [
                  { term: 'System call', definition: 'A program’s request for the kernel to do something privileged.' },
                  { term: 'Buffering', definition: 'Accumulating work in user space to reduce the number of crossings.' },
                ],
              },
            ),
            mcq(
              'A program writes 1 MB to a file one byte at a time and is extremely slow. What fixes it?',
              [
                'A faster disk',
                'Buffering the writes so the kernel is called once per few kilobytes instead of once per byte',
                'More RAM',
                'Writing from a second thread',
              ],
              1,
              ['sk-syscalls'],
              'A million syscalls at ~1,500 cycles each is billions of cycles of pure overhead. Buffering removes almost all of them.',
            ),
            multi(
              'Which of these require a system call?',
              [
                'Adding two local variables',
                'Opening a file',
                'Sending bytes over a socket',
                'Incrementing a counter in an array',
              ],
              [1, 2],
              ['sk-syscalls'],
              'Anything touching a device or another process’s world crosses the kernel boundary. Arithmetic on your own memory does not.',
            ),
          ],
        }),
        lesson({
          id: 'lesson-scheduling',
          title: 'CPU Scheduling',
          summary: 'More runnable threads than cores. Someone has to choose.',
          level: 'intermediate',
          domain: 'systems',
          steps: [
            concept(
              'Time slices and context switches',
              'You have eight cores and two hundred runnable threads. The scheduler gives each a short **time slice** — typically a few milliseconds — then interrupts it and runs another. Fast enough that everything looks simultaneous.\n\nSwapping threads is a **context switch**: save the registers and program counter of the outgoing thread, load the incoming one’s. Direct cost is a microsecond or so. The indirect cost is larger and less visible — the new thread’s data is not in cache, so it runs slowly until the cache refills.\n\nSchedulers must balance goals that conflict:\n\n| Goal | What it wants |\n|---|---|\n| Throughput | Long slices, few switches |\n| Responsiveness | Short slices, quick preemption |\n| Fairness | Everyone advances |\n| Priority | Some things matter more |\n\nLinux’s approach tracks how much CPU each task has actually received and runs the one that has had least. A thread that just woke from I/O has had almost none, so it is scheduled immediately — which is exactly what you want, since it is probably an interactive process responding to you.',
              {
                keyTerms: [
                  { term: 'Time slice', definition: 'The interval a thread runs before the scheduler may preempt it.' },
                  { term: 'Context switch', definition: 'Saving one thread’s state and restoring another’s.' },
                ],
              },
            ),
            interactive(
              'Run the scheduler',
              'cpu-scheduler',
              'Queue up jobs with different burst lengths and compare policies. Watch what first-come-first-served does to a short job stuck behind a long one, and what shortest-job-first does to the long job.',
            ),
            mcq(
              'Why does a short interactive task get scheduled quickly after waking from I/O?',
              [
                'It has a higher nice value',
                'It has consumed little CPU recently, so a fairness-based scheduler owes it time',
                'I/O tasks run in kernel mode',
                'The scheduler runs tasks in arrival order',
              ],
              1,
              ['sk-scheduling'],
              'Accumulated-usage fairness gives naturally good interactive behaviour without anyone declaring "this is interactive".',
            ),
            trueFalse(
              'The main cost of a context switch is the cache and TLB state the incoming thread has to rebuild.',
              true,
              ['sk-scheduling'],
              'Saving registers takes around a microsecond. The larger cost is the cold cache the incoming thread inherits, and it is invisible in any measurement that counts only the switch itself.',
            ),
            numeric(
              'A single core runs 4 threads with 5 ms time slices. In the worst case, how many milliseconds might a thread wait before running again?',
              15,
              ['sk-scheduling'],
              'The other three each take 5 ms: 3 × 5 = 15 ms. Add more threads and interactive latency grows linearly.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-os-1',
        title: 'Kernel and Scheduling Checkpoint',
        passingScore: 0.7,
        exercises: [
          mcq(
            'What makes user mode and kernel mode different?',
            [
              'Kernel code is written in C',
              'The CPU enforces which instructions and memory are reachable in each mode',
              'Kernel mode is faster',
              'User mode programs are compiled differently',
            ],
            1,
            ['sk-os-role'],
            'It is a hardware privilege level, not a software convention.',
          ),
          trueFalse(
            'A system call costs far more than an ordinary function call.',
            true,
            ['sk-syscalls'],
            'A function call is a few nanoseconds; crossing into the kernel is hundreds, plus the cache and branch-predictor state disturbed on the way. This is why buffered I/O exists, and why a loop that calls `write()` per byte is so much slower than one that batches.',
          ),
          mcq(
            'Adding more runnable threads than cores mainly costs you what?',
            ['More memory', 'Context switches and colder caches', 'Longer time slices', 'Fewer system calls'],
            1,
            ['sk-scheduling'],
            'Past the core count you are dividing the same CPU into smaller pieces and paying switching overhead for the privilege.',
          ),
        ],
      },
    },
    // -----------------------------------------------------------------------
    {
      id: 'unit-os-2',
      title: 'Memory, Files, and Boxes',
      description: 'Address spaces that are not real, disks that lie about writing, and isolation built from both.',
      lessons: [
        lesson({
          id: 'lesson-virtual-memory',
          title: 'Virtual Memory',
          summary: 'Every process thinks it has the whole address space. None of them do.',
          level: 'intermediate',
          domain: 'systems',
          steps: [
            concept(
              'Addresses that are translated, not real',
              'When your program reads address `0x7fff1234`, that is not a location in RAM. It is a **virtual** address, translated by hardware into a physical one on every single access.\n\nThe translation works in fixed-size **pages**, usually 4 KB. A per-process **page table** maps virtual pages to physical frames, and a small hardware cache called the **TLB** keeps the recent translations fast.\n\nFour things fall out of this, all of which you have relied on:\n\n**Isolation.** Process A’s page 5 and process B’s page 5 point at different physical frames. Neither can name the other’s memory, so neither can corrupt it.\n\n**Contiguity that is not real.** Your program sees one flat array; physically it is scattered across whatever frames were free. No compaction needed.\n\n**Overcommit.** The sum of all virtual address spaces can exceed physical RAM, because most of it is never touched.\n\n**Sharing.** One copy of libc in physical memory, mapped into a hundred processes.\n\nAnd it is why a null-pointer dereference is a clean crash: page 0 is deliberately left unmapped, so touching it traps instantly rather than silently corrupting something.',
              {
                keyTerms: [
                  { term: 'Page', definition: 'The fixed-size unit of virtual memory mapping, typically 4 KB.' },
                  { term: 'Page table', definition: 'The per-process map from virtual pages to physical frames.' },
                ],
              },
            ),
            interactive(
              'Translate an address',
              'virtual-memory',
              'Issue virtual addresses and watch the page table resolve them. Pages not yet resident trigger a fault — note how much longer a faulting access takes than a resident one.',
            ),
            mcq(
              'Why does dereferencing a null pointer crash immediately rather than corrupting data?',
              [
                'The compiler inserts a check',
                'Virtual page 0 is deliberately left unmapped, so the hardware traps on access',
                'Zero is not a valid integer',
                'The OS scans memory for null pointers',
              ],
              1,
              ['sk-virtual-memory'],
              'A deliberate hole in the address space, turning a whole class of bug into an instant, localised failure.',
            ),
            concept(
              'Page faults, swapping, and thrashing',
              'A **page fault** happens when you touch a page that is not currently in physical memory. The kernel traps, finds the data (on disk, or freshly zeroed), maps a frame, and resumes you. Your program never notices except in the timing.\n\nMinor faults are cheap. **Major** faults — the ones that go to disk — are not: hundreds of thousands of cycles.\n\nWhen physical memory runs short, the kernel evicts pages to a **swap** area on disk. A little swapping is fine. But if the working set genuinely exceeds RAM, every eviction is a page that will be needed again immediately, and the system enters **thrashing**: almost all its time spent moving pages, almost none doing work.\n\nThrashing has a signature you can recognise. CPU utilisation drops toward zero, disk I/O pegs, and the machine becomes unresponsive while apparently doing nothing. Adding CPU does not help. The only fixes are more RAM or a smaller working set — which is exactly why an over-large batch size does not slow training down gracefully, it falls off a cliff.',
              {
                keyTerms: [
                  { term: 'Page fault', definition: 'A trap taken when the accessed page is not resident in physical memory.' },
                  { term: 'Thrashing', definition: 'Spending nearly all time paging because the working set exceeds RAM.' },
                ],
              },
            ),
            mcq(
              'A machine becomes unresponsive, CPU utilisation is near zero, disk I/O is at 100%. What is happening?',
              [
                'A CPU-bound infinite loop',
                'Thrashing — the working set exceeds RAM, so the kernel is paging constantly',
                'A deadlock',
                'Network saturation',
              ],
              1,
              ['sk-paging-swapping'],
              'Idle CPU plus pegged disk is the classic signature. More cores will not help; less memory pressure will.',
            ),
            trueFalse(
              'A process can allocate more virtual memory than the machine has physical RAM.',
              true,
              ['sk-virtual-memory'],
              'Allocation maps address space; physical frames are assigned lazily on first touch. This is why allocation succeeds and the *touch* is what fails.',
            ),
            order(
              'Put the steps of a major page fault in order.',
              ['The program accesses a virtual address', 'The MMU finds no valid mapping and raises a fault', 'The kernel locates the page on disk', 'The page is read into a free physical frame', 'The page table is updated and the instruction is retried'],
              ['sk-paging-swapping'],
              'The faulting instruction is restarted, which is why the program is never aware anything happened.',
            ),
          ],
        }),
        lesson({
          id: 'lesson-files-containers',
          title: 'Files, Durability, and Containers',
          summary: 'What "saved" means, and what a container really is.',
          level: 'intermediate',
          domain: 'systems',
          steps: [
            concept(
              'A file is a name, an inode, and some blocks',
              'A filesystem separates three things that feel like one. The **directory entry** is a name pointing at an inode. The **inode** holds the metadata — size, permissions, timestamps — and the block pointers. The **data blocks** hold the contents.\n\nThat separation explains behaviour that otherwise looks strange:\n\n- Renaming a file within a filesystem is instant regardless of size. You edited a directory entry; the data never moved.\n- Two names can point at the same inode (a **hard link**). Deleting one does not delete the data; the inode has a reference count.\n- A deleted file that a process still has open keeps consuming disk. The name is gone, the inode’s count is not yet zero. This is why `rm` on a huge log does not free space until the writer restarts.\n\nThen there is the part that causes real data loss: **`write` does not mean written**. It copies into the kernel’s page cache and returns. The data reaches the physical disk some seconds later. If the power fails in between, it is gone. Only `fsync` forces it out and waits.\n\nThis is the mechanism behind the D in ACID. A database that reported a transaction committed without an `fsync` would be lying, and every durable store pays this cost deliberately.',
              {
                keyTerms: [
                  { term: 'Inode', definition: 'The on-disk structure holding a file’s metadata and block pointers.' },
                  { term: 'fsync', definition: 'A call that forces buffered data to physical storage and waits for it.' },
                ],
              },
            ),
            mcq(
              'A program writes a file and the process exits cleanly. Power is lost one second later. Is the data safe?',
              [
                'Yes, the write returned successfully',
                'Not necessarily — without an fsync the data may still be in the kernel page cache',
                'Yes, exiting flushes everything to disk',
                'Only if the file was opened in append mode',
              ],
              1,
              ['sk-file-systems'],
              'A successful `write` means "the kernel has it", not "the platter has it". Durability requires `fsync`.',
            ),
            mcq(
              'Why does deleting a 50 GB log file sometimes free no disk space?',
              [
                'The filesystem needs defragmenting',
                'A running process still has the file open, so the inode reference count is not yet zero',
                'The file was compressed',
                'Deletion is asynchronous on all filesystems',
              ],
              1,
              ['sk-file-systems'],
              'You removed the name, not the inode. Restart the writer and the space returns.',
            ),
            concept(
              'Containers are namespaces plus cgroups',
              'A virtual machine emulates hardware and runs a whole second kernel. A **container** does not. It is an ordinary process on the host kernel, with two ordinary kernel features turned up:\n\n**Namespaces** change what the process can *see*. A PID namespace means its processes are numbered from 1 and the host’s are invisible. A mount namespace gives it a different filesystem root. Network, user, and hostname namespaces do the same for their domains. The process is not sandboxed by emulation — it is simply shown a restricted view.\n\n**cgroups** (control groups) change what it can *use*: this much CPU, this much memory, this much I/O bandwidth. Exceed the memory limit and the kernel OOM-kills it.\n\nAn **image** is then just a stack of filesystem layers plus a default command.\n\nThe consequences follow directly. Containers start in milliseconds, because there is no kernel to boot. They are far lighter than VMs, because there is only one kernel. And they share that kernel — so a kernel vulnerability crosses container boundaries in a way it cannot cross VM boundaries, and a Linux container cannot run a Windows kernel’s system calls.',
              {
                keyTerms: [
                  { term: 'Namespace', definition: 'A kernel feature restricting what a process can see of the system.' },
                  { term: 'cgroup', definition: 'A kernel feature capping what resources a process group may consume.' },
                ],
              },
            ),
            match(
              'Match each mechanism to what it controls.',
              [
                { left: 'PID namespace', right: 'Which processes are visible' },
                { left: 'Mount namespace', right: 'What the filesystem root looks like' },
                { left: 'Memory cgroup', right: 'How much RAM may be used before an OOM kill' },
                { left: 'Image layers', right: 'The starting filesystem contents' },
              ],
              ['sk-containers'],
              'Visibility from namespaces, consumption from cgroups, contents from the image. No emulation anywhere.',
            ),
            multi(
              'Which are true of containers but not of virtual machines?',
              [
                'They share the host kernel',
                'They typically start in milliseconds',
                'They emulate virtual hardware',
                'A host kernel vulnerability can affect them all',
              ],
              [0, 1, 3],
              ['sk-containers'],
              'The shared kernel is simultaneously the reason they are fast and the reason their isolation is weaker than a VM’s.',
            ),
            shortAnswer(
              'Your container is killed with exit code 137 under load. What happened, and where would you look?',
              ['memory', 'oom', 'limit', 'cgroup'],
              'Exit 137 is 128 + 9, meaning SIGKILL — almost always the kernel OOM killer acting on the container’s memory cgroup limit. The process exceeded its configured memory cap. Check the cgroup memory limit against actual peak usage, and either raise the limit or reduce the working set (smaller batches, streaming instead of loading everything).',
              ['sk-containers'],
              'OOM kill against the cgroup limit. The container did not crash; the kernel stopped it.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-os-2',
        title: 'Memory and Isolation Checkpoint',
        passingScore: 0.7,
        exercises: [
          mcq(
            'What does the page table map?',
            [
              'Filenames to inodes',
              'Virtual pages to physical frames',
              'Processes to CPU cores',
              'Cache lines to RAM addresses',
            ],
            1,
            ['sk-virtual-memory'],
            'Per-process, consulted by hardware on every memory access, cached in the TLB.',
          ),
          trueFalse(
            'A successful `write()` only guarantees the data reached the kernel’s page cache.',
            true,
            ['sk-file-systems'],
            'It is still in volatile memory, and a power cut loses it. `fsync()` is what forces it to the device — and on some hardware even that is acknowledged by a volatile disk cache, which is why durability claims are tested by pulling the plug rather than by reading the manual.',
          ),
          mcq(
            'What is a container, mechanically?',
            [
              'A lightweight virtual machine with its own kernel',
              'A host process running with restricted namespaces and cgroup resource limits',
              'An emulator for a different CPU architecture',
              'A chroot with encryption',
            ],
            1,
            ['sk-containers'],
            'Ordinary process, restricted view, capped resources. No second kernel anywhere.',
          ),
        ],
      },
    },
  ],
};
