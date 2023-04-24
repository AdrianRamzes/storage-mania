import { Storage } from "./storage.interface";
import {
  getStorage,
  ref,
  uploadString,
  StorageReference,
  getBytes,
} from "@firebase/storage";

/// FireStorage uses Firebase Storage.
/// Make sure firebase app is initialized before using FireStorage.
/// If authentication is needed it's need to be done before calling any method.
export class FirebaseStorage implements Storage {
  private reference: StorageReference;

  constructor(url: string) {
    this.reference = ref(getStorage(), url);
  }

  async get(): Promise<string> {
    try {
      const bytes = await getBytes(this.reference);
      const jsonString = new TextDecoder("utf-8").decode(bytes);
      return jsonString;
    } catch (e: any) {
      if (e.code === "storage/object-not-found") {
        await this.put("");
        return new TextDecoder("utf-8").decode(await getBytes(this.reference));
      } else {
        throw e;
      }
    }
  }

  async put(data: string): Promise<void> {
    await uploadString(this.reference, data);
  }
}
