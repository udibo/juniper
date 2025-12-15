import "global-jsdom/register";

import { assert, assertEquals } from "@std/assert";
import { afterEach, describe, it } from "@std/testing/bdd";
import { cleanup, render, screen } from "@testing-library/react";

import { CodeBlock } from "@/components/CodeBlock.tsx";

describe("CodeBlock", () => {
  afterEach(() => cleanup());

  it("should render default title and code content", () => {
    const code = "console.log('hello')";
    const { container } = render(<CodeBlock>{code}</CodeBlock>);

    screen.getByRole("heading", { name: "Example Code" });

    const pre = container.querySelector("pre");
    assert(pre);
    assertEquals(pre.textContent, code);
  });

  it("should support a custom title", () => {
    render(<CodeBlock title="Snippet">x</CodeBlock>);
    screen.getByRole("heading", { name: "Snippet" });
  });
});
