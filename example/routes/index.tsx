import { Link } from "react-router";

export default function HomePage() {
  return (
    <div>
      <h1>Welcome to Juniper</h1>
      <p>
        This is a modern web framework for building React applications with
        Deno.
      </p>
      <div>
        <h2>Features</h2>
        <ul>
          <li>File-based routing</li>
          <li>Server-side rendering</li>
          <li>TypeScript support</li>
          <li>Hot reloading</li>
        </ul>
      </div>

      <div style={{ marginTop: "2rem" }}>
        <h2>Explore</h2>
        <p>
          <Link
            to="/blog"
            style={{
              color: "#2563eb",
              textDecoration: "none",
              fontWeight: "500",
            }}
          >
            Visit our Blog →
          </Link>
        </p>
        <p>
          <Link
            to="/loaders/defer"
            style={{
              color: "#2563eb",
              textDecoration: "none",
              fontWeight: "500",
            }}
          >
            Visit our Defer Page →
          </Link>
        </p>
      </div>
    </div>
  );
}
