import { Link } from "react-router";

export default function FeaturesIndex() {
  return (
    <div className="text-center py-8">
      <title>Juniper Features</title>
      <h2 className="text-2xl font-bold text-slate-100 mb-4">
        Explore Juniper Features
      </h2>
      <p className="text-slate-400 max-w-md mx-auto mb-8">
        Select a feature from the sidebar to see it in action. Each example
        demonstrates a different capability of the Juniper framework.
      </p>
      <div className="flex gap-4 justify-center">
        <Link
          to="/features/routing"
          className="px-6 py-3 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded-lg transition-colors font-medium"
        >
          Start with Routing →
        </Link>
      </div>
    </div>
  );
}
