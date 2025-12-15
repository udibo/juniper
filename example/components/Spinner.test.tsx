import "global-jsdom/register";

import { assert, assertStringIncludes } from "@std/assert";
import { afterEach, describe, it } from "@std/testing/bdd";
import { cleanup, render } from "@testing-library/react";

import { Spinner } from "@/components/Spinner.tsx";

describe("Spinner", () => {
  afterEach(() => cleanup());

  it("should render with default size and color classes", () => {
    const { container } = render(<Spinner />);
    const el = container.firstElementChild;

    assert(el);
    assertStringIncludes(el.className, "w-4 h-4 border-2");
    assertStringIncludes(el.className, "border-emerald-400");
    assertStringIncludes(el.className, "border-t-transparent");
    assertStringIncludes(el.className, "rounded-full");
    assertStringIncludes(el.className, "animate-spin");
  });

  it("should support size, color, and className overrides", () => {
    const { container } = render(
      <Spinner size="lg" color="blue" className="extra-class" />,
    );
    const el = container.firstElementChild;

    assert(el);
    assertStringIncludes(el.className, "w-12 h-12 border-4");
    assertStringIncludes(el.className, "border-blue-400");
    assertStringIncludes(el.className, "extra-class");
  });
});
