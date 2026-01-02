import { Link } from "react-router";

export default function Home() {
  return (
    <>
      <title>My Blog</title>
      <meta name="description" content="A simple blog built with Juniper" />
      <div style={{ textAlign: "center", padding: "3rem" }}>
        <h1>Welcome to My Blog</h1>
        <p>A simple blog built with Juniper.</p>
        <Link to="/blog">View Posts &rarr;</Link>
      </div>
    </>
  );
}
