# Resume Studio — Project Guide for Claude Code

This file is read on every session. Read it first before touching code.

---

## 1. What this is

A web app that lets a consultant maintain **one master resume across multiple
languages** and extract **targeted variants** for different skill areas. The
project was scaffolded conversationally and is now being continued in Claude
Code.

**Core promise:** the consultant edits once (in the language they choose), can
view/edit any field in two languages side-by-side, and exports polished `.docx`
or `.pdf` files via configurable templates.

It is **not** yet:
- Persistent (data lives only in memory for the session)
- Auto-saving
- Backed by a database or any backend (intentionally — runs entirely client-side)
- Capable of generating targeted resumes (filter master by skill tags → export)

Those are the planned next features. See section 9.

---

## 2. Stack and conventions

| Layer | Choice | Notes |
|---|---|---|
| Build | Vite 5 | `npm run dev` / `npm run build` / `npm run preview` |
| Framework | React 18 + TypeScript | Strict mode on |
| State | Zustand (single store) | See `src/store/useStore.ts` |
| Icons | lucide-react | **Tree-shaken**: import each icon by name, never `import * as` |
| Document gen | `docx` npm package | Real `.docx` output; verified against MS Word |
| PDF gen | Browser print pipeline | HTML → `window.print()` → system Save-as-PDF |
| Styling | Inline `<style>` blocks per component + CSS custom properties in `src/index.css` | No Tailwind, no CSS-in-JS lib — keep it that way |

### Code style rules
- **TypeScript strict mode.** Always typecheck with `npx tsc --noEmit` before committing.
- **No `any`** unless interfacing with truly unknown shapes (e.g. raw imported JSON). Use `unknown` then narrow.
- **No default exports** for components — use named exports. (`main.tsx` and `App.tsx` are the only existing default exports; new components are named.)
- **Inline styles via `<style>` tag inside the component.** Each component owns its CSS. Tokens come from `src/index.css` (see section 6).
- **Lucide icons must be imported by name**, e.g. `import { Star, ChevronDown } from 'lucide-react'`. Do not import `* as Icons` — it breaks tree-shaking and bloats the bundle by ~700 kB.
- **No `process.env` at runtime.** This is a pure browser app.
- **Run `npm run build` after substantial changes** — Vite's prod build catches issues `tsc --noEmit` misses (missing exports from third-party packages, dynamic import problems).

### Naming
- Files: `PascalCase.tsx` for components, `camelCase.ts` for libraries.
- Types: `PascalCase`, no `I` prefix.
- Store actions: imperative verbs (`addItem`, `updateItem`, `navigateToItem`).
- Locale codes follow CVpartner where compatible: `en`, `no`, `se`, `dk`. The original `int` is normalized to `en` on import.

---

## 3. Architecture map

```
src/
├── types/index.ts             ← single source of truth for the data model
├── store/useStore.ts          ← Zustand store + generic CRUD actions
├── lib/
│   ├── importer.ts            ← CVpartner JSON → ResumeStore
│   ├── experience.ts          ← PURE: compute role/skill totals across data
│   ├── exporter.ts            ← .docx (docx lib) + .pdf (HTML+print)
│   ├── locales.ts             ← LOCALE_LABELS, resolve(), fmtDate(), fmtRange()
│   ├── sections.ts            ← Sidebar section definitions and groups
│   └── templateCatalog.ts     ← Which sections/fields appear in export templates
├── components/
│   ├── ImportScreen.tsx       ← Landing screen (drop CVpartner JSON)
│   ├── layout/
│   │   ├── Sidebar.tsx        ← Section navigation
│   │   └── LanguageSwitcher.tsx
│   ├── ui/
│   │   ├── DualField.tsx      ← THE KEY COMPONENT — side-by-side localized input
│   │   ├── EditorCard.tsx     ← Collapsible card with star/hide/reorder/delete
│   │   └── Fields.tsx         ← TextField, DateField, TagField (plain inputs)
│   └── editor/
│       ├── Overview.tsx       ← Dashboard with stats + translation %
│       ├── HeaderEditor.tsx   ← Personal details
│       ├── ProjectsEditor.tsx ← Edit mode for projects (the richest editor)
│       ├── ProjectsOverview.tsx ← Read-only project overview (click to edit)
│       ├── SimpleEditors.tsx  ← Work/Education/Courses/Certs/etc.
│       ├── RegistryEditors.tsx ← Skill/Role/Reference/TechCat editors
│       ├── ExportTemplatesEditor.tsx ← Visual template designer + export buttons
│       └── shared/
│           ├── RoleBlock.tsx       ← Per-role label+description (reused by projects+work)
│           ├── SkillBlock.tsx      ← Skill chips linked to registry (reused)
│           └── ExperiencePanel.tsx ← Computed total + offset + contributing items
├── App.tsx                    ← Routes activeSection to the right editor
├── main.tsx                   ← React entry
└── index.css                  ← Design tokens + body/scrollbar/animations only
```

