function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("studyroom", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("workspace");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

let database;
async function access(mode, operation) {
  database ??= openDatabase();
  const db = await database;
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("workspace", mode);
    const request = operation(transaction.objectStore("workspace"));
    transaction.oncomplete = () => resolve(request.result);
    transaction.onabort = () => reject(transaction.error || new Error("Could not save this workspace."));
  });
}

export function loadWorkspace() {
  return access("readonly", (store) => store.get("current"));
}

export function saveWorkspace(data) {
  return access("readwrite", (store) => store.put(data, "current"));
}
