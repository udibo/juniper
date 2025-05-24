import { afterAll, afterEach, beforeAll, describe, it } from "@std/testing/bdd";
import { assert, assertEquals, assertExists } from "@std/assert";
import { generate as generateUUIDv7 } from "@std/uuid/unstable-v7";
import { FakeTime } from "@std/testing/time";
import { sortBy } from "@std/collections/sort-by";

import { app } from "/main.ts";
import { type NewUser, type User, userService } from "/services/user.ts";

describe("/api/users", () => {
  let time: FakeTime;

  const createSampleUserInput = (
    override?: Partial<NewUser>,
  ): NewUser => ({
    username: `testuser_${Math.random().toString(36).substring(7)}`,
    displayName: "Test User Display Name",
    email: `test_${Math.random().toString(36).substring(7)}@example.com`,
    ...override,
  });

  beforeAll(() => {
    time = new FakeTime();
  });

  afterAll(() => {
    time.restore();
    userService.close();
  });

  describe("GET /", () => {
    const users: User[] = [];
    const userInputs: NewUser[] = [
      createSampleUserInput({
        username: "alice_get",
        email: "alice_get@example.com",
      }),
      createSampleUserInput({
        username: "bob_get",
        email: "bob_get@example.com",
      }),
      createSampleUserInput({
        username: "carol_get",
        email: "carol_get@example.com",
      }),
      createSampleUserInput({
        username: "dave_get",
        email: "dave_get@example.com",
      }),
    ];

    beforeAll(async () => {
      for (const data of userInputs) {
        time.tick(500);
        users.push(await userService.create(data));
      }
      time.tick(500);
      users[0] = await userService.patch({
        id: users[0].id,
        displayName: "Alice G. (updated)",
      });
      time.tick(500);
      users[1] = await userService.patch({
        id: users[1].id,
        displayName: "Robert G. (updated)",
      });
    });
    afterAll(() => userService.close());

    it("should return a list of users", async () => {
      const res = await app.request("/api/users");
      assertEquals(res.status, 200);
      const json = await res.json();

      assert(json.users, "Response should have a users property");
      assertEquals(json.users.length, users.length);
      assertEquals(json.users[0].id, users[0].id);
      assertEquals(json.users[0].username, users[0].username);
      assertEquals(json.users[1].id, users[1].id);
      assertEquals(json.users[1].username, users[1].username);
    });

    it("should return a limited number of users when limit parameter is provided", async () => {
      const res = await app.request("/api/users?limit=2");
      assertEquals(res.status, 200);
      const json = await res.json();

      assert(json.users, "Response should have a users property");
      assertEquals(json.users.length, 2);
      assertEquals(json.users[0].id, users[0].id);
      assertEquals(json.users[1].id, users[1].id);
      assert(json.cursor, "Response should have a cursor for pagination");
    });

    it("should return users in reverse order when reverse=true", async () => {
      const res = await app.request("/api/users?reverse=true");
      assertEquals(res.status, 200);
      const json = await res.json();

      assert(json.users, "Response should have a users property");
      assertEquals(json.users.length, users.length);
      assertEquals(json.users[0].id, users[3].id);
      assertEquals(json.users[1].id, users[2].id);
      assertEquals(json.users[2].id, users[1].id);
      assertEquals(json.users[3].id, users[0].id);
    });

    it("should return remaining users when using cursor parameter", async () => {
      let res = await app.request("/api/users?limit=2");
      assertEquals(res.status, 200);
      let json = await res.json();
      assert(json.cursor, "First response should have a cursor");
      assertEquals(json.users.length, 2);
      assertEquals(json.users[0].id, users[0].id);
      assertEquals(json.users[1].id, users[1].id);

      res = await app.request(`/api/users?limit=2&cursor=${json.cursor}`);
      assertEquals(res.status, 200);
      json = await res.json();

      assert(json.users, "Response should have a users property");
      assertEquals(json.users.length, 2);
      assertEquals(json.users[0].id, users[2].id);
      assertEquals(json.users[1].id, users[3].id);

      res = await app.request(`/api/users?limit=2&cursor=${json.cursor}`);
      assertEquals(res.status, 200);
      json = await res.json();
      assertEquals(json.users.length, 0);
      assertEquals(json.cursor, "");
    });

    it("should return users sorted by username when using index parameter", async () => {
      const usersSortedByUsername = sortBy(users, (u) => u.username);
      const res = await app.request("/api/users?index=username");
      assertEquals(res.status, 200);
      const json = await res.json();

      assert(json.users, "Response should have a users property");
      assertEquals(json.users.length, users.length);
      assertEquals(json.users[0].id, usersSortedByUsername[0].id);
      assertEquals(json.users[1].id, usersSortedByUsername[1].id);
      assertEquals(json.users[2].id, usersSortedByUsername[2].id);
      assertEquals(json.users[3].id, usersSortedByUsername[3].id);
    });

    it("should return users sorted by email when using index parameter", async () => {
      const usersSortedByEmail = sortBy(users, (u) => u.email);
      const res = await app.request("/api/users?index=email");
      assertEquals(res.status, 200);
      const json = await res.json();

      assert(json.users, "Response should have a users property");
      assertEquals(json.users.length, users.length);
      if (json.users.length > 0 && usersSortedByEmail.length > 0) {
        assertEquals(json.users[0].id, usersSortedByEmail[0].id);
      }
    });

    it("should return users sorted by updatedAt when using index parameter", async () => {
      const usersSortedByUpdatedAt = sortBy(users, (u) => u.updatedAt);
      const res = await app.request("/api/users?index=updatedAt");
      assertEquals(res.status, 200);
      const json = await res.json();

      assert(json.users, "Response should have a users property");
      assertEquals(json.users.length, users.length);
      assertEquals(json.users[0].id, usersSortedByUpdatedAt[0].id);
      assertEquals(json.users[1].id, usersSortedByUpdatedAt[1].id);
    });

    it("should return 400 error for invalid query parameters", async () => {
      const res = await app.request("/api/users?index=invalidIndex");
      assertEquals(res.status, 400);
      const errorBody = await res.json();
      assertEquals(errorBody.status, 400);
      assertEquals(errorBody.title, "BadRequestError");
      assertEquals(
        errorBody.detail,
        'Invalid index "invalidIndex" for user. Valid indexes are: id, username, email, updatedAt.',
      );
      assert(errorBody.instance);
    });

    it("should not expose password fields when listing users", async () => {
      const userWithPassword = await userService.create(
        createSampleUserInput({
          username: "userlistpassword",
          email: "userlistpassword@example.com",
          password: "secretlistpassword123",
        }),
      );

      const res = await app.request("/api/users");
      assertEquals(res.status, 200);
      const json = await res.json();

      assert(json.users, "Response should have a users property");
      const foundUser = json.users.find((u: User) =>
        u.id === userWithPassword.id
      );
      assertExists(foundUser, "User with password should be in the list");
      assertEquals(foundUser.password, undefined);
      assertEquals(
        (foundUser as Record<string, unknown>)["hashedPassword"],
        undefined,
      );
      assertEquals((foundUser as Record<string, unknown>)["salt"], undefined);
    });
  });

  describe("GET /:id", () => {
    afterEach(() => userService.close());

    it("should return a specific user if found", async () => {
      const newUserData = createSampleUserInput();
      const createdUser = await userService.create(newUserData);

      const res = await app.request(`/api/users/${createdUser.id}`);
      const user = await res.json();

      assertEquals(res.status, 200);
      assertEquals(user.id, createdUser.id);
      assertEquals(user.username, createdUser.username);
    });

    it("should not expose password fields when getting a user with password", async () => {
      const userWithPassword = await userService.create(
        createSampleUserInput({
          username: "usergetpassword",
          email: "usergetpassword@example.com",
          password: "secretgetpassword123",
        }),
      );

      const res = await app.request(`/api/users/${userWithPassword.id}`);
      assertEquals(res.status, 200);
      const user = await res.json();

      assertEquals(user.id, userWithPassword.id);
      assertEquals(user.username, userWithPassword.username);
      assertEquals(user.password, undefined);
      assertEquals(
        (user as Record<string, unknown>)["hashedPassword"],
        undefined,
      );
      assertEquals((user as Record<string, unknown>)["salt"], undefined);
    });

    it("should return 404 if user not found", async () => {
      const nonExistentId = generateUUIDv7();
      const res = await app.request(`/api/users/${nonExistentId}`);
      assertEquals(res.status, 404);

      const errorBody = await res.json();
      assertEquals(errorBody.status, 404);
      assertEquals(errorBody.title, "NotFoundError");
      assertEquals(errorBody.detail, "Failed to find user");
      assert(errorBody.instance);
    });
  });

  describe("POST /", () => {
    afterEach(() => userService.close());

    it("should create a new user and return it", async () => {
      const newUserData = createSampleUserInput({
        username: "apipostuser",
        email: "apipostuser@example.com",
        displayName: "API POST User",
      });

      const res = await app.request("/api/users", {
        method: "POST",
        body: JSON.stringify(newUserData),
        headers: { "Content-Type": "application/json" },
      });
      assertEquals(res.status, 201);
      const user = await res.json();

      assertEquals(user.username, newUserData.username);
      assertEquals(user.displayName, newUserData.displayName);
      assertEquals(user.email, newUserData.email);
      assertExists(user.id, "User should have an id");
      assertExists(user.createdAt, "User should have createdAt");
      assertExists(user.updatedAt, "User should have updatedAt");
    });

    it("should create a new user with password and not expose password fields", async () => {
      const newUserData = createSampleUserInput({
        username: "apipostuserpw",
        email: "apipostuserpw@example.com",
        displayName: "API POST User with Password",
        password: "securepassword123",
      });

      const res = await app.request("/api/users", {
        method: "POST",
        body: JSON.stringify(newUserData),
        headers: { "Content-Type": "application/json" },
      });
      assertEquals(res.status, 201);
      const user = await res.json();

      assertEquals(user.username, newUserData.username);
      assertEquals(user.displayName, newUserData.displayName);
      assertEquals(user.email, newUserData.email);
      assertEquals(user.password, undefined);
      assertEquals(
        (user as Record<string, unknown>)["hashedPassword"],
        undefined,
      );
      assertEquals((user as Record<string, unknown>)["salt"], undefined);
      assertExists(user.id, "User should have an id");
      assertExists(user.createdAt, "User should have createdAt");
      assertExists(user.updatedAt, "User should have updatedAt");

      assertEquals(
        await userService.checkPassword(user.id, "securepassword123"),
        true,
      );
    });

    it("should return 400 if request body is invalid (missing username)", async () => {
      const invalidUserData = {
        displayName: "No Username",
        email: "nousername@example.com",
      };

      const res = await app.request("/api/users", {
        method: "POST",
        body: JSON.stringify(invalidUserData),
        headers: { "Content-Type": "application/json" },
      });
      assertEquals(res.status, 400);
      const errorBody = await res.json();
      assertEquals(errorBody.status, 400);
      assertEquals(errorBody.title, "BadRequestError");
      assert(
        errorBody.detail.includes("Invalid user"),
        "Error detail should mention invalid user",
      );
      assert(
        errorBody.detail.includes("Field 'username' is required"),
        "Error detail should mention missing username",
      );
    });

    it("should return 400 if password is too short", async () => {
      const invalidUserData = createSampleUserInput({
        username: "apipostshortpw",
        email: "apipostshortpw@example.com",
        password: "short",
      });

      const res = await app.request("/api/users", {
        method: "POST",
        body: JSON.stringify(invalidUserData),
        headers: { "Content-Type": "application/json" },
      });
      assertEquals(res.status, 400);
      const errorBody = await res.json();
      assertEquals(errorBody.status, 400);
      assertEquals(errorBody.title, "BadRequestError");
      assert(
        errorBody.detail.includes("Invalid user"),
        "Error detail should mention invalid user",
      );
      assert(
        errorBody.detail.includes("Password must be at least 8 characters"),
        "Error detail should mention password length requirement",
      );
    });

    it("should return 400 if username is a duplicate", async () => {
      const newUserData = createSampleUserInput({
        username: "duplicateuser",
        email: "duplicate1@example.com",
      });
      await userService.create(newUserData);

      const res = await app.request("/api/users", {
        method: "POST",
        body: JSON.stringify(
          createSampleUserInput({
            username: "duplicateuser",
            email: "duplicate2@example.com",
          }),
        ),
        headers: { "Content-Type": "application/json" },
      });
      assertEquals(res.status, 400);
      const errorBody = await res.json();
      assertEquals(errorBody.status, 400);
      assertEquals(errorBody.title, "BadRequestError");
      assertEquals(
        errorBody.detail,
        "Failed to create user",
      );
    });
  });

  describe("PUT /:id", () => {
    afterEach(() => userService.close());

    it("should update an existing user and return it", async () => {
      const createdUser = await userService.create(
        createSampleUserInput({ username: "putuseroriginal" }),
      );
      time.tick(1000);

      const updatedUserData = {
        username: "putuserupdated",
        displayName: "Updated User via PUT",
        email: createdUser.email,
      };

      const res = await app.request(`/api/users/${createdUser.id}`, {
        method: "PUT",
        body: JSON.stringify(updatedUserData),
        headers: { "Content-Type": "application/json" },
      });
      assertEquals(res.status, 200);
      const user = await res.json();

      assertEquals(user.id, createdUser.id);
      assertEquals(user.username, updatedUserData.username);
      assertEquals(user.displayName, updatedUserData.displayName);
      assertEquals(user.email, updatedUserData.email);
      assert(
        new Date(user.updatedAt) > new Date(createdUser.updatedAt),
        "updatedAt should be newer",
      );
    });

    it("should update an existing user with password and not expose password fields", async () => {
      const createdUser = await userService.create(
        createSampleUserInput({ username: "putuserpassword" }),
      );
      time.tick(1000);

      const updatedUserData = {
        username: "putuserpasswordupd",
        displayName: "Updated User via PUT with Password",
        email: createdUser.email,
        password: "newupdatedpassword123",
      };

      const res = await app.request(`/api/users/${createdUser.id}`, {
        method: "PUT",
        body: JSON.stringify(updatedUserData),
        headers: { "Content-Type": "application/json" },
      });
      assertEquals(res.status, 200);
      const user = await res.json();

      assertEquals(user.id, createdUser.id);
      assertEquals(user.username, updatedUserData.username);
      assertEquals(user.displayName, updatedUserData.displayName);
      assertEquals(user.email, updatedUserData.email);
      assertEquals(user.password, undefined);
      assertEquals(
        (user as Record<string, unknown>)["hashedPassword"],
        undefined,
      );
      assertEquals((user as Record<string, unknown>)["salt"], undefined);
      assert(
        new Date(user.updatedAt) > new Date(createdUser.updatedAt),
        "updatedAt should be newer",
      );

      assertEquals(
        await userService.checkPassword(
          user.id,
          "newupdatedpassword123",
        ),
        true,
      );
    });

    it("should return 404 if user to update is not found", async () => {
      const nonExistentId = generateUUIDv7();
      const updateData = {
        username: "ghostput",
        displayName: "Attempt to Update Non-existent",
        email: "ghostput@example.com",
        id: nonExistentId,
      };

      const res = await app.request(`/api/users/${nonExistentId}`, {
        method: "PUT",
        body: JSON.stringify(updateData),
        headers: { "Content-Type": "application/json" },
      });
      assertEquals(res.status, 404);
      const errorBody = await res.json();
      assertEquals(errorBody.status, 404);
      assertEquals(errorBody.title, "NotFoundError");
      assertEquals(errorBody.detail, "Failed to find user to update");
    });

    it("should return 400 if request body is invalid for PUT (missing display name)", async () => {
      const createdUser = await userService.create(
        createSampleUserInput({ username: "putvalidation" }),
      );
      const invalidUpdateData = {
        username: createdUser.username,
        email: createdUser.email,
      };

      const res = await app.request(`/api/users/${createdUser.id}`, {
        method: "PUT",
        body: JSON.stringify(invalidUpdateData),
        headers: { "Content-Type": "application/json" },
      });
      assertEquals(res.status, 400);
      const errorBody = await res.json();
      assertEquals(errorBody.status, 400);
      assertEquals(errorBody.title, "BadRequestError");
      assert(errorBody.detail.includes("Invalid user"));
      assert(errorBody.detail.includes("Field 'displayName' is required"));
    });

    it("should return 400 if password is too short in PUT request", async () => {
      const createdUser = await userService.create(
        createSampleUserInput({ username: "putpasswordvalidation" }),
      );
      const invalidUpdateData = {
        username: createdUser.username,
        displayName: createdUser.displayName,
        email: createdUser.email,
        password: "short",
      };

      const res = await app.request(`/api/users/${createdUser.id}`, {
        method: "PUT",
        body: JSON.stringify(invalidUpdateData),
        headers: { "Content-Type": "application/json" },
      });
      assertEquals(res.status, 400);
      const errorBody = await res.json();
      assertEquals(errorBody.status, 400);
      assertEquals(errorBody.title, "BadRequestError");
      assert(errorBody.detail.includes("Invalid user"));
      assert(
        errorBody.detail.includes("Password must be at least 8 characters"),
      );
    });

    it("should return 400 if trying to update username to an existing one", async () => {
      const user1 = await userService.create(
        createSampleUserInput({ username: "putconflict1" }),
      );
      const user2 = await userService.create(
        createSampleUserInput({ username: "putconflict2" }),
      );

      const updateData = {
        username: user1.username,
        displayName: user2.displayName,
        email: user2.email,
      };

      const res = await app.request(`/api/users/${user2.id}`, {
        method: "PUT",
        body: JSON.stringify(updateData),
        headers: { "Content-Type": "application/json" },
      });
      assertEquals(res.status, 400);
      const errorBody = await res.json();
      assertEquals(errorBody.status, 400);
      assertEquals(errorBody.title, "BadRequestError");
      assertEquals(
        errorBody.detail,
        "Failed to update user",
      );
    });
  });

  describe("PATCH /:id", () => {
    afterEach(() => userService.close());

    it("should partially update an existing user and return it", async () => {
      const createdUser = await userService.create(
        createSampleUserInput({ username: "patchuseroriginal" }),
      );
      time.tick(1000);

      const patchData = {
        displayName: "Patched User Display Name",
      };

      const res = await app.request(`/api/users/${createdUser.id}`, {
        method: "PATCH",
        body: JSON.stringify(patchData),
        headers: { "Content-Type": "application/json" },
      });
      assertEquals(res.status, 200);
      const user = await res.json();

      assertEquals(user.id, createdUser.id);
      assertEquals(user.username, createdUser.username);
      assertEquals(user.displayName, patchData.displayName);
      assertEquals(user.email, createdUser.email);
      assert(
        new Date(user.updatedAt) > new Date(createdUser.updatedAt),
        "updatedAt should be newer",
      );
    });

    it("should patch user with password and not expose password fields", async () => {
      const createdUser = await userService.create(
        createSampleUserInput({ username: "patchuserpassword" }),
      );
      time.tick(1000);

      const patchData = {
        password: "patchednewpassword123",
      };

      const res = await app.request(`/api/users/${createdUser.id}`, {
        method: "PATCH",
        body: JSON.stringify(patchData),
        headers: { "Content-Type": "application/json" },
      });
      assertEquals(res.status, 200);
      const user = await res.json();

      assertEquals(user.id, createdUser.id);
      assertEquals(user.username, createdUser.username);
      assertEquals(user.displayName, createdUser.displayName);
      assertEquals(user.email, createdUser.email);
      assertEquals(user.password, undefined);
      assertEquals(
        (user as Record<string, unknown>)["hashedPassword"],
        undefined,
      );
      assertEquals((user as Record<string, unknown>)["salt"], undefined);
      assert(
        new Date(user.updatedAt) > new Date(createdUser.updatedAt),
        "updatedAt should be newer",
      );

      assertEquals(
        await userService.checkPassword(
          user.id,
          "patchednewpassword123",
        ),
        true,
      );
    });

    it("should return 404 if user to patch is not found", async () => {
      const nonExistentId = generateUUIDv7();
      const patchData = {
        displayName: "Attempt to Patch Non-existent",
      };

      const res = await app.request(`/api/users/${nonExistentId}`, {
        method: "PATCH",
        body: JSON.stringify(patchData),
        headers: { "Content-Type": "application/json" },
      });
      assertEquals(res.status, 404);
      const errorBody = await res.json();
      assertEquals(errorBody.status, 404);
      assertEquals(errorBody.title, "NotFoundError");
      assertEquals(errorBody.detail, "Failed to find user to patch");
    });

    it("should return 400 if request body is invalid for PATCH (username too long)", async () => {
      const createdUser = await userService.create(
        createSampleUserInput({ username: "patchvalidation" }),
      );
      const invalidPatchData = {
        username: "u".repeat(51),
      };

      const res = await app.request(`/api/users/${createdUser.id}`, {
        method: "PATCH",
        body: JSON.stringify(invalidPatchData),
        headers: { "Content-Type": "application/json" },
      });
      assertEquals(res.status, 400);
      const errorBody = await res.json();
      assertEquals(errorBody.status, 400);
      assertEquals(errorBody.title, "BadRequestError");
      assert(errorBody.detail.includes("Invalid user"));
      assert(
        errorBody.detail.includes("Username must be less than 50 characters"),
      );
    });

    it("should return 400 if password is too short in PATCH request", async () => {
      const createdUser = await userService.create(
        createSampleUserInput({ username: "patchpasswordvalidation" }),
      );
      const invalidPatchData = {
        password: "short",
      };

      const res = await app.request(`/api/users/${createdUser.id}`, {
        method: "PATCH",
        body: JSON.stringify(invalidPatchData),
        headers: { "Content-Type": "application/json" },
      });
      assertEquals(res.status, 400);
      const errorBody = await res.json();
      assertEquals(errorBody.status, 400);
      assertEquals(errorBody.title, "BadRequestError");
      assert(errorBody.detail.includes("Invalid user"));
      assert(
        errorBody.detail.includes("Password must be at least 8 characters"),
      );
    });

    it("should return 400 if trying to patch username to an existing one", async () => {
      const user1 = await userService.create(
        createSampleUserInput({ username: "patchconflict1" }),
      );
      const user2 = await userService.create(
        createSampleUserInput({ username: "patchconflict2" }),
      );

      const patchData = {
        username: user1.username,
      };

      const res = await app.request(`/api/users/${user2.id}`, {
        method: "PATCH",
        body: JSON.stringify(patchData),
        headers: { "Content-Type": "application/json" },
      });
      assertEquals(res.status, 400);
      const errorBody = await res.json();
      assertEquals(errorBody.status, 400);
      assertEquals(errorBody.title, "BadRequestError");
      assertEquals(
        errorBody.detail,
        "Failed to patch user",
      );
    });
  });

  describe("DELETE /:id", () => {
    afterEach(() => userService.close());

    it("should delete an existing user and return a confirmation", async () => {
      const createdUser = await userService.create(
        createSampleUserInput({ username: "deleteuser" }),
      );

      const res = await app.request(`/api/users/${createdUser.id}`, {
        method: "DELETE",
      });
      assertEquals(res.status, 200);
      const json = await res.json();
      assertEquals(json.deleted, true);

      const getRes = await app.request(`/api/users/${createdUser.id}`);
      assertEquals(getRes.status, 404);
    });

    it("should return 404 if user to delete is not found", async () => {
      const nonExistentId = generateUUIDv7();

      const res = await app.request(`/api/users/${nonExistentId}`, {
        method: "DELETE",
      });
      assertEquals(res.status, 404);
      const errorBody = await res.json();
      assertEquals(errorBody.status, 404);
      assertEquals(errorBody.title, "NotFoundError");
      assertEquals(errorBody.detail, "Failed to find user to delete");
    });
  });
});
