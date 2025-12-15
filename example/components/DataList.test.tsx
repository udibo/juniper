import "global-jsdom/register";

import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { afterEach, describe, it } from "@std/testing/bdd";
import { cleanup, render, screen } from "@testing-library/react";

import { DataList, DataListItem } from "@/components/DataList.tsx";

describe("DataList", () => {
  afterEach(() => cleanup());

  it("should render a dl and its items with dt/dd semantics", () => {
    const { container } = render(
      <DataList>
        <DataListItem label="Framework">Juniper</DataListItem>
      </DataList>,
    );

    const dl = container.querySelector("dl");
    assert(dl);

    const dt = screen.getByText("Framework");
    const dd = screen.getByText("Juniper");
    assertEquals(dt.tagName, "DT");
    assertEquals(dd.tagName, "DD");
  });

  it("should render a divider when the item is not last", () => {
    render(
      <DataList>
        <DataListItem label="A">1</DataListItem>
        <DataListItem label="B" isLast>2</DataListItem>
      </DataList>,
    );

    const a = screen.getByText("A").closest("div");
    const b = screen.getByText("B").closest("div");

    assert(a);
    assert(b);
    assertStringIncludes(a.className, "border-b");
    assertEquals(b.className.includes("border-b"), false);
  });
});
