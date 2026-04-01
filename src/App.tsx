import { ProjectListPage } from "./pages/ProjectListPage.js";
import { TodayDashboardPage } from "./pages/TodayDashboardPage.js";
import { ProjectDetailPage } from "./pages/ProjectDetailPage.js";
import { GanttPage } from "./pages/GanttPage.js";
import { EstimatePage } from "./pages/EstimatePage.js";
import { ErrorBoundary } from "./components/ErrorBoundary.js";
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
    matchRoute: (r) => r === "/" || r.startsWith("/project/"),
    path: "/",
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

export function App() {
  const route = useHashRoute();

  // Parse route
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
    return (
      <ErrorBoundary fallbackTitle="プロジェクト一覧エラー">
        <ProjectListPage />
      </ErrorBoundary>
    );
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-16 sm:pb-0">
      {/* Top header */}
      <header className="bg-gradient-to-r from-brand-700 to-brand-800 text-white shadow-lg">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:py-4">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2.5 hover:opacity-90 transition-opacity"
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
          <nav className="hidden gap-1 sm:flex">
            {tabs.map((tab) => (
              <NavButton
                key={tab.key}
                label={tab.label}
                icon={tab.icon}
                active={tab.matchRoute(route)}
                onClick={() => navigate(tab.path)}
              />
            ))}
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main
        key={route}
        className="page-enter mx-auto max-w-5xl px-4 py-6 sm:py-8"
      >
        {renderPage()}
      </main>

      {/* Mobile bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 backdrop-blur-sm sm:hidden safe-bottom">
        <div className="flex">
          {tabs.map((tab) => {
            const isActive = tab.matchRoute(route);
            return (
              <button
                key={tab.key}
                onClick={() => navigate(tab.path)}
                className={`flex flex-1 flex-col items-center gap-0.5 py-2 transition-colors ${
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
