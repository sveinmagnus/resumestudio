# Resume Studio — Multi-Language Consultant Resume Manager (v2)

## What's new in this iteration

### Project editor improvements
- **Project description and roles combined** into one flowing block: customer background first, then per-role descriptions stacked beneath (matches the Employment section's pattern).
- **Read-only project overview** mode shows the full content of every project — full descriptions, all roles with their text, and each skill with its computed total experience. Click any project to open it for editing. Toggle between Overview and Edit mode at the top of the Projects section.

### Shared role and skill registries with computed experience
- **Roles now span both projects and employment.** Both sections carry roles linked to the same registry; the role registry's experience total aggregates across all of them.
- **Skills also span projects and employment** (Employment gained skills + roles).
- **Experience counters are computed, read-only, and dynamic.** Edit a project's role or move a date and the registry total updates instantly.
- **Years + months precision** everywhere — the manual offset uses separate years/months inputs, and totals display as e.g. "5 yr 5 mo".
- **Contributing-items list** under each registry entry shows every project and employment that contributes, with click-through links that jump straight to the relevant entry in edit mode.

### Export template designer with real .docx and .pdf
- New **Export Templates** section with a visual designer:
  - Pick which sections to include and reorder them.
  - Toggle individual fields per section (e.g. include team size on projects, hide allocation %).
  - Override section headings per locale.
  - Choose heading + body fonts, body font size, accent colour, page size (A4/Letter), date style.
- **Real `.docx` generation** via the `docx` npm library (verified: produces valid Microsoft Word 2007+ files).
- **Real `.pdf` generation** via the browser's print pipeline — opens a styled HTML version in a new window and triggers the system Save-as-PDF dialog.

## Run it

```bash
npm install
npm run dev
npm run build && npm run preview
```

On Windows, if PowerShell blocks scripts, use `npm.cmd` instead of `npm`, or run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once.

## Architecture

- **React 18 + TypeScript + Vite**, Zustand store, in-memory state for the session.
- **`src/lib/experience.ts`** — pure functions that compute role/skill totals across projects and employment.
- **`src/lib/exporter.ts`** — docx + html/pdf generation against an `ExportTemplate` config.
- **`src/lib/templateCatalog.ts`** — section catalog: which sections and which fields per section can appear in a template.
- **`src/components/editor/shared/`** — `RoleBlock`, `SkillBlock`, `ExperiencePanel` are reused by both projects and employment.

## Verified against real data

The importer was tested against a real CVpartner export with 45 projects:
- 217 skills built into the global registry (zero orphans — every project skill links back)
- 17 roles, with computed totals like "Løsningsarkitekt = 5 yr 5 mo from 2 projects"
- Skill totals like "Microsoft Visio = 12 yr 5 mo from 10 projects"
- The shared registry surfaces data-quality issues (e.g. the typo "Løsningarkitekt" vs "Løsningsarkitekt" becomes visible because both have their own experience totals)
