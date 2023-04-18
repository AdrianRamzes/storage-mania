import { DataService, DataServiceState } from "../src/data-service";
import { Storage } from "../src/storage";

/** TODO: Check what if starage returns {'key': null}
 * and check repositoreis how do they react to that?
 */

class TestStorage implements Storage {
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

describe("DataService", () => {
  const _ = new TestStorage();

  test("is in Uninitialized state after creation", async () => {
    const dataService = new DataService(_);

    expect(dataService.state).toBe(DataServiceState.Uninitialized);
  });

  // Uninitialized -load()-> Initializing
  test("is in Initializing state after load() is called for the first time", () => {
    const dataService = new DataService(_);

    dataService.load();

    expect(dataService.state).toBe(DataServiceState.Initializing);
  });

  // Uninitialized -load() finished-> Ready
  test("is in Ready state after first load() is finished", async () => {
    const dataService = new DataService(_);

    await dataService.load();

    expect(dataService.state).toBe(DataServiceState.Ready);
  });

  // Uninitialized -load() failed-> Uninitialized
  test("stays in Uninitialized state when load() failed", async () => {
    const dataService = new DataService(
      new TestStorage(() => Promise.reject("some reason"))
    );

    await expect(dataService.load()).rejects.toEqual("some reason");

    expect(dataService.state).toBe(DataServiceState.Uninitialized);
  });

  // Ready -load()-> Loading
  test("is in Loading state after load() is called", async () => {
    const dataService = new DataService(_);
    await dataService.load();
    expect(dataService.state).toBe(DataServiceState.Ready);

    dataService.load();

    expect(dataService.state).toBe(DataServiceState.Loading);
  });

  // Ready -await load()-> Ready
  test("is back in Ready state after load() is called", async () => {
    const dataService = new DataService(_);
    await dataService.load();
    expect(dataService.state).toBe(DataServiceState.Ready);

    await dataService.load();

    expect(dataService.state).toBe(DataServiceState.Ready);
  });

  // Ready -save()-> Ready
  test("stays in Ready state after save() is called", async () => {
    const dataService = new DataService(_);
    await dataService.load();
    expect(dataService.state).toBe(DataServiceState.Ready);

    dataService.save();

    expect(dataService.state).toBe(DataServiceState.Ready);
  });

  // Ready -set()-> Dirty
  test("is in Dirty state after set() is called", async () => {
    const dataService = new DataService(_);
    await dataService.load();
    expect(dataService.state).toBe(DataServiceState.Ready);

    dataService.set("key1", "value1");

    expect(dataService.state).toBe(DataServiceState.Dirty);
  });

  // Dirty -save()-> Saving
  test("is in Saving state after save() is called", async () => {
    const dataService = new DataService(_);
    await dataService.load();
    dataService.set("key1", "value1");
    expect(dataService.state).toBe(DataServiceState.Dirty);

    dataService.save();

    expect(dataService.state).toBe(DataServiceState.Saving);
  });

  // Saving -save() finished-> Ready
  test("is back in Ready state after save() is finished", async () => {
    const dataService = new DataService(_);
    await dataService.load();
    dataService.set("key1", "value1");
    const savePromise = dataService.save();
    expect(dataService.state).toBe(DataServiceState.Saving);

    await savePromise;

    expect(dataService.state).toBe(DataServiceState.Ready);
  });

  // Saving -save() failed-> Dirty
  test("stays in Dirty state when save failed", async () => {
    const dataService = new DataService(
      new TestStorage(undefined, () => Promise.reject("some reason"))
    );
    await dataService.load();
    dataService.set("key1", "value1");
    const savePromise = dataService.save();
    expect(dataService.state).toBe(DataServiceState.Saving);

    await expect(savePromise).rejects.toEqual("some reason");

    expect(dataService.state).toBe(DataServiceState.Dirty);
  });

  // Saving -set()-> Dirty
  test("is back in Dirty state when set was called while saving", async () => {
    const dataService = new DataService(_);
    await dataService.load();
    dataService.set("key1", "value1");
    const savePromise = dataService.save();
    expect(dataService.state).toBe(DataServiceState.Saving);

    dataService.set("key2", "value2");
    await savePromise;

    expect(dataService.state).toBe(DataServiceState.Dirty);
  });

  describe("calls back when state changed", () => {
    test("from Uninitialized to Initializing", () => {
      const stateChangedCallback = jest.fn();
      const dataService = new DataService(_, stateChangedCallback);

      dataService.load();

      expect(stateChangedCallback.mock.calls).toEqual([
        [DataServiceState.Initializing],
      ]);
    });

    test("from Initializing to Ready", async () => {
      const stateChangedCallback = jest.fn();
      const dataService = new DataService(_, stateChangedCallback);

      await dataService.load();

      expect(stateChangedCallback.mock.calls).toEqual([
        [DataServiceState.Initializing],
        [DataServiceState.Ready],
      ]);
    });

    test("from Initializing back to Uninitialized", async () => {
      const stateChangedCallback = jest.fn();
      const dataService = new DataService(
        new TestStorage(() => Promise.reject("some reason")),
        stateChangedCallback
      );

      await expect(dataService.load()).rejects.toEqual("some reason");

      expect(stateChangedCallback.mock.calls).toEqual([
        [DataServiceState.Initializing],
        [DataServiceState.Uninitialized],
      ]);
    });

    test("from Ready to Loading", async () => {
      const stateChangedCallback = jest.fn();
      const dataService = new DataService(_, stateChangedCallback);
      await dataService.load();
      stateChangedCallback.mockReset();

      dataService.load();

      expect(stateChangedCallback.mock.calls).toEqual([
        [DataServiceState.Loading],
      ]);
    });

    test("from Loading back to Ready", async () => {
      const stateChangedCallback = jest.fn();
      const dataService = new DataService(_, stateChangedCallback);
      await dataService.load();
      stateChangedCallback.mockReset();

      await dataService.load();

      expect(stateChangedCallback.mock.calls).toEqual([
        [DataServiceState.Loading],
        [DataServiceState.Ready],
      ]);
    });

    test("from Ready to Dirty", async () => {
      const stateChangedCallback = jest.fn();
      const dataService = new DataService(_, stateChangedCallback);
      await dataService.load();
      stateChangedCallback.mockReset();

      dataService.set("myKey", "myValue");

      expect(stateChangedCallback.mock.calls).toEqual([
        [DataServiceState.Dirty],
      ]);
    });

    test("from Dirty to Saving", async () => {
      const stateChangedCallback = jest.fn();
      const dataService = new DataService(_, stateChangedCallback);
      await dataService.load();
      dataService.set("myKey", "myValue");
      stateChangedCallback.mockReset();

      dataService.save();

      expect(stateChangedCallback.mock.calls).toEqual([
        [DataServiceState.Saving],
      ]);
    });

    test("from Saving to Ready", async () => {
      const stateChangedCallback = jest.fn();
      const dataService = new DataService(_, stateChangedCallback);
      await dataService.load();
      dataService.set("myKey", "myValue");
      stateChangedCallback.mockReset();

      await dataService.save();

      expect(stateChangedCallback.mock.calls).toEqual([
        [DataServiceState.Saving],
        [DataServiceState.Ready],
      ]);
    });

    test("from Saving to Dirty when changed", async () => {
      const stateChangedCallback = jest.fn();
      const dataService = new DataService(_, stateChangedCallback);
      await dataService.load();
      dataService.set("not", "important");
      stateChangedCallback.mockReset();

      const savePromise = dataService.save();
      dataService.set("not", "important2");
      await savePromise;

      expect(stateChangedCallback.mock.calls).toEqual([
        [DataServiceState.Saving],
        [DataServiceState.Dirty],
      ]);
    });

    test("from Saving to Dirty when saving failed", async () => {
      const stateChangedCallback = jest.fn();
      const dataService = new DataService(
        new TestStorage(undefined, () => Promise.reject("some reason")),
        stateChangedCallback
      );
      await dataService.load();
      dataService.set("not", "important");
      stateChangedCallback.mockReset();

      await expect(dataService.save()).rejects.toEqual("some reason");

      expect(stateChangedCallback.mock.calls).toEqual([
        [DataServiceState.Saving],
        [DataServiceState.Dirty],
      ]);
    });
  });
});

describe("in Uninitialized state", () => {
  const _ = new TestStorage();

  test("get returns null (no data)", () => {
    const dataService = new DataService(
      new TestStorage(async () => {
        return JSON.stringify({ myKey: "myValue" });
      })
    );

    expect(dataService.get("myKey")).toBeNull();
  });

  test("set throws error", () => {
    const dataService = new DataService(_);

    expect(() => dataService.set("myKey", "myValue")).toThrowError(
      "Uninitialized"
    );
  });

  test("save does nothing", async () => {
    const dataService = new DataService(_);

    await dataService.save();

    expect(dataService.state).toBe(DataServiceState.Uninitialized);
  });
});

describe("in Initializing state", () => {
  const _ = new TestStorage();

  const getDataServiceInInitializingState = (storage: TestStorage = _) => {
    const ds = new DataService(storage);
    ds.load();
    return ds;
  };

  test("returns null when get is called (no data)", () => {
    const dataService = getDataServiceInInitializingState(
      new TestStorage(async () => JSON.stringify({ myKey: "myValue" }))
    );

    expect(dataService.get("myKey")).toBeNull();
  });

  test("throws error when set is called", () => {
    const dataService = getDataServiceInInitializingState();

    expect(() => dataService.set("myKey", "myValue")).toThrowError(
      "Initializing"
    );
  });

  test("does nothing when save is called (not dirty)", async () => {
    const dataService = getDataServiceInInitializingState();

    await dataService.save();

    expect(dataService.state).toBe(DataServiceState.Ready);
  });

  // test('does not make duplicate requests when load is called multiple times', async () => {
  //     const storage = createDummyStorage();
  //     spyOn(storage, 'get').and.callThrough();
  //     const dataService = getDataServiceInInitializingState(storage);

  //     await Promise.all([
  //         dataService.load(),
  //         dataService.load(),
  //         dataService.load(),
  //     ]);

  //     expect(storage.get).toHaveBeenCalledTimes(1);
  // });

  // test('does nothing when save is called (not dirty)', async () => {
  //     const storage = createDummyStorage();
  //     spyOn(storage, 'put').and.callThrough();
  //     const dataService = getDataServiceInInitializingState();

  //     await expectAsync(dataService.save()).toBeResolved();

  //     expect(storage.put).not.toHaveBeenCalled();
  // });

  // test('handles empty storage', async () => {
  //     const storage = new TestStorage(async () => '', async () => { });
  //     const dataService = getDataServiceInInitializingState(storage);

  //     await expectAsync(dataService.load()).toBeResolved();

  //     expect(dataService.get('someKey')).toBeNull();
  // });

  // test('handles invalid storage ("}}}")', async () => {
  //     const storage = new TestStorage(async () => '}}}', async () => { });
  //     const dataService = getDataServiceInInitializingState(storage);

  //     await expectAsync(dataService.load()).toBeResolved();

  //     expect(dataService.get('someKey')).toBeNull();
  // });

  // test('handles invalid storage (null)', async () => {
  //     const storage = new TestStorage(async () => null, async () => { });
  //     const dataService = getDataServiceInInitializingState(storage);

  //     await expectAsync(dataService.load()).toBeResolved();

  //     expect(dataService.get('someKey')).toBeNull();
  // });

  // test('handles invalid storage ("null")', async () => {
  //     const storage = new TestStorage(async () => 'null', async () => { });
  //     const dataService = getDataServiceInInitializingState(storage);

  //     await expectAsync(dataService.load()).toBeResolved();

  //     expect(dataService.get('someKey')).toBeNull();
  // });

  // test('emits event when state has been changed to ready', async () => {
  //     const dataService = getDataServiceInInitializingState();
  //     spyOn(dataService.stateChanged, 'emit').and.callThrough();

  //     await dataService.load();

  //     expect(dataService.stateChanged.emit).toHaveBeenCalledWith(DataServiceState.Ready);
  // });

  // test('changes state to uninitialized when initializing is rejected', async () => {
  //     const storage = new TestStorage(() => Promise.reject(new Error('Some Error 123')));
  //     const dataService = new DataService(storage, true);
  //     const loadingPromise = dataService.load();
  //     expect(dataService.state).toBe(DataServiceState.Initializing);

  //     await expectAsync(loadingPromise).toBeRejected();

  //     expect(dataService.state).toBe(DataServiceState.Uninitialized);
  // });

  // test('emits event when state has been changed to uninitialized', async () => {
  //     const storage = new TestStorage(() => Promise.reject(new Error('Some Error 456')));
  //     const dataService = new DataService(storage, true);
  //     const loadingPromise = dataService.load();
  //     expect(dataService.state).toBe(DataServiceState.Initializing);
  //     spyOn(dataService.stateChanged, 'emit').and.callThrough();

  //     await expectAsync(loadingPromise).toBeRejected();

  //     expect(dataService.stateChanged.emit).toHaveBeenCalledWith(DataServiceState.Uninitialized);
  // });
});

describe("in Ready state", () => {
  const createDummyStorage = () => {
    return new TestStorage(
      async () => {
        return JSON.stringify({
          myKey: "myValue",
        });
      },
      async () => {}
    );
  };

  const createDataServiceInReadyState = async (
    storage: TestStorage = createDummyStorage()
  ) => {
    const dataService = new DataService(storage);
    await dataService.load(); // initializing
    // here is Ready
    return dataService;
  };

  // test('returns correct value when get is called', async () => {
  //     const dataService = await createDataServiceInReadyState(new TestStorage(async () => {
  //         return JSON.stringify({
  //             myKey: 'myValue'
  //         });
  //     }));

  //     expect(dataService.get('myKey')).toBe('myValue');
  // });

  // test('sets correct value when set is called', async () => {
  //     const dataService = await createDataServiceInReadyState();

  //     dataService.set('myKey', 'someValue123');
  //     expect(dataService.get('myKey')).toBe('someValue123');
  // });

  // test('returns a deep copy of the real value when get is called', async () => {
  //     const storage = new TestStorage(async () => {
  //         return JSON.stringify({myKey: [1, 2, 3]});
  //     });
  //     const dataService = await createDataServiceInReadyState(storage);
  //     let value = dataService.get('myKey');

  //     value[0] = 4;
  //     value = dataService.get('myKey');

  //     expect(value).toEqual([1, 2, 3]);
  // });

  // test('emits data changed event when set is called', async () => {
  //     const dataService = await createDataServiceInReadyState();
  //     spyOn(dataService.dataChanged, 'emit').and.callThrough();

  //     dataService.set('myKey', 'someValue123');

  //     expect(dataService.dataChanged.emit).toHaveBeenCalledWith('myKey');
  // });

  // test('returns promise when load is called', async () => {
  //     const storage = createDummyStorage();
  //     const dataService = await createDataServiceInReadyState(storage);
  //     spyOn(storage, 'get').and.callThrough();

  //     const loadPromise = dataService.load();

  //     expect(loadPromise instanceof Promise).toBeTruthy();
  //     expect(storage.get).toHaveBeenCalledTimes(1);
  // });

  // test('does not make duplicate requests when load is called multiple times', async () => {
  //     const storage = createDummyStorage();
  //     const dataService = await createDataServiceInReadyState(storage);
  //     spyOn(storage, 'get').and.callThrough();

  //     await Promise.all([
  //         dataService.load(),
  //         dataService.load(),
  //         dataService.load(),
  //     ]);

  //     expect(storage.get).toHaveBeenCalledTimes(1);
  // });

  // test('loads correct simple json', async () => {
  //     const dataService = await createDataServiceInReadyState();

  //     expect(dataService.get('myKey')).toBe('myValue');
  // });

  // test('loads correct complex json', async () => {
  //     const storage = new TestStorage(async () => {
  //         return JSON.stringify({
  //             myKey1: ['myValue'],
  //             myKey2: {
  //                 subkey1: 123,
  //                 subkey2: 0.123456,
  //                 subkey3: ['str1', 'str2'],
  //                 subkey4: null,
  //                 subkey5: [1, 2, 3]
  //             }
  //         });
  //     });
  //     const dataService = await createDataServiceInReadyState(storage);

  //     expect(dataService.get('myKey1')).toEqual(['myValue']);
  //     expect(dataService.get('myKey2')).not.toBeNull();
  //     expect(dataService.get('myKey2').subkey1).toEqual(123);
  //     expect(dataService.get('myKey2').subkey2).toEqual(0.123456);
  //     expect(dataService.get('myKey2').subkey3).toEqual(['str1', 'str2']);
  //     expect(dataService.get('myKey2').subkey4).toBeNull();
  //     expect(dataService.get('myKey2').subkey5).toEqual([1, 2, 3]);
  // });

  // test('does nothing when save is called (not dirty)', async () => {
  //     const storage = createDummyStorage();
  //     spyOn(storage, 'put').and.callThrough();
  //     const dataService = await createDataServiceInReadyState(storage);

  //     await dataService.save();

  //     expect(storage.put).not.toHaveBeenCalled();
  // });

  // test('changes state to loading when load is called', async () => {
  //     const dataService = await createDataServiceInReadyState();

  //     dataService.load();

  //     expect(dataService.state).toBe(DataServiceState.Loading);
  // });

  // test('emits event when state has been changed to dirty', async () => {
  //     const dataService = await createDataServiceInReadyState();
  //     spyOn(dataService.stateChanged, 'emit').and.callThrough();

  //     dataService.load();

  //     expect(dataService.stateChanged.emit).toHaveBeenCalledWith(DataServiceState.Loading);
  // });

  // test('changes state to dirty when set is called', async () => {
  //     const dataService = await createDataServiceInReadyState();

  //     dataService.set('myKey', 'newValue');
  //     expect(dataService.state).toBe(DataServiceState.Dirty);
  // });

  // test('emits event when state has been changed to dirty', async () => {
  //     const dataService = await createDataServiceInReadyState();
  //     spyOn(dataService.stateChanged, 'emit').and.callThrough();

  //     dataService.set('myKey', 'newValue');

  //     expect(dataService.stateChanged.emit).toHaveBeenCalledWith(DataServiceState.Dirty);
  // });

  // test('does not change state when set does not change value', async () => {
  //     const storage = new TestStorage(async () => {
  //         return JSON.stringify({
  //             myKey: 'oldValue'
  //         });
  //     });
  //     const dataService = await createDataServiceInReadyState(storage);

  //     dataService.set('myKey', 'oldValue');
  //     expect(dataService.state).toBe(DataServiceState.Ready);
  // });
});

describe("in Loading state", () => {
  // TODO:
});

describe("in Dirty state", () => {
  // TODO:
});

describe("in Saving state", () => {
  // TODO:
});

// describe('DataSevice Loading', () => {

//     const createDummyStorage = () => {
//         return new TestStorage(async () => {
//             return JSON.stringify({
//                 myKey: 'myValue'
//             });
//         }, async () => {});
//     };

//     test('is in the loading state', async () => {
//         const dataService = new DataService(createDummyStorage());
//         await dataService.load(); // initializing
//         dataService.load(); // start loading

//         expect(dataService.state).toBe(DataServiceState.Loading);
//     });

//     test('returns correct value when get is called', async () => {
//         const dataService = new DataService(createDummyStorage());
//         await dataService.load(); // initializing
//         dataService.load(); // start loading

//         expect(dataService.get('myKey')).toBe('myValue');
//     });

//     test('throws error when set is called', async () => {
//         const dataService = new DataService(createDummyStorage());
//         await dataService.load(); // initializing
//         dataService.load(); // start loading

//         expect(dataService.state).toBe(DataServiceState.Loading);
//         expect(() => dataService.set('test', 'test')).toThrowError('Loading');
//     });

//     test('does not make duplicate requests when load is called', async () => {
//         const storage = createDummyStorage();
//         const dataService = new DataService(storage);
//         await dataService.load(); // initializing
//         spyOn(storage, 'get').and.callThrough();
//         dataService.load(); // start loading

//         await Promise.all([
//             dataService.load(),
//             dataService.load(),
//             dataService.load(),
//         ]);

//         expect(storage.get).toHaveBeenCalledTimes(1);
//     });

//     test('does nothing when save is called (not dirty)', async () => {
//         const storage = createDummyStorage();
//         spyOn(storage, 'put').and.callThrough();
//         const dataService = new DataService(storage);
//         await dataService.load(); // initializing
//         dataService.load(); // start loading

//         await dataService.save();

//         expect(storage.put).not.toHaveBeenCalled();
//     });

//     test('changes state to ready when promise is rejected', async () => {
//         let firstCall = true;
//         const storage = new TestStorage(() => {
//             if (firstCall) {
//                 firstCall = false;
//                 return Promise.resolve(JSON.stringify({myKey: 'myValue'}));
//             }
//             return Promise.reject();
//         });
//         const dataService = new DataService(storage);
//         await dataService.load(); // initializing
//         dataService.load(); // start loading

//         expect(dataService.state).toBe(DataServiceState.Loading);
//         await expectAsync(dataService.load()).toBeRejected();

//         expect(dataService.state).toBe(DataServiceState.Ready);
//     });

//     test('emits event when state has been changed to ready after rejection', async () => {
//         let firstCall = true;
//         const storage = new TestStorage(() => {
//             if (firstCall) {
//                 firstCall = false;
//                 return Promise.resolve(JSON.stringify({myKey: 'myValue'}));
//             }
//             return Promise.reject();
//         });
//         const dataService = new DataService(storage);
//         await dataService.load(); // initializing
//         dataService.load(); // start loading

//         spyOn(dataService.stateChanged, 'emit').and.callThrough();
//         await expectAsync(dataService.load()).toBeRejected();

//         expect(dataService.stateChanged.emit).toHaveBeenCalledWith(DataServiceState.Ready);
//     });

//     test('changes state to ready when promise is resolved', async () => {
//         const dataService = new DataService(createDummyStorage());
//         await dataService.load(); // initializing
//         dataService.load(); // start loading

//         expect(dataService.state).toBe(DataServiceState.Loading);
//         await expectAsync(dataService.load()).toBeResolved();

//         expect(dataService.state).toBe(DataServiceState.Ready);
//     });

//     test('emits event when state has been changed to ready after resolve', async () => {
//         const dataService = new DataService(createDummyStorage());
//         await dataService.load(); // initializing
//         dataService.load(); // start loading

//         spyOn(dataService.stateChanged, 'emit').and.callThrough();
//         await expectAsync(dataService.load()).toBeResolved();

//         expect(dataService.stateChanged.emit).toHaveBeenCalledWith(DataServiceState.Ready);
//     });
// });

// describe('DataSevice Dirty', () => {

//     const createDummyStorage = () => {
//         return new TestStorage(async () => {
//             return JSON.stringify({
//                 myKey: 'myValue'
//             });
//         }, async () => {});
//     };

//     const getDataServiceInDirtyState = async (storage: TestStorage = createDummyStorage()) => {
//         const dataService = new DataService(storage);
//         await dataService.load(); // initializing
//         dataService.set('myKey', 'newValue');
//         return dataService;
//     };

//     test('is in dirty state', async () => {
//         const dataService1 = await getDataServiceInDirtyState();
//         const storage2 = createDummyStorage();
//         const dataService2 = await getDataServiceInDirtyState(storage2);

//         expect(dataService1.state).toBe(DataServiceState.Dirty);
//         expect(dataService2.state).toBe(DataServiceState.Dirty);
//     });

//     test('returns correct value when get is called', async () => {
//         const dataService = await getDataServiceInDirtyState();

//         expect(dataService.get('myKey')).toBe('newValue');
//     });

//     test('sets correct value when set is called', async () => {
//         const dataService = await getDataServiceInDirtyState();

//         dataService.set('myKey', 'someValue123');

//         expect(dataService.get('myKey')).toBe('someValue123');
//     });

//     test('emits data changed event when set is called', async () => {
//         const dataService = await getDataServiceInDirtyState();
//         spyOn(dataService.dataChanged, 'emit').and.callThrough();

//         dataService.set('myKey', 'someValue123');

//         expect(dataService.dataChanged.emit).toHaveBeenCalledWith('myKey');
//     });

//     test('throws error when load is called', async () => {
//         const dataService = await getDataServiceInDirtyState();

//         await expectAsync(dataService.load()).toBeRejected('Dirty');
//     });

//     test('returns promise when save is called', async () => {
//         const storage = createDummyStorage();
//         const dataService = await getDataServiceInDirtyState(storage);
//         spyOn(storage, 'put').and.callThrough();

//         await expectAsync(dataService.save()).toBeResolved();

//         expect(storage.put).toHaveBeenCalled();
//     });

//     test('does not make duplicate requests when save is called multiple times', async () => {
//         const storage = createDummyStorage();
//         const dataService = await getDataServiceInDirtyState(storage);
//         spyOn(storage, 'put').and.callThrough();

//         await Promise.all([
//             dataService.save(),
//             dataService.save(),
//             dataService.save(),
//         ]);

//         expect(storage.put).toHaveBeenCalledTimes(1);
//     });

//     test('does not change state when set is called', async () => {
//         const dataService = await getDataServiceInDirtyState();

//         expect(dataService.state).toBe(DataServiceState.Dirty);
//         dataService.set('myKey', 'someValye123');

//         expect(dataService.state).toBe(DataServiceState.Dirty);
//     });

//     test('changes state to saving when save is called', async () => {
//         const dataService = await getDataServiceInDirtyState();

//         dataService.save();

//         expect(dataService.state).toBe(DataServiceState.Saving);
//     });

//     test('emits event when state has been changed to saving', async () => {
//         const dataService = await getDataServiceInDirtyState();
//         spyOn(dataService.stateChanged, 'emit').and.callThrough();

//         dataService.save();

//         expect(dataService.stateChanged.emit).toHaveBeenCalledWith(DataServiceState.Saving);
//     });
// });

// describe('DataSevice Saving', () => {
//     const createDummyStorage = () => {
//         return new TestStorage(async () => {
//             return JSON.stringify({
//                 myKey: 'myValue'
//             });
//         }, async () => {});
//     };

//     const getDataServiceInDirtyState = async (storage: TestStorage = createDummyStorage()) => {
//         const dataService = new DataService(storage);
//         await dataService.load(); // initializing
//         dataService.set('myKey', 'newValue');
//         return dataService;
//     };

//     test('is in saving state', async () => {
//         const dataService = await getDataServiceInDirtyState();
//         dataService.save();

//         expect(dataService.state).toBe(DataServiceState.Saving);
//     });

//     test('returns correct value when get is called', async () => {
//         const dataService = await getDataServiceInDirtyState();
//         dataService.save();

//         expect(dataService.get('myKey')).toBe('newValue');
//     });

//     test('sets correct value when set is called', async () => {
//         const dataService = await getDataServiceInDirtyState();
//         dataService.save();

//         dataService.set('myKey', 'someValue123');

//         expect(dataService.get('myKey')).toBe('someValue123');
//     });

//     test('emits data changed event when set is called', async () => {
//         const dataService = await getDataServiceInDirtyState();
//         dataService.save();
//         spyOn(dataService.dataChanged, 'emit').and.callThrough();

//         dataService.set('myKey', 'someValue123');

//         expect(dataService.dataChanged.emit).toHaveBeenCalledWith('myKey');
//     });

//     test('throws error when load is called', async () => {
//         const dataService = await getDataServiceInDirtyState();
//         dataService.save();

//         await expectAsync(dataService.load()).toBeRejected('Saving');
//     });

//     test('does not make duplicate requests when save is called', async () => {
//         const storage = createDummyStorage();
//         const dataService = await getDataServiceInDirtyState(storage);
//         spyOn(storage, 'put').and.callThrough();
//         dataService.save();

//         await Promise.all([
//             dataService.save(),
//             dataService.save(),
//             dataService.save(),
//         ]);

//         expect(storage.put).toHaveBeenCalledTimes(1);
//     });

//     test('changes state to ready when promise is resolved', async () => {
//         const dataService = await getDataServiceInDirtyState();
//         dataService.save();

//         await expectAsync(dataService.save()).toBeResolved();

//         expect(dataService.state).toBe(DataServiceState.Ready);
//     });

//     test('emits event when state has been changed to ready', async () => {
//         const dataService = await getDataServiceInDirtyState();
//         spyOn(dataService.stateChanged, 'emit').and.callThrough();

//         await dataService.save();

//         expect(dataService.stateChanged.emit).toHaveBeenCalledWith(DataServiceState.Ready);
//     });

//     test('changes state to dirty when promise is rejected', async () => {
//         const storage = new TestStorage(
//             async () => JSON.stringify({myKey: 'myValue'}),
//             () => Promise.reject()
//         );
//         const dataService = await getDataServiceInDirtyState(storage);
//         dataService.save();

//         await expectAsync(dataService.save()).toBeRejected();

//         expect(dataService.state).toBe(DataServiceState.Dirty);
//     });

//     test('emits event when state has been changed to dirty after rejection', async () => {
//         const storage = new TestStorage(
//             async () => JSON.stringify({myKey: 'myValue'}),
//             () => Promise.reject()
//         );
//         const dataService = await getDataServiceInDirtyState(storage);
//         dataService.save();
//         spyOn(dataService.stateChanged, 'emit').and.callThrough();

//         await expectAsync(dataService.save()).toBeRejected();

//         expect(dataService.stateChanged.emit).toHaveBeenCalledWith(DataServiceState.Dirty);
//     });

//     test('changes state to dirty when promise is resolved but set was called', async () => {
//         const dataService = await getDataServiceInDirtyState();
//         dataService.save();
//         expect(dataService.state).toBe(DataServiceState.Saving);

//         dataService.set('someKey', 'someValue');
//         await expectAsync(dataService.save()).toBeResolved();

//         expect(dataService.state).toBe(DataServiceState.Dirty);
//     });

//     test('emits event when state has been changed to dirty after resolve', async () => {
//         const dataService = await getDataServiceInDirtyState();
//         dataService.save();
//         spyOn(dataService.stateChanged, 'emit').and.callThrough();

//         dataService.set('someKey', 'someValue');
//         await dataService.save();

//         expect(dataService.stateChanged.emit).toHaveBeenCalledWith(DataServiceState.Dirty);
//     });
// });
