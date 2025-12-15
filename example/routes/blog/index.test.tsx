import "global-jsdom/register";

import { assertEquals } from "@std/assert";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, it } from "@std/testing/bdd";

import { createRoutesStub } from "@udibo/juniper/utils/testing";

import * as blogIndex from "./index.tsx";

describe("Blog index route", () => {
  afterEach(cleanup);

  it("should render the blog posts heading", async () => {
    const Stub = createRoutesStub([{
      ...blogIndex,
      path: "/blog",
      loader() {
        return {
          posts: [],
          cursor: "",
          currentCursor: "",
          prevCursors: [],
          limit: 10,
        };
      },
    }]);
    render(<Stub />);

    await waitFor(() => {
      screen.getByRole("heading", { name: "Blog Posts" });
    });
    screen.getByText(/Welcome to our blog/);
  });

  it("should show empty state when no posts", async () => {
    const Stub = createRoutesStub([{
      ...blogIndex,
      path: "/blog",
      loader() {
        return {
          posts: [],
          cursor: "",
          currentCursor: "",
          prevCursors: [],
          limit: 10,
        };
      },
    }]);
    render(<Stub />);

    await waitFor(() => {
      screen.getByText(/No blog posts yet/);
    });
  });

  it("should render blog posts list", async () => {
    const Stub = createRoutesStub([{
      ...blogIndex,
      path: "/blog",
      loader() {
        return {
          posts: [
            {
              id: "post-1",
              title: "First Post",
              content: "Content of the first post",
              authorId: "author-1",
              createdAt: new Date("2025-01-01").getTime(),
              updatedAt: new Date("2025-01-01").getTime(),
            },
            {
              id: "post-2",
              title: "Second Post",
              content: "Content of the second post",
              authorId: "author-2",
              createdAt: new Date("2025-01-02").getTime(),
              updatedAt: new Date("2025-01-02").getTime(),
            },
          ],
          cursor: "",
          currentCursor: "",
          prevCursors: [],
          limit: 10,
        };
      },
    }]);
    render(<Stub />);

    await waitFor(() => {
      screen.getByRole("link", { name: "First Post" });
    });
    screen.getByRole("link", { name: "Second Post" });
    screen.getByText("Content of the first post");
    screen.getByText("Content of the second post");
  });

  it("should have a link to create new post", async () => {
    const Stub = createRoutesStub([{
      ...blogIndex,
      path: "/blog",
      loader() {
        return {
          posts: [],
          cursor: "",
          currentCursor: "",
          prevCursors: [],
          limit: 10,
        };
      },
    }]);
    render(<Stub />);

    await waitFor(() => {
      screen.getByRole("link", { name: "Write a Post" });
    });
    const link = screen.getByRole("link", { name: "Write a Post" });
    assertEquals(link.getAttribute("href"), "/blog/create");
  });

  it("should show next button when there are more posts", async () => {
    const Stub = createRoutesStub([{
      ...blogIndex,
      path: "/blog",
      loader() {
        return {
          posts: [
            {
              id: "post-1",
              title: "First Post",
              content: "Content",
              authorId: "author-1",
              createdAt: Date.now(),
              updatedAt: Date.now(),
            },
          ],
          cursor: "next-cursor",
          currentCursor: "",
          prevCursors: [],
          limit: 10,
        };
      },
    }]);
    render(<Stub />);

    await waitFor(() => {
      screen.getByRole("link", { name: "Next" });
    });
  });
});
