# Unify the Skills Showcase into the skill-category system

**Status:** planned (approved by owner 2026-07-04) — not yet implemented.
**Prereq reading:** CLAUDE.md §4 (data model), §7 (store patterns, `loadStore` vs
`replaceData`), §8 (shape versioning / `migrate.ts`), the export-pipeline skill,
and the store-and-persistence skill. Shape version at time of writing: **5**.

---

## 1. Context — what exists today and why it's being unified

Two parallel skill groupings exist:

| | Skill Registry (`skills` + `skill_categories`) | Skills Showcase (`technology_categories`) |
|---|---|---|
| Grouping | `Skill.category` — ONE free-text string per skill; `skill_categories: string[]` (shape v5) keeps emptied names alive | `TechnologyCategory` entities: localized `name`, curated `CategorySkill[]` membership (skill can be in several), curated `sort_order` |
| Export | Indirect — Skill Matrix "Category" column (`classification \|\| category`) | Direct — its own exportable section (group name + skill-name tags) |
| Editor | Skill Registry page (list + By-category view w/ drag, auto-categorize, quick-drop panel) | Separate "Skills Showcase" page (chip add/remove per group) |

Problems: double maintenance of near-identical groups, silent drift, the
registry's By-category view *looks* like the showcase editor but isn't, two
export paths can disagree, and `Skill.default_category` is a write-only
vestige. Decision (owner): **unify — the showcase becomes a projection of
registry categories.** This matches the app's design philosophy: master data +
views that project it (Resume Views, Skill Matrix, Promoted Projects).

---

## 2. Target model

### 2.1 New entity (fourth registry-ish kind, but NOT a CRUD section)

```ts
export interface SkillCategory {
  id: string
  resume_id: string
  name: LocalizedString          // localized! (fixes the old string-only gap)
  sort_order: number             // curated export order (seeded from old showcase)
}
```

- `ResumeStore.skill_categories` changes type: `string[]` (v5) → `SkillCategory[]` (v6).
- Keep it EXCLUDED from `SectionKey` (already is) — it is managed through
  dedicated pure helpers, not generic CRUD.

### 2.2 Skill links by id

```ts
export interface Skill {
  ...
  category_id?: string | null    // NEW — link into skill_categories
  // REMOVED: category: string | null
  // REMOVED: default_category (write-only vestige — delete outright)
}
```

Rationale: entities with id links follow the existing registry pattern
(`role_id`, `industry_id`); renaming a category is then a single entity edit.

### 2.3 The showcase becomes a virtual section

- `TechnologyCategory`, `CategorySkill`, the `technology_categories` store
  array, and the `TechCategoriesEditor` page are **removed**.
- The view-section **key `technology_categories` is kept** (label "Skills
  Showcase") but becomes `virtual: true` in `lib/sections.ts` (like
  `promoted_projects` / `skill_matrix`), `storeKey: 'skills'`, and is dropped
  from the sidebar. Keeping the key means saved views' detail levels, section
  ordering, and `viewTemplates.ts` entries keep working unchanged.
- Render items derive at render time from `skill_categories` + `skills` via a
  new pure builder (see §4.3).

---

## 3. Decisions (defaults chosen; ⚠ = confirm with owner before implementing)

| # | Decision | Choice | Notes |
|---|---|---|---|
| D1 | Link mechanism | `Skill.category_id` (entity id) | Registry pattern; rename = one edit |
| D2 | View-section key | keep `technology_categories`, virtual | Saved views + templates survive untouched |
| D3 | Migration conflict | existing `Skill.category` string wins; blanks filled from showcase membership (first group wins) | Registry is the recently-curated source |
| D4 ⚠ | Curation signal | skills that were in ANY old showcase group get `is_highlighted: true` | Preserves the old curation for 'summary' detail; slightly overloads the existing flag |
| D5 | Detail semantics | `full` = all categorized skills grouped; `summary` = highlighted skills only; **Uncategorized group never exports**; empty categories never export (but DO show in the editor) | Mirrors skill-matrix semantics |
| D6 ⚠ | Category order | `SkillCategory.sort_order`, seeded from old showcase order (categories not in the showcase appended alphabetically). By-category headers get ↑/↓ buttons; the drop panel + filter stay alphabetical | Trimmable to "alphabetical everywhere" if scope must shrink — but that loses curated CV ordering |
| D7 | Per-group data | `CategorySkill.proficiency` + per-group skill order are dropped; skills within a group render highlighted-first, then alphabetical | Imports carried proficiency=0 anyway |
| D8 | Multi-membership | dropped; migration assigns the FIRST group containing the skill | Count these in a migration note if trivial, else silent |
| D9 | Localization | category names join `completeness.ts` (actively-used = ≥1 linked skill) and get a rename affordance (DualField in a `TranslationPopover`) on the By-category header | NOT added to the missing-translation batch list (trimmed scope) |
| D10 | AI exchange format | `resumestudio-ai/v1` UNCHANGED (external contract, template is public); importer maps its `technology_categories` into categories + links | |
| D11 | Backup format | `format_version` stays 1; `sections.technology_categories` becomes optional-legacy in the type; content migration (shape v6) does the conversion on load | Envelope vs content versioning — don't conflate (CLAUDE.md §8) |
| D12 | Shape version | **6** | Structural: array retyped + links moved |
| D13 | Category merge | deferred follow-up (mergeRegistry gains a 4th kind later) | Delete + reassign covers the near-term need |

