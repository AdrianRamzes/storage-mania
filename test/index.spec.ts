import { RemoteStorage, StorageMania, StorageState } from "../src";

// TODO: Check what if storage returns {'key': null}
// and check repositories how do they react to that?

class TestStorage implements RemoteStorage {
  constructor(
    get?: () => Promise<string>,
    put?: (data: string) => Promise<void>
  ) {
    this.get = get ?? (() => Promise.resolve(""));
    this.put = put ?? (() => Promise.resolve());
  }
  get: () => Promise<string>;
  put: (data: string) => Promise<void>;
}

describe("StorageMania", () => {
  const _ = new TestStorage();

  test("is in Uninitialized state after creation", async () => {
    const dataService = new StorageMania(_);

    expect(dataService.state).toBe(StorageState.Uninitialized);
  });

  // Uninitialized -load()-> Initializing
  test("is in Initializing state after load() is called for the first time", () => {
    const dataService = new StorageMania(_);

    dataService.load();

    expect(dataService.state).toBe(StorageState.Initializing);
  });

  // Uninitialized -load() finished-> Ready
  test("is in Ready state after first load() is finished", async () => {
    const dataService = new StorageMania(_);

    await dataService.load();

    expect(dataService.state).toBe(StorageState.Ready);
  });

  // Uninitialized -load() failed-> Uninitialized
  test("stays in Uninitialized state when load() failed", async () => {
    const dataService = new StorageMania(
      new TestStorage(() => Promise.reject("some reason"))
    );

    await expect(dataService.load()).rejects.toEqual("some reason");

    expect(dataService.state).toBe(StorageState.Uninitialized);
  });

  // Ready -load()-> Loading
  test("is in Loading state after load() is called", async () => {
    const dataService = new StorageMania(_);
    await dataService.load();
    expect(dataService.state).toBe(StorageState.Ready);

    dataService.load();

    expect(dataService.state).toBe(StorageState.Loading);
  });

  // Ready -await load()-> Ready
  test("is back in Ready state after load() is called", async () => {
    const dataService = new StorageMania(_);
    await dataService.load();
    expect(dataService.state).toBe(StorageState.Ready);

    await dataService.load();

    expect(dataService.state).toBe(StorageState.Ready);
  });

  // Ready -save()-> Ready
  test("stays in Ready state after save() is called", async () => {
    const dataService = new StorageMania(_);
    await dataService.load();
    expect(dataService.state).toBe(StorageState.Ready);

    dataService.save();

    expect(dataService.state).toBe(StorageState.Ready);
  });

  // Ready -set()-> Dirty
  test("is in Dirty state after set() is called", async () => {
    const dataService = new StorageMania(_);
    await dataService.load();
    expect(dataService.state).toBe(StorageState.Ready);

    dataService.set("key1", "value1");

    expect(dataService.state).toBe(StorageState.Dirty);
  });

  // Dirty -save()-> Saving
  test("is in Saving state after save() is called", async () => {
    const dataService = new StorageMania(_);
    await dataService.load();
    dataService.set("key1", "value1");
    expect(dataService.state).toBe(StorageState.Dirty);

    dataService.save();

    expect(dataService.state).toBe(StorageState.Saving);
  });

  // Saving -save() finished-> Ready
  test("is back in Ready state after save() is finished", async () => {
    const dataService = new StorageMania(_);
    await dataService.load();
    dataService.set("key1", "value1");
    const savePromise = dataService.save();
    expect(dataService.state).toBe(StorageState.Saving);

    await savePromise;

    expect(dataService.state).toBe(StorageState.Ready);
  });

  // Saving -save() failed-> Dirty
  test("stays in Dirty state when save failed", async () => {
    const dataService = new StorageMania(
      new TestStorage(undefined, () => Promise.reject("some reason"))
    );
    await dataService.load();
    dataService.set("key1", "value1");
    const savePromise = dataService.save();
    expect(dataService.state).toBe(StorageState.Saving);

    await expect(savePromise).rejects.toEqual("some reason");

    expect(dataService.state).toBe(StorageState.Dirty);
  });

  // Saving -set()-> Dirty
  test("is back in Dirty state when set was called while saving", async () => {
    const dataService = new StorageMania(_);
    await dataService.load();
    dataService.set("key1", "value1");
    const savePromise = dataService.save();
    expect(dataService.state).toBe(StorageState.Saving);

    dataService.set("key2", "value2");
    await savePromise;

    expect(dataService.state).toBe(StorageState.Dirty);
  });

  describe("calls back when state changed", () => {
    test("from Uninitialized to Initializing", () => {
      const stateChangedCallback = jest.fn();
      const dataService = new StorageMania(_, stateChangedCallback);

      dataService.load();

      expect(stateChangedCallback.mock.calls).toEqual([
        [StorageState.Initializing],
      ]);
    });

    test("from Initializing to Ready", async () => {
      const stateChangedCallback = jest.fn();
      const dataService = new StorageMania(_, stateChangedCallback);

      await dataService.load();

      expect(stateChangedCallback.mock.calls).toEqual([
        [StorageState.Initializing],
        [StorageState.Ready],
      ]);
    });

    test("from Initializing back to Uninitialized", async () => {
      const stateChangedCallback = jest.fn();
      const dataService = new StorageMania(
        new TestStorage(() => Promise.reject("some reason")),
        stateChangedCallback
      );

      await expect(dataService.load()).rejects.toEqual("some reason");

      expect(stateChangedCallback.mock.calls).toEqual([
        [StorageState.Initializing],
        [StorageState.Uninitialized],
      ]);
    });

    test("from Ready to Loading", async () => {
      const stateChangedCallback = jest.fn();
      const dataService = new StorageMania(_, stateChangedCallback);
      await dataService.load();
      stateChangedCallback.mockClear();

      dataService.load();

      expect(stateChangedCallback.mock.calls).toEqual([[StorageState.Loading]]);
    });

    test("from Loading back to Ready", async () => {
      const stateChangedCallback = jest.fn();
      const dataService = new StorageMania(_, stateChangedCallback);
      await dataService.load();
      stateChangedCallback.mockClear();

      await dataService.load();

      expect(stateChangedCallback.mock.calls).toEqual([
        [StorageState.Loading],
        [StorageState.Ready],
      ]);
    });

    test("from Ready to Dirty", async () => {
      const stateChangedCallback = jest.fn();
      const dataService = new StorageMania(_, stateChangedCallback);
      await dataService.load();
      stateChangedCallback.mockClear();

      dataService.set("myKey", "myValue");

      expect(stateChangedCallback.mock.calls).toEqual([[StorageState.Dirty]]);
    });

    test("from Dirty to Saving", async () => {
      const stateChangedCallback = jest.fn();
      const dataService = new StorageMania(_, stateChangedCallback);
      await dataService.load();
      dataService.set("myKey", "myValue");
      stateChangedCallback.mockClear();

      dataService.save();

      expect(stateChangedCallback.mock.calls).toEqual([[StorageState.Saving]]);
    });

    test("from Saving to Ready", async () => {
      const stateChangedCallback = jest.fn();
      const dataService = new StorageMania(_, stateChangedCallback);
      await dataService.load();
      dataService.set("myKey", "myValue");
      stateChangedCallback.mockClear();

      await dataService.save();

      expect(stateChangedCallback.mock.calls).toEqual([
        [StorageState.Saving],
        [StorageState.Ready],
      ]);
    });

    test("from Saving to Dirty when changed", async () => {
      const stateChangedCallback = jest.fn();
      const dataService = new StorageMania(_, stateChangedCallback);
      await dataService.load();
      dataService.set("not", "important");
      stateChangedCallback.mockClear();

      const savePromise = dataService.save();
      dataService.set("not", "important2");
      await savePromise;

      expect(stateChangedCallback.mock.calls).toEqual([
        [StorageState.Saving],
        [StorageState.Dirty],
      ]);
    });

    test("from Saving to Dirty when saving failed", async () => {
      const stateChangedCallback = jest.fn();
      const dataService = new StorageMania(
        new TestStorage(undefined, () => Promise.reject("some reason")),
        stateChangedCallback
      );
      await dataService.load();
      dataService.set("not", "important");
      stateChangedCallback.mockClear();

      await expect(dataService.save()).rejects.toEqual("some reason");

      expect(stateChangedCallback.mock.calls).toEqual([
        [StorageState.Saving],
        [StorageState.Dirty],
      ]);
    });
  });
});

