import { Outlet } from "react-router";

import { CustomError, isSerializedCustomError } from "/utils/error.ts";
import type { ErrorBoundaryProps } from "@udibo/juniper";

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

export function ErrorBoundary(
  { params, error, resetErrorBoundary }: ErrorBoundaryProps,
) {
  console.log("ErrorBoundary error", error, params);
  if (error instanceof CustomError) {
    return (
      <div>
        <h1>CustomError</h1>
        <p>Message: {error.message}</p>
        <p>Expose stack: {error.exposeStack ? "Yes" : "No"}</p>
        {error.exposeStack ? <pre>Stack: {error.stack}</pre> : null}
        <button type="button" onClick={resetErrorBoundary}>Try again</button>
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
