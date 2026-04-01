import { ProjectListPage } from "./pages/ProjectListPage.js";
import { TodayDashboardPage } from "./pages/TodayDashboardPage.js";
import { useHashRoute, navigate } from "./hooks/useHashRouter.js";

export function App() {
  const route = useHashRoute();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-800 text-white shadow-lg">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <h1 className="text-xl font-bold tracking-tight">
            Construction PM
          </h1>
          <nav className="flex gap-1">
            <NavButton
              label="Today"
              active={route === "/today"}
              onClick={() => navigate("/today")}
            />
            <NavButton
              label="Projects"
              active={route === "/"}
              onClick={() => navigate("/")}
            />
          </nav>
        </div>
      </header>
      <main className={route === "/today" ? "py-6" : "mx-auto max-w-5xl px-4 py-8"}>
        {route === "/today" ? <TodayDashboardPage /> : <ProjectListPage />}
      </main>
    </div>
  );
}

function NavButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "bg-white/20 text-white"
          : "text-slate-300 hover:text-white hover:bg-white/10"
      }`}
    >
      {label}
    </button>
  );
}
