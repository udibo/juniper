import "@udibo/juniper/utils/global-jsdom";

import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { afterEach, describe, it } from "@std/testing/bdd";
import { cleanup, render, screen } from "@testing-library/react";

import { InfoBox } from "@/components/InfoBox.tsx";

describe("InfoBox", () => {
  afterEach(() => cleanup());

  it("should render children and an optional title", () => {
    render(
      <InfoBox title="Details">
        <p>Content</p>
      </InfoBox>,
    );

    const heading = screen.getByRole("heading", { name: "Details" });
    assertEquals(heading.tagName, "H3");
    screen.getByText("Content");
  });

  it("should omit the title heading when not provided", () => {
    render(
      <InfoBox>
        <p>Body</p>
      </InfoBox>,
    );

    assertEquals(screen.queryByRole("heading"), null);
    screen.getByText("Body");
  });

  it("should apply color and className to the container", () => {
    const { container } = render(
      <InfoBox color="slate" className="extra-box">
        <p>Body</p>
      </InfoBox>,
    );

    const el = container.firstElementChild;
    assert(el);
    assertStringIncludes(el.className, "bg-slate-800/50");
    assertStringIncludes(el.className, "border-slate-700");
    assertStringIncludes(el.className, "extra-box");
  });
});
