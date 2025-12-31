import "@udibo/juniper/utils/global-jsdom";

import { assertStringIncludes } from "@std/assert";
import { afterEach, describe, it } from "@std/testing/bdd";
import { cleanup, render, screen } from "@testing-library/react";

import { FeatureBadge } from "@/components/FeatureBadge.tsx";

describe("FeatureBadge", () => {
  afterEach(() => cleanup());

  it("should render children and default to emerald styling", () => {
    render(<FeatureBadge>New</FeatureBadge>);
    const badge = screen.getByText("New");
    assertStringIncludes(badge.className, "bg-emerald-500/10");
    assertStringIncludes(badge.className, "text-emerald-400");
  });

  it("should support alternate colors", () => {
    render(<FeatureBadge color="red">Danger</FeatureBadge>);
    const badge = screen.getByText("Danger");
    assertStringIncludes(badge.className, "bg-red-500/10");
    assertStringIncludes(badge.className, "text-red-400");
  });
});
