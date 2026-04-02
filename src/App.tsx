import { ProjectListPage } from "./pages/ProjectListPage.js";
import { TodayDashboardPage } from "./pages/TodayDashboardPage.js";
import { ProjectDetailPage } from "./pages/ProjectDetailPage.js";
import { GanttPage } from "./pages/GanttPage.js";
import { EstimatePage } from "./pages/EstimatePage.js";
import { LandingPage } from "./pages/LandingPage.js";
import { LoginPage } from "./pages/LoginPage.js";
import { SignupPage } from "./pages/SignupPage.js";
import { LegalPages } from "./pages/LegalPages.js";
import { ErrorBoundary } from "./components/ErrorBoundary.js";
import { AuthGuard } from "./components/AuthGuard.js";
import { AuthProvider, useAuth } from "./contexts/AuthContext.js";
import { useHashRoute, navigate } from "./hooks/useHashRouter.js";

function LogoIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 100 100"
      className="shrink-0"
      aria-hidden="true"
    >
      <rect x="10" y="60" width="80" height="35" rx="3" fill="#fff" opacity="0.9" />
      <rect x="20" y="30" width="60" height="35" rx="3" fill="#93c5fd" opacity="0.8" />
      <polygon points="50,5 15,35 85,35" fill="#fbbf24" />
    </svg>
  );
}

type TabDef = {
  key: string;
  label: string;
  icon: string;
  matchRoute: (route: string) => boolean;
  path: string;
};

const tabs: TabDef[] = [
  {
    key: "today",
    label: "Today",
    icon: "📋",
    matchRoute: (r) => r === "/today",
    path: "/today",
  },
  {
    key: "projects",
    label: "案件",
    icon: "🏗",
    matchRoute: (r) => r === "/app" || r.startsWith("/project/"),
    path: "/app",
  },
  {
    key: "gantt",
    label: "工程表",
    icon: "📊",
    matchRoute: (r) => r === "/gantt",
    path: "/gantt",
  },
  {
    key: "estimate",
    label: "見積",
    icon: "💰",
    matchRoute: (r) => r === "/estimate",
    path: "/estimate",
  },
];

function AppShell() {
  const route = useHashRoute();
  const { user, signOut } = useAuth();

  // Parse legal section from hash fragment
  const legalMatch = route.match(/^\/legal(?:#(.+))?$/);

  // Public routes
  if (route === "/" || route === "") {
    return <LandingPage />;
  }
  if (route === "/login") {
    return <LoginPage />;
  }
  if (route === "/signup") {
    return <SignupPage />;
  }
  if (legalMatch) {
    const section = legalMatch[1] as "tokushoho" | "privacy" | "tos" | undefined;
    return <LegalPages section={section} />;
  }

  // Protected app routes
  const projectDetailMatch = route.match(/^\/project\/(.+)$/);
  const projectId = projectDetailMatch?.[1] ?? null;

  const renderPage = () => {
    if (route === "/today") {
      return (
        <ErrorBoundary fallbackTitle="ダッシュボードエラー">
          <TodayDashboardPage />
        </ErrorBoundary>
      );
    }
    if (route === "/gantt") {
      return (
        <ErrorBoundary fallbackTitle="ガントチャートエラー">
          <GanttPage />
        </ErrorBoundary>
      );
    }
    if (route === "/estimate") {
      return (
        <ErrorBoundary fallbackTitle="見積エラー">
          <EstimatePage />
        </ErrorBoundary>
      );
    }
    if (projectId) {
      return (
        <ErrorBoundary fallbackTitle="プロジェクト詳細エラー">
          <ProjectDetailPage projectId={projectId} />
        </ErrorBoundary>
      );
    }
    if (route === "/app") {
      return (
        <ErrorBoundary fallbackTitle="プロジェクト一覧エラー">
          <ProjectListPage />
        </ErrorBoundary>
      );
    }
    // 404 - unknown route
    return (
      <div className="mx-auto max-w-lg px-4 py-12 text-center" role="alert">
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-8">
          <h2 className="text-lg font-bold text-slate-900">ページが見つかりません</h2>
          <p className="mt-2 text-sm text-slate-500">
            「{route}」は存在しないページです。
          </p>
          <button
            onClick={() => navigate("/app")}
            className="mt-4 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-600"
          >
            プロジェクト一覧へ
          </button>
        </div>
      </div>
    );
  };

  return (
    <AuthGuard>
      <div className="min-h-screen bg-[#f8fafc] pb-20 sm:pb-0">
        {/* Skip navigation link for keyboard/screen reader users */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-lg focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-white focus:shadow-lg"
        >
          メインコンテンツへスキップ
        </a>

        {/* Top header */}
        <header className="bg-gradient-to-r from-brand-700 to-brand-800 text-white shadow-lg">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:py-4">
            <button
              onClick={() => navigate("/app")}
              className="flex items-center gap-2.5 hover:opacity-90 transition-opacity"
              aria-label="GenbaHub ホームへ"
            >
              <LogoIcon />
              <div className="flex flex-col">
                <span className="text-lg font-bold tracking-tight leading-tight">
                  GenbaHub
                </span>
                <span className="hidden text-[10px] font-medium text-brand-300 tracking-wider sm:block">
                  建設プロジェクト管理
                </span>
              </div>
            </button>
            {/* Desktop nav */}
            <nav className="hidden gap-1 sm:flex items-center" aria-label="メインナビゲーション">
              {tabs.map((tab) => (
                <NavButton
                  key={tab.key}
                  label={tab.label}
                  icon={tab.icon}
                  active={tab.matchRoute(route)}
                  onClick={() => navigate(tab.path)}
                />
              ))}
              {user && (
                <button
                  onClick={signOut}
                  className="ml-2 flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-brand-200 hover:text-white hover:bg-white/10 transition-all"
                  title={user.email ?? ""}
                >
                  <span className="text-base" aria-hidden="true">👤</span>
                  <span className="hidden lg:block">{user.email?.split("@")[0]}</span>
                </button>
              )}
            </nav>
          </div>
        </header>

        {/* Main content */}
        <main
          id="main-content"
          key={route}
          className="page-enter mx-auto max-w-5xl px-4 py-6 sm:py-8"
        >
          {renderPage()}
        </main>

        {/* Mobile bottom tab bar */}
        <nav
          className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 backdrop-blur-sm sm:hidden safe-bottom"
          aria-label="モバイルナビゲーション"
        >
          <div className="flex">
            {tabs.map((tab) => {
              const isActive = tab.matchRoute(route);
              return (
                <button
                  key={tab.key}
                  onClick={() => navigate(tab.path)}
                  aria-current={isActive ? "page" : undefined}
                  aria-label={tab.label}
                  className={`relative flex flex-1 flex-col items-center gap-0.5 py-2.5 transition-colors ${
                    isActive
                      ? "text-brand-600"
                      : "text-slate-400 active:text-slate-600"
                  }`}
                >
                  <span className="text-lg" aria-hidden="true">
                    {tab.icon}
                  </span>
                  <span
                    className={`text-[10px] font-semibold ${
                      isActive ? "text-brand-600" : "text-slate-400"
                    }`}
                  >
                    {tab.label}
                  </span>
                  {isActive && (
                    <span className="absolute top-0 h-0.5 w-8 rounded-full bg-brand-500" />
                  )}
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    </AuthGuard>
  );
}

export function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}

function NavButton({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
        active
          ? "bg-white/20 text-white shadow-sm"
          : "text-brand-200 hover:text-white hover:bg-white/10"
      }`}
    >
      <span className="text-base" aria-hidden="true">{icon}</span>
      <span>{label}</span>
    </button>
  );
}
