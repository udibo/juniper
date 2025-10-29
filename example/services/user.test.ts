import {
  assertEquals,
  assertExists,
  assertNotEquals,
  assertRejects,
} from "@std/assert";
import { sortBy } from "@std/collections/sort-by";
import { afterAll, afterEach, beforeAll, describe, it } from "@std/testing/bdd";
import { FakeTime } from "@std/testing/time";
import { generate as generateUUIDv7 } from "@std/uuid/unstable-v7";
import { HttpError } from "@udibo/http-error";

import { type NewUser, type User, userService } from "./user.ts";

describe("UserService", () => {
  let time: FakeTime;

  beforeAll(() => {
    time = new FakeTime();
  });

  afterAll(() => {
    time.restore();
  });

  const createSampleUserInput = (
    override?: Partial<NewUser>,
  ): NewUser => ({
    username: `testuser_${Math.random().toString(36).substring(7)}`,
    displayName: "Test User Display Name",
    email: `test_${Math.random().toString(36).substring(7)}@example.com`,
    ...override,
  });

  describe("create", () => {
    afterEach(() => userService.close());

    it("should create a new user and return it", async () => {
      const newUserData = createSampleUserInput();
      const createdUser = await userService.create(newUserData);

      assertExists(createdUser.id);
      assertEquals(createdUser.username, newUserData.username);
      assertEquals(createdUser.displayName, newUserData.displayName);
      assertEquals(createdUser.email, newUserData.email);
      assertExists(createdUser.createdAt);
      assertExists(createdUser.updatedAt);
      assertEquals(createdUser.createdAt, createdUser.updatedAt);
    });

    it("should create a new user with password and not expose password fields", async () => {
      const newUserData = createSampleUserInput({
        password: "testpassword123",
      });
      const createdUser = await userService.create(newUserData);

      assertExists(createdUser.id);
      assertEquals(createdUser.username, newUserData.username);
      assertEquals(createdUser.displayName, newUserData.displayName);
      assertEquals(createdUser.email, newUserData.email);
      assertEquals(createdUser.password, undefined);
      assertExists(createdUser.createdAt);
      assertExists(createdUser.updatedAt);
      assertEquals(
        await userService.checkPassword(createdUser.id, "testpassword123"),
        true,
      );
      assertEquals(
        await userService.checkPassword(createdUser.id, "wrongpassword123"),
        false,
      );
    });

    it("should fail to create a user with invalid data (e.g., missing username)", async () => {
      const invalidUserData = {
        displayName: "No Username",
        email: "nousername@example.com",
      } as NewUser;

      await assertRejects(
        () => userService.create(invalidUserData),
        HttpError,
        "Invalid user: Field 'username' is required.",
      );
    });

    it("should fail to create a user with password that is too short", async () => {
      const invalidUserData = createSampleUserInput({ password: "short" });
      await assertRejects(
        () => userService.create(invalidUserData),
        HttpError,
        "Invalid user: Password must be at least 8 characters",
      );
    });

    it("should fail to create a user with duplicate username", async () => {
      const userData = createSampleUserInput();
      await userService.create(userData);
      await assertRejects(
        () => userService.create(userData),
        HttpError,
        "Failed to create user",
      );
    });

    it("should fail to create a user with duplicate email", async () => {
      const email = "unique@example.com";
      await userService.create(createSampleUserInput({ email }));
      await assertRejects(
        () =>
          userService.create(
            createSampleUserInput({
              username: "anotheruser",
              email,
            }),
          ),
        HttpError,
        "Failed to create user",
      );
    });

    it("should fail to create a user with invalid email format", async () => {
      const invalidUserData = createSampleUserInput({
        email: "not-an-email",
      });
      await assertRejects(
        () => userService.create(invalidUserData),
        HttpError,
        "Invalid user: Invalid email",
      );
    });
  });

  describe("get", () => {
    afterEach(() => userService.close());

    it("should retrieve an existing user by its ID", async () => {
      const newUserData = createSampleUserInput();
      const createdUser = await userService.create(newUserData);
      const retrievedUser = await userService.get(createdUser.id);

      assertEquals(retrievedUser, createdUser);
    });

    it("should not expose password, hashedPassword, or salt in get method", async () => {
      const password = "secretpassword123";
      const newUserData = createSampleUserInput({ password });
      const createdUser = await userService.create(newUserData);

      const retrievedUser = await userService.get(createdUser.id);
      assertEquals(retrievedUser.password, undefined);
      assertEquals(
        (retrievedUser as Record<string, unknown>)["hashedPassword"],
        undefined,
      );
      assertEquals(
        (retrievedUser as Record<string, unknown>)["salt"],
        undefined,
      );
    });

    it("should throw HttpError if user with given ID does not exist", async () => {
      const nonExistentId = generateUUIDv7();
      await assertRejects(
        () => userService.get(nonExistentId),
        HttpError,
        "Failed to find user",
      );
    });
  });

  describe("getBy (unique indexes)", () => {
    afterEach(() => userService.close());

    it("should retrieve an existing user by username", async () => {
      const newUserData = createSampleUserInput();
      const createdUser = await userService.create(newUserData);
      const retrievedUser = await userService.getBy(
        "username",
        newUserData.username,
      );
      assertEquals(retrievedUser, createdUser);
    });

    it("should retrieve an existing user by email", async () => {
      const newUserData = createSampleUserInput();
      const createdUser = await userService.create(newUserData);
      const retrievedUser = await userService.getBy("email", newUserData.email);
      assertEquals(retrievedUser, createdUser);
    });

    it("should not expose password, hashedPassword, or salt in getBy method", async () => {
      const password = "secretpassword123";
      const newUserData = createSampleUserInput({ password });
      await userService.create(newUserData);

      const retrievedUser = await userService.getBy(
        "username",
        newUserData.username,
      );
      assertEquals(retrievedUser.password, undefined);
      assertEquals(
        (retrievedUser as Record<string, unknown>)["hashedPassword"],
        undefined,
      );
      assertEquals(
        (retrievedUser as Record<string, unknown>)["salt"],
        undefined,
      );
    });

    it("should throw HttpError if user with given username does not exist", async () => {
      await assertRejects(
        () => userService.getBy("username", "nonexistentuser"),
        HttpError,
        "Failed to find user by username",
      );
    });

    it("should throw HttpError if user with given email does not exist", async () => {
      await assertRejects(
        () => userService.getBy("email", "nonexistent@example.com"),
        HttpError,
        "Failed to find user by email",
      );
    });

    it("should throw error when trying to getBy a non-unique index field as unique", async () => {
      await assertRejects(
        () => userService.getBy("updatedAt", "2025-01-01"),
        HttpError,
        `Index "updatedAt" is not a valid unique index for user. Valid unique indexes are: username, email.`,
      );
    });
  });

  describe("update", () => {
    afterEach(() => userService.close());

    it("should update an existing user and return the updated user", async () => {
      const initialUserData = createSampleUserInput();
      const createdUser = await userService.create(initialUserData);

      time.tick(1000);

      const updates: Omit<User, "createdAt" | "updatedAt"> = {
        id: createdUser.id,
        username: createdUser.username,
        displayName: "Updated User Name",
        email: createdUser.email,
      };

      const updatedUser = await userService.update(updates);

      assertEquals(updatedUser.id, createdUser.id);
      assertEquals(updatedUser.username, updates.username);
      assertEquals(updatedUser.displayName, updates.displayName);
      assertEquals(updatedUser.email, updates.email);
      assertEquals(updatedUser.createdAt, createdUser.createdAt);
      assertNotEquals(updatedUser.updatedAt, createdUser.updatedAt);
      assertEquals(
        updatedUser.updatedAt.getTime() - createdUser.createdAt.getTime(),
        1000,
      );

      const retrievedUser = await userService.get(createdUser.id);
      assertEquals(retrievedUser, updatedUser);
    });

    it("should update an existing user with password and not expose password fields", async () => {
      const initialUserData = createSampleUserInput();
      const createdUser = await userService.create(initialUserData);

      time.tick(1000);

      const updates: Omit<User, "createdAt" | "updatedAt"> = {
        id: createdUser.id,
        username: createdUser.username,
        displayName: "Updated User Name",
        email: createdUser.email,
        password: "newpassword123",
      };

      const updatedUser = await userService.update(updates);

      assertEquals(updatedUser.id, createdUser.id);
      assertEquals(updatedUser.displayName, updates.displayName);
      assertEquals(updatedUser.password, undefined);
      assertEquals(
        await userService.checkPassword(updatedUser.id, "newpassword123"),
        true,
      );
      assertEquals(
        await userService.checkPassword(createdUser.id, "wrongpassword123"),
        false,
      );
    });

    it("should update unique index (username) successfully", async () => {
      const user1 = await userService.create(
        createSampleUserInput({ username: "user1update" }),
      );
      const newUsername = "user1updated";
      const updatedUser = await userService.update({
        ...user1,
        username: newUsername,
      });
      assertEquals(updatedUser.username, newUsername);
      const fetchedUser = await userService.getBy("username", newUsername);
      assertEquals(fetchedUser.id, user1.id);

      await assertRejects(
        () => userService.getBy("username", "user1update"),
        HttpError,
        "Failed to find user by username",
      );
    });

    it("should update unique index (email) successfully", async () => {
      const user1 = await userService.create(
        createSampleUserInput({ email: "email1@update.com" }),
      );
      const newEmail = "email1updated@update.com";
      const updatedUser = await userService.update({
        ...user1,
        email: newEmail,
      });
      assertEquals(updatedUser.email, newEmail);
      const fetchedUser = await userService.getBy("email", newEmail);
      assertEquals(fetchedUser.id, user1.id);

      await assertRejects(
        () => userService.getBy("email", "email1@update.com"),
        HttpError,
        "Failed to find user by email",
      );
    });

    it("should fail to update if new username conflicts with an existing user", async () => {
      const user1Data = createSampleUserInput({ username: "conflictuser1" });
      const user2Data = createSampleUserInput({ username: "conflictuser2" });
      await userService.create(user1Data);
      const user2 = await userService.create(user2Data);

      await assertRejects(
        () =>
          userService.update({
            ...user2,
            username: user1Data.username,
          }),
        HttpError,
        "Failed to update user",
      );
    });

    it("should fail to update if new email conflicts with an existing user", async () => {
      const user1Data = createSampleUserInput({
        email: "conflict1@example.com",
      });
      const user2Data = createSampleUserInput({
        email: "conflict2@example.com",
      });
      await userService.create(user1Data);
      const user2 = await userService.create(user2Data);

      await assertRejects(
        () =>
          userService.update({
            ...user2,
            email: user1Data.email,
          }),
        HttpError,
        "Failed to update user",
      );
    });

    it("should fail to update a user that does not exist", async () => {
      const nonExistentUserUpdate: Omit<User, "createdAt" | "updatedAt"> = {
        id: generateUUIDv7(),
        username: "ghost",
        displayName: "Non Existent",
        email: "ghost@example.com",
      };
      await assertRejects(
        () => userService.update(nonExistentUserUpdate),
        HttpError,
        "Failed to find user to update",
      );
    });

    it("should fail to update with invalid data (e.g., empty displayName)", async () => {
      const createdUser = await userService.create(createSampleUserInput());
      const invalidUpdate = {
        id: createdUser.id,
        username: createdUser.username,
        displayName: "",
        email: createdUser.email,
      };
      await assertRejects(
        () => userService.update(invalidUpdate),
        HttpError,
        "Invalid user: Display name is required",
      );
    });

    it("should fail to update with invalid password (too short)", async () => {
      const createdUser = await userService.create(createSampleUserInput());
      const invalidUpdate = {
        id: createdUser.id,
        username: createdUser.username,
        displayName: createdUser.displayName,
        email: createdUser.email,
        password: "short",
      };
      await assertRejects(
        () => userService.update(invalidUpdate),
        HttpError,
        "Invalid user: Password must be at least 8 characters",
      );
    });
  });

  describe("patch", () => {
    afterEach(() => userService.close());

    it("should partially update an existing user", async () => {
      const initialUserData = createSampleUserInput();
      const createdUser = await userService.create(initialUserData);

      time.tick(1000);

      const patchData = {
        id: createdUser.id,
        displayName: "Patched User Display Name",
      };
      const patchedUser = await userService.patch(patchData);

      assertEquals(patchedUser.id, createdUser.id);
      assertEquals(patchedUser.username, createdUser.username);
      assertEquals(patchedUser.displayName, patchData.displayName);
      assertEquals(patchedUser.email, createdUser.email);
      assertEquals(patchedUser.createdAt, createdUser.createdAt);
      assertNotEquals(patchedUser.updatedAt, createdUser.updatedAt);
      assertEquals(
        patchedUser.updatedAt.getTime() - createdUser.createdAt.getTime(),
        1000,
      );

      const retrievedUser = await userService.get(createdUser.id);
      assertEquals(retrievedUser, patchedUser);
    });

    it("should patch user with password and not expose password fields", async () => {
      const initialUserData = createSampleUserInput();
      const createdUser = await userService.create(initialUserData);

      time.tick(1000);

      const patchData = {
        id: createdUser.id,
        password: "patchedpassword123",
      };
      const patchedUser = await userService.patch(patchData);

      assertEquals(patchedUser.id, createdUser.id);
      assertEquals(patchedUser.password, undefined);
      assertEquals(
        await userService.checkPassword(patchedUser.id, "patchedpassword123"),
        true,
      );
      assertEquals(
        await userService.checkPassword(createdUser.id, "wrongpassword123"),
        false,
      );
    });

    it("should patch unique index (username) successfully", async () => {
      const user1 = await userService.create(
        createSampleUserInput({ username: "user1patch" }),
      );
      const newUsername = "user1patched";
      const patchedUser = await userService.patch({
        id: user1.id,
        username: newUsername,
      });
      assertEquals(patchedUser.username, newUsername);
      const fetchedUser = await userService.getBy("username", newUsername);
      assertEquals(fetchedUser.id, user1.id);
      await assertRejects(() => userService.getBy("username", "user1patch"));
    });

    it("should fail to patch if new username conflicts", async () => {
      const user1 = await userService.create(
        createSampleUserInput({ username: "patchconflict1" }),
      );
      const user2 = await userService.create(
        createSampleUserInput({ username: "patchconflict2" }),
      );
      await assertRejects(
        () => userService.patch({ id: user2.id, username: user1.username }),
        HttpError,
        "Failed to patch user",
      );
    });

    it("should fail to patch a user that does not exist", async () => {
      const nonExistentUserPatch = {
        id: generateUUIDv7(),
        displayName: "Trying to patch",
      };
      await assertRejects(
        () => userService.patch(nonExistentUserPatch),
        HttpError,
        "Failed to find user to patch",
      );
    });

    it("should fail to patch with invalid data (e.g., username too long)", async () => {
      const createdUser = await userService.create(createSampleUserInput());
      const invalidPatch = {
        id: createdUser.id,
        username: "u".repeat(51),
      };
      await assertRejects(
        () => userService.patch(invalidPatch),
        HttpError,
        "Invalid user: Username must be less than 50 characters",
      );
    });

    it("should fail to patch with invalid password (too short)", async () => {
      const createdUser = await userService.create(createSampleUserInput());
      const invalidPatch = {
        id: createdUser.id,
        password: "short",
      };
      await assertRejects(
        () => userService.patch(invalidPatch),
        HttpError,
        "Invalid user: Password must be at least 8 characters",
      );
    });
  });

  describe("delete", () => {
    afterEach(() => userService.close());

    it("should delete an existing user and its unique indexes", async () => {
      const newUserData = createSampleUserInput();
      const createdUser = await userService.create(newUserData);

      await userService.delete(createdUser.id);

      await assertRejects(
        () => userService.get(createdUser.id),
        HttpError,
        "Failed to find user",
      );
      await assertRejects(
        () => userService.getBy("username", newUserData.username),
        HttpError,
        "Failed to find user by username",
      );
      await assertRejects(
        () => userService.getBy("email", newUserData.email),
        HttpError,
        "Failed to find user by email",
      );
    });

    it("should delete an existing user with password and remove password data", async () => {
      const newUserData = createSampleUserInput({ password: "deletetest123" });
      const createdUser = await userService.create(newUserData);

      assertEquals(
        await userService.checkPassword(createdUser.id, "deletetest123"),
        true,
      );

      await userService.delete(createdUser.id);

      await assertRejects(
        () => userService.get(createdUser.id),
        HttpError,
        "Failed to find user",
      );
      assertEquals(
        await userService.checkPassword(createdUser.id, "deletetest123"),
        false,
      );
    });

    it("should fail to delete a user that does not exist", async () => {
      await assertRejects(
        () => userService.delete(generateUUIDv7()),
        HttpError,
        "Failed to find user to delete",
      );
    });
  });

  describe("updatePassword", () => {
    afterEach(() => userService.close());

    it("should update password for an existing user", async () => {
      const newUserData = createSampleUserInput();
      const createdUser = await userService.create(newUserData);

      await userService.updatePassword(createdUser.id, "newpassword123");

      assertEquals(
        await userService.checkPassword(createdUser.id, "newpassword123"),
        true,
      );
      assertEquals(
        await userService.checkPassword(createdUser.id, "wrongpassword123"),
        false,
      );
    });

    it("should allow updating password multiple times", async () => {
      const newUserData = createSampleUserInput();
      const createdUser = await userService.create(newUserData);

      await userService.updatePassword(createdUser.id, "firstpassword123");
      assertEquals(
        await userService.checkPassword(createdUser.id, "firstpassword123"),
        true,
      );

      await userService.updatePassword(createdUser.id, "secondpassword123");
      assertEquals(
        await userService.checkPassword(createdUser.id, "firstpassword123"),
        false,
      );
      assertEquals(
        await userService.checkPassword(createdUser.id, "secondpassword123"),
        true,
      );
    });

    it("should work for users created without initial password", async () => {
      const newUserData = createSampleUserInput();
      const createdUser = await userService.create(newUserData);

      assertEquals(
        await userService.checkPassword(createdUser.id, "anypassword"),
        false,
      );

      await userService.updatePassword(createdUser.id, "laterpassword123");
      assertEquals(
        await userService.checkPassword(createdUser.id, "laterpassword123"),
        true,
      );
    });
  });

  describe("checkPassword", () => {
    afterEach(() => userService.close());

    it("should return true for correct password", async () => {
      const password = "correctpassword123";
      const newUserData = createSampleUserInput({ password });
      const createdUser = await userService.create(newUserData);

      assertEquals(
        await userService.checkPassword(createdUser.id, password),
        true,
      );
    });

    it("should return false for incorrect password", async () => {
      const password = "correctpassword123";
      const newUserData = createSampleUserInput({ password });
      const createdUser = await userService.create(newUserData);

      assertEquals(
        await userService.checkPassword(createdUser.id, "wrongpassword"),
        false,
      );
    });

    it("should return false for user without password", async () => {
      const newUserData = createSampleUserInput();
      const createdUser = await userService.create(newUserData);

      assertEquals(
        await userService.checkPassword(createdUser.id, "anypassword"),
        false,
      );
    });

    it("should return false for non-existent user", async () => {
      const nonExistentId = generateUUIDv7();
      assertEquals(
        await userService.checkPassword(nonExistentId, "anypassword"),
        false,
      );
    });

    it("should be case sensitive", async () => {
      const password = "CaseSensitive123";
      const newUserData = createSampleUserInput({ password });
      const createdUser = await userService.create(newUserData);

      assertEquals(
        await userService.checkPassword(createdUser.id, password),
        true,
      );
      assertEquals(
        await userService.checkPassword(createdUser.id, "casesensitive123"),
        false,
      );
    });
  });

  describe("list", () => {
    const users: User[] = [];
    const userInputs: NewUser[] = [
      {
        username: "alice_list",
        displayName: "Alice List",
        email: "alice_list@example.com",
      },
      {
        username: "bob_list",
        displayName: "Bob List",
        email: "bob_list@example.com",
      },
      {
        username: "carol_list",
        displayName: "Carol List",
        email: "carol_list@example.com",
      },
      {
        username: "dave_list",
        displayName: "Dave List",
        email: "dave_list@example.com",
      },
    ];

    beforeAll(async () => {
      for (const data of userInputs) {
        time.tick(500);
        users.push(await userService.create(data));
      }
      time.tick(500);
      users[0] = await userService.patch({
        id: users[0].id,
        displayName: "Alice L. (updated)",
      });
      time.tick(500);
      users[1] = await userService.patch({
        id: users[1].id,
        displayName: "Robert List (updated)",
      });
    });
    afterAll(() => userService.close());

    it("should return all users with default options (sorted by id)", async () => {
      const { entries, cursor } = await userService.list();
      const usersSortedById = sortBy(users, (u) => u.id);
      assertEquals(entries.length, users.length);
      assertEquals(entries, usersSortedById);
      assertEquals(cursor, "");
    });

    it("should return a limited number of users", async () => {
      const limit = 2;
      const usersSortedById = sortBy(users, (u) => u.id);
      const { entries, cursor } = await userService.list({ limit });
      assertEquals(entries.length, limit);
      assertEquals(entries, usersSortedById.slice(0, limit));
      assertExists(cursor);
      assertNotEquals(cursor, "");
    });

    it("should return remaining users using cursor", async () => {
      const limit = 3;
      const usersSortedById = sortBy(users, (u) => u.id);
      let { entries, cursor } = await userService.list({ limit });
      assertEquals(entries, usersSortedById.slice(0, limit));
      assertExists(cursor);
      assertNotEquals(cursor, "");

      ({ entries, cursor } = await userService.list({
        cursor,
        limit,
      }));
      assertEquals(entries, usersSortedById.slice(limit));
      assertEquals(cursor, "");
    });

    it("should return users in reverse order (sorted by id descending)", async () => {
      const usersSortedById = sortBy(users, (u) => u.id);
      const { entries, cursor } = await userService.list({ reverse: true });
      assertEquals(entries.length, users.length);
      assertEquals(entries, [...usersSortedById].reverse());
      assertEquals(cursor, "");
    });

    describe("list by 'updatedAt' index", () => {
      let usersSortedByUpdatedAt: User[];

      beforeAll(() => {
        usersSortedByUpdatedAt = sortBy(
          users,
          (user) => `${user.updatedAt.toISOString()}-${user.id}`,
        );
      });

      it("should list all users sorted by 'updatedAt', then by id", async () => {
        const { entries, cursor } = await userService.list({
          index: "updatedAt",
        });
        assertEquals(entries.length, usersSortedByUpdatedAt.length);
        assertEquals(entries, usersSortedByUpdatedAt);
        assertEquals(cursor, "");
      });

      it("should list users by 'updatedAt' with limit", async () => {
        const limit = 2;
        const { entries, cursor: c } = await userService.list({
          index: "updatedAt",
          limit,
        });
        assertEquals(entries.length, limit);
        assertEquals(entries, usersSortedByUpdatedAt.slice(0, limit));
        assertExists(c);
        assertNotEquals(c, "");
      });

      it("should list remaining users by 'updatedAt' with cursor", async () => {
        const limit = 2;
        const firstPage = await userService.list({
          index: "updatedAt",
          limit,
        });
        assertExists(firstPage.cursor);

        const secondPage = await userService.list({
          index: "updatedAt",
          cursor: firstPage.cursor,
          limit: usersSortedByUpdatedAt.length,
        });
        assertEquals(
          secondPage.entries.length,
          usersSortedByUpdatedAt.length - limit,
        );
        assertEquals(
          secondPage.entries,
          usersSortedByUpdatedAt.slice(limit),
        );
        assertEquals(secondPage.cursor, "");
      });

      it("should list users by 'updatedAt' in reverse order", async () => {
        const { entries, cursor: c } = await userService.list({
          index: "updatedAt",
          reverse: true,
        });
        assertEquals(entries.length, usersSortedByUpdatedAt.length);
        assertEquals(entries, [...usersSortedByUpdatedAt].reverse());
        assertEquals(c, "");
      });
    });

    describe("list by 'username' (unique) index", () => {
      let usersSortedByUsername: User[];

      beforeAll(() => {
        usersSortedByUsername = sortBy(
          users,
          (user) => `${user.username}-${user.id}`,
        );
      });

      it("should list all users sorted by 'username', then by id", async () => {
        const { entries, cursor } = await userService.list({
          index: "username",
        });
        assertEquals(entries.length, usersSortedByUsername.length);
        assertEquals(entries, usersSortedByUsername);
        assertEquals(cursor, "");
      });

      it("should list users by 'username' with limit and cursor", async () => {
        const limit = 2;
        const firstPage = await userService.list({
          index: "username",
          limit,
        });
        assertEquals(firstPage.entries.length, limit);
        assertEquals(firstPage.entries, usersSortedByUsername.slice(0, limit));
        assertExists(firstPage.cursor);

        const secondPage = await userService.list({
          index: "username",
          cursor: firstPage.cursor,
          limit: usersSortedByUsername.length,
        });
        assertEquals(secondPage.entries, usersSortedByUsername.slice(limit));
        assertEquals(secondPage.cursor, "");
      });
    });

    describe("list by 'email' (unique) index", () => {
      let usersSortedByEmail: User[];

      beforeAll(() => {
        usersSortedByEmail = sortBy(
          users,
          (user) => `${user.email}-${user.id}`,
        );
      });

      it("should list all users sorted by 'email', then by id", async () => {
        const { entries, cursor } = await userService.list({
          index: "email",
        });
        assertEquals(entries.length, usersSortedByEmail.length);
        assertEquals(entries, usersSortedByEmail);
        assertEquals(cursor, "");
      });
    });

    it("should not expose password, hashedPassword, or salt in list method", async () => {
      const password = "secretpassword123";
      const newUserData = createSampleUserInput({ password });
      await userService.create(newUserData);

      const { entries } = await userService.list();
      const userWithPassword = entries.find((u) =>
        u.username === newUserData.username
      );
      assertExists(userWithPassword);
      assertEquals(userWithPassword.password, undefined);
      assertEquals(
        (userWithPassword as Record<string, unknown>)["hashedPassword"],
        undefined,
      );
      assertEquals(
        (userWithPassword as Record<string, unknown>)["salt"],
        undefined,
      );
    });

    it("should throw HttpError if listing by a non-configured index", async () => {
      await assertRejects(
        () => userService.list({ index: "displayName" }),
        HttpError,
        `Index "displayName" is not a valid index for user. Valid indexes are: id, username, email, updatedAt.`,
      );
    });
  });
});
