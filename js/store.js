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
const SETTINGS_STORAGE_KEY = 'trip_with_lynsey_settings';
const CAPSULES_STORAGE_KEY = 'trip_with_lynsey_capsules';
const DB_NAME = 'TripMediaDB';
const DB_VERSION = 1;
const STORE_NAME = 'media';

// --- SettingsStore (Love anniversary & Couple info) ---
export const SettingsStore = {
  get() {
    try {
      const data = localStorage.getItem(SETTINGS_STORAGE_KEY);
      const defaults = {
        anniversaryDate: '2024-01-01',
        coupleTitle: 'Lynsey & Vak 💕',
        user1: 'Vak',
        user2: 'Lynsey',
        customVisitedProvinces: []
      };
      return data ? { ...defaults, ...JSON.parse(data) } : defaults;
    } catch (e) {
      console.error('Failed to load settings', e);
      return { anniversaryDate: '2024-01-01', coupleTitle: 'Lynsey & Vak 💕', user1: 'Vak', user2: 'Lynsey', customVisitedProvinces: [] };
    }
  },

  async save(settings) {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
      await setDoc(doc(db, "settings", "general"), settings);
    } catch (e) {
      console.error('Failed to save settings', e);
    }
  },

  _saveLocal(settings) {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {}
  }
};

