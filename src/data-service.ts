/**
 * !!README!!
 *
 * Posible states:
 * https://drive.google.com/file/d/1UZJ-UiKBhspE8GxhW0BZRoCXe_E_jEaT/view?usp=sharing
 *                   |  loading  |  dirty   |   saving  |   initialised
 * ------------------+-----------+----------+-----------+--------------
 * Uninitialized     |  fasle    |  false   |   false   |   false
 * Initializing      |  true     |  false   |   false   |   false
 * Ready:            |  false    |  false   |   false   |   true
 * Dirty:            |  false    |  true    |   false   |   true
 * Saving:           |  false    |  true    |   true    |   true
 * Loading:          |  true     |  false   |   false   |   true
 *
 */

import { Storage } from "./storage/storage.interface";

export class DataService {
  get state(): DataServiceState {
    return this.getState();
  }

  private initialized = false;
  private dirty = false;
  private loading = false;
  private saving = false;

  private data: { [key: string]: any } = {};
  private storageGetPromise: Promise<string> | null = null;
  private storagePutPromise: Promise<void> | null = null;
  private changedWhileSaving = false;

  constructor(
    private storage: Storage,
    private stateChangedCallback?: (_: DataServiceState) => void,
    private dataChangedCallback?: (_: string) => void
  ) {}

  containsKey(key: string): boolean {
    return key in this.data;
  }

  get(key: string): any {
    if (!this.containsKey(key)) {
      return null;
    }
    return this.deepClone(this.data[key]);
  }

  set(key: string, value: any) {
    const disallowedStates = [
      DataServiceState.Uninitialized,
      DataServiceState.Initializing,
      DataServiceState.Loading,
    ];
    if (disallowedStates.some((x) => x === this.state)) {
      throw Error(this.state);
    }
    if (this.containsKey(key) && this.areEqual(this.get(key), value)) {
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
    const disallowedStates = [DataServiceState.Dirty, DataServiceState.Saving];
    if (disallowedStates.some((x) => x === this.state)) {
      throw Error(`Cannot call this method when the state is: ${this.state}`);
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
      this.state === DataServiceState.Dirty ||
      this.state === DataServiceState.Saving
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

  private deserialize(serialized: string): { [key: string]: any } {
    if (serialized.length === 0) {
      return {};
    }
    try {
      return JSON.parse(serialized) ?? {};
    } catch (error) {
      return {};
    }
  }

  private deepClone(obj: any): any {
    return JSON.parse(JSON.stringify(obj));
  }

  private areEqual(valueA: any, valueB: any): boolean {
    return JSON.stringify(valueA) === JSON.stringify(valueB);
  }

  private getState(): DataServiceState {
    if (!this.initialized) {
      if (this.loading) {
        return DataServiceState.Initializing;
      }
      return DataServiceState.Uninitialized;
    }
    if (this.loading) {
      return DataServiceState.Loading;
    }
    if (this.saving) {
      return DataServiceState.Saving;
    }
    if (this.dirty) {
      return DataServiceState.Dirty;
    }

    return DataServiceState.Ready;
  }
}

export enum DataServiceState {
  Uninitialized = "Uninitialized",
  Initializing = "Initializing",
  Loading = "Loading",
  Ready = "Ready",
  Dirty = "Dirty",
  Saving = "Saving",
}
