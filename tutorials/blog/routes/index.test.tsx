import "@udibo/juniper/utils/global-jsdom";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, it } from "@std/testing/bdd";

import { createRoutesStub } from "@udibo/juniper/utils/testing";

import * as indexRoute from "./index.tsx";

describe("Home route", () => {
  afterEach(cleanup);

  it("should render the home page", () => {
    const Stub = createRoutesStub([indexRoute]);
    render(<Stub />);

    screen.getByRole("heading", { name: "Welcome to My Blog" });
    screen.getByText("A simple blog built with Juniper.");
    screen.getByRole("link", { name: /View Posts/ });
  });
});