---

## 4. Implementation phases

Each phase should end green (`npm run typecheck && npm test`) and be a separate
commit. Phase 1 will not compile until Phase 2/3 call-sites are adjusted — so
Phases 1–3 may need to land as one commit; keep the *work* ordered anyway.

### Phase 1 — types, migration, lib core

**`src/types/index.ts`**
- Add `SkillCategory` (above). Change `skill_categories?: string[]` →
  `skill_categories?: SkillCategory[]` (keep optional; migration guarantees it).
- `Skill`: add `category_id?: string | null`; delete `category` and
  `default_category`.
- Delete `TechnologyCategory` and `CategorySkill` interfaces; remove
  `technology_categories` from `ResumeStore`. `SectionKey` keeps excluding
  `skill_categories`.

**`src/lib/freshStore.ts`** — remove `technology_categories: []`; keep
`skill_categories: []` (now typed as entities).

**`src/lib/migrate.ts`** — bump `CURRENT_SHAPE_VERSION = 6`; add
`unifyShowcaseCategories(store)` to the chain (after `internSkillCategories`).
Spec (idempotent shape-sniffer — must tolerate unstamped data):

1. Build category entities:
   - Start from v5 `skill_categories` strings AND every used `Skill.category`
     string → entities `{ id: uuid, resume_id, name: { en: str }, sort_order }`.
     Dedupe case-insensitively (use the `localizedKey` helper pattern).
   - For each legacy `TechnologyCategory` (if the array exists): find-or-create
     an entity by name key; adopt its **full LocalizedString name** (richer than
     the plain string) and remember its showcase position.
   - `sort_order`: old showcase order first, remaining categories appended
     alphabetically.
