import { IDB_CONFIG, DEFAULT_CONNECTIONS } from '@/shared/constants';
import type {
  Connection,
  ConsoleError,
  Issue,
  IssueType,
  MonitoringSession,
  NetworkError,
  PromptTemplate,
} from '@/shared/types';

/**
 * IndexedDB-based storage manager for the simplified schema.
 * Stores issues, network errors, and console errors.
 */
class StorageManager {
  private db: IDBDatabase | null = null;
  private dbPromise: Promise<IDBDatabase> | null = null;

  /**
   * Initialize the IndexedDB connection.
   */
  async init(): Promise<void> {
    if (this.db) return;
    if (this.dbPromise) {
      await this.dbPromise;
      return;
    }

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(
        IDB_CONFIG.DB_NAME,
        IDB_CONFIG.DB_VERSION
      );

      request.onerror = () => {
        reject(new Error(`Failed to open database: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        this.createStores(db);
      };
    });

    await this.dbPromise;
  }

  /**
   * Create object stores for the database.
   */
  private createStores(db: IDBDatabase): void {
    // Sessions store
    if (!db.objectStoreNames.contains(IDB_CONFIG.STORES.SESSIONS)) {
      db.createObjectStore(IDB_CONFIG.STORES.SESSIONS, {
        keyPath: 'sessionId',
      });
    }

    // Issues store
    if (!db.objectStoreNames.contains(IDB_CONFIG.STORES.ISSUES)) {
      const store = db.createObjectStore(IDB_CONFIG.STORES.ISSUES, {
        keyPath: 'id',
      });
      store.createIndex('sessionId', 'sessionId', { unique: false });
      store.createIndex('timestamp', 'timestamp', { unique: false });
    }

    // Network errors store
    if (!db.objectStoreNames.contains(IDB_CONFIG.STORES.NETWORK_ERRORS)) {
      const store = db.createObjectStore(IDB_CONFIG.STORES.NETWORK_ERRORS, {
        keyPath: 'id',
        autoIncrement: true,
      });
      store.createIndex('sessionId', 'sessionId', { unique: false });
      store.createIndex('timestamp', 'timestamp', { unique: false });
    }

    // Console errors store
    if (!db.objectStoreNames.contains(IDB_CONFIG.STORES.CONSOLE_ERRORS)) {
      const store = db.createObjectStore(IDB_CONFIG.STORES.CONSOLE_ERRORS, {
        keyPath: 'id',
        autoIncrement: true,
      });
      store.createIndex('sessionId', 'sessionId', { unique: false });
      store.createIndex('timestamp', 'timestamp', { unique: false });
    }

    // Connections store (added in version 4)
    if (!db.objectStoreNames.contains(IDB_CONFIG.STORES.CONNECTIONS)) {
      const store = db.createObjectStore(IDB_CONFIG.STORES.CONNECTIONS, {
        keyPath: 'id',
      });
      store.createIndex('type', 'type', { unique: false });
      store.createIndex('enabled', 'enabled', { unique: false });
    }

    // Prompt templates store (added in version 5)
    if (!db.objectStoreNames.contains(IDB_CONFIG.STORES.PROMPT_TEMPLATES)) {
      db.createObjectStore(IDB_CONFIG.STORES.PROMPT_TEMPLATES, {
        keyPath: 'type',
      });
    }
  }

  /**
   * Get the database instance, initializing if needed.
   */
  private async getDb(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.init();
    }
    return this.db!;
  }

  /**
   * Generic add operation for any store.
   */
  private async add<T>(
    storeName: string,
    data: T & { sessionId?: string }
  ): Promise<IDBValidKey> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.add(data);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(new Error(`Failed to add to ${storeName}: ${request.error?.message}`));
    });
  }

  /**
   * Generic put operation for any store.
   */
  private async put<T>(storeName: string, data: T): Promise<IDBValidKey> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(data);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(new Error(`Failed to put to ${storeName}: ${request.error?.message}`));
    });
  }

  /**
   * Get all records from a store matching a session ID.
   */
  private async getAllBySession<T>(
    storeName: string,
    sessionId: string
  ): Promise<T[]> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const index = store.index('sessionId');
      const request = index.getAll(sessionId);

      request.onsuccess = () => resolve(request.result as T[]);
      request.onerror = () =>
        reject(new Error(`Failed to get from ${storeName}: ${request.error?.message}`));
    });
  }

  /**
   * Delete a record by key.
   */
  private async delete(storeName: string, key: IDBValidKey): Promise<void> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () =>
        reject(new Error(`Failed to delete from ${storeName}: ${request.error?.message}`));
    });
  }

  /**
   * Delete all records for a session.
   */
  private async deleteBySession(
    storeName: string,
    sessionId: string
  ): Promise<void> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const index = store.index('sessionId');
      const request = index.openCursor(sessionId);

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = () =>
        reject(new Error(`Failed to delete from ${storeName}: ${request.error?.message}`));
    });
  }

  // Session operations
  async saveSession(session: MonitoringSession): Promise<void> {
    await this.put(IDB_CONFIG.STORES.SESSIONS, session);
  }

  /**
   * Get the most recent active session.
   */
  async getActiveSession(): Promise<MonitoringSession | null> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_CONFIG.STORES.SESSIONS, 'readonly');
      const store = tx.objectStore(IDB_CONFIG.STORES.SESSIONS);
      const request = store.getAll();

      request.onsuccess = () => {
        const sessions = request.result as MonitoringSession[];
        // Find the most recent session that's monitoring
        const activeSessions = sessions.filter(
          s => s.state === 'monitoring' || s.state === 'selecting_element'
        );
        if (activeSessions.length > 0) {
          activeSessions.sort((a, b) => b.startTime - a.startTime);
          resolve(activeSessions[0]);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(new Error(`Failed to get active session: ${request.error?.message}`));
    });
  }

  /**
   * Get the most recent session regardless of state.
   * Used to retrieve issues from a previous session after extension reload.
   */
  async getMostRecentSession(): Promise<MonitoringSession | null> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_CONFIG.STORES.SESSIONS, 'readonly');
      const store = tx.objectStore(IDB_CONFIG.STORES.SESSIONS);
      const request = store.getAll();

      request.onsuccess = () => {
        const sessions = request.result as MonitoringSession[];
        if (sessions.length > 0) {
          sessions.sort((a, b) => b.startTime - a.startTime);
          resolve(sessions[0]);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(new Error(`Failed to get most recent session: ${request.error?.message}`));
    });
  }

  // Issue operations
  async addIssue(sessionId: string, issue: Issue): Promise<IDBValidKey> {
    return this.add(IDB_CONFIG.STORES.ISSUES, { ...issue, sessionId });
  }

  async getIssues(sessionId: string): Promise<Issue[]> {
    return this.getAllBySession(IDB_CONFIG.STORES.ISSUES, sessionId);
  }

  async deleteIssue(issueId: string): Promise<void> {
    return this.delete(IDB_CONFIG.STORES.ISSUES, issueId);
  }

  async markIssueExported(issueId: string): Promise<void> {
    await this.init();
    const db = this.db!;

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(IDB_CONFIG.STORES.ISSUES, 'readwrite');
      const store = transaction.objectStore(IDB_CONFIG.STORES.ISSUES);

      const getRequest = store.get(issueId);

      getRequest.onsuccess = () => {
        const issue = getRequest.result;
        if (issue) {
          issue.exportedAt = Date.now();
          const putRequest = store.put(issue);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          resolve(); // Issue not found, just resolve
        }
      };

      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  // Network error operations
  async addNetworkError(sessionId: string, error: NetworkError): Promise<IDBValidKey> {
    return this.add(IDB_CONFIG.STORES.NETWORK_ERRORS, { ...error, sessionId });
  }

  async getNetworkErrors(sessionId: string): Promise<NetworkError[]> {
    return this.getAllBySession(IDB_CONFIG.STORES.NETWORK_ERRORS, sessionId);
  }

  // Console error operations
  async addConsoleError(sessionId: string, error: ConsoleError): Promise<IDBValidKey> {
    return this.add(IDB_CONFIG.STORES.CONSOLE_ERRORS, { ...error, sessionId });
  }

  async getConsoleErrors(sessionId: string): Promise<ConsoleError[]> {
    return this.getAllBySession(IDB_CONFIG.STORES.CONSOLE_ERRORS, sessionId);
  }

  // Clear only error logs (keep issues)
  async clearErrors(sessionId: string): Promise<void> {
    await Promise.all([
      this.deleteBySession(IDB_CONFIG.STORES.NETWORK_ERRORS, sessionId),
      this.deleteBySession(IDB_CONFIG.STORES.CONSOLE_ERRORS, sessionId),
    ]);
  }

  // Clear all session data
  async clearSessionData(sessionId: string): Promise<void> {
    await Promise.all([
      this.deleteBySession(IDB_CONFIG.STORES.ISSUES, sessionId),
      this.deleteBySession(IDB_CONFIG.STORES.NETWORK_ERRORS, sessionId),
      this.deleteBySession(IDB_CONFIG.STORES.CONSOLE_ERRORS, sessionId),
    ]);
  }

  // Delete session completely
  async deleteSession(sessionId: string): Promise<void> {
    await this.clearSessionData(sessionId);
    await this.delete(IDB_CONFIG.STORES.SESSIONS, sessionId);
  }

  // Connection operations
  async getConnections(): Promise<Connection[]> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(IDB_CONFIG.STORES.CONNECTIONS, 'readonly');
      const store = transaction.objectStore(IDB_CONFIG.STORES.CONNECTIONS);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result as Connection[]);
      request.onerror = () =>
        reject(new Error(`Failed to get connections: ${request.error?.message}`));
    });
  }

  async getConnectionById(id: string): Promise<Connection | null> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(IDB_CONFIG.STORES.CONNECTIONS, 'readonly');
      const store = transaction.objectStore(IDB_CONFIG.STORES.CONNECTIONS);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () =>
        reject(new Error(`Failed to get connection: ${request.error?.message}`));
    });
  }

  async addConnection(connection: Connection): Promise<IDBValidKey> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(IDB_CONFIG.STORES.CONNECTIONS, 'readwrite');
      const store = transaction.objectStore(IDB_CONFIG.STORES.CONNECTIONS);
      const request = store.add(connection);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(new Error(`Failed to add connection: ${request.error?.message}`));
    });
  }

  async updateConnection(connection: Connection): Promise<IDBValidKey> {
    return this.put(IDB_CONFIG.STORES.CONNECTIONS, connection);
  }

  async deleteConnection(connectionId: string): Promise<void> {
    return this.delete(IDB_CONFIG.STORES.CONNECTIONS, connectionId);
  }

  // Prompt template operations
  async getPromptTemplates(): Promise<PromptTemplate[]> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(IDB_CONFIG.STORES.PROMPT_TEMPLATES, 'readonly');
      const store = transaction.objectStore(IDB_CONFIG.STORES.PROMPT_TEMPLATES);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result as PromptTemplate[]);
      request.onerror = () =>
        reject(new Error(`Failed to get prompt templates: ${request.error?.message}`));
    });
  }

  async getPromptTemplate(type: IssueType): Promise<PromptTemplate | null> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(IDB_CONFIG.STORES.PROMPT_TEMPLATES, 'readonly');
      const store = transaction.objectStore(IDB_CONFIG.STORES.PROMPT_TEMPLATES);
      const request = store.get(type);

      request.onsuccess = () => resolve((request.result as PromptTemplate) || null);
      request.onerror = () =>
        reject(new Error(`Failed to get prompt template: ${request.error?.message}`));
    });
  }

  async upsertPromptTemplate(template: PromptTemplate): Promise<IDBValidKey> {
    return this.put(IDB_CONFIG.STORES.PROMPT_TEMPLATES, template);
  }

  async deletePromptTemplate(type: IssueType): Promise<void> {
    return this.delete(IDB_CONFIG.STORES.PROMPT_TEMPLATES, type);
  }

  /**
   * Initialize default connections if this is the first run.
   * Uses chrome.storage.local to persist the "initialized" flag across service worker restarts.
   * Returns true if defaults were created, false if they already existed.
   */
  async initializeDefaultConnections(): Promise<boolean> {
    const { defaultConnectionsInitialized } = await chrome.storage.local.get(
      'defaultConnectionsInitialized'
    );

    if (defaultConnectionsInitialized) {
      return false;
    }

    const now = Date.now();

    const openCodeConnection: Connection = {
      id: DEFAULT_CONNECTIONS.opencode.id,
      name: DEFAULT_CONNECTIONS.opencode.name,
      type: DEFAULT_CONNECTIONS.opencode.type,
      endpoint: DEFAULT_CONNECTIONS.opencode.endpoint,
      enabled: DEFAULT_CONNECTIONS.opencode.enabled,
      autoSend: DEFAULT_CONNECTIONS.opencode.autoSend,
      isActive: DEFAULT_CONNECTIONS.opencode.isActive,
      createdAt: now,
      updatedAt: now,
    };

    const vsCodeConnection: Connection = {
      id: DEFAULT_CONNECTIONS.vscode.id,
      name: DEFAULT_CONNECTIONS.vscode.name,
      type: DEFAULT_CONNECTIONS.vscode.type,
      endpoint: DEFAULT_CONNECTIONS.vscode.endpoint,
      enabled: DEFAULT_CONNECTIONS.vscode.enabled,
      autoSend: DEFAULT_CONNECTIONS.vscode.autoSend,
      isActive: DEFAULT_CONNECTIONS.vscode.isActive,
      createdAt: now,
      updatedAt: now,
    };

    await this.addConnection(openCodeConnection);
    await this.addConnection(vsCodeConnection);
    await chrome.storage.local.set({ defaultConnectionsInitialized: true });

    console.log('[StorageManager] Default connections initialized');
    return true;
  }
}

// Export singleton instance
export const storageManager = new StorageManager();
