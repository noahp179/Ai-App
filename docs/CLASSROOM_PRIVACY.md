# Classroom privacy

This page is for schools, teachers, students and families. It explains what the Classroom feature collects, who can see it, where it goes, how long it is kept and how to get or delete it. It is a description of the software, **not legal advice and not a statement that any school's use of it complies with the law**. Each school or board decides whether and how to use it, and is responsible for its own privacy assessment.

## The short version

- Students are told exactly what is recorded **before** each assessment and must acknowledge it.
- During an assessment only these are recorded:
  - answers and drafts;
  - time per question;
  - the chat with the assistant;
  - blocked paste and copy attempts (how many characters, never what);
  - leaving the page (not where to);
  - large amounts of text appearing at once.
- **Never recorded:** camera, microphone, screen, individual keystrokes, other apps, tabs or websites, location, or anything before starting or after submitting.
- **Students' names are never sent to the AI.** The assistant and the AI suggestions see the questions, the teacher's materials, and the student's messages and answers.
- AI suggestions are suggestions. The teacher decides every mark and level, and nothing is applied automatically.
- Data is deleted automatically a set number of days after a class ends (365 by default).

## What is collected

| Data | Why | Who can see it |
| --- | --- | --- |
| Account: display name, school email or username, password (stored as a salted scrypt hash), role | To sign in and to show the right classes | The person; their teachers (name and login); school administrators |
| Class membership, join date, accommodations (extra time, paste allowed, read aloud, larger text, a private teacher note) | To run the class and apply accommodations | The student sees their own accommodations; the class's teachers see everything |
| Teacher materials (files and their extracted text) | So the assistant can answer from them | The class's teachers. Students only through the assistant's citations, page by page |
| Answers, saved drafts of written answers, seconds per question | Marking and feedback | The student; the class's teachers |
| Chat with the assistant, with citations | Learning, and the AI-use evaluation | The student (if the teacher allows it after release); the class's teachers. Administrators only if the school turns that on, and every opening is logged |
| Activity events, as listed above | Signals the student was told about | The class's teachers |
| Marks, comments, AI-use levels and the student's reply | Feedback | The student sees only what the teacher releases; the class's teachers see all |
| AI suggestions (suggested levels, quotes, rationale, suggested marks) | To help the teacher decide | The class's teachers only. Students never see the AI's version, only the teacher's decision |
| Audit log: who opened which student's work, changed a checker's mark or an AI-use level, released results, changed settings or deleted data | Accountability | School administrators |
| AI usage: token counts and estimated cost per class and assessment, with no content | Budgeting | School administrators |

Not collected: IP-based tracking, analytics, advertising identifiers, device fingerprints, or anything outside an assessment page. Request addresses are used only, in memory, for rate limiting. Cookies are used only for the browser session (HttpOnly, SameSite=Strict, and Secure when the server is set up for HTTPS).

## What goes to the AI provider

AI requests go from the classroom server only, to Anthropic's Claude API, using the school's API key (or the server's).

| Request | Sent | Not sent |
| --- | --- | --- |
| Student assistant | The assessment's rules, the question texts, the attached materials, and the student's messages (and a draft answer only when the student chooses to share it) | The student's name, login, marks, activity events, accommodations |
| AI-use evaluation | The rubric, the questions, and the chat transcript (messages labelled only "student" and "assistant", with short ids) | Name, login, marks, activity events, accommodations |
| Suggested mark for a written answer | The question, the rubric, the teacher's marking notes, the answer | Name, login, chat, activity |
| Drafting questions | The materials and the teacher's focus text | Anything about students |

Materials uploaded as PDF are also sent once to Anthropic's Files API (so the model can see figures) and deleted from it when the material is replaced or the class is deleted.

**The school should read Anthropic's terms on data use and retention for its account, and use an account with a data agreement suitable for student data.** This software cannot check or change those terms. The automated tests check that names are absent from every AI request; that does not prevent a student from typing their own name into the chat.

## Retention and deletion

- **Automatic deletion:** each class is deleted, with all its data, a set number of days after its last day. The default is 365 days, and the school can change it. When no last day is set, it counts from one year after the class was created. Deleted data includes:
  - materials and their files;
  - assessments, attempts, answers and drafts;
  - chats, events, marks and AI suggestions;
  - the provider's copies of files.
- **Leftover accounts:** student accounts left with no class and no work are removed after 30 days. Each class deletion is written to the audit log. The server checks once an hour, and an administrator can run the check at any time.
- **Deleting a class** by its teacher removes everything at once.
- **Removing a student from a class** ends their access. Their submitted work stays with the class until the class is deleted, so marks stay consistent.
- **Backups** are the server operator's responsibility. Deleted data stays in any backup until that backup expires.

## Students' rights

- **See it:** a student can open their results, feedback and (if allowed) their chat once released, and **download everything the server holds about them** from My account. The export includes released marks and comments.
- **Question it:** a student can reply to their teacher's AI-use evaluation to ask them to look again.
- **Correct or delete it:** through the school, which can edit accounts, remove students and delete classes. This version has no self-service account deletion or password change.

## Children under 13

A class can be marked "may include students under 13". Students cannot join such a class until a school administrator confirms, in School settings, that the school has the consent it needs. The confirmation is recorded with the administrator's name and date. The software does not collect ages or verify consent; that stays with the school.

## Ontario and Canadian law, in plain words

These summaries help schools ask the right questions. They are not legal advice, and this software has not been reviewed by a lawyer or a privacy commissioner.

- **MFIPPA** (*Municipal Freedom of Information and Protection of Privacy Act*) governs personal information held by Ontario school boards. It generally expects that collection is necessary for the board's work, that people are told why information is collected, that it is used only for that purpose, and that it is protected and kept only as long as needed. How Classroom supports this:
  - the notice before every assessment;
  - collection limited to the assessment;
  - role-based access;
  - retention settings;
  - the audit log.

  The board still decides whether its use is authorised and does the notice and privacy assessment work.
- **PIPEDA** (*Personal Information Protection and Electronic Documents Act*) covers private organisations handling personal information in commercial activity. It may apply to a private school or a commercial service operating the server. Its principles are similar: consent, limited collection, safeguards, access and accountability.
- **Data location.** The server runs wherever the school installs it. AI requests go to Anthropic, which may process them outside Canada. The "where the data is stored" setting is a note for the school's records and is not checked by the software.

## Security, briefly

Details are in [SECURITY.md](SECURITY.md#classroom-server).

- Stored files and the school's AI key are encrypted with AES-256-GCM using the server's master key.
- The database file itself is not encrypted; use disk encryption.
- In the desktop app the session token is kept in the operating system's secure storage where available.
- Uploads are checked, and scanned with ClamAV when one is configured.

## Honest limits

- Copy and paste blocking, and recording when a student leaves the page, are deterrents and signals, not proctoring. They cannot see another device, and they are not evidence of misconduct on their own.
- The AI can be wrong, and its suggestions can be biased by how students write. Teachers decide; students can ask for a second look.
- The AI-use judge has not yet been measured against teachers' judgements (see [CLASSROOM_AI.md](CLASSROOM_AI.md#evaluation-set)).
