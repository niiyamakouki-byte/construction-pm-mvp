# GenbaHub UX Deep Dive Spec - 2026-05-27

## Context

Security-guidance is production-ready. Next work should improve existing GenbaHub features until they feel usable in the field, not add new feature surface.

Audit method:
- Ran Vite locally.
- Used Playwright with the existing E2E auth bypass.
- Captured desktop 1440x1000 and mobile 390x844 screenshots.
- Routes checked: `/today`, `/app`, `/tasks`, `/cross-project-gantt`, `/progress-review`, `/photos`, `/estimate`, `/cost-management`.

Artifacts:
- `tasks/genbahub_ux_audit_shots/` - first-run state with onboarding/tour visible.
- `tasks/genbahub_ux_audit_shots_no_tour/` - app state after marking onboarding/tour complete.

## Main Finding

GenbaHub has enough functional coverage, but the first usable path is unclear. The UX currently fails before feature depth matters:

1. First-run onboarding blocks every route, even when the user navigates directly to a specific task page.
2. Mobile layout breaks on key pages: content columns become too narrow and Japanese text renders nearly vertical.
3. Empty states do not consistently advance the user to the next concrete action.
4. Navigation exposes too many destinations at once, which hides the primary workflow.

## Priority Work

### P0 - Mobile Layout Must Not Collapse

Observed:
- `/today` mobile: greeting card becomes a narrow vertical strip.
- `/estimate` mobile: tab labels and form content collapse into vertical text.
- The page keeps desktop-style grid widths while the viewport is 390px.

Acceptance:
- At 390x844, `/today` and `/estimate` render normal horizontal Japanese text.
- No primary card or form column is narrower than 280px.
- Bottom nav remains usable without covering primary submit/action buttons.
- Add or update responsive tests/screenshots for these two routes.

Likely targets:
- `src/pages/TodayDashboardPage.tsx`
- `src/pages/EstimatePage.tsx`
- shared app shell layout in `src/App.tsx`

### P0 - First-Run Flow Should Lead to One Useful Project

Observed:
- Onboarding appears on top of all routes.
- If skipped, many pages are empty and push the user back to "create project".
- The onboarding asks for project data, but the visible fastest path on `/app` is "sample project".

Decision to make:
- For real adoption, should first-run default be "sample project" or "create real project"?

Recommended default:
- Make `/app` the first-run entry.
- Show onboarding only there, or make it a compact project setup panel instead of a blocking global modal.
- Primary CTA should create or load one usable project, then route to the project gantt.

Acceptance:
- Direct navigation to `/today`, `/estimate`, `/progress-review` is not blocked by onboarding after the user has a project.
- New user can reach a populated gantt in two actions or fewer.
- Empty-state CTAs create/load a project or route to the exact creation form.

### P1 - Empty States Need Workflow-Specific Next Actions

Observed:
- `/tasks`: says no tasks and links to gantt.
- `/photos`: says no photos, but does not offer upload from the same route.
- `/progress-review`: allows entering AI progress without a selected project/photo context.
- `/cost-management`: only says create project.

Acceptance:
- Each empty state has one primary action and one secondary action.
- Primary action is specific to the page:
  - `/tasks`: create first task or open selected project's gantt.
  - `/photos`: upload photos or open today's photo upload.
  - `/progress-review`: pick project and photo source before progress input.
  - `/cost-management`: import estimate/create budget baseline.
- Empty-state copy explains the missing prerequisite in one sentence.

### P1 - Navigation Should Expose the Field Workflow

Observed:
- Desktop sidebar has many destinations and duplicates schedule/gantt concepts.
- Mobile drawer lists nearly every feature, while bottom nav shows only four entries.
- The field workflow is not obvious: project -> schedule -> tasks -> photos/progress -> report.

Acceptance:
- Desktop groups remain, but top quick actions map to the primary field workflow.
- Mobile drawer is grouped and scrollable, with current route visible and no duplicate "工程表" ambiguity.
- Bottom nav includes the real daily loop: Home, 工程, タスク, 写真/今日, その他.

## Product Questions For Koki

1. First-run target: should GenbaHub show a realistic sample project by default, or force real project creation?
2. Primary persona for the next polish pass: 現場監督 mobile-first, or office/executive desktop-first?
3. Most important daily loop: 今日の予定, 工程更新, 写真アップロード, 見積/原価, or 報告書?
4. "機能の作り込みが甘い" is most painful in which screen: `/today`, `/estimate`, `/progress-review`, `/photos`, or `/app`?

## Suggested Next Implementation Order

1. Fix mobile layout collapse for `/today` and `/estimate`.
2. Replace global first-run modal behavior with a route-aware setup path.
3. Upgrade empty states for `/tasks`, `/photos`, `/progress-review`, `/cost-management`.
4. Simplify mobile navigation labels and remove duplicate schedule ambiguity.

## Verification Baseline

Current audit passed with no uncaught browser errors on all checked routes. The problems above are UX/rendering/workflow issues, not runtime crashes.

## 2026-05-27 Mobile Fix Verification

Updated:
- `/today`: `GreetingHeader` keeps horizontal Japanese text and a 280px minimum card width.
- `/estimate`: tab labels are in a horizontal scroll container; the primary form/catalog column stays 280px or wider at 390px.

Screenshots:
- Before `/today`: `tasks/genbahub_ux_audit_shots_no_tour/mobile-_today.png`
- Before `/estimate`: `tasks/genbahub_ux_audit_shots_no_tour/mobile-_estimate.png`
- After `/today`: `tasks/mobile_responsive_verification_2026-05-27/today-390-after.png`
- After `/estimate`: `tasks/mobile_responsive_verification_2026-05-27/estimate-390-after.png`

Checks:
- `pnpm exec playwright test e2e/mobile-responsive-routes.test.ts --project=chromium`
- 390x844 screenshot recapture showed `scrollWidth=390` and `clientWidth=390` on both routes.
