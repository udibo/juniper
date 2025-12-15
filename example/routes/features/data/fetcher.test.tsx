import "global-jsdom/register";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, it } from "@std/testing/bdd";

import { createRoutesStub } from "@udibo/juniper/utils/testing";

import * as fetcherRoute from "./fetcher.tsx";

describe("FetcherActionDemo route", () => {
  afterEach(cleanup);

  it("should render the fetcher action page", () => {
    const Stub = createRoutesStub([fetcherRoute]);
    render(<Stub />);

    screen.getByRole("heading", { name: "Fetcher Action" });
    screen.getByText(/Fetchers allow you to submit data without navigation/);
  });

  it("should display the counter at 0 initially", () => {
    const Stub = createRoutesStub([fetcherRoute]);
    render(<Stub />);

    screen.getByText("0");
    screen.getByText("Click a button to update");
  });

  it("should have increment, decrement, and reset buttons", () => {
    const Stub = createRoutesStub([fetcherRoute]);
    render(<Stub />);

    screen.getByRole("button", { name: "+" });
    screen.getByRole("button", { name: "−" });
    screen.getByRole("button", { name: "Reset" });
  });

  it("should display the Fetcher Action heading", () => {
    const Stub = createRoutesStub([fetcherRoute]);
    render(<Stub />);

    screen.getByRole("heading", { name: "Fetcher Action" });
  });

  it("should show the tip about fetchers not causing navigation", () => {
    const Stub = createRoutesStub([fetcherRoute]);
    render(<Stub />);

    screen.getByText(/fetchers don't cause navigation/);
  });
});
