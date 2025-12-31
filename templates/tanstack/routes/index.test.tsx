import "@udibo/juniper/utils/global-jsdom";

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, it } from "@std/testing/bdd";
import { FakeTime } from "@std/testing/time";

import { createRoutesStub } from "@udibo/juniper/utils/testing";

import * as indexRoute from "./index.ts";
import * as indexRouteClient from "./index.tsx";

describe("Home route", () => {
  afterEach(cleanup);

  it("should render loader data", async () => {
    using _time = new FakeTime("2025-01-15T12:00:00.000Z");
    const Stub = createRoutesStub([{
      ...indexRouteClient,
      loader: indexRoute.loader,
    }]);
    render(<Stub />);

    await waitFor(() => {
      screen.getByRole("heading", { name: "Hello, World!" });
    });
    screen.getByText("Current time: 2025-01-15T12:00:00.000Z");
  });

  it("should render with stubbed loader data", async () => {
    const Stub = createRoutesStub([{
      ...indexRouteClient,
      loader() {
        return { message: "Custom Message!", now: new Date() };
      },
    }]);
    render(<Stub />);

    await waitFor(() => {
      screen.getByRole("heading", { name: "Custom Message!" });
    });
  });
});
