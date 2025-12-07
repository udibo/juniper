import { Outlet } from "react-router";
import type { ErrorBoundaryProps } from "@udibo/juniper";

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <main>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1.0" />
      <link rel="icon" href="/favicon.ico" />
      <link rel="stylesheet" href="/build/main.css" precedence="default" />
      <h1 className="text-3xl font-bold underline">TailwindCSS Example</h1>
      {children}
    </main>
  );
}

export default function Main() {
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}

export function ErrorBoundary(
  { error }: ErrorBoundaryProps,
) {
  let name = "Error";
  let message = "An unexpected error occurred.";
  if (error instanceof Error) {
    name = error.name;
    message = error.message;
  }

  return (
    <Layout>
      <h2>{name}</h2>
      <p>{message}</p>
    </Layout>
  );
}
