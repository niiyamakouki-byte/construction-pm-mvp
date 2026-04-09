import { useEffect, useState } from "react";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts.js";
import { KeyboardShortcutHelp } from "./components/KeyboardShortcutHelp.js";
import { ProjectListPage } from "./pages/ProjectListPage.js";
import { TodayDashboardPage } from "./pages/TodayDashboardPage.js";
import { ProjectDetailPage } from "./pages/ProjectDetailPage.js";
import { GanttPage } from "./pages/GanttPage.js";
import { NodeSchedulePage } from "./pages/NodeSchedulePage.js";
import { InvoicePage } from "./pages/InvoicePage.js";
import { EstimatePage } from "./pages/EstimatePage.js";
import { ContractorsPage } from "./pages/ContractorsPage.js";
import { NotificationsPage } from "./pages/NotificationsPage.js";
import { HelpPage } from "./pages/HelpPage.js";
import { LandingPage } from "./pages/LandingPage.js";
import { LoginPage } from "./pages/LoginPage.js";
import { SignupPage } from "./pages/SignupPage.js";
import { LegalPages } from "./pages/LegalPages.js";
import { PricingPage } from "./pages/PricingPage.js";
import { TasksPage } from "./pages/TasksPage.js";
import { CostManagementPage } from "./pages/CostManagementPage.js";
import { WeatherPage } from "./pages/WeatherPage.js";
import { ErrorBoundary } from "./components/ErrorBoundary.js";
import { AuthGuard } from "./components/AuthGuard.js";
import { OnboardingWizard, useOnboardingDone } from "./components/OnboardingWizard.js";
import { TourGuide, useTourDone } from "./components/TourGuide.js";
import { AuthProvider, useAuth } from "./contexts/AuthContext.js";
import { OrganizationProvider } from "./contexts/OrganizationContext.js";
import { hasSupabaseEnv } from "./infra/supabase-client.js";
import { SubscriptionProvider } from "./contexts/SubscriptionContext.js";
import { PersonaProvider, usePersona } from "./contexts/PersonaContext.js";
import { useHashRoute, navigate } from "./hooks/useHashRouter.js";
import { useTheme } from "./hooks/useTheme.js";
import { ThemeToggle } from "./components/ThemeToggle.js";
import { MobileNav } from "./components/MobileNav.js";
import { NotificationBanner } from "./components/NotificationBanner.js";
import { readLastProjectId } from "./lib/last-project.js";

function LogoIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 96 96" className="shrink-0" aria-hidden="true">
      <rect x="10" y="46" width="76" height="40" rx="18" fill="#0f172a" opacity="0.08" />
      <path d="M18 58c0-17.673 14.327-32 32-32h14c7.732 0 14 6.268 14 14v18H18Z" fill="#2563eb" />
      <path d="M28 58c0-11.046 8.954-20 20-20h16c3.314 0 6 2.686 6 6v14H28Z" fill="#f59e0b" />
    </svg>
  );
}

type TabDef = {
  key: string;
  label: string;
  icon: string;
  path: string;
  matchRoute: (route: string) => boolean;
  dataTour?: string;
};

