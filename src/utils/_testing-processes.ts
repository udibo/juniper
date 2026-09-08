import childProcess from "node:child_process";
import { once } from "node:events";
import { stub } from "@std/testing/mock";

/** Await real child exits after the test has asked its services to stop. */
export function observeChildProcesses(): AsyncDisposable {
  const spawn = childProcess.spawn;
  const children = new Map<childProcess.ChildProcess, Promise<unknown>>();
  const observer = stub(childProcess, "spawn", (...args) => {
    const child = spawn(...args);
    children.set(child, once(child, "close"));
    return child;
  });
  return {
    async [Symbol.asyncDispose]() {
      try {
        for (const child of children.keys()) child.ref();
        await Promise.all(children.values());
      } finally {
        observer.restore();
      }
    },
  };
}
