import { Outlet } from "react-router";
import type { ErrorBoundaryProps } from "@udibo/juniper";

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <main style={{ maxWidth: "800px", margin: "0 auto", padding: "1rem" }}>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1.0" />
      <link rel="icon" href="/favicon.ico" />
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

export function ErrorBoundary({ error }: ErrorBoundaryProps) {
  let name = "Error";
  let message = "An unexpected error occurred.";
  if (error instanceof Error) {
    name = error.name;
    message = error.message;
  }

  return (
    <Layout>
      <h1>{name}</h1>
      <p>{message}</p>
    </Layout>
  );
}
