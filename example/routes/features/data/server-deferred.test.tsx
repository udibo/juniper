import "@udibo/juniper/utils/global-jsdom";

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, it } from "@std/testing/bdd";

import { createRoutesStub } from "@udibo/juniper/utils/testing";

import * as serverDeferredRoute from "./server-deferred.tsx";

describe("ServerDeferredDataDemo route", () => {
  afterEach(cleanup);

  it("should render with stubbed loader data", async () => {
    const Stub = createRoutesStub([{
      ...serverDeferredRoute,
      loader() {
        return {
          fastData: "Instant server data!",
          slowData: Promise.resolve("Slow data resolved!"),
          verySlowData: Promise.resolve("Very slow data resolved!"),
          timestamp: "2026-01-09T00:00:00.000Z",
        };
      },
    }]);
    render(<Stub />);

    await waitFor(() => {
      screen.getByRole("heading", { name: "Server Deferred Data" });
    });

    screen.getByText("Instant server data!");
  });

  it("should show the server deferred data explanation", async () => {
    const Stub = createRoutesStub([{
      ...serverDeferredRoute,
      loader() {
        return {
          fastData: "Fast!",
          slowData: Promise.resolve("Slow!"),
          verySlowData: Promise.resolve("Very slow!"),
          timestamp: "2026-01-09T00:00:00.000Z",
        };
      },
    }]);
    render(<Stub />);

    await waitFor(() => {
      screen.getByText(/Server loaders can also return promises/);
    });
  });

  it("should display how it works section", async () => {
    const Stub = createRoutesStub([{
      ...serverDeferredRoute,
      loader() {
        return {
          fastData: "Fast!",
          slowData: Promise.resolve("Slow!"),
          verySlowData: Promise.resolve("Very slow!"),
          timestamp: "2026-01-09T00:00:00.000Z",
        };
      },
    }]);
    render(<Stub />);

    await waitFor(() => {
      screen.getByText("How it works:");
    });
    screen.getByText(/Server loader runs and returns an object with promises/);
  });
});
