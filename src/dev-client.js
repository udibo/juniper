/**
 * Client-side script for connecting to the Juniper dev server.
 * This script establishes an SSE connection to the dev server and
 * automatically reloads the page when the server indicates a rebuild.
 */

/**
 * Connects to the dev server SSE endpoint and handles automatic reloads
 */
function connectToDevServer(devServerPort = 9001) {
  const devServerUrl = `http://localhost:${devServerPort}/sse`;

  console.log("🔗 Connecting to dev server at", devServerUrl);

  const eventSource = new EventSource(devServerUrl);

  eventSource.addEventListener("dev-connection", (_event) => {
    console.log("✅ Connected to dev server");
  });

  eventSource.addEventListener("dev-reload", (event) => {
    try {
      const data = JSON.parse(event.data);
      console.log("🔄 Dev server requested reload:", data);
      globalThis.location.reload();
    } catch (error) {
      console.error("❌ Failed to parse reload message:", error);
    }
  });

  eventSource.addEventListener("dev-keepalive", (_event) => {
    console.debug("💓 Dev server keepalive");
  });

  eventSource.onerror = (error) => {
    console.error("❌ Dev server connection error:", error);
    setTimeout(() => {
      console.log("🔄 Attempting to reconnect to dev server...");
      connectToDevServer(devServerPort);
    }, 5000);
  };

  globalThis.addEventListener("beforeunload", () => {
    eventSource.close();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    connectToDevServer();
  });
} else {
  connectToDevServer();
}
