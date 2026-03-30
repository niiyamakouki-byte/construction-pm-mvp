import { ProjectListPage } from "./pages/ProjectListPage.js";

export function App() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-800 text-white shadow-lg">
        <div className="mx-auto max-w-5xl px-4 py-4">
          <h1 className="text-xl font-bold tracking-tight">
            Construction PM
          </h1>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <ProjectListPage />
      </main>
    </div>
  );
}
