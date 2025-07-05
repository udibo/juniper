import { Link, Outlet } from "react-router";

export default function BlogLayout() {
  return (
    <div>
      <header
        style={{
          borderBottom: "1px solid #ccc",
          paddingBottom: "1rem",
          marginBottom: "2rem",
        }}
      >
        <nav style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          <Link to="/" style={{ textDecoration: "none", color: "#666" }}>
            ← Home
          </Link>
          <h1 style={{ margin: 0 }}>Blog</h1>
        </nav>
      </header>

      <main>
        <Outlet />
      </main>
    </div>
  );
}
