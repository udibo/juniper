import { Outlet } from "react-router";

export default function Main() {
  return <Outlet />;
}

export function ErrorBoundary(...args: unknown[]) {
  console.log("ErrorBoundary args", args);
  return <div>Error</div>;
}
