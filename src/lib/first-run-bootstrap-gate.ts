// laporta-beads-pfn0s: 初回サンプル案件bootstrap(本番Supabaseへのprojects INSERT)を
// 未認証セッションで発火させないためのゲート条件。AuthGuardが実際にchildrenを描画する
// 条件(authGuardWouldRenderChildren)と揃える。ここを外すと未認証ユーザーが
// "/" → "/app" へリダイレクトされる一瞬の間にbootstrapが走り、Supabaseへ
// anon keyのみでPOSTが飛んでしまう(実測: 400 not_null_violation、laporta-beads-pfn0s)。
export function computeAuthGuardWouldRenderChildren(params: {
  isE2EBypass: boolean;
  hasSupabaseEnv: boolean;
  authLoading: boolean;
  hasUser: boolean;
}): boolean {
  return params.isE2EBypass || !params.hasSupabaseEnv || (!params.authLoading && params.hasUser);
}

export function computeShouldBootstrapFirstRun(params: {
  authGuardWouldRenderChildren: boolean;
  onboardingDone: boolean;
  route: string;
  lastProjectId: string | null;
}): boolean {
  return (
    params.authGuardWouldRenderChildren &&
    !params.onboardingDone &&
    (params.route === "/app" || params.route === "/gantt") &&
    !params.lastProjectId
  );
}
