/**
 * Student-friendly names for curriculum expectations. The Ministry organises each course into strands (used here as
 * units, e.g. "Number", "Biology") and overall expectations with short headings (used as topics, e.g. "Powers").
 * Some headings are the same in every strand ("Investigating and Understanding Concepts"); those get a plain name.
 */
export interface TopicInfo {
  /** The strand, shown as the unit, e.g. "Number". */
  unit: string;
  /** The strand letter, e.g. "B". */
  unitIndex: string;
  /** What the student is learning, e.g. "Scientific notation" or "Powers". */
  topic: string;
  /** An "I can …" goal written by FlowCompanion, only where it has an offline lesson. */
  goal: string | null;
}

const GENERIC: [RegExp, string][] = [
  [/^investigating and understanding concepts$|^understanding (basic )?concepts$/i, 'Key ideas'],
  [/^relating science (and technology )?to (our changing world|society,? and the environment)$/i, 'Science, technology and society'],
  [/^developing (skills of )?investigation and communication( skills)?$|^developing investigation and communication skills$/i, 'Investigation skills'],
  [/^stem investigation skills$/i, 'Investigation skills'],
  [/^applications, careers, and connections$/i, 'Careers and real-world uses'],
  [/^mathematical processes$/i, 'Math thinking skills'],
  [/^social-emotional learning( \(sel\))? skills/i, 'Social-emotional learning skills'],
];

/** A topic name from an overall expectation's heading, falling back to the strand when there is no useful heading. */
export function plainTopic(heading: string, strandTitle: string): string {
  const h = heading.trim().replace(/[.:]$/, '');
  if (!h) return strandTitle;
  for (const [re, plain] of GENERIC) if (re.test(h)) return plain;
  return h;
}

/** "B · Number" — how a unit is shown. */
export const unitLabel = (t: Pick<TopicInfo, 'unit' | 'unitIndex'>) => (t.unitIndex ? `Unit ${t.unitIndex}: ${t.unit}` : t.unit);
