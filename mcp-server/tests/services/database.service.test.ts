import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { Pool, Client } from 'pg';
import { DatabaseService } from '../../src/services/database.service.js';

// Mock the entire pg module
vi.mock('pg', () => ({
  Pool: vi.fn(),
  Client: vi.fn()
}));

describe('DatabaseService', () => {
  let mockPool: {
    connect: Mock;
    end: Mock;
  };
  let mockClient: {
    query: Mock;
    release: Mock;
  };
  let mockPersistentClient: {
    connect: Mock;
    end: Mock;
    query: Mock;
  };

  beforeEach(() => {
    // Reset singleton instance
    (DatabaseService as typeof DatabaseService & { instance: unknown }).instance = undefined;

    // Setup pool mock
    mockClient = {
      query: vi.fn(),
      release: vi.fn()
    };

    mockPool = {
      connect: vi.fn().mockResolvedValue(mockClient),
      end: vi.fn().mockResolvedValue(undefined)
    };

    // Setup persistent client mock
    mockPersistentClient = {
      connect: vi.fn().mockResolvedValue(undefined),
      end: vi.fn().mockResolvedValue(undefined),
      query: vi.fn()
    };

    // Mock constructors
    vi.mocked(Pool).mockImplementation(() => mockPool);
    vi.mocked(Client).mockImplementation(() => mockPersistentClient);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = DatabaseService.getInstance();
      const instance2 = DatabaseService.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    it('should create Pool with correct configuration', () => {
      DatabaseService.getInstance();
      
      expect(Pool).toHaveBeenCalledWith({
        connectionString: process.env.DATABASE_URL,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });
    });
  });

  describe('query method', () => {
    it('should execute query and release client', async () => {
      const mockResult = { rows: [{ id: 1, name: 'test' }] };
      mockClient.query.mockResolvedValue(mockResult);

      const service = DatabaseService.getInstance();
      const result = await service.query('SELECT * FROM test_table', []);

      expect(mockPool.connect).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalledWith('SELECT * FROM test_table', []);
      expect(mockClient.release).toHaveBeenCalled();
      expect(result).toEqual(mockResult);
    });

    it('should release client even if query fails', async () => {
      mockClient.query.mockRejectedValue(new Error('Query failed'));

      const service = DatabaseService.getInstance();
      
      await expect(service.query('INVALID SQL')).rejects.toThrow('Query failed');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('transaction method', () => {
    it('should execute transaction successfully', async () => {
      const mockResult = { success: true };
      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce(undefined); // COMMIT

      const callback = vi.fn().mockResolvedValue(mockResult);

      const service = DatabaseService.getInstance();
      const result = await service.transaction(callback);

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(callback).toHaveBeenCalledWith(mockClient);
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
      expect(result).toBe(mockResult);
    });

    it('should rollback on error', async () => {
      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce(undefined); // ROLLBACK

      const callback = vi.fn().mockRejectedValue(new Error('Transaction failed'));

      const service = DatabaseService.getInstance();
      
      await expect(service.transaction(callback)).rejects.toThrow('Transaction failed');
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('healthCheck method', () => {
    it('should return true when query succeeds', async () => {
      mockClient.query.mockResolvedValue({ rows: [{ health: 1 }] });

      const service = DatabaseService.getInstance();
      const isHealthy = await service.healthCheck();

      expect(isHealthy).toBe(true);
      expect(mockClient.query).toHaveBeenCalledWith('SELECT 1 as health', undefined);
    });

    it('should return false when query fails', async () => {
      mockClient.query.mockRejectedValue(new Error('Connection failed'));

      const service = DatabaseService.getInstance();
      const isHealthy = await service.healthCheck();

      expect(isHealthy).toBe(false);
    });
  });

  describe('persistent client methods', () => {
    it('should create and reuse persistent client', async () => {
      const service = DatabaseService.getInstance();
      
      const client1 = await service.getPersistentClient();
      const client2 = await service.getPersistentClient();
      
      expect(client1).toBe(client2);
      expect(Client).toHaveBeenCalledTimes(1);
      expect(mockPersistentClient.connect).toHaveBeenCalledTimes(1);
    });

    it('should release persistent client', async () => {
      const service = DatabaseService.getInstance();
      
      await service.getPersistentClient();
      await service.releasePersistentClient();
      
      expect(mockPersistentClient.end).toHaveBeenCalled();
    });
  });

  describe('cleanup method', () => {
    it('should cleanup all connections', async () => {
      const service = DatabaseService.getInstance();
      
      // Create a persistent client first
      await service.getPersistentClient();
      
      await service.cleanup();
      
      expect(mockPersistentClient.end).toHaveBeenCalled();
      expect(mockPool.end).toHaveBeenCalled();
    });
  });
});