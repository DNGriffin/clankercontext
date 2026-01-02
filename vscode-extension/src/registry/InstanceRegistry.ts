/**
 * Instance Registry - Manages registration of multiple VSCode instances
 * Uses a shared file with simple file locking for discovery across instances
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { InstanceInfo, RegistryData } from '../types';
import * as packageJson from '../../package.json';

const REGISTRY_DIR = path.join(os.homedir(), '.clankercontext');
const REGISTRY_FILE = path.join(REGISTRY_DIR, 'instances.json');
const LOCK_FILE = path.join(REGISTRY_DIR, 'instances.lock');
const HEARTBEAT_INTERVAL = 10000; // 10 seconds (faster detection)
const STALE_THRESHOLD = 20000; // 20 seconds (faster cleanup)
const LOCK_STALE_MS = 10000; // Lock considered stale after 10s
const LOCK_RETRY_DELAY = 50; // ms between lock retries
const LOCK_MAX_RETRIES = 100; // Max retries (5 seconds total)

export class InstanceRegistry {
  private instanceId: string;
  private instanceName: string;
  private workspacePath: string;
  private port: number;
  private pid: number;
  private heartbeatTimer: NodeJS.Timeout | null = null;

  constructor(workspacePath: string, workspaceName: string, port: number) {
    this.workspacePath = workspacePath;
    this.instanceName = workspaceName;
    this.port = port;
    this.pid = process.pid;
    // Generate unique ID using PID + random bytes (guarantees uniqueness)
    this.instanceId = this.generateInstanceId();
  }

  /**
   * Generate a unique instance ID using PID and random bytes
   */
  private generateInstanceId(): string {
    const random = crypto.randomBytes(4).toString('hex');
    return `${this.pid}-${random}`;
  }

  /**
   * Get the unique instance ID
   */
  getId(): string {
    return this.instanceId;
  }

  /**
   * Get the PID
   */
  getPid(): number {
    return this.pid;
  }

  /**
   * Update the port (called after server finds an available port)
   */
  setPort(port: number): void {
    this.port = port;
  }

  /**
   * Get the current port
   */
  getPort(): number {
    return this.port;
  }

  /**
   * Get the workspace name
   */
  getWorkspaceName(): string {
    return this.instanceName;
  }

  /**
   * Get the workspace path
   */
  getWorkspacePath(): string {
    return this.workspacePath;
  }

  /**
   * Get the extension version from package.json
   */
  getVersion(): string {
    return packageJson.version;
  }

  /**
   * Ensure the registry directory exists
   */
  private ensureRegistryDir(): void {
    if (!fs.existsSync(REGISTRY_DIR)) {
      fs.mkdirSync(REGISTRY_DIR, { recursive: true });
    }
  }

  /**
   * Ensure the registry file exists
   */
  private ensureRegistryFile(): void {
    this.ensureRegistryDir();
    if (!fs.existsSync(REGISTRY_FILE)) {
      fs.writeFileSync(REGISTRY_FILE, JSON.stringify({ instances: [] }, null, 2));
    }
  }

  /**
   * Simple file-based lock acquisition
   */
  private async acquireLock(): Promise<void> {
    this.ensureRegistryDir();

    for (let i = 0; i < LOCK_MAX_RETRIES; i++) {
      try {
        // Check if lock file exists and is stale
        if (fs.existsSync(LOCK_FILE)) {
          const stats = fs.statSync(LOCK_FILE);
          const age = Date.now() - stats.mtimeMs;
          if (age > LOCK_STALE_MS) {
            // Lock is stale, remove it
            try {
              fs.unlinkSync(LOCK_FILE);
            } catch {
              // Ignore - another process may have removed it
            }
          }
        }

        // Try to create lock file exclusively
        fs.writeFileSync(LOCK_FILE, String(this.pid), { flag: 'wx' });
        return; // Lock acquired
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'EEXIST') {
          // Lock file exists, wait and retry
          await this.sleep(LOCK_RETRY_DELAY);
        } else {
          throw err;
        }
      }
    }

    throw new Error('Failed to acquire lock after maximum retries');
  }

  /**
   * Release the file lock
   */
  private releaseLock(): void {
    try {
      if (fs.existsSync(LOCK_FILE)) {
        fs.unlinkSync(LOCK_FILE);
      }
    } catch {
      // Ignore errors during unlock
    }
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Read the current registry data (internal, no locking)
   */
  private readRegistryUnsafe(): RegistryData {
    this.ensureRegistryFile();

    try {
      const data = fs.readFileSync(REGISTRY_FILE, 'utf-8');
      return JSON.parse(data) as RegistryData;
    } catch {
      // If file is corrupted, start fresh
      return { instances: [] };
    }
  }

  /**
   * Write registry data atomically using temp file + rename
   */
  private writeRegistryAtomic(data: RegistryData): void {
    this.ensureRegistryDir();
    const tempFile = `${REGISTRY_FILE}.${this.pid}.tmp`;

    try {
      // Write to temp file first
      fs.writeFileSync(tempFile, JSON.stringify(data, null, 2));
      // Atomic rename (on POSIX systems)
      fs.renameSync(tempFile, REGISTRY_FILE);
    } catch (err) {
      // Clean up temp file if it exists
      try {
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
      } catch {
        // Ignore cleanup errors
      }
      throw err;
    }
  }

  /**
   * Execute a modification on the registry with file locking
   */
  private async modifyRegistry(
    modifier: (instances: InstanceInfo[]) => InstanceInfo[]
  ): Promise<void> {
    await this.acquireLock();

    try {
      // Read current state
      const registry = this.readRegistryUnsafe();

      // Clean stale instances
      let instances = this.cleanStaleInstances(registry.instances);

      // Apply modification
      instances = modifier(instances);

      // Write atomically
      this.writeRegistryAtomic({ instances });
    } finally {
      this.releaseLock();
    }
  }

  /**
   * Remove stale instances from the registry
   */
  private cleanStaleInstances(instances: InstanceInfo[]): InstanceInfo[] {
    const now = Date.now();
    return instances.filter(instance => {
      const age = now - instance.lastHeartbeat;
      return age < STALE_THRESHOLD;
    });
  }

  /**
   * Register this instance in the registry
   */
  async register(): Promise<void> {
    await this.modifyRegistry(instances => {
      // Remove any existing entry for this instance ID (shouldn't exist, but be safe)
      const filtered = instances.filter(i => i.id !== this.instanceId);

      // Add this instance
      const instanceInfo: InstanceInfo = {
        id: this.instanceId,
        name: this.instanceName,
        workspacePath: this.workspacePath,
        port: this.port,
        pid: this.pid,
        lastHeartbeat: Date.now(),
      };

      filtered.push(instanceInfo);
      return filtered;
    });

    // Start heartbeat
    this.startHeartbeat();
  }

  /**
   * Unregister this instance from the registry
   */
  async unregister(): Promise<void> {
    this.stopHeartbeat();

    try {
      await this.modifyRegistry(instances => {
        return instances.filter(i => i.id !== this.instanceId);
      });
    } catch (err) {
      // Log but don't throw - we're shutting down anyway
      console.error('Failed to unregister from registry:', err);
    }
  }

  /**
   * Update heartbeat timestamp
   */
  private async updateHeartbeat(): Promise<void> {
    try {
      await this.modifyRegistry(instances => {
        // Find this instance
        const index = instances.findIndex(i => i.id === this.instanceId);

        if (index >= 0) {
          // Update heartbeat
          instances[index].lastHeartbeat = Date.now();
          // Also update port in case it changed
          instances[index].port = this.port;
        } else {
          // Re-register if not found (instance was cleaned as stale)
          instances.push({
            id: this.instanceId,
            name: this.instanceName,
            workspacePath: this.workspacePath,
            port: this.port,
            pid: this.pid,
            lastHeartbeat: Date.now(),
          });
        }

        return instances;
      });
    } catch (err) {
      console.error('Failed to update heartbeat:', err);
      // Don't throw - heartbeat will retry
    }
  }

  /**
   * Start periodic heartbeat
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.updateHeartbeat().catch(err => {
        console.error('Heartbeat error:', err);
      });
    }, HEARTBEAT_INTERVAL);
  }

  /**
   * Stop periodic heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Get all registered instances (for discovery endpoint)
   * Note: This reads without locking for performance - may see slightly stale data
   */
  getAllInstances(): InstanceInfo[] {
    const registry = this.readRegistryUnsafe();
    return this.cleanStaleInstances(registry.instances);
  }

  /**
   * Get instance info by ID
   */
  getInstance(id: string): InstanceInfo | undefined {
    const instances = this.getAllInstances();
    return instances.find(i => i.id === id);
  }
}
