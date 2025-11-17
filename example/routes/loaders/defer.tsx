import { delay } from "@std/async/delay";
import { Suspense } from "react";
import { Await, useAsyncError } from "react-router";

import type { AnyParams, RouteProps } from "@udibo/juniper";

interface DeferLoaderData {
  message: string;
  delayedMessage: Promise<string>;
  oops: Promise<string>;
}

export function loader(): DeferLoaderData {
  console.log("loader called");
  return {
    message: "Hello",
    delayedMessage: delay(1000).then(() => "World"),
    oops: delay(2000).then(() => {
      throw new Error("Oops");
    }),
  };
}

function AwaitError() {
  const error = useAsyncError();
  return (
    <p>
      Await Error: {error instanceof Error ? error.message : "Unknown error"}
    </p>
  );
}

export default function Defer({
  loaderData,
}: RouteProps<AnyParams, DeferLoaderData>) {
  const { message, delayedMessage, oops } = loaderData;
  console.log("Defer component rendered", message, delayedMessage, oops);

  return (
    <div>
      <title>{`Defer ${message}`}</title>
      <p>Message: {message}</p>
      <Suspense fallback={<p>Loading...</p>}>
        <Await resolve={delayedMessage} errorElement={<AwaitError />}>
          {(resolvedMessage: string) => (
            <p>Delayed message: {resolvedMessage}</p>
          )}
        </Await>
      </Suspense>
      <Suspense fallback={<p>Loading...</p>}>
        <Await resolve={oops} errorElement={<AwaitError />}>
          {(resolvedOops: string) => <p>Oops: {resolvedOops}</p>}
        </Await>
      </Suspense>
    </div>
  );
}
