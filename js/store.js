// Store configurations
const LOCAL_STORAGE_KEY = 'trip_with_lynsey_data';
const DB_NAME = 'TripMediaDB';
const DB_VERSION = 1;
const STORE_NAME = 'media';

// --- TripStore ---
export const TripStore = {
  getAll() {
    return this._load();
  },

  getById(id) {
    const trips = this._load();
    return trips.find(t => t.id === id) || null;
  },

  save(trip) {
    const trips = this._load();
    const index = trips.findIndex(t => t.id === trip.id);
    if (index >= 0) {
      trips[index] = trip;
    } else {
      trips.push(trip);
    }
    this._save(trips);
  },

  delete(id) {
    const trips = this._load();
    const newTrips = trips.filter(t => t.id !== id);
    this._save(newTrips);
  },

  _load() {
    try {
      const data = localStorage.getItem(LOCAL_STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Failed to load trips from localStorage', e);
      return [];
    }
  },

  _save(trips) {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(trips));
    } catch (e) {
      console.error('Failed to save trips to localStorage', e);
    }
  }
};

// --- MediaStore ---
let dbInstance = null;

export const MediaStore = {
  async init() {
    if (dbInstance) return;
    
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      
      request.onerror = (event) => {
        console.error('IndexedDB error:', event.target.error);
        reject(event.target.error);
      };
      
      request.onsuccess = (event) => {
        dbInstance = event.target.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
    });
  },

  async save(key, blob) {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = dbInstance.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(blob, key);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  async get(key) {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = dbInstance.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);
      
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  },

  async delete(key) {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = dbInstance.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(key);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  async getAllKeys() {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = dbInstance.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAllKeys();
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  async deleteByPrefix(prefix) {
    const keys = await this.getAllKeys();
    const keysToDelete = keys.filter(k => k.startsWith(prefix));
    for (const key of keysToDelete) {
      await this.delete(key);
    }
  }
};

// --- Helpers ---
const blobToBase64 = (blob) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(',')[1]); // remove data URL prefix
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

const base64ToBlob = (base64, type) => {
  const byteCharacters = atob(base64);
  const byteArrays = [];
  
  for (let offset = 0; offset < byteCharacters.length; offset += 512) {
    const slice = byteCharacters.slice(offset, offset + 512);
    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    byteArrays.push(byteArray);
  }
  
  return new Blob(byteArrays, { type: type });
};

// --- Import / Export ---
export async function exportAllData() {
  const trips = TripStore.getAll();
  const keys = await MediaStore.getAllKeys();
  const mediaData = [];

  for (const key of keys) {
    const blob = await MediaStore.get(key);
    if (blob) {
      const base64 = await blobToBase64(blob);
      mediaData.push({
        key,
        type: blob.type,
        data: base64
      });
    }
  }

  const exportObject = {
    version: 1,
    exportDate: new Date().toISOString(),
    trips,
    media: mediaData
  };

  const jsonString = JSON.stringify(exportObject);
  return new Blob([jsonString], { type: 'application/json' });
}

export async function importAllData(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const importObject = JSON.parse(e.target.result);
        
        if (!importObject.trips || !importObject.media) {
          throw new Error('Invalid backup file format.');
        }

        // Restore trips to localStorage
        TripStore._save(importObject.trips);

        // Restore media to IndexedDB
        await MediaStore.init();
        
        // Optionally clear existing media before import
        // (Depends on whether we want merge or replace. We'll replace for full restore)
        const currentKeys = await MediaStore.getAllKeys();
        for (const key of currentKeys) {
          await MediaStore.delete(key);
        }

        for (const item of importObject.media) {
          const blob = base64ToBlob(item.data, item.type);
          await MediaStore.save(item.key, blob);
        }

        resolve();
      } catch (err) {
        reject(err);
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read backup file.'));
    reader.readAsText(file);
  });
}