describe("in Uninitialized state", () => {
  const _ = new TestStorage();

  test("get returns null (no data)", () => {
    const dataService = new StorageMania(
      new TestStorage(async () => {
        return JSON.stringify({ myKey: "myValue" });
      })
    );

    expect(dataService.get("myKey")).toBeNull();
  });

  test("set throws error", () => {
    const dataService = new StorageMania(_);

    expect(() => dataService.set("myKey", "myValue")).toThrowError(
      "Uninitialized"
    );
  });

  test("load calls storage.get()", () => {
    const storageGet = jest.fn(() => Promise.resolve("test"));
    const dataService = new StorageMania(new TestStorage(storageGet));

    dataService.load();

    expect(storageGet).toBeCalled();
  });

  test("save does nothing", async () => {
    const storagePut = jest.fn((_) => Promise.resolve());
    const dataService = new StorageMania(
      new TestStorage(undefined, storagePut)
    );

    dataService.save();

    expect(storagePut).not.toBeCalled();
    expect(dataService.state).toBe(StorageState.Uninitialized);
  });
});

describe("in Initializing state", () => {
  const _ = new TestStorage();

  const createStorageManiaInInitializingState = (storage: TestStorage = _) => {
    const ds = new StorageMania(storage);
    ds.load();
    return ds;
  };

  test("get returns null", () => {
    const dataService = createStorageManiaInInitializingState(
      new TestStorage(async () => JSON.stringify({ myKey: "myValue" }))
    );

    expect(dataService.get("myKey")).toBeNull();
  });

  test("set throws error", () => {
    const dataService = createStorageManiaInInitializingState();

    expect(() => dataService.set("myKey", "myValue")).toThrowError(
      "Initializing"
    );
  });

  test("save does nothing", async () => {
    const storagePut = jest.fn((_) => Promise.resolve());
    const storageMock = new TestStorage(undefined, storagePut);
    const dataService = createStorageManiaInInitializingState(storageMock);

    dataService.save();

    expect(storagePut).not.toBeCalled();
    expect(dataService.state).toBe(StorageState.Initializing);
  });

  test("load does not make extra calls to storage", () => {
    const storageGet = jest.fn(() => Promise.resolve("data"));
    const storageMock = new TestStorage(storageGet);
    const dataService = createStorageManiaInInitializingState(storageMock);

    dataService.load();
    dataService.load();
    dataService.load();

    expect(storageGet).toBeCalledTimes(1);
  });
});

