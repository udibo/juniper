import { Await, useAsyncError, useLoaderData } from "react-router";
import { Suspense } from "react";
import { delay } from "@std/async/delay";

export function loader() {
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

export default function Defer() {
  const { message, delayedMessage, oops } = useLoaderData();
  console.log("Defer component rendered", message, delayedMessage, oops);

  return (
    <div>
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