// --- TimeCapsuleStore (Hộp thư thời gian bí mật) ---
export const TimeCapsuleStore = {
  getAll() {
    return this._load();
  },

  getById(id) {
    const list = this._load();
    return list.find(c => c.id === id) || null;
  },

  async save(capsule) {
    const list = this._load();
    const index = list.findIndex(c => c.id === capsule.id);
    if (index >= 0) {
      list[index] = capsule;
    } else {
      list.push(capsule);
    }
    this._save(list);

    try {
      await setDoc(doc(db, "time_capsules", capsule.id), capsule);
    } catch (e) {
      console.error('Firestore save capsule error:', e);
    }
  },

  async delete(id) {
    const list = this._load();
    const newList = list.filter(c => c.id !== id);
    this._save(newList);

    try {
      await deleteDoc(doc(db, "time_capsules", id));
    } catch (e) {
      console.error('Firestore delete capsule error:', e);
    }
  },

  _load() {
    try {
      const data = localStorage.getItem(CAPSULES_STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  },

  _save(list) {
    try {
      localStorage.setItem(CAPSULES_STORAGE_KEY, JSON.stringify(list));
    } catch (e) {}
  }
};

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

  // Listen to Settings
  onSnapshot(doc(db, "settings", "general"), (docSnap) => {
    if (docSnap.exists()) {
      SettingsStore._saveLocal(docSnap.data());
      if (onUpdateCallback) onUpdateCallback('settings');
    }
  }, (err) => {
    console.error("Settings realtime error:", err);
  });

  // Listen to Time Capsules
  onSnapshot(collection(db, "time_capsules"), (snapshot) => {
    const list = [];
    snapshot.forEach((docSnap) => {
      list.push(docSnap.data());
    });
    TimeCapsuleStore._save(list);
    if (onUpdateCallback) onUpdateCallback('time_capsules');
  }, (err) => {
    console.error("Time capsules realtime error:", err);
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
      resolve(blob);
      return;
    }
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      const maxDim = 1200;

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
        0.75
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

// --- Vietnam 63 Provinces Reference List ---
export const VIETNAM_PROVINCES = [
  // Miền Bắc
  { id: 'hanoi', name: 'Hà Nội', region: 'north' },
  { id: 'haiphong', name: 'Hải Phòng', region: 'north' },
  { id: 'quangninh', name: 'Quảng Ninh', region: 'north' },
  { id: 'laocai', name: 'Lào Cai (Sa Pa)', region: 'north' },
  { id: 'hagiang', name: 'Hà Giang', region: 'north' },
  { id: 'ninhbinh', name: 'Ninh Bình', region: 'north' },
  { id: 'hoabinh', name: 'Hòa Bình', region: 'north' },
  { id: 'sonla', name: 'Sơn La (Mộc Châu)', region: 'north' },
  { id: 'dienbien', name: 'Điện Biên', region: 'north' },
  { id: 'laichau', name: 'Lai Châu', region: 'north' },
  { id: 'yenvai', name: 'Yên Bái', region: 'north' },
  { id: 'tuyenquang', name: 'Tuyên Quang', region: 'north' },
  { id: 'caobang', name: 'Cao Bằng', region: 'north' },
  { id: 'baclieu_north', name: 'Bắc Kạn', region: 'north' },
  { id: 'thainguyen', name: 'Thái Nguyên', region: 'north' },
  { id: 'langson', name: 'Lạng Sơn', region: 'north' },
  { id: 'bacgiang', name: 'Bắc Giang', region: 'north' },
  { id: 'phutho', name: 'Phú Thọ', region: 'north' },
  { id: 'vinhphuc', name: 'Vĩnh Phúc (Tam Đảo)', region: 'north' },
  { id: 'bacninh', name: 'Bắc Ninh', region: 'north' },
  { id: 'hungyen', name: 'Hưng Yên', region: 'north' },
  { id: 'haiduong', name: 'Hải Dương', region: 'north' },
  { id: 'hanam', name: 'Hà Nam', region: 'north' },
  { id: 'thaibinh', name: 'Thái Bình', region: 'north' },
  { id: 'namdinh', name: 'Nam Định', region: 'north' },

  // Miền Trung & Tây Nguyên
  { id: 'danang', name: 'Đà Nẵng', region: 'central' },
  { id: 'thua_thien_hue', name: 'Thừa Thiên Huế', region: 'central' },
  { id: 'quangnam', name: 'Quảng Nam (Hội An)', region: 'central' },
  { id: 'lamdong', name: 'Lâm Đồng (Đà Lạt)', region: 'central' },
  { id: 'khanhhoa', name: 'Khánh Hòa (Nha Trang)', region: 'central' },
  { id: 'binhdinh', name: 'Bình Định (Quy Nhơn)', region: 'central' },
  { id: 'phuyen', name: 'Phú Yên', region: 'central' },
  { id: 'ninhthuan', name: 'Ninh Thuận', region: 'central' },
  { id: 'binhthuan', name: 'Bình Thuận (Phan Thiết)', region: 'central' },
  { id: 'quangngai', name: 'Quảng Ngãi', region: 'central' },
  { id: 'quangtri', name: 'Quảng Trị', region: 'central' },
  { id: 'quangbinh', name: 'Quảng Bình', region: 'central' },
  { id: 'hatinh', name: 'Hà Tĩnh', region: 'central' },
  { id: 'nghean', name: 'Nghệ An', region: 'central' },
  { id: 'thanhhoa', name: 'Thanh Hóa', region: 'central' },
  { id: 'kontum', name: 'Kon Tum', region: 'central' },
  { id: 'gialai', name: 'Gia Lai', region: 'central' },
  { id: 'daklak', name: 'Đắk Lắk', region: 'central' },
  { id: 'daknong', name: 'Đắk Nông', region: 'central' },

  // Miền Nam
  { id: 'tphcm', name: 'TP. Hồ Chí Minh', region: 'south' },
  { id: 'kiengiang', name: 'Kiên Giang (Phú Quốc)', region: 'south' },
  { id: 'bariavungtau', name: 'Bà Rịa - Vũng Tàu', region: 'south' },
  { id: 'cantho', name: 'Cần Thơ', region: 'south' },
  { id: 'dongnai', name: 'Đồng Nai', region: 'south' },
  { id: 'binhduong', name: 'Bình Dương', region: 'south' },
  { id: 'binhphuoc', name: 'Bình Phước', region: 'south' },
  { id: 'tayninh', name: 'Tây Ninh', region: 'south' },
  { id: 'longan', name: 'Long An', region: 'south' },
  { id: 'tiengiang', name: 'Tiền Giang', region: 'south' },
  { id: 'bentre', name: 'Bến Tre', region: 'south' },
  { id: 'dongthap', name: 'Đồng Tháp', region: 'south' },
  { id: 'vinhlong', name: 'Vĩnh Long', region: 'south' },
  { id: 'angiang', name: 'An Giang', region: 'south' },
  { id: 'haugiang', name: 'Hậu Giang', region: 'south' },
  { id: 'soctrang', name: 'Sóc Trăng', region: 'south' },
  { id: 'baclieu', name: 'Bạc Liêu', region: 'south' },
  { id: 'camau', name: 'Cà Mau', region: 'south' },
  { id: 'travinh', name: 'Trà Vinh', region: 'south' }
];

// Calculate stats for Scratch Map
export function getVisitedStats(trips) {
  const settings = SettingsStore.get();
  const custom = settings.customVisitedProvinces || [];
  
  const visitedMap = {}; // { provinceId: count }

  // Scan trips destination
  trips.forEach(t => {
    const dest = (t.destination || '').toLowerCase();
    const name = (t.name || '').toLowerCase();
    VIETNAM_PROVINCES.forEach(p => {
      const pName = p.name.toLowerCase();
      const purePName = pName.replace(/\(.*?\)/g, '').trim();
      if (dest.includes(purePName) || name.includes(purePName) || (p.id === 'danang' && dest.includes('đà nẵng')) || (p.id === 'thua_thien_hue' && dest.includes('huế')) || (p.id === 'lamdong' && dest.includes('đà lạt')) || (p.id === 'quangnam' && dest.includes('hội an')) || (p.id === 'kiengiang' && dest.includes('phú quốc'))) {
        visitedMap[p.id] = (visitedMap[p.id] || 0) + 1;
      }
    });
  });

  // Add custom checked
  custom.forEach(id => {
    if (!visitedMap[id]) visitedMap[id] = 1;
  });

  const visitedCount = Object.keys(visitedMap).length;
  const totalCount = VIETNAM_PROVINCES.length;
  const percentage = Math.round((visitedCount / totalCount) * 100);

  return { visitedMap, visitedCount, totalCount, percentage };
}

// --- Import / Export ---
export async function exportAllData() {
  const trips = TripStore.getAll();
  const settings = SettingsStore.get();
  const timeCapsules = TimeCapsuleStore.getAll();
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
    version: 2,
    exportDate: new Date().toISOString(),
    settings,
    timeCapsules,
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

        // Restore settings if present
        if (importObject.settings) {
          await SettingsStore.save(importObject.settings);
        }

        // Restore time capsules if present
        if (importObject.timeCapsules) {
          for (const cap of importObject.timeCapsules) {
            await TimeCapsuleStore.save(cap);
          }
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
