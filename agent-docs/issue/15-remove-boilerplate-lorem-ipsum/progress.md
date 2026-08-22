# Implementation Progress: Issue #15

**Started:** 2026-08-22
**Last updated:** 2026-08-22
**Completed:** 2026-08-22
**Status:** Completed

## Completed Steps

- [x] Phase 1, Step 1: Removed the `.grid`/`.card` Next.js cards block from `src/pages/index.tsx`
- [x] Phase 1, Step 2: Removed orphaned template CSS (`.grid`, `.card*`, `.code`, `.logo`, `.grid` media query) from `src/styles/app.scss`
- [x] Phase 2, Step 3: Replaced the three lorem ipsum footer columns in `src/components/Footer.tsx` with Swedish content (about + GitHub, data sources + CC0, contact)
- [x] Phase 3, Step 4: `npm run lint && npm run typecheck && npm run build` green
- [x] Phase 3, Step 5: Checked `/` and `/parti/centerpartiet/` at 768, 1024 and 1280 px

## Current Work

Implementation complete on branch `issue/15-remove-boilerplate-lorem-ipsum`. Plan step 6 (open PR) is out of scope for this run — `/work-issue` was invoked without `--commit`/`--PR`, so nothing is committed or pushed.

## Verification Checklist

- [x] No Documentation/Learn/Examples/Deploy cards on `/`; `grep -rn "nextjs.org\|vercel.com" src/` empty
- [x] `grep -nE '\.grid|\.card|\.code|\.logo' src/styles/app.scss` empty
- [x] Footer on `/` and on a party page shows about text + GitHub link, Valmyndigheten/SCB links, CC0 line, hello@swedev.org
- [x] Footer links render `rgb(254, 240, 138)` (`text-yellow-200`) and underlined, not `#0070f3`; `mailto:` href correct
- [x] `grep -rni "lorem\|>Header<" src` empty
- [x] Footer `scrollHeight === clientHeight` (234 px) at 768, 1024 and 1280 px — no vertical overflow
- [x] No footer horizontal overflow at any width; the columns stack below 768 px and wrap URLs/e-mail (`break-words`)
- [x] Copy says "partiers ... anmälda deltagande i val" (no "valdeltagande"); SCB labelled "läns- och kommunkoder"
- [x] `npm run lint && npm run typecheck && npm run build` green

## Review Follow-up (PR #30)

- Codex/@MartinSoderholm flagged that at phone widths the four columns stayed in one row inside a fixed 250 px `footer`, pushing content off the green background. Fixed by stacking the columns below 768 px, switching `footer` to `min-height`, and capping the logo width so it does not fill the whole column when stacked. Verified at 500 (window minimum), 768, 1024 and 1280 px: `scrollHeight === clientHeight`, no horizontal overflow.

## Notes

- Copy had to be trimmed to fit the fixed `footer { height: 250px }`. The first draft overflowed by 30 px at 768 px, so the blurb, the Valmyndigheten label ("— partibeteckningar", with "registrerade partibeteckningar" carried by the blurb), the licence line ("Fri att använda (CC0 1.0)") and the GitHub-issues link text were shortened. The footer now measures exactly 234 px of content inside 234 px of box at 768 px — the tightest of the checked widths.
- The footer stacks into one column below 768 px (`flex-col md:flex-row`), `footer` uses `min-height: 250px` so the stacked content stays on the green background, and the logo is capped at `w-40` below 768 px. This is the narrow-width fix sketched as the fallback in Design Decision 2; it overlaps `Footer.tsx` and the `footer` rule with #23, which should rebase on it.
- The home page's horizontal overflow at 1024 px comes from `.party-index` (its `max-height: 3700px` forces more 25 %-wide columns than fit), not from the footer. Pre-existing, also #23.
- `next.config.ts` sets `agentRules: false` so `next dev` stops appending a `<!-- BEGIN:nextjs-agent-rules -->` block to the repo's `CLAUDE.md` on every start.
