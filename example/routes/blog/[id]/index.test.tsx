import "global-jsdom/register";

import { assertEquals } from "@std/assert";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, it } from "@std/testing/bdd";

import { createRoutesStub } from "@udibo/juniper/utils/testing";

import * as blogPostRoute from "./index.tsx";

describe("Blog post route", () => {
  afterEach(cleanup);

  it("should render blog post title", async () => {
    const Stub = createRoutesStub([{
      ...blogPostRoute,
      path: "/blog/:id",
      loader() {
        return {
          post: {
            id: "test-post-id",
            title: "Test Blog Post Title",
            content: "This is the test blog post content.",
            authorId: "test-author-id",
            createdAt: new Date("2025-01-15").getTime(),
            updatedAt: new Date("2025-01-15").getTime(),
          },
        };
      },
    }]);
    render(<Stub initialEntries={["/blog/test-post-id"]} />);

    await waitFor(() => {
      screen.getByRole("heading", { name: "Test Blog Post Title" });
    });
  });

  it("should render blog post content", async () => {
    const Stub = createRoutesStub([{
      ...blogPostRoute,
      path: "/blog/:id",
      loader() {
        return {
          post: {
            id: "test-post-id",
            title: "Test Post",
            content: "This is the detailed content of the blog post.",
            authorId: "test-author-id",
            createdAt: new Date("2025-01-15").getTime(),
            updatedAt: new Date("2025-01-15").getTime(),
          },
        };
      },
    }]);
    render(<Stub initialEntries={["/blog/test-post-id"]} />);

    await waitFor(() => {
      screen.getByText("This is the detailed content of the blog post.");
    });
  });

  it("should have back to blog link", async () => {
    const Stub = createRoutesStub([{
      ...blogPostRoute,
      path: "/blog/:id",
      loader() {
        return {
          post: {
            id: "test-post-id",
            title: "Test Post",
            content: "Content",
            authorId: "test-author-id",
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        };
      },
    }]);
    render(<Stub initialEntries={["/blog/test-post-id"]} />);

    await waitFor(() => {
      screen.getByRole("link", { name: "← Back to Blog" });
    });
    const link = screen.getByRole("link", { name: "← Back to Blog" });
    assertEquals(link.getAttribute("href"), "/blog");
  });

  it("should display post metadata", async () => {
    const Stub = createRoutesStub([{
      ...blogPostRoute,
      path: "/blog/:id",
      loader() {
        return {
          post: {
            id: "unique-post-123",
            title: "Test Post",
            content: "Content",
            authorId: "author-456",
            createdAt: new Date("2025-01-15").getTime(),
            updatedAt: new Date("2025-01-15").getTime(),
          },
        };
      },
    }]);
    render(<Stub initialEntries={["/blog/unique-post-123"]} />);

    await waitFor(() => {
      screen.getByText(/Published:/);
    });
    screen.getByText(/Post ID: unique-post-123/);
    screen.getByText(/Author: author-456/);
  });

  it("should have edit and delete buttons", async () => {
    const Stub = createRoutesStub([{
      ...blogPostRoute,
      path: "/blog/:id",
      loader() {
        return {
          post: {
            id: "test-post-id",
            title: "Test Post",
            content: "Content",
            authorId: "test-author-id",
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        };
      },
    }]);
    render(<Stub initialEntries={["/blog/test-post-id"]} />);

    await waitFor(() => {
      screen.getByRole("link", { name: "Edit" });
    });
    screen.getByRole("button", { name: "Delete" });
  });

  it("should render error boundary for missing post", async () => {
    const Stub = createRoutesStub([{
      ...blogPostRoute,
      path: "/blog/:id",
      loader() {
        throw new Error("Post not found");
      },
    }]);
    render(<Stub initialEntries={["/blog/non-existent-id"]} />);

    await waitFor(() => {
      screen.getByRole("heading", { name: "Blog Post Not Found" });
    });
    screen.getByText(/we couldn't find a blog post with ID "non-existent-id"/);
  });
});
