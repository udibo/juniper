import { encodeHex } from "@std/encoding/hex";
import { HttpError } from "@udibo/http-error";
import { z } from "zod";

import { isDevelopment } from "@udibo/juniper/utils/env";

import { startActiveSpan } from "/utils/otel.ts";

import { Service } from "./service.ts";

/**
 * Generates random salt. The length is the number of bytes.
 *
 * @param length - The length of the salt to generate.
 * @returns The salt as a hex string.
 */
function generateSalt(length = 16): string {
  const salt = new Uint8Array(length);
  crypto.getRandomValues(salt);
  return encodeHex(salt);
}

/** Hashes a password with salt using the PBKDF2 algorithm with 100k SHA-256 iterations.
 *
 * @param password - The password to hash.
 * @param salt - The salt to use for the hash.
 * @returns The hashed password as a hex string.
 */
async function hashPassword(
  password: string,
  salt: string,
): Promise<string> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"],
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: encoder.encode(salt),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    256,
  );
  const buffer = new Uint8Array(derivedBits, 0, 32);
  return encodeHex(buffer);
}

export const UserSchema = z.object({
  id: z.string().uuid(),
  username: z.string()
    .min(1, "Username is required")
    .max(50, "Username must be less than 50 characters"),
  displayName: z.string()
    .min(1, "Display name is required")
    .max(100, "Display name must be less than 100 characters"),
  email: z.string().email("Invalid email"),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .max(256, "Password must be less than 256 characters")
    .optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type User = z.infer<typeof UserSchema>;
export type NewUser = Omit<User, "id" | "createdAt" | "updatedAt">;
export type UserPatch = Partial<User> & { id: string };

interface PasswordEntry {
  hashedPassword: string;
  salt: string;
}

/**
 * Check will always fail due to hashedPassword being empty string.
 * This is used to avoid timing attacks when checking the password.
 */
const defaultPasswordEntry: PasswordEntry = {
  hashedPassword: "",
  salt: generateSalt(),
};

class UserService extends Service<User> {
  constructor() {
    super({
      name: "user",
      schema: UserSchema,
      uniqueIndexes: ["username", "email"],
      indexes: ["updatedAt"],
    });
  }

  updatePassword(id: string, password: string): Promise<void> {
    return startActiveSpan("user.updatePassword", async (span) => {
      span.setAttribute("service", this.name);
      span.setAttribute("id", id);
      const salt = generateSalt();
      const hashedPassword = await hashPassword(password, salt);
      const kv = await this.getKv();
      await kv.set([this.name, "password", id], {
        hashedPassword,
        salt,
      });
    });
  }

  checkPassword(id: string, password: string): Promise<boolean> {
    return startActiveSpan("user.checkPassword", async (span) => {
      span.setAttribute("service", this.name);
      span.setAttribute("id", id);
      const kv = await this.getKv();
      const { value: passwordEntry } = await kv.get<PasswordEntry>([
        this.name,
        "password",
        id,
      ]);
      const { hashedPassword, salt } = passwordEntry ?? defaultPasswordEntry;
      // Always hash the password to avoid timing attacks.
      return await hashPassword(password, salt) === hashedPassword;
    });
  }

  private validatePassword(password: string): void {
    return startActiveSpan("user.validatePassword", (span) => {
      span.setAttribute("service", this.name);
      try {
        UserSchema.shape.password.parse(password);
      } catch (error) {
        if (error instanceof z.ZodError) {
          const messages = error.errors.map((e) => e.message);
          throw new HttpError(
            400,
            `Invalid user: ${messages.join(", ")}`,
          );
        }
        throw HttpError.from(error);
      }
    });
  }

  override create(value: NewUser): Promise<User> {
    return startActiveSpan("user.create", async (span) => {
      span.setAttribute("service", this.name);
      if (value.password !== undefined) {
        this.validatePassword(value.password);
      }

      const { password, ...rest } = value;
      const user = await super.create(rest);
      if (password) await this.updatePassword(user.id, password);
      return user;
    });
  }

  override update(
    value: Omit<User, "createdAt" | "updatedAt">,
  ): Promise<User> {
    return startActiveSpan("user.update", async (span) => {
      span.setAttribute("service", this.name);
      if (value.password !== undefined) {
        this.validatePassword(value.password);
      }

      const { password, ...rest } = value;
      const user = await super.update(rest);
      if (password) await this.updatePassword(user.id, password);
      return user;
    });
  }

  override patch(
    partialValue: Omit<Partial<User>, "createdAt" | "updatedAt"> & {
      id: string;
    },
  ): Promise<User> {
    return startActiveSpan("user.patch", async (span) => {
      span.setAttribute("service", this.name);
      if (partialValue.password !== undefined) {
        this.validatePassword(partialValue.password);
      }

      const { password, ...rest } = partialValue;
      const user = await super.patch(rest);
      if (password) await this.updatePassword(user.id, password);
      return user;
    });
  }

  override delete(id: string): Promise<void> {
    return startActiveSpan("user.delete", async (span) => {
      span.setAttribute("service", this.name);
      span.setAttribute("id", id);
      await super.delete(id);
      const kv = await this.getKv();
      await kv.delete([this.name, "password", id]);
    });
  }
}

export const userService = new UserService();

if (isDevelopment()) {
  try {
    await userService.create({
      username: "admin",
      displayName: "Admin",
      email: "admin@udibo.com",
      password: "password",
    });
  } catch {
    // Already initialized
  }
}
