// ==================== IndexedDB 管理类 ====================
export class IndexedDBManager {
  constructor() {
    this.dbName = 'AccountingBookDB';
    this.version = 1;
    this.db = null;
  }

  async open() {
    if (this.db) return this.db;
    
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        if (!db.objectStoreNames.contains('entries')) {
          const entriesStore = db.createObjectStore('entries', { keyPath: 'id' });
          entriesStore.createIndex('date', 'date', { unique: false });
          entriesStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
        
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
        
        if (!db.objectStoreNames.contains('categories')) {
          db.createObjectStore('categories', { keyPath: 'key' });
        }
      };
    });
  }

  async getAll(storeName) {
    try {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();
        
        request.onerror = () => {
          const error = request.error;
          console.error(`IndexedDB getAll 失败 [${storeName}]:`, error);
          reject(new Error('读取数据失败'));
        };
        
        request.onsuccess = () => resolve(request.result);
      });
    } catch (error) {
      console.error('IndexedDB 连接失败:', error);
      throw new Error('无法连接数据库，请检查浏览器设置');
    }
  }

  async get(storeName, key) {
    try {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(key);
        
        request.onerror = () => {
          console.error(`IndexedDB get 失败 [${storeName}][${key}]:`, request.error);
          reject(new Error('读取数据失败'));
        };
        
        request.onsuccess = () => resolve(request.result);
      });
    } catch (error) {
      console.error('IndexedDB 连接失败:', error);
      throw new Error('无法连接数据库，请检查浏览器设置');
    }
  }

  async put(storeName, item) {
    try {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put(item);
        
        request.onerror = () => {
          const error = request.error;
          let errorMessage = '保存失败，请重试';
          if (error.name === 'QuotaExceededError') {
            errorMessage = '存储空间已满，请删除部分记录后重试';
          }
          console.error(`IndexedDB put 失败 [${storeName}]:`, error);
          reject(new Error(errorMessage));
        };
        
        request.onsuccess = () => resolve(request.result);
      });
    } catch (error) {
      console.error('IndexedDB 连接失败:', error);
      throw new Error('无法连接数据库，请检查浏览器设置');
    }
  }

  async putAll(storeName, items) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      if (!items || items.length === 0) {
        resolve({ success: 0, failed: 0, errors: [] });
        return;
      }

      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);

      let successCount = 0;
      let failedCount = 0;
      const errors = [];

      transaction.oncomplete = () => {
        resolve({ success: successCount, failed: failedCount, errors });
      };

      transaction.onerror = (event) => {
        reject({ error: transaction.error, message: '事务执行失败' });
      };

      items.forEach((item, index) => {
        try {
          const request = store.put(item);
          
          request.onsuccess = () => { successCount++; };
          
          request.onerror = (event) => {
            failedCount++;
            errors.push({
              index,
              id: item.id || 'unknown',
              error: request.error?.message || '未知错误'
            });
          };
        } catch (err) {
          failedCount++;
          errors.push({ index, id: item.id || 'unknown', error: err.message });
        }
      });
    });
  }

  async delete(storeName, key) {
    try {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(key);
        
        request.onerror = () => {
          console.error(`IndexedDB delete 失败 [${storeName}][${key}]:`, request.error);
          reject(new Error('删除失败，请重试'));
        };
        
        request.onsuccess = () => resolve(request.result);
      });
    } catch (error) {
      console.error('IndexedDB 连接失败:', error);
      throw new Error('无法连接数据库，请检查浏览器设置');
    }
  }

  async clear(storeName) {
    try {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.clear();
        
        request.onerror = () => {
          console.error(`IndexedDB clear 失败 [${storeName}]:`, request.error);
          reject(new Error('清空失败，请重试'));
        };
        
        request.onsuccess = () => resolve(request.result);
      });
    } catch (error) {
      console.error('IndexedDB 连接失败:', error);
      throw new Error('无法连接数据库，请检查浏览器设置');
    }
  }

  async clearAll() {
    const storeNames = ['entries', 'settings', 'categories'];
    await Promise.all(storeNames.map(name => this.clear(name)));
  }

  async getOldestEntries(limit = 1) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('entries', 'readonly');
      const store = transaction.objectStore('entries');
      const index = store.index('timestamp');
      
      const request = index.openCursor();
      const results = [];
      
      request.onerror = () => reject(request.error);
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor && results.length < limit) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          resolve(results);
        }
      };
    });
  }

  async getCount(storeName) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.count();
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }
}