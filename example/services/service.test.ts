import { afterAll, beforeAll, describe, it } from "@std/testing/bdd";
import { FakeTime } from "@std/testing/time";
import { assert, assertEquals, assertRejects } from "@std/assert";
import { z } from "zod";
import { HttpError } from "@udibo/http-error";
import {
  generate as generateUUIDv7,
  validate as validateUUIDv7,
} from "@std/uuid/unstable-v7";

import { Service } from "./service.ts";

const userSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  age: z.number()
    .min(18, { message: "Age must be greater than or equal to 18" })
    .max(150, { message: "Age must be less than or equal to 150" }),
  createdAt: z.date(),
  updatedAt: z.date(),
});

describe("Service", () => {
  describe("create", () => {
    it("without secondary index", async () => {
      using service = new Service({ name: "user", schema: userSchema });

      const user = await service.create({ name: "John Doe", age: 32 });
      assert(validateUUIDv7(user.id));
      assertEquals(user.name, "John Doe");
      assertEquals(user.age, 32);
      assert(user.createdAt instanceof Date);
      assert(user.updatedAt instanceof Date);
      assertEquals(user.createdAt, user.updatedAt);
    });

    it("with secondary index", async () => {
      using service = new Service({
        name: "user",
        schema: userSchema,
        secondaryIndexes: ["name"],
      });

      const user = await service.create({ name: "John Doe", age: 32 });
      assert(validateUUIDv7(user.id));
      assertEquals(user.name, "John Doe");
      assertEquals(user.age, 32);
      assert(user.createdAt instanceof Date);
      assert(user.updatedAt instanceof Date);
      assertEquals(user.createdAt, user.updatedAt);
    });

    it("should fail to create with duplicate secondary index", async () => {
      using service = new Service({
        name: "user",
        schema: userSchema,
        secondaryIndexes: ["name"],
      });

      await service.create({ name: "John Doe", age: 32 });
      await assertRejects(
        async () => {
          await service.create({ name: "John Doe", age: 33 });
        },
        HttpError,
        `Failed to create user`,
      );
    });

    it("should fail to create with invalid data", async () => {
      using service = new Service({ name: "user", schema: userSchema });
      await assertRejects(
        async () => {
          await service.create({ name: "John Doe", age: 17 });
        },
        HttpError,
        "Invalid user data: Age must be greater than or equal to 18",
      );
    });
  });

  describe("get", () => {
    it("without secondary index", async () => {
      using service = new Service({ name: "user", schema: userSchema });

      const createdUser = await service.create({ name: "John Doe", age: 32 });
      const user = await service.get(createdUser.id);
      assertEquals(user, createdUser);
      assert(user.createdAt instanceof Date);
      assert(user.updatedAt instanceof Date);

      await assertRejects(
        async () => {
          await service.get("non-existent-id");
        },
        HttpError,
        "Failed to find user",
      );
    });

    it("with secondary index", async () => {
      using service = new Service({
        name: "user",
        schema: userSchema,
        secondaryIndexes: ["name"],
      });

      const createdUser = await service.create({ name: "John Doe", age: 32 });
      const user = await service.get(createdUser.id);
      assertEquals(user, createdUser);
      assert(user.createdAt instanceof Date);
      assert(user.updatedAt instanceof Date);

      await assertRejects(
        async () => {
          await service.get("non-existent-id");
        },
        HttpError,
        "Failed to find user",
      );
    });
  });

  describe("getBy", () => {
    let service: Service<z.infer<typeof userSchema>>;
    let createdUser: z.infer<typeof userSchema>;

    beforeAll(async () => {
      service = new Service({
        name: "user",
        schema: userSchema,
        secondaryIndexes: ["name"],
      });
      createdUser = await service.create({ name: "John Doe", age: 32 });
    });

    afterAll(() => {
      service.close();
    });

    it("get by indexed field should return the entity if it exists", async () => {
      const user = await service.getBy("name", "John Doe");
      assertEquals(user, createdUser);
      assert(user.createdAt instanceof Date);
      assert(user.updatedAt instanceof Date);
    });

    it("get by indexed field should return null if the entity does not exist", async () => {
      await assertRejects(
        async () => {
          await service.getBy("name", "Jane Doe");
        },
        HttpError,
        "Failed to find user by name",
      );
    });

    it("get by non-indexed field should return null", async () => {
      await assertRejects(
        async () => {
          await service.getBy("age", 32);
        },
        HttpError,
        "Failed to find user by age",
      );
    });
  });

  describe("parse", () => {
    const service = new Service({ name: "user", schema: userSchema });

    it("should return parsed data for valid input", () => {
      const now = new Date();
      const validData = {
        id: generateUUIDv7(),
        name: "Test User",
        age: 25,
        createdAt: now,
        updatedAt: now,
      };
      const parsed = service.parse(validData);
      assertEquals(parsed, validData);
    });

    it("should throw HttpError for invalid input", () => {
      const invalidData = {
        id: generateUUIDv7(),
        name: "Test User",
        age: 17,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      assertRejects(
        () => {
          return Promise.resolve().then(() => service.parse(invalidData));
        },
        HttpError,
        "Invalid user data: Age must be greater than or equal to 18",
      );
    });

    it("should throw HttpError for missing required fields", () => {
      const incompleteData = {
        id: generateUUIDv7(),
        age: 25,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      assertRejects(
        () => {
          return Promise.resolve().then(() => service.parse(incompleteData));
        },
        HttpError,
        "Invalid user data: Field 'name' is required.",
      );
    });
  });
});

describe("update", () => {
  it("without secondary index", async () => {
    using time = new FakeTime();
    using service = new Service({ name: "user", schema: userSchema });
    const initialUser = await service.create({ name: "John Doe", age: 32 });

    time.tick(10);

    const updatedUserPayload = {
      id: initialUser.id,
      name: "John Doe",
      age: 33,
    };
    const updatedUser = await service.update(updatedUserPayload);
    assertEquals(updatedUser.id, initialUser.id);
    assertEquals(updatedUser.name, "John Doe");
    assertEquals(updatedUser.age, 33);
    assertEquals(updatedUser.createdAt, initialUser.createdAt);
    assertEquals(
      updatedUser.updatedAt.getTime() - initialUser.createdAt.getTime(),
      10,
    );

    const retrievedUser = await service.get(initialUser.id);
    assertEquals(retrievedUser, updatedUser);
  });

  it("should fail to update non-existent user", async () => {
    using service = new Service({ name: "user", schema: userSchema });
    const nonExistentUser = {
      id: "non-existent-id",
      name: "Ghost User",
      age: 99,
    };
    await assertRejects(
      async () => {
        await service.update(nonExistentUser);
      },
      HttpError,
      `Failed to find user to update`,
    );
  });

  describe("with secondary index", () => {
    it("indexed value does not change", async () => {
      using time = new FakeTime();
      using service = new Service({
        name: "user",
        schema: userSchema,
        secondaryIndexes: ["name"],
      });
      const initialUser = await service.create({ name: "John Doe", age: 32 });

      time.tick(10);

      const updatedUserPayload = {
        id: initialUser.id,
        name: "John Doe",
        age: 33,
      };
      const updatedUser = await service.update(updatedUserPayload);
      assertEquals(updatedUser.id, initialUser.id);
      assertEquals(updatedUser.name, "John Doe");
      assertEquals(updatedUser.age, 33);
      assertEquals(updatedUser.createdAt, initialUser.createdAt);
      assertEquals(
        updatedUser.updatedAt.getTime() - initialUser.createdAt.getTime(),
        10,
      );

      const retrievedUser = await service.get(initialUser.id);
      assertEquals(retrievedUser, updatedUser);
      const retrievedUserByName = await service.getBy("name", "John Doe");
      assertEquals(retrievedUserByName, updatedUser);
    });

    it("indexed value changes", async () => {
      using time = new FakeTime();
      using service = new Service({
        name: "user",
        schema: userSchema,
        secondaryIndexes: ["name"],
      });
      const initialUser = await service.create({ name: "John Doe", age: 32 });

      time.tick(10);

      const updatedUserPayload = {
        id: initialUser.id,
        name: "Jane Doe",
        age: 33,
      };
      const updatedUser = await service.update(updatedUserPayload);
      assertEquals(updatedUser.id, initialUser.id);
      assertEquals(updatedUser.name, "Jane Doe");
      assertEquals(updatedUser.age, 33);
      assertEquals(updatedUser.createdAt, initialUser.createdAt);
      assertEquals(
        updatedUser.updatedAt.getTime() - initialUser.createdAt.getTime(),
        10,
      );

      const retrievedUser = await service.get(initialUser.id);
      assertEquals(retrievedUser, updatedUser);
      await assertRejects(
        async () => {
          await service.getBy("name", "John Doe");
        },
        HttpError,
        "Failed to find user by name",
      );
      const retrievedUserByNameNew = await service.getBy("name", "Jane Doe");
      assertEquals(retrievedUserByNameNew, updatedUser);
    });

    it("should fail to update with duplicate secondary index", async () => {
      using service = new Service({
        name: "user",
        schema: userSchema,
        secondaryIndexes: ["name"],
      });
      await service.create({ name: "John Doe", age: 32 });
      const userToUpdate = await service.create({ name: "Jane Doe", age: 33 });

      await assertRejects(
        async () => {
          await service.update({ ...userToUpdate, name: "John Doe" });
        },
        HttpError,
        `Failed to update user`,
      );
    });

    it("should fail to update with invalid data", async () => {
      using service = new Service({ name: "user", schema: userSchema });
      const initialUser = await service.create({ name: "John Doe", age: 32 });
      await assertRejects(
        async () => {
          await service.update({
            id: initialUser.id,
            name: "John Doe",
            age: 17,
          });
        },
        HttpError,
        "Invalid user data: Age must be greater than or equal to 18",
      );
    });
  });
});

describe("patch", () => {
  it("without secondary index", async () => {
    using time = new FakeTime();
    using service = new Service({ name: "user", schema: userSchema });
    const initialUser = await service.create({ name: "John Doe", age: 32 });

    time.tick(10);

    const patchPayload = { id: initialUser.id, age: 33 };
    const patchedUser = await service.patch(patchPayload);
    assertEquals(patchedUser.name, "John Doe");
    assertEquals(patchedUser.age, 33);
    assertEquals(patchedUser.id, initialUser.id);
    assertEquals(patchedUser.createdAt, initialUser.createdAt);
    assertEquals(
      patchedUser.updatedAt.getTime() - initialUser.createdAt.getTime(),
      10,
    );

    const retrievedUser = await service.get(initialUser.id);
    assertEquals(retrievedUser, patchedUser);
  });

  it("should fail to patch non-existent user", async () => {
    using service = new Service({ name: "user", schema: userSchema });
    const nonExistentUserPatch = {
      id: "non-existent-id",
      age: 99,
    };
    await assertRejects(
      async () => {
        await service.patch(nonExistentUserPatch);
      },
      HttpError,
      `Failed to find user to patch`,
    );
  });

  describe("with secondary index", () => {
    it("indexed value does not change", async () => {
      using time = new FakeTime();
      using service = new Service({
        name: "user",
        schema: userSchema,
        secondaryIndexes: ["name"],
      });
      const initialUser = await service.create({ name: "John Doe", age: 32 });

      time.tick(10);

      const patchPayload = { id: initialUser.id, age: 33 };
      const patchedUser = await service.patch(patchPayload);
      assertEquals(patchedUser.name, "John Doe");
      assertEquals(patchedUser.age, 33);
      assertEquals(patchedUser.id, initialUser.id);
      assertEquals(patchedUser.createdAt, initialUser.createdAt);
      assertEquals(
        patchedUser.updatedAt.getTime() - initialUser.createdAt.getTime(),
        10,
      );

      const retrievedUser = await service.get(initialUser.id);
      assertEquals(retrievedUser, patchedUser);
      const retrievedUserByName = await service.getBy("name", "John Doe");
      assertEquals(retrievedUserByName, patchedUser);
    });

    it("indexed value changes", async () => {
      using time = new FakeTime();
      using service = new Service({
        name: "user",
        schema: userSchema,
        secondaryIndexes: ["name"],
      });
      const initialUser = await service.create({ name: "John Doe", age: 32 });

      time.tick(10);

      const patchPayload = { id: initialUser.id, name: "Jane Doe" };
      const patchedUser = await service.patch(patchPayload);
      assertEquals(patchedUser.name, "Jane Doe");
      assertEquals(patchedUser.age, 32); // Age should remain from initialUser
      assertEquals(patchedUser.id, initialUser.id);
      assertEquals(patchedUser.createdAt, initialUser.createdAt);
      assertEquals(
        patchedUser.updatedAt.getTime() - initialUser.createdAt.getTime(),
        10,
      );

      const retrievedUser = await service.get(initialUser.id);
      assertEquals(retrievedUser, patchedUser);
      await assertRejects(
        async () => {
          await service.getBy("name", "John Doe");
        },
        HttpError,
        "Failed to find user by name",
      );
      const retrievedUserByNameNew = await service.getBy("name", "Jane Doe");
      assertEquals(retrievedUserByNameNew, patchedUser);
    });

    it("should fail to patch with duplicate secondary index", async () => {
      using service = new Service({
        name: "user",
        schema: userSchema,
        secondaryIndexes: ["name"],
      });
      await service.create({ name: "John Doe", age: 32 });
      const userToPatch = await service.create({ name: "Jane Doe", age: 33 });

      await assertRejects(
        async () => {
          await service.patch({ id: userToPatch.id, name: "John Doe" });
        },
        HttpError,
        `Failed to patch user`,
      );
    });

    it("should fail to patch with invalid data", async () => {
      using service = new Service({ name: "user", schema: userSchema });
      const initialUser = await service.create({ name: "John Doe", age: 32 });
      await assertRejects(
        async () => {
          await service.patch({ id: initialUser.id, age: 17 });
        },
        HttpError,
        "Invalid user data: Age must be greater than or equal to 18",
      );
    });
  });
});

describe("delete", () => {
  it("without secondary index", async () => {
    using service = new Service({ name: "user", schema: userSchema });
    const initialUser = await service.create({ name: "John Doe", age: 32 });

    await service.delete(initialUser.id);

    await assertRejects(
      async () => {
        await service.get(initialUser.id);
      },
      HttpError,
      "Failed to find user",
    );
  });

  it("should fail to delete non-existent user", async () => {
    using service = new Service({ name: "user", schema: userSchema });
    await assertRejects(
      async () => {
        await service.delete("non-existent-id");
      },
      HttpError,
      `Failed to find user to delete`,
    );
  });

  describe("with secondary index", () => {
    it("deletes entity and its secondary indexes", async () => {
      using service = new Service({
        name: "user",
        schema: userSchema,
        secondaryIndexes: ["name"],
      });
      const initialUser = await service.create({ name: "John Doe", age: 32 });

      await service.delete(initialUser.id);

      await assertRejects(
        async () => {
          await service.get(initialUser.id);
        },
        HttpError,
        "Failed to find user",
      );

      await assertRejects(
        async () => {
          await service.getBy("name", "John Doe");
        },
        HttpError,
        "Failed to find user by name",
      );
    });
  });
});
