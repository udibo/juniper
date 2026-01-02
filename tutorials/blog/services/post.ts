import { HttpError } from "@udibo/juniper";

export interface Post {
  id: string;
  title: string;
  content: string;
  excerpt: string;
  createdAt: Date;
  updatedAt: Date;
}

export type NewPost = Pick<Post, "title" | "content">;

let kv: Deno.Kv | undefined;

async function getKv(): Promise<Deno.Kv> {
  if (!kv) {
    kv = await Deno.openKv();
  }
  return kv;
}

export const postService = {
  async get(id: string): Promise<Post> {
    const db = await getKv();
    const entry = await db.get<Post>(["posts", id]);
    if (!entry.value) {
      throw new HttpError(404, "Post not found");
    }
    return entry.value;
  },

  async list(): Promise<Post[]> {
    const db = await getKv();
    const entries: Post[] = [];
    const iter = db.list<Post>({ prefix: ["posts"] });

    for await (const entry of iter) {
      entries.push(entry.value);
    }

    // Sort by creation date, newest first
    entries.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    return entries;
  },

  async create(data: NewPost): Promise<Post> {
    const db = await getKv();
    const id = crypto.randomUUID();
    const now = new Date();

    const post: Post = {
      id,
      ...data,
      excerpt: data.content.slice(0, 150) +
        (data.content.length > 150 ? "..." : ""),
      createdAt: now,
      updatedAt: now,
    };

    await db.set(["posts", id], post);
    return post;
  },

  async update(id: string, data: Partial<NewPost>): Promise<Post> {
    const db = await getKv();
    const existing = await this.get(id);

    const updated: Post = {
      ...existing,
      ...data,
      excerpt: data.content
        ? data.content.slice(0, 150) +
          (data.content.length > 150 ? "..." : "")
        : existing.excerpt,
      updatedAt: new Date(),
    };

    await db.set(["posts", id], updated);
    return updated;
  },

  async delete(id: string): Promise<void> {
    const db = await getKv();
    await this.get(id); // Ensure it exists
    await db.delete(["posts", id]);
  },
};
