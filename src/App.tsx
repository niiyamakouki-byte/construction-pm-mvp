import { lazy, Suspense, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts.js";
import { KeyboardShortcutHelp } from "./components/KeyboardShortcutHelp.js";
import { InstallPrompt } from "./components/InstallPrompt.js";

const ProjectListPage = lazy(() => import("./pages/ProjectListPage.js").then((m) => ({ default: m.ProjectListPage })));
const TodayDashboardPage = lazy(() => import("./pages/TodayDashboardPage.js").then((m) => ({ default: m.TodayDashboardPage })));
const ProjectDetailPage = lazy(() => import("./pages/ProjectDetailPage.js").then((m) => ({ default: m.ProjectDetailPage })));
const GanttPage = lazy(() => import("./pages/GanttPage.js").then((m) => ({ default: m.GanttPage })));
const NodeSchedulePage = lazy(() => import("./pages/NodeSchedulePage.js").then((m) => ({ default: m.NodeSchedulePage })));
const InvoicePage = lazy(() => import("./pages/InvoicePage.js").then((m) => ({ default: m.InvoicePage })));
const EstimatePage = lazy(() => import("./pages/EstimatePage.js").then((m) => ({ default: m.EstimatePage })));
const ContractorsPage = lazy(() => import("./pages/ContractorsPage.js").then((m) => ({ default: m.ContractorsPage })));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage.js").then((m) => ({ default: m.NotificationsPage })));
const HelpPage = lazy(() => import("./pages/HelpPage.js").then((m) => ({ default: m.HelpPage })));
const LandingPage = lazy(() => import("./pages/LandingPage.js").then((m) => ({ default: m.LandingPage })));
const LoginPage = lazy(() => import("./pages/LoginPage.js").then((m) => ({ default: m.LoginPage })));
const SignupPage = lazy(() => import("./pages/SignupPage.js").then((m) => ({ default: m.SignupPage })));
const LegalPages = lazy(() => import("./pages/LegalPages.js").then((m) => ({ default: m.LegalPages })));
const PricingPage = lazy(() => import("./pages/PricingPage.js").then((m) => ({ default: m.PricingPage })));
const PricingSuccessPage = lazy(() => import("./pages/PricingSuccessPage.js").then((m) => ({ default: m.PricingSuccessPage })));
const PricingCancelPage = lazy(() => import("./pages/PricingCancelPage.js").then((m) => ({ default: m.PricingCancelPage })));
const TasksPage = lazy(() => import("./pages/TasksPage.js").then((m) => ({ default: m.TasksPage })));
const CostManagementPage = lazy(() => import("./pages/CostManagementPage.js").then((m) => ({ default: m.CostManagementPage })));
const WeatherPage = lazy(() => import("./pages/WeatherPage.js").then((m) => ({ default: m.WeatherPage })));
const SafetyInspectionPage = lazy(() => import("./pages/SafetyInspectionPage.js").then((m) => ({ default: m.SafetyInspectionPage })));
const ProcurementPage = lazy(() => import("./pages/ProcurementPage.js").then((m) => ({ default: m.ProcurementPage })));
const SiteEntryPage = lazy(() => import("./pages/SiteEntryPage.js").then((m) => ({ default: m.SiteEntryPage })));
const AttendanceHistoryPage = lazy(() => import("./pages/AttendanceHistoryPage.js").then((m) => ({ default: m.AttendanceHistoryPage })));
const ContractorPortalPage = lazy(() => import("./pages/ContractorPortalPage.js").then((m) => ({ default: m.ContractorPortalPage })));
const ClientViewerPage = lazy(() => import("./pages/ClientViewerPage.js").then((m) => ({ default: m.ClientViewerPage })));
const SelectionBoardPage = lazy(() => import("./pages/SelectionBoardPage.js").then((m) => ({ default: m.SelectionBoardPage })));
const MoodBoardPage = lazy(() => import("./pages/MoodBoardPage.js").then((m) => ({ default: m.MoodBoardPage })));
const CRMPage = lazy(() => import("./pages/CRMPage.js").then((m) => ({ default: m.CRMPage })));
const ReportsPage = lazy(() => import("./pages/ReportsPage.js").then((m) => ({ default: m.ReportsPage })));
const OrderManagementPage = lazy(() => import("./pages/OrderManagementPage.js").then((m) => ({ default: m.OrderManagementPage })));
const InvoiceManagementPage = lazy(() => import("./pages/InvoiceManagementPage.js").then((m) => ({ default: m.InvoiceManagementPage })));
const CrossProjectGanttPage = lazy(() => import("./pages/CrossProjectGanttPage.js").then((m) => ({ default: m.CrossProjectGanttPage })));
const ProgressReviewPage = lazy(() => import("./pages/ProgressReviewPage.js").then((m) => ({ default: m.ProgressReviewPage })));
const PhotoPage = lazy(() => import("./pages/PhotoPage.js").then((m) => ({ default: m.PhotoPage })));
const FreeePage = lazy(() => import("./pages/FreeePage.js").then((m) => ({ default: m.FreeePage })));
const FinishingSchedulePage = lazy(() => import("./pages/FinishingSchedulePage.js").then((m) => ({ default: m.FinishingSchedulePage })));
const ScheduleFromEstimatePage = lazy(() => import("./pages/ScheduleFromEstimatePage.js").then((m) => ({ default: m.ScheduleFromEstimatePage })));
const AccountSettingsPage = lazy(() => import("./pages/AccountSettingsPage.js").then((m) => ({ default: m.AccountSettingsPage })));
const InvoiceReconcilePage = lazy(() => import("./pages/InvoiceReconcilePage.js").then((m) => ({ default: m.InvoiceReconcilePage })));
const OwnerAppPageLazy = lazy(() => import("./components/OwnerAppPage.js").then((m) => ({ default: m.OwnerAppPage })));
const OwnerShareTokenPanelLazy = lazy(() => import("./components/OwnerShareTokenPanel.js").then((m) => ({ default: m.OwnerShareTokenPanel })));
const MarginWatchPageLazy = lazy(() => import("./components/MarginWatchPage.js").then((m) => ({ default: m.MarginWatchPage })));
const ProfitRankingPageLazy = lazy(() => import("./components/ProfitRankingPage.js").then((m) => ({ default: m.ProfitRankingPage })));
const CrewOptimizerPageLazy = lazy(() => import("./components/CrewOptimizerPage.js").then((m) => ({ default: m.CrewOptimizerPage })));
const RepeatPredictorPageLazy = lazy(() => import("./components/RepeatPredictorPage.js").then((m) => ({ default: m.RepeatPredictorPage })));
const InquiryResponderPageLazy = lazy(() => import("./components/InquiryResponderPage.js").then((m) => ({ default: m.InquiryResponderPage })));
import { ErrorBoundary } from "./components/ErrorBoundary.js";
import { AuthGuard } from "./components/AuthGuard.js";
import { OnboardingWizard, useOnboardingDone } from "./components/OnboardingWizard.js";
import { TourGuide, useTourDone } from "./components/TourGuide.js";
import { AuthProvider, useAuth } from "./contexts/AuthContext.js";
import { OrganizationProvider } from "./contexts/OrganizationContext.js";
import { SubscriptionProvider } from "./contexts/SubscriptionContext.js";
import { PersonaProvider, usePersona } from "./contexts/PersonaContext.js";
import { useHashRoute, navigate } from "./hooks/useHashRouter.js";
import { useTheme } from "./hooks/useTheme.js";
import { ThemeToggle } from "./components/ThemeToggle.js";
import { MobileNav } from "./components/MobileNav.js";
// Navigation import removed – sidebar is rendered inline in AppShell
import { NotificationBanner } from "./components/NotificationBanner.js";
import { readLastProjectId } from "./lib/last-project.js";
// Sprint 3-3: v2-cozy刷新版 AssistantChatPanel (コマンド5本+framer-motion)
import { AssistantChatPanel } from "./components/AssistantChatPanel.js";

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
  const { t } = useTranslation(["common", "pages", "errors"]);
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
      label: t("common:nav.home"),
      icon: "🏠",
      path: "/app",
      matchRoute: (currentRoute) => currentRoute === "/app" || currentRoute === "/" || currentRoute === "",
    },
    {
      key: "gantt",
      label: t("common:nav.gantt"),
      icon: "📊",
      path: ganttPath,
      matchRoute: (currentRoute) => currentRoute === "/gantt" || currentRoute.startsWith("/gantt/"),
    },
    {
      key: "tasks",
      label: t("common:nav.tasks"),
      icon: "🗂",
      path: "/tasks",
      matchRoute: (currentRoute) => currentRoute === "/tasks",
    },
    {
      key: "more",
      label: t("common:nav.more"),
      icon: "☰",
      path: "/notifications",
      matchRoute: (currentRoute) =>
        ["/today", "/invoice", "/estimate", "/contractors", "/notifications", "/help", "/node-schedule", "/cost-management", "/weather", "/safety", "/procurement", "/orders", "/crm", "/reports", "/invoices", "/invoices/reconcile", "/cross-project-gantt", "/progress-review", "/photos", "/freee", "/finishing", "/schedule"].includes(currentRoute) || currentRoute.startsWith("/reports/") || currentRoute.startsWith("/freee?") || currentRoute.startsWith("/finishing"),
    },
  ];

  const secondaryTabs: TabDef[] = [
    {
      key: "today",
      label: t("common:nav.today"),
      icon: "📋",
      path: "/today",
      matchRoute: (currentRoute) => currentRoute === "/today",
    },
    {
      key: "notifications",
      label: t("common:nav.notifications"),
      icon: "🔔",
      path: "/notifications",
      matchRoute: (currentRoute) => currentRoute === "/notifications",
    },
    {
      key: "weather",
      label: t("common:nav.weather"),
      icon: "☔",
      path: "/weather",
      matchRoute: (currentRoute) => currentRoute === "/weather",
    },
    {
      key: "contractors",
      label: t("common:nav.contractors"),
      icon: "🏢",
      path: "/contractors",
      matchRoute: (currentRoute) => currentRoute === "/contractors",
      dataTour: "nav-contractors",
    },
    {
      key: "estimate",
      label: t("common:nav.estimate"),
      icon: "🧾",
      path: "/estimate",
      matchRoute: (currentRoute) => currentRoute === "/estimate",
    },
    { key: "cross-gantt", label: t("common:nav.cross_gantt"), icon: "📅", path: "/cross-project-gantt", matchRoute: (currentRoute) => currentRoute === "/cross-project-gantt" },
    { key: "progress-review", label: t("common:nav.progress_review"), icon: "📸", path: "/progress-review", matchRoute: (currentRoute) => currentRoute === "/progress-review" },
    { key: "photos", label: t("common:nav.photos"), icon: "🖼", path: "/photos", matchRoute: (currentRoute) => currentRoute === "/photos" },
    { key: "safety", label: t("common:nav.safety"), icon: "🦺", path: "/safety", matchRoute: (currentRoute) => currentRoute === "/safety" },
    { key: "procurement", label: t("common:nav.procurement"), icon: "📦", path: "/procurement", matchRoute: (currentRoute) => currentRoute === "/procurement" },
    { key: "orders", label: t("common:nav.orders"), icon: "🗒", path: "/orders", matchRoute: (currentRoute) => currentRoute === "/orders" },
    { key: "cost", label: t("common:nav.cost"), icon: "💹", path: "/cost-management", matchRoute: (currentRoute) => currentRoute === "/cost-management" },
    { key: "crm", label: t("common:nav.crm"), icon: "🤝", path: "/crm", matchRoute: (currentRoute) => currentRoute === "/crm" },
    {
      key: "invoice",
      label: t("common:nav.invoice"),
      icon: "💴",
      path: "/invoice",
      matchRoute: (currentRoute) => currentRoute === "/invoice",
    },
    {
      key: "freee",
      label: t("common:nav.freee"),
      icon: "📗",
      path: "/freee",
      matchRoute: (currentRoute) => currentRoute === "/freee" || currentRoute.startsWith("/freee?"),
    },
    {
      key: "help",
      label: t("common:nav.help"),
      icon: "❓",
      path: "/help",
      matchRoute: (currentRoute) => currentRoute === "/help",
    },
    {
      key: "node",
      label: t("common:nav.node"),
      icon: "🕸",
      path: "/node-schedule",
      matchRoute: (currentRoute) => currentRoute === "/node-schedule",
    },
    {
      key: "reports",
      label: t("common:nav.reports"),
      icon: "📄",
      path: "/reports",
      matchRoute: (currentRoute) => currentRoute === "/reports" || currentRoute.startsWith("/reports/"),
    },
    {
      key: "finishing",
      label: "仕上表",
      icon: "📋",
      path: "/finishing",
      matchRoute: (currentRoute) => currentRoute === "/finishing" || currentRoute.startsWith("/finishing/"),
    },
    {
      key: "schedule",
      label: "工程表",
      icon: "📅",
      path: "/schedule",
      matchRoute: (currentRoute) => currentRoute === "/schedule",
    },
  ];

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- ルート変化でナビを閉じる意図的な同期
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
  const projectDetailMatch = route.match(/^\/project\/([^/]+)(?:\/(.+))?$/);
  const ganttMatch = route.match(/^\/gantt(?:\/(.+))?$/);
  const entryMatch = route.match(/^\/entry\/(.+)$/);
  const historyMatch = route.match(/^\/attendance-history\/(.+)$/);
  const reportsMatch = route.match(/^\/reports(?:\/(.+))?$/);
  const portalMatch = route.match(/^\/portal\/([^/]+)(?:\/(.+))?$/);
  const selectionMatch = route.match(/^\/selection\/([^/]+)$/);
  const moodBoardMatch = route.match(/^\/mood-board\/([^/]+)$/);
  const clientMatch = route.match(/^\/client\/([^/]+)$/);
  const ownerAppMatch = route.match(/^\/owner-app\/([^/?]+)/);
  const finishingMatch = route.match(/^\/finishing(?:\/([^/]+))?$/);
  const projectId = projectDetailMatch?.[1]
    ? decodeURIComponent(projectDetailMatch[1])
    : null;
  const projectSubPath = projectDetailMatch?.[2] ?? null;
  const ganttProjectId = ganttMatch?.[1] ? decodeURIComponent(ganttMatch[1]) : null;
  const entryProjectId = entryMatch?.[1] ? decodeURIComponent(entryMatch[1]) : null;
  const historyProjectId = historyMatch?.[1] ? decodeURIComponent(historyMatch[1]) : null;
  const reportsProjectId = reportsMatch?.[1] ? decodeURIComponent(reportsMatch[1]) : undefined;
  const portalProjectId = portalMatch?.[1] ? decodeURIComponent(portalMatch[1]) : null;
  const portalCompany = portalMatch?.[2] ? decodeURIComponent(portalMatch[2]) : undefined;
  const selectionProjectId = selectionMatch?.[1] ? decodeURIComponent(selectionMatch[1]) : null;
  const moodBoardProjectId = moodBoardMatch?.[1] ? decodeURIComponent(moodBoardMatch[1]) : null;
  const clientProjectId = clientMatch?.[1] ? decodeURIComponent(clientMatch[1]) : null;
  const ownerAppProjectId = ownerAppMatch?.[1] ? decodeURIComponent(ownerAppMatch[1]) : null;
  // Extract token from hash query string: /#/owner-app/xxx?token=yyy
  const ownerAppToken = ownerAppProjectId
    ? (window.location.hash.match(/[?&]token=([^&]+)/)?.[1] ?? "")
    : null;

  const pageFallback = <div className="flex items-center justify-center py-20 text-slate-400 text-sm">{t("common:status.loading")}</div>;

  // 認証不要ページ（入退場キオスク+協力会社ポータル+施主セレクション+施主ビューア+秘書デモ）
  if (route === "/assistant/demo") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center text-slate-500 text-sm">
          <div className="text-2xl mb-2">🤖</div>
          <div className="font-semibold text-slate-700">{t("pages:assistant.demo_title")}</div>
          <div className="mt-1">{t("pages:assistant.demo_hint")}</div>
        </div>
        <AssistantChatPanel userId="demo-user" />
      </div>
    );
  }
  if (ownerAppProjectId && ownerAppToken !== null) return <Suspense fallback={pageFallback}><OwnerAppPageLazy projectId={ownerAppProjectId} token={ownerAppToken} /></Suspense>;
  if (route === "/share-tokens") return <Suspense fallback={pageFallback}><OwnerShareTokenPanelLazy /></Suspense>;
  if (clientProjectId) return <Suspense fallback={pageFallback}><ClientViewerPage projectId={clientProjectId} /></Suspense>;
  if (entryProjectId) return <Suspense fallback={pageFallback}><SiteEntryPage projectId={entryProjectId} /></Suspense>;
  if (portalProjectId) return <Suspense fallback={pageFallback}><ContractorPortalPage projectId={portalProjectId} company={portalCompany} /></Suspense>;
  if (selectionProjectId) return <Suspense fallback={pageFallback}><SelectionBoardPage projectId={selectionProjectId} /></Suspense>;
  if (finishingMatch) return <Suspense fallback={pageFallback}><FinishingSchedulePage projectName={finishingMatch[1] ? decodeURIComponent(finishingMatch[1]) : undefined} /></Suspense>;
  if (route === "/landing") return <Suspense fallback={pageFallback}><LandingPage /></Suspense>;
  if (route === "/" || route === "") {
    navigate("/app");
    return null;
  }
  if (route === "/login") return <Suspense fallback={pageFallback}><LoginPage /></Suspense>;
  if (route === "/signup") return <Suspense fallback={pageFallback}><SignupPage /></Suspense>;
  if (legalMatch) {
    const section = legalMatch[1] as "tokushoho" | "privacy" | "tos" | undefined;
    return <Suspense fallback={pageFallback}><LegalPages section={section} /></Suspense>;
  }
  if (route === "/pricing/success" || route.startsWith("/pricing/success?")) {
    return <Suspense fallback={pageFallback}><PricingSuccessPage /></Suspense>;
  }
  if (route === "/pricing/cancel" || route.startsWith("/pricing/cancel?")) {
    return <Suspense fallback={pageFallback}><PricingCancelPage /></Suspense>;
  }
  if (route === "/pricing") return <Suspense fallback={pageFallback}><PricingPage /></Suspense>;

  const renderPage = () => {
    if (moodBoardProjectId) {
      return (
        <ErrorBoundary fallbackTitle={t("errors:page_error.mood_board")}>
          <MoodBoardPage projectId={moodBoardProjectId} />
        </ErrorBoundary>
      );
    }
    if (historyProjectId) {
      return <AttendanceHistoryPage projectId={historyProjectId} />;
    }
    if (reportsMatch) {
      return <ReportsPage projectId={reportsProjectId} />;
    }
    if (route === "/app") {
      return (
        <ErrorBoundary fallbackTitle={t("errors:page_error.project_list")}>
          <ProjectListPage />
        </ErrorBoundary>
      );
    }
    if (route === "/cross-project-gantt") {
      return (
        <ErrorBoundary fallbackTitle={t("errors:page_error.cross_gantt")}>
          <CrossProjectGanttPage />
        </ErrorBoundary>
      );
    }
    if (route === "/progress-review") {
      return (
        <ErrorBoundary fallbackTitle={t("errors:page_error.progress_review")}>
          <ProgressReviewPage />
        </ErrorBoundary>
      );
    }
    if (route === "/photos") {
      return (
        <ErrorBoundary fallbackTitle={t("errors:page_error.photos")}>
          <PhotoPage />
        </ErrorBoundary>
      );
    }
    if (route === "/freee" || route.startsWith("/freee?")) {
      return (
        <ErrorBoundary fallbackTitle={t("errors:page_error.freee")}>
          <FreeePage />
        </ErrorBoundary>
      );
    }
    if (finishingMatch) {
      return (
        <ErrorBoundary fallbackTitle="仕上表エラー">
          <FinishingSchedulePage
            projectName={finishingMatch[1] ? decodeURIComponent(finishingMatch[1]) : undefined}
          />
        </ErrorBoundary>
      );
    }
    if (route === "/schedule") {
      return (
        <ErrorBoundary fallbackTitle="工程表エラー">
          <ScheduleFromEstimatePage />
        </ErrorBoundary>
      );
    }
    if (route === "/margin-watch") {
      return (
        <ErrorBoundary fallbackTitle="粗利ウォッチエラー">
          <Suspense fallback={pageFallback}>
            <MarginWatchPageLazy />
          </Suspense>
        </ErrorBoundary>
      );
    }
    if (route === "/profit-ranking") {
      return (
        <ErrorBoundary fallbackTitle="粗利ランキングエラー">
          <Suspense fallback={pageFallback}>
            <ProfitRankingPageLazy />
          </Suspense>
        </ErrorBoundary>
      );
    }
    if (route === "/crew-optimizer") {
      return (
        <ErrorBoundary fallbackTitle="職人スケジュールエラー">
          <Suspense fallback={pageFallback}>
            <CrewOptimizerPageLazy />
          </Suspense>
        </ErrorBoundary>
      );
    }
    if (route === "/repeat-predictor") {
      return (
        <ErrorBoundary fallbackTitle="リピート予測エラー">
          <Suspense fallback={pageFallback}>
            <RepeatPredictorPageLazy />
          </Suspense>
        </ErrorBoundary>
      );
    }
    if (route === "/inquiry-responder") {
      return (
        <ErrorBoundary fallbackTitle="問合せ返信AIエラー">
          <Suspense fallback={pageFallback}>
            <InquiryResponderPageLazy />
          </Suspense>
        </ErrorBoundary>
      );
    }
    if (ganttMatch) {
      return <GanttPage initialProjectId={ganttProjectId} />;
    }
    if (route === "/tasks") {
      return (
        <ErrorBoundary fallbackTitle={t("errors:page_error.tasks")}>
          <TasksPage />
        </ErrorBoundary>
      );
    }
    if (route === "/today") {
      return <TodayDashboardPage />;
    }
    if (route === "/node-schedule") {
      return (
        <ErrorBoundary fallbackTitle={t("errors:page_error.node_schedule")}>
          <NodeSchedulePage />
        </ErrorBoundary>
      );
    }
    if (route === "/invoice") {
      return (
        <ErrorBoundary fallbackTitle={t("errors:page_error.invoice")}>
          <InvoicePage />
        </ErrorBoundary>
      );
    }
    if (route === "/estimate") {
      return <EstimatePage />;
    }
    if (route === "/cost-management") {
      return (
        <ErrorBoundary fallbackTitle={t("errors:page_error.cost")}>
          <CostManagementPage />
        </ErrorBoundary>
      );
    }
    if (route === "/invoices") {
      return (
        <ErrorBoundary fallbackTitle={t("errors:page_error.invoice_management")}>
          <InvoiceManagementPage />
        </ErrorBoundary>
      );
    }
    if (route === "/invoices/reconcile") {
      return (
        <ErrorBoundary fallbackTitle="入金照合エラー">
          <InvoiceReconcilePage />
        </ErrorBoundary>
      );
    }
    if (route === "/weather") {
      return (
        <ErrorBoundary fallbackTitle={t("errors:page_error.weather")}>
          <WeatherPage />
        </ErrorBoundary>
      );
    }
    if (route === "/procurement") {
      return (
        <ErrorBoundary fallbackTitle={t("errors:page_error.procurement")}>
          <ProcurementPage />
        </ErrorBoundary>
      );
    }
    if (route === "/orders") {
      return (
        <ErrorBoundary fallbackTitle={t("errors:page_error.orders")}>
          <OrderManagementPage />
        </ErrorBoundary>
      );
    }
    if (route === "/safety") {
      return (
        <ErrorBoundary fallbackTitle={t("errors:page_error.safety")}>
          <SafetyInspectionPage />
        </ErrorBoundary>
      );
    }
    if (route === "/contractors") {
      return (
        <ErrorBoundary fallbackTitle={t("errors:page_error.contractors")}>
          <ContractorsPage />
        </ErrorBoundary>
      );
    }
    if (route === "/crm") {
      return (
        <ErrorBoundary fallbackTitle={t("errors:page_error.crm")}>
          <CRMPage />
        </ErrorBoundary>
      );
    }
    if (route === "/notifications") {
      return (
        <ErrorBoundary fallbackTitle={t("errors:page_error.notifications")}>
          <NotificationsPage />
        </ErrorBoundary>
      );
    }
    if (route === "/help") {
      return (
        <ErrorBoundary fallbackTitle={t("errors:page_error.help")}>
          <HelpPage />
        </ErrorBoundary>
      );
    }
    if (projectId) {
      return (
        <ErrorBoundary fallbackTitle={t("errors:page_error.project_detail")}>
          <ProjectDetailPage projectId={projectId} subPath={projectSubPath} />
        </ErrorBoundary>
      );
    }
    if (route === "/account") {
      return (
        <Suspense fallback={pageFallback}>
          <AccountSettingsPage />
        </Suspense>
      );
    }
    return (
      <div className="mx-auto max-w-lg px-4 py-12 text-center" role="alert">
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-8">
          <h2 className="text-lg font-bold text-slate-900">{t("common:messages.page_not_found")}</h2>
          <p className="mt-2 text-sm text-slate-500">{t("common:messages.page_not_found_desc", { route })}</p>
          <button
            onClick={() => navigate("/app")}
            className="mt-4 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-600"
          >
            {t("common:actions.go_home")}
          </button>
        </div>
      </div>
    );
  };

  const allSidebarItems = [
    { key: "today", label: t("common:nav.dashboard"), icon: "📊", path: "/today", active: route === "/today" },
    { key: "app", label: t("common:nav.project_list"), icon: "📋", path: "/app", active: route === "/app" || route === "/" || route === "" },
    { key: "cross-gantt", label: t("common:nav.gantt_chart"), icon: "📅", path: "/cross-project-gantt", active: route === "/cross-project-gantt" },
    { key: "tasks", label: t("common:nav.tasks"), icon: "✅", path: "/tasks", active: route === "/tasks" },
    { key: "estimate", label: t("common:nav.estimate"), icon: "💰", path: "/estimate", active: route === "/estimate" },
    { key: "progress-review", label: t("common:nav.progress_review"), icon: "📸", path: "/progress-review", active: route === "/progress-review" },
    { key: "safety", label: t("common:nav.safety_management"), icon: "🏗️", path: "/safety", active: route === "/safety" },
    { key: "crm", label: t("common:nav.crm"), icon: "👥", path: "/crm", active: route === "/crm" },
    { key: "contractors", label: t("common:nav.partner_companies"), icon: "🤝", path: "/contractors", active: route === "/contractors" },
    { key: "invoice", label: t("common:nav.invoices_nav"), icon: "🧾", path: "/invoice", active: route === "/invoice" },
    { key: "reports", label: t("common:nav.reports"), icon: "📈", path: "/reports", active: route === "/reports" || route.startsWith("/reports/") },
    { key: "cost", label: t("common:nav.cost"), icon: "💹", path: "/cost-management", active: route === "/cost-management" },
    { key: "freee", label: t("common:nav.freee"), icon: "📗", path: "/freee", active: route === "/freee" || route.startsWith("/freee?") },
    { key: "finishing", label: "仕上表", icon: "📋", path: "/finishing", active: route === "/finishing" || route.startsWith("/finishing/") },
    { key: "schedule", label: "工程表", icon: "📅", path: "/schedule", active: route === "/schedule" },
    { key: "help", label: t("common:nav.help"), icon: "❓", path: "/help", active: route === "/help" },
    { key: "account", label: "アカウント設定", icon: "⚙️", path: "/account", active: route === "/account" },
  ];

  return (
    <AuthGuard>
      <div className="min-h-screen bg-[var(--app-bg)] text-[var(--app-text)]">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[100] focus:rounded-lg focus:bg-[#007AFF] focus:px-4 focus:py-2 focus:text-white"
        >
          {t("common:messages.skip_to_main")}
        </a>

        {/* ── iPadOS TopBar (frosted glass) ── */}
        <header className="ios-topbar text-slate-900">
          <div className="flex h-full items-center justify-between px-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate("/app")}
                className="flex items-center gap-2.5"
                aria-label={`${t("common:app.name")} ${t("common:nav.home")}`}
              >
                <LogoIcon />
                <div className="text-left hidden sm:block">
                  <span className="block text-base font-bold tracking-tight leading-tight">{t("common:app.name")}</span>
                  <span className="block text-[10px] text-slate-400 leading-tight">{t("common:app.tagline")}</span>
                </div>
              </button>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle theme={theme} onToggle={cycleTheme} />
              {/* Mobile hamburger */}
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
                personaLabel={persona === "supervisor" ? t("common:persona.supervisor") : t("common:persona.executive")}
                onTogglePersona={() => setPersona(persona === "supervisor" ? "executive" : "supervisor")}
                userLabel={user?.email ?? undefined}
                onSignOut={user ? signOut : undefined}
              />
              {user ? (
                <div className="hidden items-center gap-2 md:flex">
                  <span className="max-w-[160px] truncate text-xs text-slate-500" title={user.email}>
                    {user.email}
                  </span>
                  <button
                    type="button"
                    onClick={() => void signOut()}
                    className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    {t("common:actions.logout")}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        {/* ── iPadOS Sidebar (desktop only) ── */}
        <nav className="ios-sidebar hidden md:block" aria-label={t("common:nav.home")}>
          <div className="px-3 py-4 space-y-0.5">
            {allSidebarItems.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => navigate(item.path)}
                aria-current={item.active ? "page" : undefined}
                className={`ios-nav-item${item.active ? " active" : ""}`}
              >
                <span className="text-base leading-none" aria-hidden="true">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
          {user ? (
            <div className="border-t border-[rgba(60,60,67,0.12)] px-3 py-3 space-y-1">
              <button
                type="button"
                onClick={() => setPersona(persona === "supervisor" ? "executive" : "supervisor")}
                className="ios-nav-item w-full justify-between"
              >
                <span className="text-xs text-slate-400">表示モード</span>
                <span className="text-xs font-semibold text-[#007AFF]">{persona === "supervisor" ? t("common:persona.supervisor") : t("common:persona.executive")}</span>
              </button>
            </div>
          ) : null}
        </nav>

        <NotificationBanner refreshKey={route} />

        {/* ── Main content area (shifted right on desktop) ── */}
        <main
          id="main-content"
          key={route}
          className="page-enter ios-main-with-sidebar max-md:ml-0 px-4 py-5 pb-24 sm:py-6"
        >
          <div className="mx-auto max-w-5xl">
            <Suspense fallback={pageFallback}>
              {renderPage()}
            </Suspense>
          </div>
        </main>

        {/* ── Mobile bottom tab bar ── */}
        <nav
          className={`safe-bottom fixed inset-x-0 bottom-0 z-40 flex border-t border-[rgba(60,60,67,0.12)] bg-white/80 backdrop-blur shadow-[0_-1px_0_rgba(60,60,67,0.12)] md:hidden transition-transform duration-200 ${keyboardOpen ? "translate-y-full" : ""}`}
          aria-label={t("common:nav.home")}
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
                  isActive ? "text-[#007AFF]" : "text-slate-400"
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
                <p className="text-sm font-bold text-slate-700">{t("common:nav.more")}</p>
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
                        ? "border-[#007AFF]/30 bg-[#007AFF]/8 text-[#007AFF]"
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

        {!onboardingDone ? <OnboardingWizard onComplete={handleOnboardingComplete} /> : null}
        {onboardingDone && !tourDone && showTour ? <TourGuide onComplete={markTourDone} /> : null}
        {showShortcutHelp ? <KeyboardShortcutHelp onClose={() => setShowShortcutHelp(false)} /> : null}
        <AssistantChatPanel userId={user?.email ?? "anonymous"} />
        <InstallPrompt />
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
