import "global-jsdom/register";

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import { stub } from "@std/testing/mock";
import { FakeTime } from "@std/testing/time";

import { createRoutesStub } from "@udibo/juniper/utils/testing";

import * as loaderRoute from "./loader.tsx";

describe("LoaderDemo route", () => {
  let time: FakeTime;
  let randomStub: { restore: () => void };

  beforeEach(() => {
    time = new FakeTime(new Date("2025-01-15T12:00:00.000Z"));
    randomStub = stub(Math, "random", () => 0.42);
  });

  afterEach(() => {
    randomStub.restore();
    time.restore();
    cleanup();
  });

  it("should show HydrateFallback while loading", async () => {
    const Stub = createRoutesStub([loaderRoute]);
    render(<Stub />);

    await waitFor(() => {
      screen.getByText("Loading data...");
    });
  });

  it("should render loaded data after loader completes", async () => {
    const Stub = createRoutesStub([loaderRoute]);
    render(<Stub />);

    await waitFor(() => {
      screen.getByText("Loading data...");
    });

    await time.tickAsync(600);

    await waitFor(() => {
      screen.getByText("Data loaded successfully!");
    });

    screen.getByText("2025-01-15T12:00:00.600Z");
    screen.getByText("420");
  });

  it("should display the Loader heading", async () => {
    const Stub = createRoutesStub([loaderRoute]);
    render(<Stub />);

    await time.tickAsync(600);

    await waitFor(() => {
      screen.getByRole("heading", { name: "Loader" });
    });
  });

  it("should render with stubbed loader data", async () => {
    const Stub = createRoutesStub([{
      ...loaderRoute,
      loader() {
        return {
          timestamp: "2025-01-01T00:00:00.000Z",
          randomNumber: 999,
          message: "Stubbed data!",
        };
      },
    }]);
    render(<Stub />);

    await waitFor(() => {
      screen.getByText("Stubbed data!");
    });

    screen.getByText("2025-01-01T00:00:00.000Z");
    screen.getByText("999");
  });
});
