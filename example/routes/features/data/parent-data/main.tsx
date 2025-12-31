import { Outlet } from "react-router";

import { FeatureBadge } from "@/components/FeatureBadge.tsx";
import { InfoBox } from "@/components/InfoBox.tsx";

export interface ParentLoaderData {
  parentMessage: string;
  loadedAt: string;
  sharedConfig: {
    theme: string;
    version: string;
  };
}

export default function ParentDataLayout() {
  return (
    <div>
      <title>Parent Data - Juniper Features</title>
      <FeatureBadge color="purple">useRouteLoaderData</FeatureBadge>
      <h2 className="text-2xl font-bold text-slate-100 mb-4">
        Accessing Parent Route Data
      </h2>
      <p className="text-slate-300 mb-6 leading-relaxed">
        Child routes can access loader data from parent routes using{" "}
        <code className="text-emerald-400">useRouteLoaderData</code>. This is
        useful for sharing data like user info, config, or any data loaded by a
        parent without needing to reload it.
      </p>

      <InfoBox title="Parent Route" color="purple" className="mb-6">
        <p className="text-slate-300">
          This parent route has a loader that fetches shared data. The child
          route below accesses this data using{" "}
          <code className="text-emerald-400">
            useRouteLoaderData("/features/data/parent-data")
          </code>
          .
        </p>
      </InfoBox>

      <Outlet />
    </div>
  );
}
