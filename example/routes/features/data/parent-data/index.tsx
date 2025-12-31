import { useRouteLoaderData } from "react-router";

import { CodeBlock } from "@/components/CodeBlock.tsx";
import { DataList, DataListItem } from "@/components/DataList.tsx";
import { InfoBox } from "@/components/InfoBox.tsx";
import { Note } from "@/components/Note.tsx";

import type { ParentLoaderData } from "./main.tsx";

export default function ChildRouteUsingParentData() {
  const parentData = useRouteLoaderData<ParentLoaderData>(
    "/features/data/parent-data",
  )!;

  return (
    <div>
      <h3 className="text-xl font-semibold text-slate-100 mb-4">
        Child Route (No Loader)
      </h3>
      <p className="text-slate-300 mb-6 leading-relaxed">
        This child route does not have its own loader. Instead, it accesses the
        parent route's loader data using{" "}
        <code className="text-emerald-400">useRouteLoaderData</code>{" "}
        with the parent's route ID.
      </p>

      <InfoBox title="Data from Parent Loader" color="emerald" className="mb-6">
        <DataList>
          <DataListItem label="Parent Message">
            {parentData.parentMessage}
          </DataListItem>
          <DataListItem label="Loaded At">
            <span className="font-mono text-sm">{parentData.loadedAt}</span>
          </DataListItem>
          <DataListItem label="Theme">
            <span className="text-purple-400">
              {parentData.sharedConfig.theme}
            </span>
          </DataListItem>
          <DataListItem label="Version" isLast>
            <span className="font-mono">{parentData.sharedConfig.version}</span>
          </DataListItem>
        </DataList>
      </InfoBox>

      <h4 className="text-lg font-semibold text-slate-200 mb-3">
        Parent Route Code
      </h4>
      <CodeBlock>
        {`// routes/features/data/parent-data/main.tsx
import { Outlet } from "react-router";
import type { RouteLoaderArgs } from "@udibo/juniper";

export interface ParentLoaderData {
  parentMessage: string;
  loadedAt: string;
  sharedConfig: { theme: string; version: string };
}

export async function loader(_args: RouteLoaderArgs): Promise<ParentLoaderData> {
  return {
    parentMessage: "Hello from parent loader!",
    loadedAt: new Date().toISOString(),
    sharedConfig: { theme: "dark", version: "1.0.0" },
  };
}

export default function ParentLayout() {
  return (
    <div>
      <h2>Parent Route</h2>
      <Outlet />
    </div>
  );
}`}
      </CodeBlock>

      <h4 className="text-lg font-semibold text-slate-200 mb-3 mt-6">
        Child Route Code
      </h4>
      <CodeBlock>
        {`// routes/features/data/parent-data/index.tsx
import { useRouteLoaderData } from "react-router";
import type { ParentLoaderData } from "./main.tsx";

export default function ChildRoute() {
  // Use the parent route's path as the route ID
  const parentData = useRouteLoaderData(
    "/features/data/parent-data"
  ) as ParentLoaderData;

  return (
    <div>
      <p>Message: {parentData.parentMessage}</p>
      <p>Theme: {parentData.sharedConfig.theme}</p>
    </div>
  );
}`}
      </CodeBlock>

      <Note className="mt-6">
        With path-based route IDs, accessing parent data is intuitive—just use
        the parent route's URL path as the ID. This makes your code more
        readable and maintainable.
      </Note>
    </div>
  );
}
