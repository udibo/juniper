export default function NestedChildWithError() {
  if (Math.random() > 0) {
    throw new Error(
      "This error was thrown by a nested child route without an ErrorBoundary",
    );
  }
  return <div>No error</div>;
}