describe("in Ready state", () => {
  const _ = new TestStorage(
    () =>
      Promise.resolve(
        JSON.stringify({
          myKey: "myValue",
        })
      ),
    () => Promise.resolve()
  );

  const createStorageManiaInReadyState = async (storage: TestStorage = _) => {
    const dataService = new StorageMania(storage);
    await dataService.load();
    return dataService;
  };

  test("get returns correct value", async () => {
    const dataService = await createStorageManiaInReadyState(
      new TestStorage(async () => {
        return JSON.stringify({
          myKey: "myValue",
        });
      })
    );

    expect(dataService.get("myKey")).toBe("myValue");
  });

  test("set sets correct value", async () => {
    const dataService = await createStorageManiaInReadyState();

    dataService.set("myKey", "someValue123");

    expect(dataService.get("myKey")).toBe("someValue123");
  });

  test("save does nothing", async () => {
    const storagePut = jest.fn((_) => Promise.resolve());
    const dataService = new StorageMania(
      new TestStorage(undefined, storagePut)
    );

    dataService.save();

    expect(storagePut).not.toBeCalled();
    expect(dataService.state).toBe(StorageState.Uninitialized);
  });

  test("load calls storage", async () => {
    const storageGet = jest.fn(() => Promise.resolve(""));
    const dataService = new StorageMania(new TestStorage(storageGet));

    dataService.save();

    expect(storageGet).not.toBeCalled();
    expect(dataService.state).toBe(StorageState.Uninitialized);
  });
});

describe("in Loading state", () => {
  // TODO:
});

describe("in Dirty state", () => {
  test("load throws error", async () => {
    const storagePut = jest.fn((_) => Promise.resolve());
    const storageMock = new TestStorage(undefined, storagePut);
    const dataService = new StorageMania(storageMock);
    await dataService.load();
    dataService.set("make", "dirty");
    expect(dataService.state).toBe(StorageState.Dirty);

    await expect(dataService.load()).rejects.toEqual(
      Error("Cannot call this method when the state is: Dirty")
    );
  });
});

describe("in Saving state", () => {
  test("save does not make extra calls to storage", async () => {
    const storagePut = jest.fn((_) => Promise.resolve());
    const storageMock = new TestStorage(undefined, storagePut);
    const dataService = new StorageMania(storageMock);
    await dataService.load();
    dataService.set("make", "dirty");
    dataService.save();
    expect(dataService.state).toBe(StorageState.Saving);

    dataService.save();
    dataService.save();
    dataService.save();

    expect(storagePut).toBeCalledTimes(1);
  });

  test("load throws error", async () => {
    const storagePut = jest.fn((_) => Promise.resolve());
    const storageMock = new TestStorage(undefined, storagePut);
    const dataService = new StorageMania(storageMock);
    await dataService.load();
    dataService.set("make", "dirty");
    dataService.save();
    expect(dataService.state).toBe(StorageState.Saving);

    await expect(dataService.load()).rejects.toEqual(
      Error("Cannot call this method when the state is: Saving")
    );
  });
});

