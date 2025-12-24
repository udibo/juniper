import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  it,
} from "@std/testing/bdd";
import { assert, assertEquals, assertRejects } from "@std/assert";
import { sortBy } from "@std/collections/sort-by";
import { FakeTime } from "@std/testing/time";
import { z } from "zod";
import { HttpError } from "@udibo/juniper";
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
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

describe("Service", () => {
  const indexedUserSchema = userSchema.extend({
    department: z.string().optional(),
  });
  type IndexedUser = z.infer<typeof indexedUserSchema>;

  describe("create", () => {
    it("without unique index", async () => {
      using service = new Service({
        name: "user",
        schema: userSchema,
        keyspace: crypto.randomUUID(),
      });

      const user = await service.create({ name: "John Doe", age: 32 });
      assert(validateUUIDv7(user.id));
      assertEquals(user.name, "John Doe");
      assertEquals(user.age, 32);
      assert(user.createdAt instanceof Date);
      assert(user.updatedAt instanceof Date);
      assertEquals(user.createdAt, user.updatedAt);
    });

    it("with unique index", async () => {
      using service = new Service({
        name: "user",
        schema: userSchema,
        uniqueIndexes: ["name"],
        keyspace: crypto.randomUUID(),
      });

      const user = await service.create({ name: "John Doe", age: 32 });
      assert(validateUUIDv7(user.id));
      assertEquals(user.name, "John Doe");
      assertEquals(user.age, 32);
      assert(user.createdAt instanceof Date);
      assert(user.updatedAt instanceof Date);
      assertEquals(user.createdAt, user.updatedAt);
    });

    it("should fail to create with duplicate unique index", async () => {
      using service = new Service({
        name: "user",
        schema: userSchema,
        uniqueIndexes: ["name"],
        keyspace: crypto.randomUUID(),
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
      using service = new Service({
        name: "user",
        schema: userSchema,
        keyspace: crypto.randomUUID(),
      });
      await assertRejects(
        async () => {
          await service.create({ name: "John Doe", age: 17 });
        },
        HttpError,
        "Invalid user: Age must be greater than or equal to 18",
      );
    });

    it("with non-unique index: should create user and set non-unique index", async () => {
      const service = new Service<IndexedUser>({
        name: "indexedUserCreate",
        schema: indexedUserSchema,
        indexes: ["age"],
        keyspace: crypto.randomUUID(),
      });
      const user = await service.create({
        name: "Test User",
        age: 30,
        department: "HR",
      });
      assert(validateUUIDv7(user.id));
      assertEquals(user.age, 30);
      assertEquals(user.department, "HR");
    });
  });

  describe("get", () => {
    it("without unique index", async () => {
      using service = new Service({
        name: "user",
        schema: userSchema,
        keyspace: crypto.randomUUID(),
      });

      const createdUser = await service.create({
        name: "John Doe",
        age: 32,
      });
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

    it("with unique index", async () => {
      using service = new Service({
        name: "user",
        schema: userSchema,
        uniqueIndexes: ["name"],
        keyspace: crypto.randomUUID(),
      });

      const createdUser = await service.create({
        name: "John Doe",
        age: 32,
      });
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
        uniqueIndexes: ["name"],
        keyspace: crypto.randomUUID(),
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

    it("get by non-unique index field should throw error", async () => {
      await assertRejects(
        async () => {
          await service.getBy("age", 32);
        },
        HttpError,
        `Index "age" is not a valid unique index for user. Valid unique indexes are: name.`,
      );
    });
  });

  describe("parse", () => {
    let service: Service<z.infer<typeof userSchema>>;

    beforeAll(() => {
      service = new Service({
        name: "user",
        schema: userSchema,
        keyspace: crypto.randomUUID(),
      });
    });

    afterAll(() => {
      service.close();
    });

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

    it("should return parsed data for valid JSON input", () => {
      const now = new Date();
      const validData = {
        id: generateUUIDv7(),
        name: "Test User",
        age: 25,
        createdAt: now,
        updatedAt: now,
      };
      const validJsonData = JSON.parse(JSON.stringify(validData));
      const parsed = service.parse(validJsonData);
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
        "Invalid user: Age must be greater than or equal to 18",
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
        "Invalid user: Field 'name' is required.",
      );
    });
  });

  describe("update", () => {
    it("without unique index", async () => {
      using time = new FakeTime();
      using service = new Service({
        name: "user",
        schema: userSchema,
        keyspace: crypto.randomUUID(),
      });
      const initialUser = await service.create({
        name: "John Doe",
        age: 32,
      });

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
      using service = new Service({
        name: "user",
        schema: userSchema,
        keyspace: crypto.randomUUID(),
      });
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

    describe("with unique index", () => {
      it("indexed value does not change", async () => {
        using time = new FakeTime();
        using service = new Service({
          name: "user",
          schema: userSchema,
          uniqueIndexes: ["name"],
          keyspace: crypto.randomUUID(),
        });
        const initialUser = await service.create({
          name: "John Doe",
          age: 32,
        });

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
          uniqueIndexes: ["name"],
          keyspace: crypto.randomUUID(),
        });
        const initialUser = await service.create({
          name: "John Doe",
          age: 32,
        });

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
        const retrievedUserByNameNew = await service.getBy(
          "name",
          "Jane Doe",
        );
        assertEquals(retrievedUserByNameNew, updatedUser);
      });

      it("should fail to update with duplicate unique index", async () => {
        using service = new Service({
          name: "user",
          schema: userSchema,
          uniqueIndexes: ["name"],
          keyspace: crypto.randomUUID(),
        });
        await service.create({ name: "John Doe", age: 32 });
        const userToUpdate = await service.create({
          name: "Jane Doe",
          age: 33,
        });

        await assertRejects(
          async () => {
            await service.update({ ...userToUpdate, name: "John Doe" });
          },
          HttpError,
          `Failed to update user`,
        );
      });

      it("should fail to update with invalid data", async () => {
        using service = new Service({
          name: "user",
          schema: userSchema,
          keyspace: crypto.randomUUID(),
        });
        const initialUser = await service.create({
          name: "John Doe",
          age: 32,
        });
        await assertRejects(
          async () => {
            await service.update({
              id: initialUser.id,
              name: "John Doe",
              age: 17,
            });
          },
          HttpError,
          "Invalid user: Age must be greater than or equal to 18",
        );
      });
    });

    describe("with non-unique index", () => {
      describe("when updating user and non-unique index if changed", () => {
        let time: FakeTime;
        let service: Service<IndexedUser>;
        let initialUser: IndexedUser;

        beforeEach(async () => {
          time = new FakeTime();
          service = new Service<IndexedUser>({
            name: "indexedUserUpdate",
            schema: indexedUserSchema,
            indexes: ["age", "department"],
            keyspace: crypto.randomUUID(),
          });
          initialUser = await service.create({
            name: "User One",
            age: 25,
            department: "Sales",
          });
        });

        afterEach(() => {
          time.restore();
          service.close();
        });

        it("indexed fields (age, department) do not change name", async () => {
          time.tick(100);
          const updatedUser = await service.update({
            ...initialUser,
            name: "User One Updated",
          });
          assertEquals(updatedUser.name, "User One Updated");
          assertEquals(updatedUser.age, initialUser.age);
          assertEquals(updatedUser.department, initialUser.department);

          const listedUsersByAge = await service.list({ index: "age" });
          assert(
            listedUsersByAge.entries.some((u) =>
              u.id === updatedUser.id && u.age === updatedUser.age
            ),
          );
          const listedUsersByDept = await service.list({ index: "department" });
          assert(
            listedUsersByDept.entries.some((u) =>
              u.id === updatedUser.id && u.department === updatedUser.department
            ),
          );
        });

        it("one indexed field (age) changes", async () => {
          time.tick(100);
          const updatedUser = await service.update({ ...initialUser, age: 26 });
          assertEquals(updatedUser.age, 26);
          assertEquals(updatedUser.department, initialUser.department);

          const listedUsersByAge = await service.list({ index: "age" });
          assert(
            listedUsersByAge.entries.some((u) =>
              u.id === updatedUser.id && u.age === 26
            ),
          );
          const usersAtOldAge = await service.list({ index: "age" });
          assert(
            !usersAtOldAge.entries.find((u) =>
              u.id === initialUser.id && u.age === 25
            ),
            "User should not be found by old age after update",
          );
        });

        it("another indexed field (department) changes", async () => {
          time.tick(100);
          const updatedUser = await service.update({
            ...initialUser,
            department: "Marketing",
          });
          assertEquals(updatedUser.age, initialUser.age);
          assertEquals(updatedUser.department, "Marketing");

          const listedUsersByDept = await service.list({ index: "department" });
          assert(
            listedUsersByDept.entries.some((u) =>
              u.id === updatedUser.id && u.department === "Marketing"
            ),
          );
          const usersAtOldDept = await service.list({ index: "department" });
          assert(
            !usersAtOldDept.entries.find((u) =>
              u.id === initialUser.id && u.department === "Sales"
            ),
            "User should not be found by old department after update",
          );
        });

        it("both indexed fields change", async () => {
          time.tick(100);
          const updatedUser = await service.update({
            ...initialUser,
            age: 27,
            department: "Engineering",
          });
          assertEquals(updatedUser.age, 27);
          assertEquals(updatedUser.department, "Engineering");

          const listedUsersByAge = await service.list({ index: "age" });
          assert(
            listedUsersByAge.entries.some((u) =>
              u.id === updatedUser.id && u.age === 27
            ),
          );
          const listedUsersByDept = await service.list({ index: "department" });
          assert(
            listedUsersByDept.entries.some((u) =>
              u.id === updatedUser.id && u.department === "Engineering"
            ),
          );
        });
      });
    });
  });

  describe("patch", () => {
    it("without unique index", async () => {
      using time = new FakeTime();
      using service = new Service({
        name: "user",
        schema: userSchema,
        keyspace: crypto.randomUUID(),
      });
      const initialUser = await service.create({
        name: "John Doe",
        age: 32,
      });

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
      using service = new Service({
        name: "user",
        schema: userSchema,
        keyspace: crypto.randomUUID(),
      });
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

    describe("with unique index", () => {
      it("indexed value does not change", async () => {
        using time = new FakeTime();
        using service = new Service({
          name: "user",
          schema: userSchema,
          uniqueIndexes: ["name"],
          keyspace: crypto.randomUUID(),
        });
        const initialUser = await service.create({
          name: "John Doe",
          age: 32,
        });

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
        const retrievedUserByName = await service.getBy(
          "name",
          "John Doe",
        );
        assertEquals(retrievedUserByName, patchedUser);
      });

      it("indexed value changes", async () => {
        using time = new FakeTime();
        using service = new Service({
          name: "user",
          schema: userSchema,
          uniqueIndexes: ["name"],
          keyspace: crypto.randomUUID(),
        });
        const initialUser = await service.create({
          name: "John Doe",
          age: 32,
        });

        time.tick(10);

        const patchPayload = { id: initialUser.id, name: "Jane Doe" };
        const patchedUser = await service.patch(patchPayload);
        assertEquals(patchedUser.name, "Jane Doe");
        assertEquals(patchedUser.age, 32);
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
        const retrievedUserByNameNew = await service.getBy(
          "name",
          "Jane Doe",
        );
        assertEquals(retrievedUserByNameNew, patchedUser);
      });

      it("should fail to patch with duplicate unique index", async () => {
        using service = new Service({
          name: "user",
          schema: userSchema,
          uniqueIndexes: ["name"],
          keyspace: crypto.randomUUID(),
        });
        await service.create({ name: "John Doe", age: 32 });
        const userToPatch = await service.create({
          name: "Jane Doe",
          age: 33,
        });

        await assertRejects(
          async () => {
            await service.patch({ id: userToPatch.id, name: "John Doe" });
          },
          HttpError,
          `Failed to patch user`,
        );
      });

      it("should fail to patch with invalid data", async () => {
        using service = new Service({
          name: "user",
          schema: userSchema,
          keyspace: crypto.randomUUID(),
        });
        const initialUser = await service.create({
          name: "John Doe",
          age: 32,
        });
        await assertRejects(
          async () => {
            await service.patch({ id: initialUser.id, age: 17 });
          },
          HttpError,
          "Invalid user: Age must be greater than or equal to 18",
        );
      });
    });

    describe("with non-unique index", () => {
      describe("when patching user and non-unique index if changed", () => {
        let time: FakeTime;
        let service: Service<IndexedUser>;
        let initialUser: IndexedUser;

        beforeEach(async () => {
          time = new FakeTime();
          service = new Service<IndexedUser>({
            name: "indexedUserPatch",
            schema: indexedUserSchema,
            indexes: ["age", "department"],
            keyspace: crypto.randomUUID(),
          });
          initialUser = await service.create({
            name: "User Two",
            age: 40,
            department: "Support",
          });
        });

        afterEach(() => {
          time.restore();
          service.close();
        });

        it("indexed fields do not change from patch (only name changes)", async () => {
          time.tick(100);
          const patchedUser = await service.patch({
            id: initialUser.id,
            name: "User Two Patched",
          });
          assertEquals(patchedUser.name, "User Two Patched");
          assertEquals(patchedUser.age, initialUser.age);
          assertEquals(patchedUser.department, initialUser.department);

          const listedUsersByAge = await service.list({ index: "age" });
          assert(
            listedUsersByAge.entries.some((u) =>
              u.id === patchedUser.id && u.age === patchedUser.age
            ),
          );
          const listedUsersByDept = await service.list({ index: "department" });
          assert(
            listedUsersByDept.entries.some((u) =>
              u.id === patchedUser.id && u.department === patchedUser.department
            ),
          );
        });

        it("one indexed field (age) changes", async () => {
          time.tick(100);
          const patchedUser = await service.patch({
            id: initialUser.id,
            age: 41,
          });
          assertEquals(patchedUser.age, 41);
          assertEquals(patchedUser.department, initialUser.department);

          const listedUsersByAge = await service.list({ index: "age" });
          assert(
            listedUsersByAge.entries.some((u) =>
              u.id === patchedUser.id && u.age === 41
            ),
          );
          const usersAtOldAge = await service.list({ index: "age" });
          assert(
            !usersAtOldAge.entries.find((u) =>
              u.id === initialUser.id && u.age === 40
            ),
            "User should not be found by old age after patch",
          );
        });

        it("another indexed field (department) changes", async () => {
          time.tick(100);
          const patchedUser = await service.patch({
            id: initialUser.id,
            department: "DevOps",
          });
          assertEquals(patchedUser.age, initialUser.age);
          assertEquals(patchedUser.department, "DevOps");

          const listedUsersByDept = await service.list({ index: "department" });
          assert(
            listedUsersByDept.entries.some((u) =>
              u.id === patchedUser.id && u.department === "DevOps"
            ),
          );
          const usersAtOldDept = await service.list({ index: "department" });
          assert(
            !usersAtOldDept.entries.find((u) =>
              u.id === initialUser.id && u.department === "Support"
            ),
            "User should not be found by old department after patch",
          );
        });

        it("both indexed fields change", async () => {
          time.tick(100);
          const patchedUser = await service.patch({
            id: initialUser.id,
            age: 42,
            department: "QA",
          });
          assertEquals(patchedUser.age, 42);
          assertEquals(patchedUser.department, "QA");

          const listedUsersByAge = await service.list({ index: "age" });
          assert(
            listedUsersByAge.entries.some((u) =>
              u.id === patchedUser.id && u.age === 42
            ),
          );
          const listedUsersByDept = await service.list({ index: "department" });
          assert(
            listedUsersByDept.entries.some((u) =>
              u.id === patchedUser.id && u.department === "QA"
            ),
          );
        });
      });
    });
  });

  describe("delete", () => {
    it("without unique index", async () => {
      using service = new Service({
        name: "user",
        schema: userSchema,
        keyspace: crypto.randomUUID(),
      });
      const initialUser = await service.create({
        name: "John Doe",
        age: 32,
      });

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
      using service = new Service({
        name: "user",
        schema: userSchema,
        keyspace: crypto.randomUUID(),
      });
      await assertRejects(
        async () => {
          await service.delete("non-existent-id");
        },
        HttpError,
        `Failed to find user to delete`,
      );
    });

    describe("with unique index", () => {
      it("deletes entity and its unique indexes", async () => {
        using service = new Service({
          name: "user",
          schema: userSchema,
          uniqueIndexes: ["name"],
          keyspace: crypto.randomUUID(),
        });
        const initialUser = await service.create({
          name: "John Doe",
          age: 32,
        });

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

    describe("with non-unique index", () => {
      it("should delete user and remove non-unique index entries", async () => {
        const service = new Service<IndexedUser>({
          name: "indexedUserDelete",
          schema: indexedUserSchema,
          indexes: ["age", "department"],
          keyspace: crypto.randomUUID(),
        });
        const user = await service.create({
          name: "User Three",
          age: 50,
          department: "Management",
        });
        const userId = user.id;
        const userAge = user.age;
        const userDept = user.department;

        await service.delete(userId);

        const listedUsersByAge = await service.list({ index: "age" });
        assert(
          !listedUsersByAge.entries.some((u) =>
            u.id === userId && u.age === userAge
          ),
        );
        const listedUsersByDept = await service.list({
          index: "department",
        });
        assert(
          !listedUsersByDept.entries.some((u) =>
            u.id === userId && u.department === userDept
          ),
        );

        await assertRejects(
          async () => await service.get(userId),
          HttpError,
          "Failed to find indexedUserDelete",
        );
      });
    });
  });

  describe("list", () => {
    let time: FakeTime;
    let service: Service<z.infer<typeof userSchema>>;
    const usersToCreate = [
      { name: "Alice", age: 30 },
      { name: "Bob", age: 24 },
      { name: "Charlie", age: 35 },
      { name: "Diana", age: 28 },
      { name: "Edward", age: 40 },
    ];
    let createdUsers: z.infer<typeof userSchema>[];

    beforeAll(async () => {
      time = new FakeTime();
      service = new Service({
        name: "user",
        schema: userSchema,
        keyspace: crypto.randomUUID(),
      });
      createdUsers = [];
      for (const userData of usersToCreate) {
        time.tick(100);
        createdUsers.push(await service.create(userData));
      }
      createdUsers = sortBy(
        createdUsers,
        (user: z.infer<typeof userSchema>) => user.id,
      );
    });

    afterAll(() => {
      service.close();
      time.restore();
    });

    it("should return all items with default options", async () => {
      const { entries, cursor } = await service.list();
      assertEquals(entries.length, createdUsers.length);
      assertEquals(entries, createdUsers);
      assertEquals(cursor, "");
    });

    it("should return a limited number of items with the limit option", async () => {
      const limit = 2;
      const { entries, cursor } = await service.list({ limit });
      assertEquals(entries.length, limit);
      assertEquals(entries, createdUsers.slice(0, limit));
      assert(
        cursor !== "",
        "Cursor should not be empty when limit is applied and there are more items",
      );
    });

    it("should return remaining items with the cursor option", async () => {
      const limit = 2;
      let { entries, cursor } = await service.list({
        limit,
      });
      assertEquals(entries.length, limit);
      assert(cursor !== "", "First cursor should not be empty");

      const listResult = await service.list({
        cursor,
        limit: createdUsers.length,
      });
      entries = listResult.entries;
      cursor = listResult.cursor;

      assertEquals(entries.length, createdUsers.length - limit);
      assertEquals(entries, createdUsers.slice(limit));
      assertEquals(
        cursor,
        "",
        "Cursor should be an empty string as all remaining items are fetched",
      );
    });

    it("should return items in reverse order with the reverse option", async () => {
      const { entries, cursor } = await service.list({ reverse: true });
      assertEquals(entries.length, createdUsers.length);
      assertEquals(entries, [...createdUsers].reverse());
      assertEquals(cursor, "");
    });

    it("should return a limited number of items in reverse order with limit and reverse options", async () => {
      const limit = 2;
      const { entries, cursor } = await service.list({
        limit,
        reverse: true,
      });
      assertEquals(entries.length, limit);
      assertEquals(entries, [...createdUsers].reverse().slice(0, limit));
      assert(cursor !== "", "Cursor should not be empty");
    });

    it("should return remaining items in reverse order with cursor, limit, and reverse options", async () => {
      const limit = 2;
      let { entries, cursor } = await service.list({
        limit,
        reverse: true,
      });
      assertEquals(entries.length, limit);
      assert(cursor !== "", "First cursor should not be empty");

      const listResult = await service.list({
        cursor,
        limit: createdUsers.length,
        reverse: true,
      });
      entries = listResult.entries;
      cursor = listResult.cursor;

      assertEquals(entries.length, createdUsers.length - limit);
      assertEquals(
        entries,
        [...createdUsers].reverse().slice(limit),
      );
      assertEquals(
        cursor,
        "",
        "Cursor should be an empty string as all remaining items are fetched",
      );
    });

    it("should return an empty list if no items exist", async () => {
      using emptyService = new Service({
        name: "emptyUser",
        schema: userSchema,
        keyspace: crypto.randomUUID(),
      });
      const { entries, cursor } = await emptyService.list();
      assertEquals(entries.length, 0);
      assertEquals(cursor, "");
    });

    it("should list items by unique index", async () => {
      using indexedService = new Service({
        name: "indexedUser",
        schema: userSchema,
        uniqueIndexes: ["name"],
        keyspace: crypto.randomUUID(),
      });

      const usersData = [
        { name: "Charlie", age: 35 },
        { name: "Alice", age: 30 },
        { name: "Bob", age: 24 },
      ];
      let expectedIndexedUsers: z.infer<typeof userSchema>[] = [];
      for (const data of usersData) {
        time.tick(10);
        expectedIndexedUsers.push(await indexedService.create(data));
      }

      expectedIndexedUsers = sortBy(
        expectedIndexedUsers,
        (user: z.infer<typeof userSchema>) => `${user.name}-${user.id}`,
      );

      const { entries: nameIndexedEntries, cursor } = await indexedService.list(
        {
          index: "name",
        },
      );

      assertEquals(nameIndexedEntries.length, expectedIndexedUsers.length);
      assertEquals(nameIndexedEntries, expectedIndexedUsers);
      assertEquals(cursor, "");
    });

    it("should throw HttpError if listing by a non-existent index", async () => {
      using indexService = new Service({
        name: "user",
        schema: userSchema,
        uniqueIndexes: ["name"],
        indexes: ["age"],
        keyspace: crypto.randomUUID(),
      });
      await assertRejects(
        async () => {
          // @ts-expect-error: testing invalid index
          await indexService.list({ index: "nonExistentIndex" });
        },
        HttpError,
        `Index "nonExistentIndex" is not a valid index for user. Valid indexes are: id, name, age.`,
      );
    });

    it("should throw HttpError if listing by a non-existent index when no indexes are defined", async () => {
      using noIndexService = new Service({
        name: "user",
        schema: userSchema,
        keyspace: crypto.randomUUID(),
      });
      await assertRejects(
        async () => {
          // @ts-expect-error: testing invalid index
          await noIndexService.list({ index: "nonExistentIndex" });
        },
        HttpError,
        `Index "nonExistentIndex" is not a valid index for user. Valid indexes are: id.`,
      );
    });

    describe("with non-unique index", () => {
      let nonUniqueService: Service<IndexedUser>;
      const usersData: Array<
        Omit<IndexedUser, "id" | "createdAt" | "updatedAt">
      > = [
        { name: "Bob", age: 24, department: "Sales" },
        { name: "Diana", age: 28, department: "Marketing" },
        { name: "Alice", age: 30, department: "Engineering" },
        { name: "Charlie", age: 30, department: "Sales" },
        { name: "Edward", age: 40, department: "Engineering" },
        { name: "Frank", age: 24, department: "Support" },
      ];
      let createdUsersSortedById: IndexedUser[];
      let createdUsersSortedByAgeThenId: IndexedUser[];
      let createdUsersSortedByDepartmentThenId: IndexedUser[];

      beforeAll(async () => {
        nonUniqueService = new Service<IndexedUser>({
          name: "userListByNonUnique",
          schema: indexedUserSchema,
          indexes: ["age", "department"],
          keyspace: crypto.randomUUID(),
        });
        const tempCreatedUsers: IndexedUser[] = [];
        for (const userData of usersData) {
          time.tick(100);
          tempCreatedUsers.push(await nonUniqueService.create(userData));
        }

        createdUsersSortedById = sortBy(
          tempCreatedUsers,
          (user: IndexedUser) => user.id,
        );

        createdUsersSortedByAgeThenId = sortBy(
          tempCreatedUsers,
          (user: IndexedUser) => `${user.age}-${user.id}`,
        );

        createdUsersSortedByDepartmentThenId = sortBy(
          tempCreatedUsers,
          (user: IndexedUser) => `${user.department ?? ""}-${user.id}`,
        );
      });

      afterAll(() => {
        nonUniqueService.close();
      });

      it("should list all items sorted by id (when default index 'id' is used, even with non-unique indexes present)", async () => {
        const { entries, cursor } = await nonUniqueService.list();
        assertEquals(entries.length, createdUsersSortedById.length);
        assertEquals(entries, createdUsersSortedById);
        assertEquals(cursor, "");
      });

      it("should list all items sorted by 'age' (non-unique index), then by id", async () => {
        const { entries, cursor } = await nonUniqueService.list({
          index: "age",
        });
        assertEquals(entries.length, createdUsersSortedByAgeThenId.length);
        assertEquals(entries, createdUsersSortedByAgeThenId);
        assertEquals(cursor, "");
      });

      it("should list items by 'age' with limit", async () => {
        const limit = 2;
        const { entries, cursor } = await nonUniqueService.list({
          index: "age",
          limit,
        });
        assertEquals(entries.length, limit);
        assertEquals(entries, createdUsersSortedByAgeThenId.slice(0, limit));
        assert(cursor !== "", "Cursor should not be empty");
      });

      it("should list remaining items by 'age' with cursor", async () => {
        const limit = 2;
        let page = await nonUniqueService.list({ index: "age", limit });
        assertEquals(page.entries.length, limit);
        assertEquals(
          page.entries,
          createdUsersSortedByAgeThenId.slice(0, limit),
        );
        assert(
          page.cursor !== "",
          "Cursor should not be empty for the first page",
        );

        page = await nonUniqueService.list({
          index: "age",
          limit: createdUsersSortedByAgeThenId.length,
          cursor: page.cursor,
        });
        assertEquals(
          page.entries.length,
          createdUsersSortedByAgeThenId.length - limit,
        );
        assertEquals(page.entries, createdUsersSortedByAgeThenId.slice(limit));
        assertEquals(
          page.cursor,
          "",
          "Cursor should be empty for the last page",
        );
      });

      it("should list items by 'age' in reverse order", async () => {
        const { entries, cursor } = await nonUniqueService.list({
          index: "age",
          reverse: true,
        });
        assertEquals(entries.length, createdUsersSortedByAgeThenId.length);
        assertEquals(entries, [...createdUsersSortedByAgeThenId].reverse());
        assertEquals(cursor, "");
      });

      it("should list all items sorted by 'department' (non-unique index), then by id", async () => {
        const { entries, cursor } = await nonUniqueService.list({
          index: "department",
        });
        assertEquals(
          entries.length,
          createdUsersSortedByDepartmentThenId.length,
        );
        assertEquals(entries, createdUsersSortedByDepartmentThenId);
        assertEquals(cursor, "");
      });

      it("should list items by 'department' with limit and cursor", async () => {
        const limit = 3;
        let page = await nonUniqueService.list({ index: "department", limit });
        assertEquals(page.entries.length, limit);
        assertEquals(
          page.entries,
          createdUsersSortedByDepartmentThenId.slice(0, limit),
        );
        assert(page.cursor !== "", "Cursor should not be empty for page 1");

        page = await nonUniqueService.list({
          index: "department",
          limit: createdUsersSortedByDepartmentThenId.length,
          cursor: page.cursor,
        });
        assertEquals(
          page.entries.length,
          createdUsersSortedByDepartmentThenId.length - limit,
        );
        assertEquals(
          page.entries,
          createdUsersSortedByDepartmentThenId.slice(limit),
        );
        assertEquals(
          page.cursor,
          "",
          "Cursor should be empty for the last page",
        );
      });
    });
  });
});
