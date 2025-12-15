import "global-jsdom/register";

import { assert } from "@std/assert";
import { afterEach, describe, it } from "@std/testing/bdd";
import { cleanup, render, screen } from "@testing-library/react";

import { LoadingPlaceholder } from "@/components/LoadingPlaceholder.tsx";

describe("LoadingPlaceholder", () => {
  afterEach(() => cleanup());

  it("should render the label and a spinner", () => {
    const { container } = render(<LoadingPlaceholder label="Loading data" />);

    screen.getByText("Loading data");

    const root = container.firstElementChild;
    assert(root);
    assert(root.className.includes("animate-pulse"));

    const spinner = container.querySelector(".animate-spin");
    assert(spinner);
  });
});