2. Rewrite skills: `category` string → `category_id` (matching entity);
   delete the `category` and `default_category` keys from every skill object
   (rebuild objects, don't `delete` in place — stay pure).
3. Fill blanks from showcase membership (D3) and set `is_highlighted: true`
   for every skill referenced by any `CategorySkill` (D4).
4. Rewrite every view's `excluded_item_ids`: old `TechnologyCategory.id` →
   the corresponding new `SkillCategory.id` (name-mapped). Unmatched ids pass
   through untouched (harmless).
5. Drop the `technology_categories` key from the store object.
6. Idempotence guard: if `skill_categories` entries are already objects (have
   `.id`) and no `technology_categories` key exists and no skill has a
   `category` string → return the same reference.

Note: the v5 `internSkillCategories` migration still runs first for ≤v4 data
(producing `string[]`), then v6 converts. Keep both; v6 must accept both a
`string[]` and an already-entity array (idempotence).

**`src/lib/skillCategorize.ts`** — rewrite the category helpers around ids:
- `skillCategoryList(store): SkillCategory[]` — entities sorted by
  `sort_order` (export/editor order); keep a `categoryNameResolver(store,
  locale): (skill) => string` or a prebuilt `Map<id, name>` helper for display.
- `effectiveSkillCategory(skill, byId, locale): string` — resolve
  `category_id` → localized name, else `UNCATEGORIZED_LABEL`. (Signature
  changes; update all call sites: list subtitle, By-category grouping,
  category filter, contentSearch/skillMatrix if they used it.)
- `assignSkillCategory(store, skillId, categoryIdOrNewName)` — accept an
  existing id OR free text (find case-insensitively / create entity, appended
  `sort_order`); sets `category_id`.
- `clearSkillCategories(store, ids)` — set `category_id: null` (categories
  persist — unchanged semantics).
- `deleteSkillCategory(store, categoryId)` — remove entity + null every
  linking skill. Now by id, not name.
- `renameSkillCategory(store, categoryId, name: LocalizedString)` — new.
- `moveSkillCategory(store, categoryId, dir: 'up'|'down')` — new (D6).
- `autoCategorizeSkills` — assignments create/find entities per Quadim
  domain (store the English name under `en`; the resolve() fallback chain
  handles other primaries) and set `category_id`. The
  `CategoryAssignment.category` stays a display string for the preview.

**NEW `src/lib/showcase.ts`** (pure) — the render builder:
```ts
export interface ShowcaseGroup {
  id: string                 // SkillCategory.id — the excludable item id
  name: LocalizedString
  skills: Skill[]            // highlighted-first, then alphabetical (resolved name)
}
export function showcaseGroups(
  store: ResumeStore, view: ResumeView, detail: 'full' | 'summary',
): ShowcaseGroup[]
```
- Groups = `skill_categories` by `sort_order`; skip ids in
  `view.excluded_item_ids`; skip groups that end up with zero skills;
  never emit an Uncategorized group (D5).
- `summary` → highlighted skills only; `full` → all linked skills.
- Exclude individual skills? No — skill-level exclusion stays a Skill-Matrix
  concern; keep group-level only (excluded ids are category ids).

### Phase 2 — render/export/derived-data paths

**`src/lib/sections.ts`** — `technology_categories` entry becomes
`{ ..., storeKey: 'skills', virtual: true, hidden: true }` (drops out of the
sidebar; stays in the view editor via `isExportableSection`). Extend
`canonicalSectionKey()` to fold `technology_categories` → `skills` so old
deep links `/r/:id/technology_categories` land on the Skill Registry.

**`src/lib/viewFilter.ts`**
- `defaultViewDetail`: KEEP `technology_categories` defaulting to `'full'`
  (existing views expect it on).
- `applyView`: already skips `virtual` sections — verify, no change expected.
- `buildViewHtml` (~line 355): add a branch beside `promoted_projects`:
  `s.key === 'technology_categories' ? showcaseGroups(store, view, detail)` —
  feeding the SAME `SECTION_CATALOG.technology_categories` descriptor.

**`src/lib/sectionCatalog.ts`** — the `technology_categories` descriptor now
receives `ShowcaseGroup` items: `title` = resolved `name`; `summary` = one
line "Name: skill, skill, …"; `full` = `view({ title, tags })` — i.e. the
current render output is PRESERVED, only the item source changes. Descriptors
return data only; adapters own escaping (unchanged).

**`src/lib/exporter.ts`** (~line 366) and **`src/lib/viewText.ts`** — mirror
the same virtual-items branch as `promoted_projects`. (viewText: locate its
promoted_projects branch; same pattern.)

**`src/lib/skillMatrix.ts`** — Category column: `classification ||
categoryName(category_id)` via a prebuilt id→name map (resolved in the row
locale).

**`src/lib/completeness.ts`**
- Remove the `technology_categories` section case (~line 276) and the
  used-skill scan over it (~line 143 — skill usage is now projects only).
- ADD: actively-used `SkillCategory` names (≥1 linked skill) to the
  registry-names block, so untranslated category names count against
  completeness (D9).

**`src/lib/usage.ts`** — `SkillUsage` loses `technology_categories`;
`usageOfSkill` returns projects only; `isSkillUnused` simplifies.

**`src/lib/merge.ts`** — skills descriptor: drop the `technology_categories`
rewrite + count branches (project skills remain).

**`src/lib/wipeLocale.ts`** — remove the tech-cat branch; ADD wiping of
`skill_categories[].name` locales. Remove the `default_category` line.

**`src/lib/snapshotDiff.ts` / `src/lib/diffResume.ts`** — remove/replace their
`technology_categories` section entries (diff labels). Add `skill_categories`
to whichever diff surfaces named sections (verify how sections are enumerated —
both may iterate SECTIONS and need nothing beyond the sections.ts change).

**`src/lib/contentSearch.ts`** — recursive collector: verify it needs no
change (it walks the store generically); check any explicit Category display
that referenced `skill.category` and repoint through the id→name map.

**`src/lib/skillNormalize.ts`** — drop the `fixCopies` pass over
`technology_categories` (CategorySkill snapshots no longer exist).

**`src/lib/viewTemplates.ts`** — keys keep working (D2); no change. Verify.

### Phase 3 — UI

**`src/components/editor/RegistryEditors.tsx`**
- DELETE `TechCategoriesEditor`, `CategorySkillChip`, `linkSkillIntoCategory`,
  `createSkillAndLink`, and their styles (~200 lines).
- `SkillsEditor`: all category reads/writes go through the new id-based
  helpers (`assignSkillCategory` / `effectiveSkillCategory(skill, byId,
  locale)` / `skillCategoryList`). The `CategoryField` autocomplete commits by
  resolving text → existing entity (case-insensitive) or creating one; its
  option list = entity names resolved in the primary locale; the "New
  category" row semantics stay.
- Category filter dropdown: entities (value = id, label = resolved name +
  count); "Uncategorized" filter option keyed by sentinel.
- By-category view (`RegistryCategoryView`): `CatItem.category` becomes the
  category **id** (sentinel for uncategorized); groups built from
  `skillCategoryList` (so empty categories still render, sorted by
  `sort_order`); headers gain ↑/↓ (D6) and a **rename** affordance (DualField
  popover — reuse `TranslationPopover`); header trash keeps calling
  `deleteSkillCategory` (by id). Drop-target ids become category ids.
- `AutoCategorizePanel`, quick-drop panel, chip "×", lightbox delete: all keep
  working through the new helpers — update wiring only.

**`src/App.tsx`** — remove the `TechCategoriesEditor` import + route case.
(Old URLs handled by `canonicalSectionKey`.)

**`src/components/editor/Overview.tsx`** — replace the "Skills Showcase" stat
with `{ label: 'Skill categories', count: skill_categories.length, key: 'skills' }`.

**`src/components/editor/views/ViewEditor.tsx`**
- The per-section item list + counts (~lines 228, 373) iterate
  `data[s.storeKey]` — add a virtual branch: for `technology_categories` the
  excludable items are `skillCategoryList(data)` (id + resolved name), like
  promoted projects. Verify how `promoted_projects` items are listed here and
  mirror it.
- The header "N items visible" total (~line 228) must not double-count skills
  for the virtual section — check how `skill_matrix`/`promoted_projects` are
  treated there today and follow suit.

### Phase 4 — importers

**`src/lib/importer.ts` (CVpartner)** — `technologies[]` →
`SkillCategory` entities (localized names via `localized(cat.category)`,
showcase order = `sort_order`); each technology skill: create the registry
skill (as today) AND set `category_id` to its group (first wins), and
`is_highlighted: true` (D4 — showcase membership implied curation). Remove the
`technology_categories` output array. (`default_category` disappears with the
type.)

**`src/lib/aiImport.ts`** — format v1 unchanged (D10): keep accepting
`technology_categories` in `AIImportDraft` + `ARRAY_SECTIONS` + validation;
`importFromAIDraft` maps each group → SkillCategory + `category_id` on the
interned skills (+ highlight). Preview summary line "tech categories" →
"skill categories" (count of created categories).
**`public/ai-import-template.md`** — no schema change; adjust the comment on
`technology_categories` to say groups become skill categories.

**`src/lib/importerLinkedIn.ts` / `importerEuropass.ts`** — they only emit the
empty array; deleting the field from `emptyStore()` covers it (verify).

**`src/lib/backup.ts`** — `BackupV1.sections.technology_categories` becomes
optional (`?:` legacy, typed loosely e.g. `unknown[]`); `buildBackup` stops
writing it and adds `skill_categories`; `backupToStore` passes legacy field
through so `migrateStore` (which runs on every load path) converts. Confirm
the restore path runs `migrateStore` (it should — single choke point).

### Phase 5 — tests

Update / add (see `tests/` conventions in CLAUDE.md §10):
- `tests/fixtures.ts` — delete `makeTechCategory`; add `makeSkillCategory`;
  `makeSkill` gains `category_id`.
- `tests/migrate.test.ts` (or wherever migrations are pinned) — table-test
  `unifyShowcaseCategories`: v4 store w/ tech-cats + category strings + view
  exclusions → entities, links, highlight flags, exclusion-id rewrite,
  idempotence (run twice ≡ once), `string[]`-only v5 input, already-v6 input
  returns same reference.
- `tests/skillCategorize.test.ts` — rewrite for id-based helpers; add
  rename/move/delete/assign-by-text cases; auto-categorize creates entities.
- NEW `tests/showcase.test.ts` — `showcaseGroups`: detail semantics,
  exclusions, empty-group and Uncategorized omission, ordering (D5–D7).
- `tests/viewFilter.test.ts` / `exporter.test.ts` / `viewText.test.ts` — the
  showcase section renders from categories on all three paths; excluded
  category disappears; XSS-escaping test for a hostile category name in the
  HTML path (security skill: it's a render path).
- `tests/usage.test.ts`, `merge.test.ts`, `completeness.test.ts`,
  `wipeLocale.test.ts`, `snapshotDiff`/`diffResume` tests — adjust removed
  branches; completeness gains a used-category-name case.
- `tests/importer.test.ts` — technologies → categories/links/highlights
  (replace the tech-cat mapping cases); `aiImport.test.ts` similarly.
- `tests/components/RegistryEditors.test.tsx` — remove TechCategories tests;
  update category filter/assign/By-category tests for ids; add header rename +
  reorder cases. `tests/components/a11y.test.tsx` — drop the
  TechCategoriesEditor surface, ensure the popover is labelled.
- `tests/components/ResumeViews*/ViewEditor` tests — showcase item exclusion
  lists categories.
- `e2e/smoke.spec.ts` — verify it doesn't touch the showcase page (adjust if
  it navigates there).

### Phase 6 — docs & manifest

- **CLAUDE.md**: §1 registry-management + skill-taxonomy bullets (showcase is
  now a projection; category entities; renamed helpers), §3 architecture map
  (remove TechCategoriesEditor, add `showcase.ts`, update `skillCategorize.ts`
  line), §4 shared registries (SkillCategory as a linked kind; remove
  CategorySkill snapshot-name mention for showcase), shape-version note (v6),
  "Adding a new section" untouched. Update the `technology_categories` label
  wherever mentioned.
- **knowledge.yaml**: bump `validated` on CLAUDE.md unit; add this plan file
  as a unit if plans are indexed (check existing entries for the pattern).
- The auto-memory file `skill-category-type-unified.md` (user-level memory)
  should be updated post-implementation to reflect id-based categories.

### Phase 7 — verification gate & release

1. `npm run typecheck` && `npm test` && `npm run build` (bundle-size eye on
   the main chunk; nothing new is lazy-loaded here).
2. **Real-data migration rehearsal**: export a backup of the owner's real
   resume (v5 data with a populated showcase) BEFORE upgrading; load it into a
   dev build; verify: categories carried over w/ localized names + order,
   skills linked, highlights set, existing Resume Views render the showcase
   section identically (compare PDF preview before/after), excluded showcase
   groups still excluded.
3. Live QA script: registry By-category (rename, reorder, delete, drag,
   auto-categorize, quick-drop), category filter, batch translation view,
   view editor showcase section (detail toggle, exclude a category, preview),
   DOCX + plain-text export, undo/redo across category ops, old deep link
   `/r/:id/technology_categories` lands on skills.
4. Snapshot-history restore of a PRE-migration snapshot → verify the restore
   path migrates (it must run `migrateStore` before `replaceData`).
5. Release as a **minor** bump (`0.5.0`) — this is a data-shape change with a
   migration; follow the §14 release procedure (bump package.json +
   package-lock, commit, tag; CI guards the match).

---

## 5. Risks & edge cases (implementer: read before coding)

- **Irreversibility**: v6 data on a v0.4.x build loads best-effort
  (`dataFromNewerApp` warning) but that build would re-save without
  `category_id` knowledge — acceptable (same class as v4/v5), but the
  cloud-sync + auto-update note in CLAUDE.md §8 applies. Don't ship v6 in a
  patch release users might skip-read (hence 0.5.0).
- **Undo across the migration**: migration runs in `loadStore` (resets undo),
  never via `replaceData` — no undo entry for it. Correct per store contract.
- **Dirty offline queue**: a pending v5 record flushes as-is, then migrates on
  next load — fine, but verify `savePending`/boot ordering doesn't stamp v6
  onto an unmigrated payload.
- **`excluded_item_ids` is a flat id set** shared across sections — the
  rewrite in the migration must only map ids that belonged to tech-cats.
- **Two skills, same name, different showcase groups** (D8): first group
  wins; deterministic order = showcase iteration order.
- **Hostile category names** flow into HTML/DOCX/text renders — descriptors
  return data only; adapters escape. Add the regression test (Phase 5).
- **`CatItem.category` semantic change** (name → id) is easy to half-do;
  grep every `RegistryCategoryView` call site (Skills AND Roles — roles keep
  plain-string categories! The shared component must support both: roles pass
  name-as-id sentinel semantics unchanged. Consider a `resolveGroupLabel`
  prop instead of overloading).
- **Roles are out of scope**: `Role.category` stays a plain string. The
  shared By-category component must keep working for roles unchanged.

## 6. Explicitly out of scope (follow-ups)

- Category **merge** via `mergeRegistry` (D13).
- Role categories as entities.
- Per-skill exclusion inside a showcase group.
- Adding category names to the missing-translation batch surface (D9 trim).
