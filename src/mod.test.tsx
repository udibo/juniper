import "./utils/global-jsdom.ts";

import { assertStringIncludes } from "@std/assert";
import { afterEach, describe, it } from "@std/testing/bdd";
import { stub } from "@std/testing/mock";
import { assertType } from "@std/testing/types";
import type { IsExact } from "@std/testing/types";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Link, Outlet } from "react-router";

import { Client } from "@udibo/juniper/client";
import { HttpError } from "@udibo/juniper";
import type { AnyParams, ErrorBoundaryProps } from "@udibo/juniper";
import { createServer } from "@udibo/juniper/server";
import { createRoutesStub } from "@udibo/juniper/utils/testing";

interface LayoutData {
  name: string;
}

function LayoutBoundary(
  { loaderData, error }: ErrorBoundaryProps<AnyParams, LayoutData>,
) {
  const message = error instanceof HttpError
    ? error.exposedMessage
    : "Unexpected error";
  return (
    <div>
      <p>{loaderData ? `Layout data: ${loaderData.name}` : "No layout data"}</p>
      <p>{message}</p>
    </div>
  );
}

describe("ErrorBoundaryProps", () => {
  it("types loaderData and actionData as possibly undefined", () => {
    type Props = ErrorBoundaryProps<AnyParams, LayoutData, { saved: true }>;
    assertType<IsExact<Props["loaderData"], LayoutData | undefined>>(true);
    assertType<IsExact<Props["actionData"], { saved: true } | undefined>>(
      true,
    );
  });

  it("rejects reading loader data without checking that it is present", () => {
    const unguarded = (
      { loaderData }: ErrorBoundaryProps<AnyParams, LayoutData>,
    ) =>
      // @ts-expect-error loaderData is undefined when this route's loader threw
      loaderData.name;
    assertType<IsExact<ReturnType<typeof unguarded>, string>>(true);
  });
});

describe("ErrorBoundary loaderData in the browser", () => {
  afterEach(cleanup);

  function createLayoutStub(
    { layoutFails, childFails }: { layoutFails: boolean; childFails: boolean },
  ) {
    return createRoutesStub([{
      path: "/:tenant",
      loader: ({ params }) => {
        if (layoutFails || params.tenant === "refused") {
          throw new HttpError(404, "Not found", {
            exposedMessage: "Tenant not found",
          });
        }
        return { name: params.tenant! } satisfies LayoutData;
      },
      default: () => (
        <div>
          <Link to="/refused">Switch tenant</Link>
          <Outlet />
        </div>
      ),
      ErrorBoundary: LayoutBoundary,
      children: [
        { index: true, default: () => <p>Overview</p> },
        {
          path: "users",
          loader: () => {
            if (childFails) {
              throw new HttpError(404, "Not found", {
                exposedMessage: "User not found",
              });
            }
            return null;
          },
          default: () => <p>Users</p>,
        },
      ],
    }]);
  }

  it("is undefined when the boundary's own loader threw", async () => {
    const Stub = createLayoutStub({ layoutFails: true, childFails: false });
    render(<Stub initialEntries={["/acme/users"]} />);

    await screen.findByText("Tenant not found");
    screen.getByText("No layout data");
  });

  it("is the boundary's loader data when a descendant's loader threw", async () => {
    const Stub = createLayoutStub({ layoutFails: false, childFails: true });
    render(<Stub initialEntries={["/acme/users"]} />);

    await screen.findByText("User not found");
    screen.getByText("Layout data: acme");
  });

  it("is not carried forward from a previous navigation when the boundary's own loader throws", async () => {
    const Stub = createLayoutStub({ layoutFails: false, childFails: false });
    render(<Stub initialEntries={["/acme"]} />);

    await screen.findByText("Overview");
    fireEvent.click(screen.getByRole("link", { name: "Switch tenant" }));

    await screen.findByText("Tenant not found");
    screen.getByText("No layout data");
  });
});

describe("ErrorBoundary loaderData during server rendering", () => {
  function createLayoutServer() {
    const client = new Client({
      path: "/",
      main: {
        default: () => <Outlet />,
        ErrorBoundary: LayoutBoundary,
      },
      children: [{
        path: "users",
        main: { default: () => <p>Users</p> },
      }],
    });
    return createServer(import.meta.url, client, {
      path: "/",
      main: {
        loader: ({ request }) => {
          if (new URL(request.url).searchParams.has("refuse")) {
            throw new HttpError(403, "Forbidden", {
              exposedMessage: "Tenant refused",
            });
          }
          return { name: "acme" } satisfies LayoutData;
        },
      },
      children: [{
        path: "users",
        main: {
          loader: () => {
            throw new HttpError(404, "Not found", {
              exposedMessage: "User not found",
            });
          },
          action: () => {
            throw new HttpError(400, "Bad request", {
              exposedMessage: "Could not save user",
            });
          },
        },
      }],
    });
  }

  it("is undefined when the boundary's own loader threw", async () => {
    using _console = stub(console, "error");
    const response = await createLayoutServer().request(
      "http://localhost/users?refuse",
    );
    const html = await response.text();
    assertStringIncludes(html, "Tenant refused");
    assertStringIncludes(html, "No layout data");
  });

  it("is the boundary's loader data when a descendant's loader threw", async () => {
    using _console = stub(console, "error");
    const response = await createLayoutServer().request(
      "http://localhost/users",
    );
    const html = await response.text();
    assertStringIncludes(html, "User not found");
    assertStringIncludes(html, "Layout data: acme");
  });

  it("is undefined when a document form submission below the boundary failed", async () => {
    using _console = stub(console, "error");
    const response = await createLayoutServer().request(
      "http://localhost/users",
      { method: "POST", body: new URLSearchParams({ name: "Ada" }) },
    );
    const html = await response.text();
    assertStringIncludes(html, "Could not save user");
    assertStringIncludes(html, "No layout data");
  });
});
