import { ProjectListPage } from "./pages/ProjectListPage.js";
import { TodayDashboardPage } from "./pages/TodayDashboardPage.js";
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

export function App() {
  const route = useHashRoute();

  return (
    <div className="min-h-screen bg-[#f8fafc]">
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
          <nav className="flex gap-1">
            <NavButton
              label="Today"
              icon="📋"
              active={route === "/today"}
              onClick={() => navigate("/today")}
            />
            <NavButton
              label="Projects"
              icon="🏗"
              active={route === "/"}
              onClick={() => navigate("/")}
            />
          </nav>
        </div>
      </header>
      <main className={route === "/today" ? "py-6" : "mx-auto max-w-5xl px-4 py-6 sm:py-8"}>
        {route === "/today" ? <TodayDashboardPage /> : <ProjectListPage />}
      </main>
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
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
