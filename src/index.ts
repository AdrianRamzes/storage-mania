export interface RemoteStorage {
  put(data: string): Promise<void>;
  get(): Promise<string>;
}

/** Use it for tests */
export interface KeyValueStorage {
  containsKey(key: string): boolean;
  getKeys(): string[];
  get(key: string): string | null;
  set(key: string, value: string): void;
  /**
   * Loads data from remote storage.
   */
  load(): Promise<void>;
  /**
   * Saves data into remote storage.
   * Calls remote storage only if dirty.
   */
  save(): Promise<void>;
}

export enum StorageState {
  Uninitialized = "Uninitialized",
  Initializing = "Initializing",
  Loading = "Loading",
  Ready = "Ready",
  Dirty = "Dirty",
  Saving = "Saving",
}

/**
 *                   |  loading  |  dirty   |   saving  |   initialized
 * ------------------+-----------+----------+-----------+--------------
 * Uninitialized     |  false    |  false   |   false   |   false
 * Initializing      |  true     |  false   |   false   |   false
 * Ready:            |  false    |  false   |   false   |   true
 * Dirty:            |  false    |  true    |   false   |   true
 * Saving:           |  false    |  true    |   true    |   true
 * Loading:          |  true     |  false   |   false   |   true
 *
 */

/**
 * Check out: {@link https://drive.google.com/file/d/1UZJ-UiKBhspE8GxhW0BZRoCXe_E_jEaT/view?usp=sharing | States Diagram}
 */
export class StorageMania implements KeyValueStorage {
  get state(): StorageState {
    return this.getState();
  }

  private initialized = false;
  private dirty = false;
  private loading = false;
  private saving = false;

  private data: { [key: string]: string } = {};
  private storageGetPromise: Promise<string> | null = null;
  private storagePutPromise: Promise<void> | null = null;
  private changedWhileSaving = false;

  constructor(
    private storage: RemoteStorage,
    private stateChangedCallback?: (_: StorageState) => void,
    private dataChangedCallback?: (_: string) => void
  ) {}

  containsKey(key: string): boolean {
    return key in this.data;
  }

  getKeys() {
    return [...Object.keys(this.data)];
  }

  get(key: string): string | null {
    if (!this.containsKey(key)) {
      return null;
    }
    return this.data[key];
  }

  set(key: string, value: string) {
    const disallowedStates = [
      StorageState.Uninitialized,
      StorageState.Initializing,
      StorageState.Loading,
    ];
    if (disallowedStates.some((x) => x === this.state)) {
      throw Error(`Cannot use set() when storage is in ${this.state} state`);
    }
    if (this.containsKey(key) && this.get(key) == value) {
      return;
    }
    this.data[key] = value;
    this.dataChangedCallback?.(key);
    if (!this.dirty) {
      this.dirty = true;
      this.stateChangedCallback?.(this.state);
    }
    if (this.saving) {
      this.changedWhileSaving = true;
    }
  }

  /**
   * Loads data from storage.
   */
  async load(): Promise<void> {
    const disallowedStates = [StorageState.Dirty, StorageState.Saving];
    if (disallowedStates.some((x) => x === this.state)) {
      throw Error(`Cannot use load() when storage is in ${this.state} state`);
    }
    if (this.storageGetPromise == null) {
      this.loading = true;
      this.stateChangedCallback?.(this.state);
      try {
        this.storageGetPromise = this.storage.get();
        this.loadFromString(await this.storageGetPromise);
        this.storageGetPromise = null;
        if (!this.initialized) {
          this.initialized = true;
        }
      } finally {
        this.loading = false;
        this.stateChangedCallback?.(this.state);
      }
    } else {
      await this.storageGetPromise;
    }
  }

  /**
   * Saves data into storage.
   * Calls storage only if dirty.
   */
  async save(): Promise<void> {
    if (
      this.state === StorageState.Dirty ||
      this.state === StorageState.Saving
    ) {
      if (this.storagePutPromise == null) {
        this.saving = true;
        this.stateChangedCallback?.(this.state);
        try {
          this.storagePutPromise = this.storage.put(JSON.stringify(this.data));
          await this.storagePutPromise;
          this.dirty = this.changedWhileSaving;
        } finally {
          this.saving = false;
          this.stateChangedCallback?.(this.state);
          this.storagePutPromise = null;
        }
      } else {
        await this.storagePutPromise;
      }
    }
  }

  private loadFromString(jsonString: string): void {
    this.data = this.deserialize(jsonString);
    if (this.dataChangedCallback !== undefined) {
      for (const key of Object.keys(this.data)) {
        this.dataChangedCallback(key);
      }
    }
  }

  private deserialize(serialized: string): { [key: string]: string } {
    if (serialized.length === 0) {
      return {};
    }
    try {
      const result: { [key: string]: string } = {};
      const deserialized = JSON.parse(serialized) ?? {};
      for (const key of Object.keys(deserialized)) {
        if (typeof deserialized[key] == typeof "string") {
          result[key] = deserialized[key];
        } else {
          result[key] = JSON.stringify(deserialized[key]);
        }
      }
      return result;
    } catch (error) {
      return {};
    }
  }

  // private deepClone<T>(obj: T): T {
  //   return JSON.parse(JSON.stringify(obj));
  // }

  // private areEqual<T>(valueA: T, valueB: T): boolean {
  //   return JSON.stringify(valueA) === JSON.stringify(valueB);
  // }

  private getState(): StorageState {
    if (!this.initialized) {
      if (this.loading) {
        return StorageState.Initializing;
      }
      return StorageState.Uninitialized;
    }
    if (this.loading) {
      return StorageState.Loading;
    }
    if (this.saving) {
      return StorageState.Saving;
    }
    if (this.dirty) {
      return StorageState.Dirty;
    }

    return StorageState.Ready;
  }
}
