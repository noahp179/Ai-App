import type { IntegrityKind } from './protocol';

/**
 * Integrity signals are deterrents and things for a teacher to look at. They are never proof, and never a verdict.
 * Every signal is shown with what it does and does not mean.
 */
export const SIGNAL_LABEL: Record<IntegrityKind, string> = {
  paste_blocked: 'Paste attempt (blocked)',
  copy_blocked: 'Copy attempt (blocked)',
  drop_blocked: 'Drag-and-drop attempt (blocked)',
  focus_lost: 'Left the assessment window',
  large_insert: 'A lot of text appeared at once',
  rule_change_attempt: 'Asked the assistant to ignore its rules',
};
export const SIGNAL_MEANING: Record<IntegrityKind, string> = {
  paste_blocked: 'Shows that pasting was tried and stopped. It does not show that work was copied: many people paste out of habit.',
  copy_blocked: 'Shows that copying text from the assistant or the question was tried and stopped. It says nothing about what the student wrote.',
  drop_blocked: 'Shows that dragging text was tried and stopped.',
  focus_lost: 'The assessment window was not in front for a while. This also happens with notifications, a second monitor, assistive technology or looking something up that was allowed.',
  large_insert: 'More text than usual arrived in one step. Dictation, autocomplete and some keyboards do this too. Worth a look, never a conclusion on its own.',
  rule_change_attempt: 'The student’s message matched a phrase such as “ignore your instructions”. The assistant’s rules cannot be changed by students; read the message in the transcript.',
};

/** What every student is told before starting, and what teachers and documentation repeat. */
export const HONEST_LIMITS =
  'Copy and paste blocking and window tracking are deterrents and signals for your teacher. They are not proctoring and not proof of anything: a person could still retype text from another device.';

export function recordedNotice(s: { aiMode: string; blockPaste: boolean; logFocus: boolean; largeInsertSignal: boolean }): { recorded: string[]; never: string[] } {
  const recorded = ['Your answers, saved as you type, and when you submit.', 'How long you spend on each question.'];
  if (s.aiMode !== 'off') recorded.push('Everything you type to the AI assistant and its replies. Your teacher can read this chat, and an AI will suggest to your teacher how well you used the assistant.');
  if (s.blockPaste) recorded.push('Attempts to paste into an answer or to copy text from the assistant or the questions (these are blocked).');
  if (s.logFocus) recorded.push('When you leave this window or tab and when you come back.');
  if (s.largeInsertSignal) recorded.push('When a large amount of text appears in an answer in one step.');
  return {
    recorded,
    never: ['Your camera, microphone or screen.', 'Individual keystrokes.', 'Other apps, tabs or websites, or anything you do before you start or after you submit.'],
  };
}

const RULE_CHANGE = [
  /\b(ignore|disregard|forget|override|bypass)\b.{0,40}\b(rules?|instructions?|prompt|restrictions?|guidelines?|settings?)\b/i,
  /\b(pretend|act as if|imagine|roleplay|role-play)\b.{0,60}\b(no rules|not an? (ai|tutor|assistant)|different (ai|assistant)|teacher said|allowed to)\b/i,
  /\b(system prompt|developer mode|jailbreak|dan mode)\b/i,
  /\byou are (now|no longer)\b.{0,40}\b(free|unrestricted|allowed|tutor|assistant)\b/i,
  /\bmy teacher (said|says|told you|allows?)\b.{0,60}\b(give|tell|show)\b.{0,20}\b(answers?)\b/i,
];

/** Matches messages that try to change the assistant's rules. Deliberately narrow; the transcript is the evidence. */
export function looksLikeRuleChange(text: string): boolean {
  return RULE_CHANGE.some((re) => re.test(text));
}
