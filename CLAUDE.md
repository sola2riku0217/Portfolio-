# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

"我が家のマネージャー" (Wagaya Manager) — a static portfolio site of free, standalone Japanese-language household/life-planning tools, published via GitHub Pages at `https://sola2riku0217.github.io/Portfolio-/`. There is no build step, no bundler, and no package manager: every page is a single self-contained `.html` file with inline `<style>` and `<script>`.

`index.html` is the landing page with a card grid linking to each tool. Each tool is its own top-level `.html` file, directly deep-linkable and usable standalone:

| File | Tool | `appKey` | `storageKey` |
|---|---|---|---|
| `lifeplan_sim.html` | ライフプランシミュレーター (life-plan/asset simulator) | `lifeplan_sim` | `lifePlanSimDataV3` |
| `housework_tracker.html` | 夫婦の家事分担トラッカー (chore-split tracker) | `housework_tracker` | `houseworkTrackerData_v1` |
| `budget_tracker.html` | 家計管理アプリ (household budget, multi-account, receipt OCR) | `budget_tracker` | `budgetTrackerData_v1` |
| `birth_checklist.html` | 出産手続きナビ (birth-procedure checklist/calendar) | `birth_checklist` | `birthChecklist_v1` |
| `expense_split.html` | 生活費按分ツール (expense-splitting by income ratio) | `shushi_anbun` | `shushiAnbunV1` |
| `terms.html` | Terms of service / privacy policy (linked from signup) | — | — |

`auth.js` is the one shared JS module, loaded by every page. `new/` is a separate exported snapshot (different markup dialect: `<x-dc>`/`<helmet>`, its own `support.js`) — treat it as a reference/export artifact, not part of the live site; don't assume its conventions apply to the top-level pages.

## Development workflow

There is no build/lint/test tooling in this repo (no `package.json`, no CI config). "Development" means editing an HTML file directly and opening it in a browser (or a local static server) to check it.

```bash
# Preview a page locally
python3 -m http.server 8000   # then open http://localhost:8000/index.html

# Publish (this is a static GitHub Pages site — pushing to main is "deploying")
git add <changed files>
git commit -m "..."
git push
```

Deploys are just a `git push` to `main`; GitHub Pages picks it up within a few minutes (see `deploy_memo.md`).

## Architecture and conventions

**Single-file app pattern.** Each tool HTML file is fully self-contained: markup, a `<style>` block, and a `<script>` block with all app logic — no imports, no modules, no external JS framework. When editing a tool, everything relevant lives in that one file (state, rendering, storage, event wiring). Follow the same inline, no-build style rather than introducing modules/bundlers.

**State persistence.** Each tool defines its own `const STORAGE_KEY = '...'` and reads/writes a single JSON blob via `localStorage.getItem/setItem(STORAGE_KEY, ...)`. There's no shared data layer between tools — each app owns its own key and its own JSON shape.

**Shared auth/sync module (`auth.js`).** Every page loads the Supabase JS CDN script, then `auth.js`, then calls:
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="auth.js"></script>
<script>PortfolioAuth.init({ appKey: '<unique-app-id>', storageKey: '<localStorage-key>' });</script>
```
- `appKey` is required; it's the row identifier in Supabase. `storageKey` is optional — omit it for pages that should show login UI only, with no cloud sync (e.g. `index.html`).
- `auth.js` monkey-patches `localStorage.setItem/removeItem` for the configured `storageKey`: any write is debounced (1.2s) and pushed to the Supabase table `user_app_data` (`user_id`, `app`, `data`, `updated_at`, RLS-scoped to the owning user) when a user is signed in.
- On login, it pulls cloud data, and if it differs from local, overwrites local storage and reloads the page (throttled to once per 10s via `sessionStorage`). On first login it migrates any existing local data to the cloud.
- It renders its own floating login button / avatar menu / auth modal (login, signup, password reset, recovery) into `#authMount` if present, else fixed-positioned in the body. All auth UI strings are Japanese; `jpError()` translates Supabase error messages.
- Adding a new tool page: pick a unique `appKey`, add its `storageKey` if it should sync, and add a row to the table in `auth_setup_memo.md` for documentation purposes.

**Design language.** Warm/paper palette (`#FBF6EE` background, `#D0794F` accent orange, `#4F7F67` green for auth UI), `Zen Maru Gothic` for headings and `Noto Sans JP` for body text, pill-shaped buttons (`border-radius:999px`), soft drop shadows, and `IntersectionObserver`-driven fade-in-on-scroll sections (`.fade-section` / `.visible`). New pages/sections should match this look — check `index.html`'s `<style>` block as the reference.

**Like/comment widget on `index.html` cards.** Each `.project-card` in the tool grid wires up like/comment buttons against Supabase tables `card_likes` / `card_comments` (keyed by `data-project`), with a `localStorage`-backed fallback (`portfolioCardInteractions`) if the Supabase call fails or credentials look like placeholders. This logic lives inline in `index.html`'s closing `<script>` block, not in `auth.js`.

**Backend.** Supabase project `inndpuhwcdqazlhoborx` (URL and anon key are hardcoded in `auth.js` and `index.html` — this is intentional, it's a public anon key gated by RLS, not a secret). One-time console setup steps (SQL for `user_app_data`, redirect URLs, Google OAuth, email confirmation) are documented in `auth_setup_memo.md` — consult it before assuming any backend config needs to be redone.

**Language.** All user-facing text across the site is Japanese. Match this in any new UI copy, error messages, or comments in user-visible strings.

## Other files

- `deploy_memo.md` — copy-paste git publish steps (includes stale absolute paths from the original author's machine; the `git add`/`commit`/`push` shape is what matters, not the `cd` path).
- `reel_caption.md`, `reel_captions_by_app.md` — social media caption drafts for the apps; not code, safe to ignore for engineering tasks.
- `インスタアイコン-selection.png` — an icon asset, not referenced by any HTML currently checked.
