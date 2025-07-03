import { Outlet } from "react-router";

export default function Main() {
  return <Outlet />;
}

export function ErrorBoundary() {
  return <div>Error</div>;
}