function AppShell() {
  const route = useHashRoute();
  const { user, signOut } = useAuth();
  const { persona, setPersona } = usePersona();
  const { theme, cycleTheme } = useTheme();
  const [onboardingDone, markOnboardingDone] = useOnboardingDone();
  const [tourDone, markTourDone] = useTourDone();
  const [showTour, setShowTour] = useState(false);
  const [showShortcutHelp, setShowShortcutHelp] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [moreDrawerOpen, setMoreDrawerOpen] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const lastProjectId = readLastProjectId();

  // iOS keyboard detection via visualViewport
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => {
      const threshold = window.innerHeight * 0.75;
      setKeyboardOpen(vv.height < threshold);
    };
    vv.addEventListener("resize", onResize);
    return () => vv.removeEventListener("resize", onResize);
  }, []);
  const ganttPath = lastProjectId ? `/gantt/${lastProjectId}` : "/gantt";

  const primaryTabs: TabDef[] = [
    {
      key: "home",
      label: "ホーム",
      icon: "🏠",
      path: "/app",
      matchRoute: (currentRoute) => currentRoute === "/app" || currentRoute === "/" || currentRoute === "",
    },
    {
      key: "gantt",
      label: "工程表",
      icon: "📊",
      path: ganttPath,
      matchRoute: (currentRoute) => currentRoute === "/gantt" || currentRoute.startsWith("/gantt/"),
    },
    {
      key: "tasks",
      label: "タスク",
      icon: "🗂",
      path: "/tasks",
      matchRoute: (currentRoute) => currentRoute === "/tasks",
    },
    {
      key: "more",
      label: "その他",
      icon: "☰",
      path: "/notifications",
      matchRoute: (currentRoute) =>
        ["/today", "/invoice", "/estimate", "/contractors", "/notifications", "/help", "/node-schedule", "/cost-management", "/weather"].includes(currentRoute),
    },
  ];

  const secondaryTabs: TabDef[] = [
    {
      key: "today",
      label: "今日",
      icon: "📋",
      path: "/today",
      matchRoute: (currentRoute) => currentRoute === "/today",
    },
    {
      key: "notifications",
      label: "通知",
      icon: "🔔",
      path: "/notifications",
      matchRoute: (currentRoute) => currentRoute === "/notifications",
    },
    {
      key: "weather",
      label: "天気",
      icon: "☔",
      path: "/weather",
      matchRoute: (currentRoute) => currentRoute === "/weather",
    },
    {
      key: "contractors",
      label: "業者",
      icon: "🏢",
      path: "/contractors",
      matchRoute: (currentRoute) => currentRoute === "/contractors",
      dataTour: "nav-contractors",
    },
    {
      key: "estimate",
      label: "見積",
      icon: "🧾",
      path: "/estimate",
      matchRoute: (currentRoute) => currentRoute === "/estimate",
    },
    { key: "cost", label: "コスト", icon: "💹", path: "/cost-management", matchRoute: (currentRoute) => currentRoute === "/cost-management" },
    {
      key: "invoice",
      label: "請求",
      icon: "💴",
      path: "/invoice",
      matchRoute: (currentRoute) => currentRoute === "/invoice",
    },
    {
      key: "help",
      label: "ヘルプ",
      icon: "❓",
      path: "/help",
      matchRoute: (currentRoute) => currentRoute === "/help",
    },
    {
      key: "node",
      label: "ノード",
      icon: "🕸",
      path: "/node-schedule",
      matchRoute: (currentRoute) => currentRoute === "/node-schedule",
    },
  ];

  useEffect(() => {
    setMobileNavOpen(false);
    setMoreDrawerOpen(false);
  }, [route]);

  useKeyboardShortcuts({
    onNewTask: () => navigate(ganttPath),
    onCloseModal: () => setShowShortcutHelp(false),
    onShowHelp: () => setShowShortcutHelp((current) => !current),
  });

  const handleOnboardingComplete = () => {
    markOnboardingDone();
    setShowTour(true);
  };

  const legalMatch = route.match(/^\/legal(?:#(.+))?$/);
  const projectDetailMatch = route.match(/^\/project\/(.+)$/);
  const ganttMatch = route.match(/^\/gantt(?:\/(.+))?$/);
  const projectId = projectDetailMatch?.[1] ?? null;
  const ganttProjectId = ganttMatch?.[1] ? decodeURIComponent(ganttMatch[1]) : null;

  if (route === "/landing") return <LandingPage />;
  if (route === "/" || route === "") {
    navigate("/app");
    return null;
  }
  if (route === "/login") return <LoginPage />;
  if (route === "/signup") return <SignupPage />;
  if (legalMatch) {
    const section = legalMatch[1] as "tokushoho" | "privacy" | "tos" | undefined;
    return <LegalPages section={section} />;
  }
  if (route === "/pricing") return <PricingPage />;

  const renderPage = () => {
    if (route === "/app") {
      return (
        <ErrorBoundary fallbackTitle="案件一覧エラー">
          <ProjectListPage />
        </ErrorBoundary>
      );
    }
    if (ganttMatch) {
      return <GanttPage initialProjectId={ganttProjectId} />;
    }
    if (route === "/tasks") {
      return (
        <ErrorBoundary fallbackTitle="タスク一覧エラー">
          <TasksPage />
        </ErrorBoundary>
      );
    }
    if (route === "/today") {
      return <TodayDashboardPage />;
    }
    if (route === "/node-schedule") {
      return (
        <ErrorBoundary fallbackTitle="ノードビューエラー">
          <NodeSchedulePage />
        </ErrorBoundary>
      );
    }
    if (route === "/invoice") {
      return (
        <ErrorBoundary fallbackTitle="請求書OCRエラー">
          <InvoicePage />
        </ErrorBoundary>
      );
    }
    if (route === "/estimate") {
      return <EstimatePage />;
    }
    if (route === "/cost-management") {
      return (
        <ErrorBoundary fallbackTitle="コスト管理エラー">
          <CostManagementPage />
        </ErrorBoundary>
      );
    }
    if (route === "/weather") {
      return (
        <ErrorBoundary fallbackTitle="天気予報エラー">
          <WeatherPage />
        </ErrorBoundary>
      );
    }
    if (route === "/contractors") {
      return (
        <ErrorBoundary fallbackTitle="業者管理エラー">
          <ContractorsPage />
        </ErrorBoundary>
      );
    }
    if (route === "/notifications") {
      return (
        <ErrorBoundary fallbackTitle="通知一覧エラー">
          <NotificationsPage />
        </ErrorBoundary>
      );
    }
    if (route === "/help") {
      return (
        <ErrorBoundary fallbackTitle="ヘルプエラー">
          <HelpPage />
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
      <div className="mx-auto max-w-lg px-4 py-12 text-center" role="alert">
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-8">
          <h2 className="text-lg font-bold text-slate-900">ページが見つかりません</h2>
          <p className="mt-2 text-sm text-slate-500">「{route}」は存在しないページです。</p>
          <button
            onClick={() => navigate("/app")}
            className="mt-4 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-600"
          >
            ホームへ戻る
          </button>
        </div>
      </div>
    );
  };

  return (
    <AuthGuard>
      <div className="min-h-screen bg-[var(--app-bg)] text-[var(--app-text)]">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[100] focus:rounded-lg focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-white"
        >
          メインコンテンツへスキップ
        </a>

        <header className="sticky top-0 z-30 border-b border-white/50 bg-white/90 text-slate-900 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <button
              onClick={() => navigate("/app")}
              className="flex items-center gap-3"
              aria-label="GenbaHub ホームへ"
            >
              <LogoIcon />
              <div className="text-left">
                <span className="block text-lg font-bold tracking-tight">GenbaHub</span>
                <span className="block text-[11px] text-slate-500">現場工程を最短で開く</span>
              </div>
            </button>
            <div className="flex items-center gap-2">
              <ThemeToggle theme={theme} onToggle={cycleTheme} />
              <MobileNav
                open={mobileNavOpen}
                onOpen={() => setMobileNavOpen(true)}
                onClose={() => setMobileNavOpen(false)}
                items={[...primaryTabs.filter((tab) => tab.key !== "more"), ...secondaryTabs].map((tab) => ({
                  key: tab.key,
                  label: tab.label,
                  icon: tab.icon,
                  path: tab.path,
                  active: tab.matchRoute(route),
                  dataTour: tab.dataTour,
                }))}
                onNavigate={navigate}
                personaLabel={persona === "supervisor" ? "現場監督" : "経営層"}
                onTogglePersona={() => setPersona(persona === "supervisor" ? "executive" : "supervisor")}
                userLabel={user?.email ?? undefined}
                onSignOut={user ? signOut : undefined}
              />

              <nav className="hidden items-center gap-1 md:flex" aria-label="メインナビゲーション">
                {primaryTabs.slice(0, 3).map((tab) => (
                  <NavButton
                    key={tab.key}
                    label={tab.label}
                    icon={tab.icon}
                    active={tab.matchRoute(route)}
                    onClick={() => navigate(tab.path)}
                  />
                ))}
                <div className="relative">
                  <NavButton
                    label="その他"
                    icon="☰"
                    active={secondaryTabs.some((tab) => tab.matchRoute(route)) || moreDrawerOpen}
                    onClick={() => setMoreDrawerOpen((current) => !current)}
                  />
                  {moreDrawerOpen ? (
                    <div className="absolute right-0 top-full z-50 mt-2 w-40 rounded-2xl border border-slate-200 bg-white py-2 shadow-xl">
                      {secondaryTabs.map((tab) => (
                        <button
                          key={tab.key}
                          type="button"
                          onClick={() => {
                            navigate(tab.path);
                            setMoreDrawerOpen(false);
                          }}
                          className={`flex w-full items-center gap-2 px-4 py-2 text-sm font-medium ${
                            tab.matchRoute(route)
                              ? "bg-brand-50 text-brand-700"
                              : "text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          <span aria-hidden="true">{tab.icon}</span>
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </nav>
            </div>
          </div>
        </header>

        <NotificationBanner refreshKey={route} />

        <main id="main-content" key={route} className="page-enter mx-auto max-w-6xl px-4 py-5 pb-24 sm:py-6">
          {renderPage()}
        </main>

        <nav
          className={`safe-bottom fixed inset-x-0 bottom-0 z-40 flex border-t border-slate-200 bg-white shadow-[0_-2px_12px_rgba(0,0,0,0.08)] md:hidden transition-transform duration-200 ${keyboardOpen ? "translate-y-full" : ""}`}
          aria-label="ボトムナビゲーション"
        >
          {primaryTabs.map((tab) => {
            const isMore = tab.key === "more";
            const isActive = isMore ? moreDrawerOpen || secondaryTabs.some((item) => item.matchRoute(route)) : tab.matchRoute(route);
            return (
              <button
                key={tab.key}
                type="button"
                aria-current={isActive && !isMore ? "page" : undefined}
                onClick={() => {
                  if (isMore) {
                    setMoreDrawerOpen((current) => !current);
                  } else {
                    navigate(tab.path);
                  }
                }}
                className={`flex flex-1 flex-col items-center justify-center gap-1 py-2 text-center ${
                  isActive ? "text-brand-600" : "text-slate-400"
                }`}
              >
                <span className="text-xl leading-none" aria-hidden="true">{tab.icon}</span>
                <span className="text-[10px] font-semibold leading-tight">{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {moreDrawerOpen ? (
          <div className="fixed inset-0 z-30 md:hidden" onClick={() => setMoreDrawerOpen(false)}>
            <div className="absolute inset-0 bg-slate-950/30" />
            <div className="safe-bottom absolute bottom-16 inset-x-0 rounded-t-2xl bg-white px-4 pb-6 pt-4 shadow-2xl" onClick={(event) => event.stopPropagation()}>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-bold text-slate-700">その他</p>
                <button type="button" onClick={() => setMoreDrawerOpen(false)} className="p-1 text-slate-400">
                  <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
                    <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {secondaryTabs.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => {
                      navigate(tab.path);
                      setMoreDrawerOpen(false);
                    }}
                    className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold ${
                      tab.matchRoute(route)
                        ? "border-brand-200 bg-brand-50 text-brand-700"
                        : "border-slate-200 bg-white text-slate-700"
                    }`}
                  >
                    <span aria-hidden="true">{tab.icon}</span>
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {!onboardingDone && !hasSupabaseEnv() ? <OnboardingWizard onComplete={handleOnboardingComplete} /> : null}
        {onboardingDone && !tourDone && showTour ? <TourGuide onComplete={markTourDone} /> : null}
        {showShortcutHelp ? <KeyboardShortcutHelp onClose={() => setShowShortcutHelp(false)} /> : null}
      </div>
    </AuthGuard>
  );
}

export function App() {
  return (
    <AuthProvider>
      <OrganizationProvider>
        <SubscriptionProvider>
          <PersonaProvider>
            <AppShell />
          </PersonaProvider>
        </SubscriptionProvider>
      </OrganizationProvider>
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
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold ${
        active ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"
      }`}
    >
      <span aria-hidden="true">{icon}</span>
      {label}
    </button>
  );
}