describe("Method", () => {
  const createStorageManiaInReadyState = async (storage: TestStorage) => {
    const dataService = new StorageMania(storage);
    await dataService.load();
    return dataService;
  };

  test("get returns a deep copy of stored value", async () => {
    const dataService = await createStorageManiaInReadyState(
      new TestStorage(async () => {
        return JSON.stringify({ myKey: [1, 2, 3] });
      })
    );

    (dataService.get("myKey") as Array<number>)[0] = 4;

    expect(dataService.get("myKey")).toEqual([1, 2, 3]);
  });

  test("set sets a deep copy of provided value", async () => {
    const dataService = await createStorageManiaInReadyState(
      new TestStorage(async () => {
        return JSON.stringify({ myKey: [1, 2, 3] });
      })
    );

    const arr = [1, 2, 3];
    dataService.set("key1", arr);
    arr.push(4);

    expect(dataService.get("key1")).toEqual([1, 2, 3]);
  });

  test("set triggers callback when data has changed", async () => {
    const dataChangedCallback = jest.fn();
    const dataService = new StorageMania(
      new TestStorage(),
      undefined,
      dataChangedCallback
    );
    await dataService.load();

    dataService.set("myKey", "someValue123");

    expect(dataChangedCallback).toBeCalledWith("myKey");
  });

  test("set does not trigger callback when data is no different", async () => {
    const dataChangedCallback = jest.fn();
    const dataService = new StorageMania(
      new TestStorage(() =>
        Promise.resolve(JSON.stringify({ myKey: "someValue123" }))
      ),
      undefined,
      dataChangedCallback
    );
    await dataService.load();
    dataChangedCallback.mockClear();

    dataService.set("myKey", "someValue123");

    expect(dataChangedCallback).not.toBeCalled();
  });

  test("set does not change state when value is not different", async () => {
    const dataService = await createStorageManiaInReadyState(
      new TestStorage(async () => {
        return JSON.stringify({
          myKey: "the same value",
        });
      })
    );

    dataService.set("myKey", "the same value");

    expect(dataService.state).toBe(StorageState.Ready);
  });

  test("load correctly parses simple json", async () => {
    const dataService = await createStorageManiaInReadyState(
      new TestStorage(() =>
        Promise.resolve(JSON.stringify({ myKey: "myValue" }))
      )
    );

    expect(dataService.get("myKey")).toBe("myValue");
  });

  test("load correctly parses complex json", async () => {
    const dataService = await createStorageManiaInReadyState(
      new TestStorage(async () => {
        return JSON.stringify({
          myKey1: ["myValue"],
          myKey2: {
            subkey1: 123,
            subkey2: 0.123456,
            subkey3: ["str1", "str2"],
            subkey4: null,
            subkey5: [1, 2, 3],
          },
        });
      })
    );

    expect(dataService.get("myKey1")).toEqual(["myValue"]);
    expect(dataService.get("myKey2")).not.toBeNull();
    expect((dataService.get("myKey2") as any).subkey1).toEqual(123);
    expect((dataService.get("myKey2") as any).subkey2).toEqual(0.123456);
    expect((dataService.get("myKey2") as any).subkey3).toEqual([
      "str1",
      "str2",
    ]);
    expect((dataService.get("myKey2") as any).subkey4).toBeNull();
    expect((dataService.get("myKey2") as any).subkey5).toEqual([1, 2, 3]);
  });

  test("load handles empty storage", async () => {
    const dataService = new StorageMania(
      new TestStorage(async () => "", undefined)
    );

    await dataService.load();

    expect(dataService.get("someKey")).toBeNull();
  });

  test('load handles invalid storage ("}}}")', async () => {
    const dataService = new StorageMania(
      new TestStorage(async () => "}}}", undefined)
    );

    dataService.load();

    expect(dataService.get("someKey")).toBeNull();
  });

  test("load handles invalid storage ('null')", async () => {
    const dataService = new StorageMania(
      new TestStorage(async () => "null", undefined)
    );

    await dataService.load();

    expect(dataService.get("someKey")).toBeNull();
  });

  test("getKeys returns all keys in storage", async () => {
    const dataService = await createStorageManiaInReadyState(
      new TestStorage(() =>
        Promise.resolve(
          JSON.stringify({ myKey1: "myValue1", myKey2: "myValue2" })
        )
      )
    );

    expect(dataService.getKeys()).toEqual(["myKey1", "myKey2"]);
  });
});
