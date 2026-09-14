# Design canvas

Seven artboards for Synapse, laid out on one pan/zoom canvas.

| Artboard | What it shows |
|---|---|
| `Main.dc.html` | **Today** — the home screen, hero-first |
| `Lesson.dc.html` | **Lesson** — a real question, graded, with the feedback sheet up |
| `Complete.dc.html` | **Lesson complete** — XP, accuracy, and what the session strengthened |
| `Lab.dc.html` | **Lab** — the experiment index, with working filters |
| `Widget.dc.html` | **Interactive widget** — the network trainer, running real backprop |
| `Desktop.dc.html` | **macOS window** — the tab bar as a sidebar at Mac and iPad widths |
| `Tokens.dc.html` | **Design system** — colour, type, spacing, components, icons, motion |

Every value in these files is the one in `packages/ui/src/theme/tokens.ts`. Four
of the artboards are live prototypes, not pictures: answer the question, filter
the Lab, train the network.

`canvas.json` positions the artboards and carries the sticky notes explaining
what is shipped versus what is proposed.

## Rebuilding

```bash
node "<design skill dir>/seed-canvas.mjs" \
  --template "<design skill dir>/payload.template.html" \
  --out synapse-screens.html --title "Synapse Screens" \
  --artboard Main.dc.html --artboard Lesson.dc.html --artboard Complete.dc.html \
  --artboard Lab.dc.html --artboard Widget.dc.html --artboard Desktop.dc.html \
  --artboard Tokens.dc.html --canvas canvas.json
```

Then publish `synapse-screens.html` as an Artifact. The seeded file is
gitignored — it is a copy of the editor payload with these files injected.

Each `.dc.html` is a standalone document: markup inside `<x-dc>`, CSS in
`<helmet>`, and behaviour in a `class Component extends DCLogic` script.
