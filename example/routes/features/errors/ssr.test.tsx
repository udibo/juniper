import "global-jsdom/register";

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, it } from "@std/testing/bdd";

import { createRoutesStub } from "@udibo/juniper/utils/testing";

import * as ssrRoute from "./ssr.tsx";

describe("SSRErrorDemo route", () => {
  afterEach(cleanup);

  it("should render with stubbed loader data", async () => {
    const Stub = createRoutesStub([{
      ...ssrRoute,
      loader() {
        return {
          message: "Data loaded successfully from the client!",
          timestamp: "2025-01-15T12:00:00.000Z",
        };
      },
    }]);
    render(<Stub />);

    await waitFor(() => {
      screen.getByRole("heading", { name: "Server-Side Error Handling" });
    });

    screen.getByText("Data loaded successfully from the client!");
  });

  it("should display the SSR Errors feature badge", async () => {
    const Stub = createRoutesStub([{
      ...ssrRoute,
      loader() {
        return {
          message: "Loaded!",
          timestamp: "2025-01-01T00:00:00.000Z",
        };
      },
    }]);
    render(<Stub />);

    await waitFor(() => {
      screen.getByText("SSR Errors");
    });
  });

  it("should show current state information", async () => {
    const Stub = createRoutesStub([{
      ...ssrRoute,
      loader() {
        return {
          message: "Test message",
          timestamp: "2025-01-15T12:00:00.000Z",
        };
      },
    }]);
    render(<Stub />);

    await waitFor(() => {
      screen.getByText("Current State");
    });

    screen.getByText(/Data loaded successfully/);
  });

  it("should explain how SSR errors work", async () => {
    const Stub = createRoutesStub([{
      ...ssrRoute,
      loader() {
        return {
          message: "Loaded!",
          timestamp: "2025-01-01T00:00:00.000Z",
        };
      },
    }]);
    render(<Stub />);

    await waitFor(() => {
      screen.getByText("How It Works");
    });

    screen.getByText(
      /When a page is loaded directly.*the loader runs on the server/,
    );
  });

  it("should have a button to trigger SSR error via page refresh", async () => {
    const Stub = createRoutesStub([{
      ...ssrRoute,
      loader() {
        return {
          message: "Loaded!",
          timestamp: "2025-01-01T00:00:00.000Z",
        };
      },
    }]);
    render(<Stub />);

    await waitFor(() => {
      screen.getByRole("button", { name: /Refresh Page/ });
    });
  });
});