### Layered design — these layers must stay clean
1. **`types/`** has zero runtime imports. Pure type definitions.
2. **`lib/`** is pure logic. No React, no DOM (except `exporter.ts` for the print window). Easy to test.
3. **`store/`** owns mutable state. Only place where data lives.
4. **`components/`** read from the store and call store actions. No business logic in components — if a computation is more than one line, it goes in `lib/`.

If you're tempted to put computation in a component file, add a function to `lib/` instead.

---

## 4. The data model — read this carefully

The data model was carefully designed across several iterations. Don't change shapes without considering the consequences.

### Localization
Every translatable field is a `LocalizedString = Record<string, string>` keyed by locale. Resolution chain (in `lib/locales.ts` → `resolve()`):
1. Requested locale
2. Fallback locale (default `"en"`)
3. First available key

**Never** check `value[locale]` directly in components — always go through `resolve()` so the fallback chain works.

### Dates
- `YearMonth = { year: number, month: number | null }` — month-precision, not full dates. `month: null` means only year is known.
- `end: null` on date ranges means ongoing.
- `Duration = { years: number, months: number }` is used for **manual offsets** on roles/skills. Never use floats for offsets.

### Two kinds of "duration"
- **Computed durations** (across projects + employment) live nowhere on entities. They're calculated on demand via `computeRoleExperience()` / `computeSkillExperience()`. Don't add `total_months` fields to roles or skills — that's deliberately avoided.
- **Manual offsets** live as `experience_offset: Duration` on `Role` and `Skill`. They fold into the computed total.

### The shared registries
- **`Skill`** lives in a global registry (`data.skills`) and is referenced by `ProjectSkill` and `CategorySkill` via `skill_id`. Both projects AND employment carry `skills: ProjectSkill[]`.
- **`Role`** also lives in a global registry (`data.roles`). `ProjectRole` references it via `role_id`. Both projects AND employment carry `roles: ProjectRole[]`.
- **Snapshot names**: `ProjectSkill.name` and `ProjectRole.name` are denormalized copies of the registry's name at link time, so a registry rename doesn't silently rewrite history. The registry name is the source of truth for display lookups; the snapshot is a fallback when the link is broken.

### What's an entity vs. an embedded array
- Tables (`projects`, `educations`, `courses`, etc.) live as top-level arrays in `ResumeStore`.
- Sub-collections that are tightly bound to a parent (a project's roles, a project's skills, a key qualification's bullet points, a tech category's skills) are **embedded arrays** on the parent entity. Don't promote these to top-level tables.

### Disabled vs. starred
- `disabled: true` excludes from all exports and overview lists. Used to soft-delete.
- `starred: true` is featured/highlighted ordering. Used by "starred-only" export filtering.

---

## 5. Multi-language UI — the dual-view pattern

The single most important UX requirement: **every translatable field renders as two inputs side-by-side**, primary language on the left, secondary on the right. The user can:
- Pick which two locales are visible (independent of which locales the master resume supports).
- Swap them with one click.
- Hide the secondary column to focus on one language.

**Implementation:**
- `useStore().primaryLocale` and `useStore().secondaryLocale` (the latter can be `null` to mean "single column mode").
- The `DualField` component reads these directly and renders 1 or 2 inputs accordingly. Components calling `DualField` never need to know about locales — just pass the `LocalizedString` and a setter.
- The secondary input gets a subtle cyan tint (CSS var `--secondary-tint`) to distinguish from the primary (which uses the Cartavio navy accent on focus).

**Rule:** Every component that touches a `LocalizedString` must use `DualField`. Never render a single text input bound to one locale.

---

## 6. Design tokens and styling

CSS custom properties in `src/index.css` are the design system:

