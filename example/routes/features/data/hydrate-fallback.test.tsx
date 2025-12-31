import "@udibo/juniper/utils/global-jsdom";

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, it } from "@std/testing/bdd";

import { createRoutesStub } from "@udibo/juniper/utils/testing";

import * as hydrateFallbackRoute from "./hydrate-fallback.tsx";

describe("HydrateFallbackDemo route", () => {
  afterEach(cleanup);

  it("should show HydrateFallback while loading", async () => {
    const Stub = createRoutesStub([{
      ...hydrateFallbackRoute,
      async loader() {
        await new Promise(() => {});
        return { message: "", timestamp: "" };
      },
    }]);
    render(<Stub />);

    await waitFor(() => {
      screen.getByText("This is the HydrateFallback component...");
    });
  });

  it("should render with stubbed loader data", async () => {
    const Stub = createRoutesStub([{
      ...hydrateFallbackRoute,
      loader() {
        return {
          message: "Test message loaded!",
          timestamp: "2025-01-15T12:00:00.000Z",
        };
      },
    }]);
    render(<Stub />);

    await waitFor(() => {
      screen.getByText("Test message loaded!");
    });

    screen.getByRole("heading", { name: "Hydrate Fallback" });
    screen.getByText("2025-01-15T12:00:00.000Z");
  });

  it("should display the Hydrate Fallback heading", async () => {
    const Stub = createRoutesStub([{
      ...hydrateFallbackRoute,
      loader() {
        return {
          message: "Loaded!",
          timestamp: "2025-01-01T00:00:00.000Z",
        };
      },
    }]);
    render(<Stub />);

    await waitFor(() => {
      screen.getByRole("heading", { name: "Hydrate Fallback" });
    });
  });

  it("should show tip about refreshing the page", async () => {
    const Stub = createRoutesStub([{
      ...hydrateFallbackRoute,
      loader() {
        return {
          message: "Loaded!",
          timestamp: "2025-01-01T00:00:00.000Z",
        };
      },
    }]);
    render(<Stub />);

    await waitFor(() => {
      screen.getByText(/Refresh the page to see the HydrateFallback/);
    });
  });
});
