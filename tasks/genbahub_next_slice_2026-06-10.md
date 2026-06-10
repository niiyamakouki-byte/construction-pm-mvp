# GenbaHub 次の1件 - 2026-06-10

## Decision

次に着手する 1 件は `P1 - Navigation Should Expose the Field Workflow`。

## Why this next

- `P0 mobile layout` は closed 済み
- `route-aware first-run setup` は closed 済み
- `workflow-specific empty states` は closed 済み
- 2026-05-27 UX spec の主要未回収は、現場導線がナビから見えにくい点

## Target bottleneck

`project -> schedule -> tasks -> photos/progress -> report` の日次導線が見えず、機能量の割に使い始めが重い。

## Acceptance

- Desktop の quick actions が現場導線順になる
- Mobile drawer が grouped / scrollable で、`工程` 系の重複ラベルを減らす
- Bottom nav が `Home / 工程 / タスク / 写真 or 今日 / その他` の日次導線に寄る
- 既存 route を壊さず、主要導線の regression test を 1 本追加する

## Likely targets

- `src/App.tsx`
- shared navigation components
- mobile nav / drawer tests

## Verification plan

1. navigation component edit
2. targeted Vitest for nav labels / current route visibility
3. mobile screenshot or Playwright route smoke
