export interface Storage {
  put(data: string): Promise<void>;
  get(): Promise<string>;
}