```css
--paper, --paper-raised, --paper-sunken    /* backgrounds */
--ink, --ink-soft, --ink-faint             /* text */
--line, --line-strong                      /* borders */
--accent (#002E6E), --accent-bright, --accent-wash  /* Cartavio navy (verified from live site) */
--secondary-tint, --secondary-line, --secondary-ink /* Cartavio cyan #00B8DE, for secondary locale */
--gold (#9a7b3f)                           /* star/featured indicator */
--serif: 'Open Sans Condensed' weight 300  /* heading font — matches cartavio.no */
--sans: 'Ubuntu' + system                  /* body font — matches cartavio.no */
--r-sm/--r-md/--r-lg                       /* border radii */
--shadow-sm/-md/-lg
```

**Aesthetic:** Cartavio brand — pure white backgrounds, Cartavio navy (#002E6E) as the primary accent, cyan (#00B8DE) as the secondary/highlight. Open Sans Condensed (weight 300) for headings, Ubuntu for body. Colors and fonts verified directly from cartavio.no CSS. No warm/sepia tones, no oxblood. Brand skill: `.claude/skills/cartavio-brand.md`.

When adding a component, copy the inline `<style>` pattern from an existing one (e.g. `DualField.tsx`). Use the tokens, don't introduce new colors casually.

---

## 7. The store — patterns to follow

### Reading
```ts
const data = useStore(s => s.data)
const projects = useStore(s => s.data.projects)
```

### Generic CRUD (use these — don't write custom mutations per section)
```ts
const { addItem, updateItem, removeItem, reorderItem } = useStore()

addItem('projects', newProject)
updateItem('projects', projectId, { customer: localized })
removeItem('projects', projectId)
reorderItem('projects', projectId, 'up' | 'down')
```

The generic functions are typed: `updateItem('projects', id, { customer: ... })` will autocomplete to the fields of `Project`. Use them rather than writing one-off mutations.

### Navigation
- `setActiveSection(key)` to switch sidebar section.
- `setExpandedItem(id)` to toggle an `EditorCard` open/closed.
- `navigateToItem(section, id)` to jump to a specific item in a specific section (used by registry "contributing items" lists). Sets active section AND expanded item in one go.

### Adding a new section
1. Add the array to `ResumeStore` in `types/index.ts`.
2. Add the empty array to `emptyStore` in `useStore.ts`.
3. Add an entry to `SECTIONS` in `lib/sections.ts`.
4. Add the icon import to `Sidebar.tsx`'s `ICON_MAP`.
5. Create the editor component and wire it into `App.tsx`'s router.
6. If it should appear in exports: add to `SECTION_CATALOG` in `lib/templateCatalog.ts` and add a `case` to both `buildDocxSection` switch in `exporter.ts` and `renderHtmlSection`.

---

## 8. Importer notes (CVpartner format)

`src/lib/importer.ts` maps the CVpartner JSON export to our `ResumeStore`. Key behaviors:

- Localized values can be objects (`{ no: "...", int: "..." }`) or interleaved arrays (`['no', '...', 'int', '...']`). The `localized()` helper handles both. The `int` locale code is renamed to `en` on import.
- The exporter's source `language_codes` field is unreliable (often only lists `no` even when content is in `no`, `int`, `se`, `dk`). We scan all content recursively to detect actually-used locales — see `scanLocales()` in `importFromCVPartner`.
- Skills are built from `technologies[].technology_skills` AND any extra skills referenced only by projects (no orphans).
- Roles come from `cv_roles`. Project roles link via `cv_role_id`.
- `project.related_work_experience_id` → our `work_experience_id`. The work-experience id map is pre-built before projects map so links resolve.
- `customer_selected: 'customer_anonymized'` → our `use_anonymized: true`.

**If you're modifying the importer:** test against the real file. There's no fixture in the repo yet, but the user has a CVpartner JSON for verification. Add a `tests/fixtures/` and a small smoke test if you touch this.

---

## 9. Planned next features

Ordered by recommended priority. Each is a self-contained chunk.

### 9.1 Persistence (HIGH — do this first)
Currently a refresh loses all data. Two reasonable approaches:

**Option A: localStorage** — easiest, but limited to ~5 MB per origin. A medium-size resume comes in well under that. Serialize `data` to JSON, save on every change (debounced), load on app start.

**Option B: file-system save/load** — explicit "Save to file" / "Load from file" buttons. Lower magic, gives the user control, no quota worries.

Recommend implementing **both**: localStorage for auto-save, file save/load as explicit backup + portability mechanism. Make auto-save toggleable.

### 9.2 Targeted resumes
This is the original project goal — the second half of "extract each item into different targeted resumes for different skill areas." The `TargetedResume` type already exists (`types/index.ts`). Build:
- A "Targeted Resumes" section in the sidebar listing saved targeted configs.
- An editor where you set: name, locale, skill tags (filter rule), section list, starred-only toggle, page limit, and which `ExportTemplate` to use.
- A preview that shows the filtered resume.
- Export buttons that combine the targeted config + chosen template.

The filter logic should be a pure function in `lib/` (next to `experience.ts`), taking `(ResumeStore, TargetedResume) → ResumeStore` (a filtered subset). The exporter already takes a `ResumeStore`, so it should "just work" with a filtered store.

### 9.3 Drag-and-drop reordering
Currently uses up/down arrow buttons. Should switch to drag-and-drop. Use `@dnd-kit/core` + `@dnd-kit/sortable`. Don't use `react-beautiful-dnd` — it's unmaintained.

### 9.4 Undo/redo
The store has all the right shape (immutable updates) for an undo stack. Add a history slice that pushes a snapshot of `data` on each change and supports rewind. Wire to Cmd/Ctrl+Z.

### 9.5 Code-splitting the bundle
The `docx` library is ~400 kB of the current bundle. Lazy-load `lib/exporter.ts` only when the user clicks an Export button:
```ts
const { exportDocx } = await import('./lib/exporter')
```
This cuts initial JS to ~230 kB.

### 9.6 Translation completeness drill-down
The Overview shows a translation % per locale. Make it interactive: click a percentage → show a list of fields that are missing in that locale, each linking to the right editor and item.

### 9.7 Skill / role merge
Real data has typos like "Løsningarkitekt" vs "Løsningsarkitekt" appearing as two separate registry entries. Add a "merge into…" action on the registry editor that re-links all references and deletes the redundant entry.

### 9.8 Tests
There are no tests yet. The two highest-value places to start:
- `lib/experience.ts` — pure function, easy to unit test, would catch regressions in totals.
- `lib/importer.ts` — table-driven tests with sample CVpartner JSON snippets.

Use Vitest (Vite-native, fast).

---

## 10. Operational notes

### Common commands
```
npm install              # first time only
npm run dev              # dev server at http://localhost:5173
npm run build            # production build to dist/
npm run preview          # serve dist/ to verify the prod build works
npx tsc --noEmit         # typecheck without emitting
```

### Verifying changes
After any significant change:
1. `npx tsc --noEmit` — must be clean.
2. `npm run build` — must be clean (catches things tsc misses).
3. Try the import flow with the real CVpartner JSON if you touched the importer or the data model.
4. Open the dev server and click around — there's no test suite yet.

### Known quirks
- The bundle includes the whole `docx` library upfront because it's imported statically. Lazy-load it when you touch the exporter (see 9.5).
- The `.pdf` export uses `window.open()` + `window.print()`. **Pop-ups must be allowed.** The user gets an alert if blocked.
- Project skills imported from CVpartner may have proficiency=0 across the board (the source file doesn't populate them). Don't assume non-zero proficiency exists.

### What NOT to change without good reason
- The dual-view multi-language pattern (DualField). It's the whole point of the app.
- The shared role/skill registry design. Computing experience across projects + employment depends on it.
- Storing `experience_offset` as `Duration` (years + months), not a float.
- The CVpartner importer's locale detection — it handles real-world malformed exports.

---

## 11. Working with this project in Claude Code

A few tips specifically for this codebase:

- **Always read the relevant file before editing.** Files are small; reading is cheap.
- **`types/index.ts` is the source of truth.** When in doubt about a field, look there.
- **The store actions are generically typed.** Use them; don't write per-section update functions.
- **Inline styles live next to the component.** Don't extract to global CSS unless something is truly cross-cutting (in which case it goes in `index.css` as a CSS var or animation keyframe).
- **Before adding a dependency**, check the bundle size (`npm run build` shows it). This is a client-side app; every dep ships to users.
- **The `docx` library's API uses `italics: true`, not `italic: true`.** Easy mistake; tsc catches it.
- **Lucide icons:** check the icon exists before using it (`grep -o "IconName" node_modules/lucide-react/dist/esm/lucide-react.js`). `IdCard` and a few others don't exist in this version; use `SquareUser` etc.

If a request is large or touches many files, propose a plan first — list the files you'd change and what each change is. Then proceed once confirmed.
