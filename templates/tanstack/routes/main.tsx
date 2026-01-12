import { Link, Outlet } from "react-router";
import { QueryClientProvider } from "@tanstack/react-query";

import type { ErrorBoundaryProps, RouteProps } from "@udibo/juniper";

import { queryClientContext } from "@/context/query.ts";

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <main>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1.0" />
      <link rel="icon" href="/favicon.ico" />
      <h1>TanStack Query Example</h1>
      <nav>
        <Link to="/">Home</Link> | <Link to="/contacts">Contacts</Link>
      </nav>
      {children}
    </main>
  );
}

export default function Main({ context }: RouteProps) {
  const queryClient = context.get(queryClientContext);

  return (
    <QueryClientProvider client={queryClient}>
      <Layout>
        <Outlet />
      </Layout>
    </QueryClientProvider>
  );
}

export function ErrorBoundary({ error }: ErrorBoundaryProps) {
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
