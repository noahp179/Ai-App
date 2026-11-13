# Classroom

Classroom lets a teacher create classes, upload their own materials and set quizzes, tests and written assignments. Students take them in one screen with two panes: on one side an AI study assistant that answers from the teacher's materials and cites the page it used, on the other the student's own answers. After a student submits, an AI can suggest how well they used the assistant and suggest marks for written answers. **The teacher decides every mark and every level; students see only what the teacher releases.**

Classroom is a learning tool. It does not guarantee marks, it does not prove or disprove academic dishonesty, and its activity signals are things for a teacher to look at, never verdicts.

- Privacy, what is recorded, retention and the law in plain words: [CLASSROOM_PRIVACY.md](CLASSROOM_PRIVACY.md)
- The AI: prompts, models, effort, validation, costs and the evaluation set: [CLASSROOM_AI.md](CLASSROOM_AI.md)
- What is verified and what is not: [FEATURE_MATRIX.md](FEATURE_MATRIX.md#classroom), [TEST_REPORT.md](TEST_REPORT.md), [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md#classroom)

## How it fits together

```
 Desktop app (Electron)                     Browser (Chromebooks, school computers)
 Classroom section ──IPC──► main process      the same React screens, served by the server
                            (token in the       │  fetch + HttpOnly cookie
                             secret store)      │
                                  │ HTTPS       │ HTTPS
                                  ▼             ▼
                    ┌────────── classroom server (Node) ──────────┐
                    │ accounts · classes · materials · assessments │
                    │ attempts · autosave · timer (server clock)  │
                    │ grading · AI jobs and batches · audit log   │
                    │ SQLite (WAL) + encrypted file store          │
                    └───────────────┬──────────────────────────────┘
                                    │ HTTPS (AI only ever called from here)
                                    ▼
                           Claude API (Anthropic)
```

- **One codebase for both clients.** `src/renderer/modules/classroom` is the Classroom section of the desktop app and, unchanged, the browser build (`src/web`). Only the transport differs (`src/shared/classroom/transport.ts`).
- **AI is called only by the server.** The school's API key never reaches a teacher's or student's device.
- **The server's clock decides** when an assessment opens and closes, and when a student's time runs out.

## Running the classroom server

The server is a single Node process with its own SQLite database and file store. It is a reference implementation, built and tested in this repository but not yet run in a real school (see [Known limitations](KNOWN_LIMITATIONS.md#classroom)).

```bash
npm install
npm run build:classroom            # server (dist/classroom) and the browser app (dist/classroom-web)
FC_CLASSROOM_KEY="$(openssl rand -base64 32)" \
FC_CLASSROOM_SETUP_CODE="choose-a-long-code" \
FC_CLASSROOM_SECURE=1 \
node dist/classroom/main.js --host 127.0.0.1 --port 8790 --data /srv/flowcompanion-classroom
```

| Setting | What it does |
| --- | --- |
| `--port`, `--host` | Where it listens (default `127.0.0.1:8790`). Put it behind a TLS-terminating reverse proxy (nginx, Caddy); it does not serve HTTPS itself. |
| `--data` | Folder for the database (`classroom.db`) and the encrypted file store (`files/`). Back it up. |
| `--web` | Folder of the browser app (default `dist/classroom-web`). Without it only the desktop app can connect. |
| `FC_CLASSROOM_KEY` | 32-byte base64 master key. Encrypts stored files and the school's AI key, and signs download links. If unset, a key file is created in the data folder: then the data folder alone is enough to read the files, so keep the key elsewhere in production. |
| `FC_CLASSROOM_SETUP_CODE` | Required to create a school. Without it, only the first school can be created, by whoever reaches the server first. |
| `ANTHROPIC_API_KEY` | Optional server-wide AI key, used by schools that have not set their own. |
| `FC_CLAMD` | `host:port` of a ClamAV daemon. Uploads are then scanned and refused if the scan fails or cannot run. Without it the server does basic checks only (type, size, structure) and says so. |
| `FC_CLASSROOM_SECURE=1` | Marks the session cookie `Secure`. Set it whenever the server is reached over HTTPS. |

Every 30 seconds the server submits attempts whose time is up and collects finished AI batches. Once an hour it deletes classes whose retention period has ended.

**Not included:** PostgreSQL, S3-compatible storage, single sign-on (Google, Microsoft), and encryption of the database file itself (use disk encryption). See [Known limitations](KNOWN_LIMITATIONS.md#classroom).

## Getting started

1. **Administrator.** Open the server's address in a browser, or the desktop app's **Classroom** section (enter the address once). Choose **Set up a school**. This creates the school and your administrator account.
2. In **School settings**:
   - add the school's Anthropic API key (stored encrypted, never shown again);
   - check the model and the monthly budget;
   - set how long class data is kept;
   - make a **teacher invite** code.
3. **Teachers** choose **Teacher invite**, enter the code and create their account.
4. **Students** choose **Join a class** and enter the class code their teacher gives them. The class name and school appear as they type, so they know it is the right one.

Accounts are an email address or a username plus a password. Five wrong passwords lock that sign-in name for five minutes. Sessions last 14 days.

## For teachers

### Classes and students

- **New class:**
  - name, section, school year;
  - optionally an Ontario course, so questions can be tagged with curriculum expectations;
  - the last day of class (retention counts from it).
- **Class code:** make one in **Students**. Codes expire after 14 days. You can require approval for each student, stop joining, or make a new code.
- **Roster import:** paste or choose a CSV of names and school emails or usernames. You check the list before anything is created. New accounts get a password to hand out, shown once. This version has no password change, so keep it private.
- **Co-teachers** can do everything except delete the class.
- **Accommodations** apply to every assessment in the class:
  - extra time (%);
  - pasting allowed;
  - read questions aloud;
  - larger text.

  They are never shown or counted as flags. Students see their own accommodations before they start.

### Materials

- **Formats:** PDF, Word (.docx), PowerPoint (.pptx), text, Markdown and images, up to 25 MB each and 500 MB per class.
- **Rights:** you confirm you have the right to share each file with your class.
- **Checks:** each file is checked when uploaded, and its text is read on the server. The table shows whether text could be read. Scanned pages with no text layer are stored but cannot be searched.
- **Preview:** click a file to see the text the assistant reads, page by page.
- **Replace:** uploading a new version keeps the old ones.

### Assessments

1. **Create** an assessment and add questions. There are ten types:
   - multiple choice;
   - choose all that apply;
   - true/false;
   - number (fractions accepted);
   - expression (any equivalent form);
   - short answer;
   - fill in the blanks;
   - matching;
   - put in order;
   - written answer with a rubric.

   You can import questions from JSON.
2. **Draft with AI** (optional). The AI drafts questions from the attached materials and says where each came from. Each draft is marked **AI-drafted · not reviewed** until you accept or edit it. **You cannot publish while any draft is unreviewed.**
3. **Settings:**
   - kind (practice, quiz, test, assignment);
   - opening and closing times, time limit and attempts;
   - layout and shuffling;
   - the assistant's mode, its materials and its message limit;
   - what is recorded;
   - when results are shown.

   | Assistant mode | What students get |
   | --- | --- |
   | Off | No assistant. |
   | Materials-only tutor | Explains and quotes your materials; never gives answers to the questions. |
   | Hints only | One nudge at a time; no full explanations, no answers. |
   | Open explanations | Explains ideas fully with different examples; never writes answers. |

   "Allow general knowledge" lets the assistant go beyond your materials; otherwise it says "That isn't in your teacher's materials."
4. **Publish.** Students who have started keep the version they started with; edits apply to new attempts.

### Marking, feedback and release

- **Submissions** lists every student with their status, mark, AI-use evaluation status and plain activity counts (paste attempts, times they left the page, large inserts, rule-change attempts, messages, and how much of a written answer matches the assistant's words). These are counts to look at, not a ranking or a verdict.
- **Suggest AI-use evaluations / Suggest marks for written answers** runs the whole class as one batch at a lower cost. A progress bar shows how far it has got. Suggestions are only suggestions.
- **Reviewing one student** shows:
  - **Answers:** each answer, the checker's mark for questions code can mark, and passages of a written answer that also appear in the assistant's messages. That match is computed by code, not AI, and links to the message.
  - **Marking:** a mark box and a comment for each question. Changing the checker's mark requires a reason, which goes to the audit log. For written answers you can ask for an **AI-suggested mark**: rubric levels with quotes from the answer and draft feedback. You can **use it as a starting point**; it never counts until you save a mark.
  - **Chat:** the full transcript with citations.
  - **Activity:** each recorded event with what it does and does not mean.
  - **Drafts:** saved versions of written answers over time.
  - **AI use:** the AI's suggested level for each criterion, with quotes linked to the messages they come from. **You set the levels**, add a comment and save; your version is final.
- **Release marked results** shows results to students whose every question has a mark. You can withdraw results. Every time a teacher opens a student's chat, it is written to the audit log.
- **Class overview:** completion, the spread of marks, results by question with the most common wrong answers, and your AI-use levels across the class.
- **Gradebook:** your decided marks for every assessment, exportable as CSV (cells that look like spreadsheet formulas are neutralised).

## For students

1. Open **Classroom**, choose your class, then **Start**.
2. Read **what is recorded** and **what is never recorded**, tick that you have read it, and start. For example, your chat with the assistant is recorded; your camera, microphone, screen and keystrokes never are.
3. **Use the assistant** on the left to understand the ideas. It answers from your teacher's materials and shows which page it used (click to read it). It will not give you the answers, and your teacher can read the chat. You can share a draft of a written answer to get feedback on your own ideas.
4. **Write your answers** on the right, in your own words.
   - Answers save as you type. If the connection drops they are kept in your browser and saved when you reconnect.
   - Pasting into answers is turned off unless your teacher has given you that accommodation. So is copying from the assistant and the questions.
5. **Submit.** If time runs out, your saved answers are submitted for you. You get a receipt.
6. **Results** appear when your teacher releases them. They show your marks, comments, and your teacher's view of how you used the assistant. You can reply to ask them to look again.
7. **My account → Download my data** gives you everything the server holds about you.

## For administrators

**School settings** has:

- **AI:** the school's key, the model, and the effort for the assistant and for grading.
- **Budget:** a monthly limit and the prices used for the estimate. At the limit the assistant pauses for students and AI suggestions wait; answers are never affected.
- **Privacy and retention:**
  - how many days data is kept after a class ends;
  - where the data is stored (for your records);
  - whether administrators may open students' chats (off by default, always audited);
  - the under-13 consent confirmation, without which classes marked "may include under 13" cannot accept students.
- **Teachers:** the invite code and the list of teachers.
- **AI use:** estimated cost by class and assessment.
- **Audit log:**
  - who opened students' work;
  - changed a checker's mark or an AI-use level;
  - released results;
  - changed settings;
  - deleted data.

  You can also run the retention check now.

## Honest limits

- **Copy and paste blocking** stops pasting and copying inside the assessment page. The desktop app also refuses to copy anywhere in the app while an assessment is open. Nothing stops a student retyping text from another device or app. It is a deterrent and a signal, not proctoring.
- **Leaving the page** is recorded, but not where the student went. Notifications, a second monitor and assistive technology also cause it.
- **The AI can be wrong.** The assistant can make mistakes, and the evaluation and marking suggestions are suggestions. The evaluation set for the AI-use judge has not yet been run against the real model, so its agreement with teachers is not known (see [CLASSROOM_AI.md](CLASSROOM_AI.md#evaluation-set)).
