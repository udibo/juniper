import "global-jsdom/register";

import { assertEquals } from "@std/assert";
import { afterEach, describe, it } from "@std/testing/bdd";
import { cleanup, render, screen } from "@testing-library/react";

import { Note } from "@/components/Note.tsx";

describe("Note", () => {
  afterEach(() => cleanup());

  it("should default the label to Note", () => {
    render(<Note>Remember this</Note>);

    const label = screen.getByText("Note:");
    assertEquals(label.tagName, "STRONG");
    screen.getByText("Remember this");
  });

  it("should support custom labels", () => {
    render(<Note label="Warning">Be careful</Note>);
    screen.getByText("Warning:");
    screen.getByText("Be careful");
  });
});
