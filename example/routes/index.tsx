import { Link } from "react-router";

export default function HomePage() {
  return (
    <div>
      <title>Juniper - Modern Web Framework for Deno</title>

      <section className="text-center py-16">
        <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
          Welcome to Juniper
        </h1>
        <p className="text-xl text-slate-300 max-w-2xl mx-auto mb-12 leading-relaxed">
          A modern web framework for building React applications with Deno.
          File-based routing, server-side rendering, and TypeScript support out
          of the box.
        </p>

        <div className="flex gap-4 justify-center">
          <Link
            to="/features"
            className="px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-semibold rounded-xl transition-all hover:scale-105 shadow-lg shadow-emerald-500/25"
          >
            Explore Features
          </Link>
          <Link
            to="/blog"
            className="px-8 py-4 border-2 border-slate-600 hover:border-emerald-400 text-slate-300 hover:text-emerald-400 font-semibold rounded-xl transition-all"
          >
            Read the Blog
          </Link>
        </div>
      </section>

      <section className="py-16">
        <h2 className="text-3xl font-bold text-center mb-12 text-slate-100">
          Why Juniper?
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-slate-800/50 p-8 rounded-2xl border border-slate-700/50 hover:border-emerald-500/30 transition-colors">
            <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center mb-4">
              <svg
                className="w-6 h-6 text-emerald-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-3 text-slate-100">
              File-Based Routing
            </h3>
            <p className="text-slate-400 leading-relaxed">
              Intuitive routing based on your file structure. Create pages by
              adding files to your routes directory.
            </p>
          </div>

          <div className="bg-slate-800/50 p-8 rounded-2xl border border-slate-700/50 hover:border-emerald-500/30 transition-colors">
            <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center mb-4">
              <svg
                className="w-6 h-6 text-emerald-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-3 text-slate-100">
              Server-Side Rendering
            </h3>
            <p className="text-slate-400 leading-relaxed">
              Fast initial page loads with SSR. Your React components render on
              the server for optimal performance.
            </p>
          </div>

          <div className="bg-slate-800/50 p-8 rounded-2xl border border-slate-700/50 hover:border-emerald-500/30 transition-colors">
            <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center mb-4">
              <svg
                className="w-6 h-6 text-emerald-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-3 text-slate-100">
              Hot Reloading
            </h3>
            <p className="text-slate-400 leading-relaxed">
              See your changes instantly. Development server automatically
              refreshes when you save your files.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
