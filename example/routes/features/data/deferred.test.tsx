import "global-jsdom/register";

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, it } from "@std/testing/bdd";

import { createRoutesStub } from "@udibo/juniper/utils/testing";

import * as deferredRoute from "./deferred.tsx";

describe("DeferredDataDemo route", () => {
  afterEach(cleanup);

  it("should render with stubbed loader data", async () => {
    const Stub = createRoutesStub([{
      ...deferredRoute,
      loader() {
        return {
          fastData: "Instant data!",
          slowData: Promise.resolve("Slow data resolved!"),
          verySlowData: Promise.resolve("Very slow data resolved!"),
        };
      },
    }]);
    render(<Stub />);

    await waitFor(() => {
      screen.getByRole("heading", { name: "Deferred Data" });
    });

    screen.getByText("Instant data!");
  });

  it("should show the deferred data explanation", async () => {
    const Stub = createRoutesStub([{
      ...deferredRoute,
      loader() {
        return {
          fastData: "Fast!",
          slowData: Promise.resolve("Slow!"),
          verySlowData: Promise.resolve("Very slow!"),
        };
      },
    }]);
    render(<Stub />);

    await waitFor(() => {
      screen.getByText(/Deferred loading allows you to return promises/);
    });
  });

  it("should display the Deferred Data feature badge and heading", async () => {
    const Stub = createRoutesStub([{
      ...deferredRoute,
      loader() {
        return {
          fastData: "Fast!",
          slowData: Promise.resolve("Slow!"),
          verySlowData: Promise.resolve("Very slow!"),
        };
      },
    }]);
    render(<Stub />);

    await waitFor(() => {
      screen.getByRole("heading", { name: "Deferred Data" });
    });
  });
});
