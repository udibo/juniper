import { Link, Outlet } from "react-router";

export default function BlogLayout() {
  return (
    <div>
      <header className="border-b border-slate-700/50 pb-6 mb-8">
        <nav className="flex gap-4 items-center">
          <Link
            to="/"
            className="text-slate-400 hover:text-emerald-400 transition-colors"
          >
            ← Home
          </Link>
          <h1 className="text-3xl font-bold text-slate-100 m-0">Blog</h1>
        </nav>
      </header>

      <main>
        <Outlet />
      </main>
    </div>
  );
}
