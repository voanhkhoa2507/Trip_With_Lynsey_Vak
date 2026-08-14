// Firebase SDK Imports (ES Modules from CDN)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyCRdPJVYgsS2DyZ_eGtvpJtnJUD2rdE8wU",
  authDomain: "trip-lynsey-vak.firebaseapp.com",
  projectId: "trip-lynsey-vak",
  storageBucket: "trip-lynsey-vak.firebasestorage.app",
  messagingSenderId: "2061333320",
  appId: "1:2061333320:web:00067e32aaad180c92797d",
  measurementId: "G-F7QXEZ3XVP"
};

// Initialize Firebase & Firestore
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

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

  async save(trip) {
    const trips = this._load();
    const index = trips.findIndex(t => t.id === trip.id);
    if (index >= 0) {
      trips[index] = trip;
    } else {
      trips.push(trip);
    }
    this._save(trips);

    // Sync to Cloud Firestore
    try {
      await setDoc(doc(db, "trips", trip.id), trip);
    } catch (e) {
      console.error('Firestore save trip error:', e);
    }
  },

  async delete(id) {
    const trips = this._load();
    const newTrips = trips.filter(t => t.id !== id);
    this._save(newTrips);

    // Delete from Cloud Firestore
    try {
      await deleteDoc(doc(db, "trips", id));
    } catch (e) {
      console.error('Firestore delete trip error:', e);
    }
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
    
    // Save to IndexedDB locally
    await new Promise((resolve, reject) => {
      const transaction = dbInstance.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(blob, key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    // Compress & Sync to Cloud Firestore
    try {
      const compressedBlob = await compressMedia(blob);
      const base64 = await blobToBase64(compressedBlob);
      await setDoc(doc(db, "media", key), {
        key,
        type: compressedBlob.type,
        data: base64,
        updatedAt: new Date().toISOString()
      });
    } catch (e) {
      console.error('Firestore save media error:', e);
    }
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
    await new Promise((resolve, reject) => {
      const transaction = dbInstance.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(key);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    try {
      await deleteDoc(doc(db, "media", key));
    } catch (e) {
      console.error('Firestore delete media error:', e);
    }
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

// --- Realtime Sync Listener ---
export function subscribeToRealtimeUpdates(onUpdateCallback) {
  // Listen to Trips
  onSnapshot(collection(db, "trips"), (snapshot) => {
    const trips = [];
    snapshot.forEach((docSnap) => {
      trips.push(docSnap.data());
    });
    TripStore._save(trips);
    if (onUpdateCallback) onUpdateCallback('trips');
  }, (err) => {
    console.error("Trips realtime error:", err);
  });

  // Listen to Media
  onSnapshot(collection(db, "media"), (snapshot) => {
    snapshot.forEach(async (docSnap) => {
      const { key, type, data } = docSnap.data();
      if (key && data) {
        try {
          const blob = base64ToBlob(data, type);
          await MediaStore.init();
          const existing = await MediaStore.get(key);
          if (!existing) {
            // Save to local IndexedDB
            const transaction = dbInstance.transaction([STORE_NAME], 'readwrite');
            transaction.objectStore(STORE_NAME).put(blob, key);
          }
        } catch (e) {
          console.error("Error saving synced media:", e);
        }
      }
    });
    if (onUpdateCallback) onUpdateCallback('media');
  }, (err) => {
    console.error("Media realtime error:", err);
  });
}

// --- Helpers ---
const compressMedia = (blob) => {
  return new Promise((resolve) => {
    if (!blob.type.startsWith('image/')) {
      resolve(blob); // non-image (video/etc) return as is
      return;
    }
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      const maxDim = 1200; // max dimension

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (compressedBlob) => {
          resolve(compressedBlob || blob);
        },
        'image/jpeg',
        0.75 // 75% quality
      );
    };
    img.onerror = () => resolve(blob);
    img.src = url;
  });
};

const blobToBase64 = (blob) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(',')[1]);
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
  
  return new Blob(byteArrays, { type: type || 'image/jpeg' });
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

        // Restore trips
        for (const trip of importObject.trips) {
          await TripStore.save(trip);
        }

        // Restore media
        await MediaStore.init();
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
