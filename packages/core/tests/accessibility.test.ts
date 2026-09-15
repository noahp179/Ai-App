/**
 * Accessibility contract for the interactive widgets.
 *
 * This is a source-scanning test, which is unusual, and it lives here rather
 * than in the app because the app has no test runner and standing one up for
 * a React Native tree is a great deal of machinery for a rule that is really
 * about the source text.
 *
 * What it guards: the widgets are the signature feature of this app, and they
 * are built from absolutely-positioned views that a screen reader cannot read
 * at all. Every control therefore needs a role and a name, and every result
 * needs to be announced when it changes. That was true once, when it was done
 * by hand; without a check it will not stay true as widgets are added.
 *
 * `PlotCanvas` is not checked here because its label is a required prop, so
 * TypeScript already rejects an unlabelled plot.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const WIDGET_DIR = join(__dirname, '../../../apps/mobile/src/components/interactives');

interface SourceFile {
  name: string;
  text: string;
}

function widgetSources(): SourceFile[] {
  return readdirSync(WIDGET_DIR)
    .filter((f) => f.endsWith('.tsx'))
    .map((name) => ({ name, text: readFileSync(join(WIDGET_DIR, name), 'utf8') }));
}

/**
 * Splits a file into JSX opening tags for one element name.
 *
 * A real parser would be better and is not worth the dependency — these files
 * are formatted by one formatter, so the shape is predictable, and a false
 * positive here fails loudly rather than silently passing something broken.
 */
function openingTags(source: string, element: string): string[] {
  const tags: string[] = [];
  const marker = `<${element}`;
  let from = 0;
  for (;;) {
    const start = source.indexOf(marker, from);
    if (start < 0) break;
    // Stop at the first '>' that is not inside braces, which is the end of the
    // opening tag. Attribute values routinely contain '>' inside expressions.
    let depth = 0;
    let end = start;
    while (end < source.length) {
      const ch = source[end];
      if (ch === '{') depth += 1;
      else if (ch === '}') depth -= 1;
      else if (ch === '>' && depth === 0) break;
      end += 1;
    }
    tags.push(source.slice(start, end + 1));
    from = end + 1;
  }
  return tags;
}

describe('interactive widget accessibility', () => {
  const sources = widgetSources();

  it('finds the widget sources', () => {
    expect(sources.length).toBeGreaterThan(5);
  });

  it('gives every Pressable a role', () => {
    const missing: string[] = [];
    for (const file of sources) {
      for (const tag of openingTags(file.text, 'Pressable')) {
        if (!tag.includes('accessibilityRole')) {
          missing.push(`${file.name}: ${tag.slice(0, 70).replace(/\s+/g, ' ')}…`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it('gives every Pressable a name', () => {
    // Either an explicit label, or a state that names what it toggles. A
    // control a screen reader announces as "button" and nothing else is
    // unusable.
    const missing: string[] = [];
    for (const file of sources) {
      for (const tag of openingTags(file.text, 'Pressable')) {
        if (!tag.includes('accessibilityLabel')) {
          missing.push(`${file.name}: ${tag.slice(0, 70).replace(/\s+/g, ' ')}…`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it('marks toggles and selections with an accessibility state', () => {
    const missing: string[] = [];
    for (const file of sources) {
      for (const tag of openingTags(file.text, 'Pressable')) {
        const role = /accessibilityRole="(\w+)"/.exec(tag)?.[1];
        if (role !== 'switch' && role !== 'radio' && role !== 'checkbox' && role !== 'tab') continue;
        if (!tag.includes('accessibilityState')) {
          missing.push(`${file.name}: role=${role} has no accessibilityState`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it('announces a changing result somewhere in every widget file', () => {
    // A widget whose whole output is a silently-updating view tells a screen
    // reader user nothing. Either a live region or a Readout (which is one)
    // must be present.
    const silent: string[] = [];
    for (const file of sources) {
      if (file.name === 'shared.tsx' || file.name === 'index.tsx') continue;
      const announces =
        file.text.includes('accessibilityLiveRegion') || file.text.includes('<Readout');
      if (!announces) silent.push(file.name);
    }
    expect(silent).toEqual([]);
  });
});
