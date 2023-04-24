import { FirebaseStorage } from "../../src/storage/firebaseStorage";
import { initializeApp } from "@firebase/app";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  Auth,
} from "@firebase/auth";

import { firebaseConfig } from "./firebaseExports"; // this file is only present locally
import { testUsers } from "./firebaseTestUsers"; // this file is only present locally
import { deleteObject, getStorage, ref } from "@firebase/storage";

describe("FirebaseStorage (uses real Firebase Storage account)", () => {
  let storage: FirebaseStorage;
  let firebaseAuth: Auth;

  beforeAll(async () => {
    initializeApp(firebaseConfig);
    firebaseAuth = getAuth();
    onAuthStateChanged(firebaseAuth, (user) => {
      if (user) {
        storage = new FirebaseStorage(testUsers.testUser1.url);
      }
    });
    await signOut(firebaseAuth);
    await signInWithEmailAndPassword(
      firebaseAuth,
      testUsers.testUser1.email,
      testUsers.testUser1.password
    );
  });

  afterAll(async () => {
    await signOut(firebaseAuth);
  });

  test("get creates file if not exists", async () => {
    await deleteObject(ref(getStorage(), testUsers.testUser1.url));

    const result = await storage.get();

    expect(result).toBe("");
  });

  test("loads string from files stored at Firebase Storage", async () => {
    await storage.put("TEST MESSAGE!! 123");
    const result = await storage.get();
    expect(result).toBe("TEST MESSAGE!! 123");
  });

  test("saves and loads alphabet", async () => {
    await storage.put("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ");
    const result = await storage.get();
    expect(result).toBe("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ");
  });

  test("saves and loads numbers", async () => {
    await storage.put("0123456789");
    const result = await storage.get();
    expect(result).toBe("0123456789");
  });

  test("saves and loads punctuation signs", async () => {
    await storage.put("!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~");
    const result = await storage.get();
    expect(result).toBe("!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~");
  });

  test("saves and loads whitespace signs", async () => {
    await storage.put(" \t\n\r\x0b\x0c");
    const result = await storage.get();
    expect(result).toBe(" \t\n\r\x0b\x0c");
  });

  test("saves and loads polish alphabet", async () => {
    await storage.put(
      "aąbcćdeęfghijklłmnńoóprsśtuwyzźżAĄBCĆDEĘFGHIJKLŁMNŃOÓPRSŚTUWYZŹŻ"
    );
    const result = await storage.get();
    expect(result).toBe(
      "aąbcćdeęfghijklłmnńoóprsśtuwyzźżAĄBCĆDEĘFGHIJKLŁMNŃOÓPRSŚTUWYZŹŻ"
    );
  });
});
