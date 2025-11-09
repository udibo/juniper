import { Outlet, useRouteError } from "react-router";

import { CustomError, isSerializedCustomError } from "/utils/error.ts";

export default function Main() {
  return (
    <>
      <meta charSet="utf-8" />
      <meta
        name="viewport"
        content="width=device-width,initial-scale=1.0"
      />
      <Outlet />
    </>
  );
}

export function ErrorBoundary(...args: unknown[]) {
  console.log("ErrorBoundary args", args);
  const error = useRouteError();
  console.error("ErrorBoundary error", error);

  if (error instanceof CustomError) {
    return (
      <div>
        <h1>CustomError</h1>
        <p>Message: {error.message}</p>
        <p>Expose stack: {error.exposeStack ? "Yes" : "No"}</p>
        {error.exposeStack ? <pre>Stack: {error.stack}</pre> : null}
      </div>
    );
  }

  return <div>Error</div>;
}

export function deserializeError(serializedError: unknown) {
  if (isSerializedCustomError(serializedError)) {
    const { message, exposeStack, stack } = serializedError;
    const error = new CustomError(message, exposeStack);
    error.stack = stack;
    return error;
  }
}
