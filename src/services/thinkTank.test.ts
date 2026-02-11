/**
 * ThinkTankService Tests
 *
 * Tests for the Think Tank API service.
 *
 * Story: 9-1-1-think-tank-proposal-creation
 * AC: 4, 5
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ThinkTankService,
  GenerateProposalRequest,
  ThinkTankError,
  getErrorMessage,
  isRetryable,
} from './thinkTank';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('ThinkTankService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('generateProposal', () => {
    it('should return a request ID on successful generation initiation', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          requestId: 'req-123',
          status: 'queued',
          estimatedTime: 30000,
        }),
      });

      const request: GenerateProposalRequest = {
        prompt: 'Test proposal for community solar project',
        scale: 'medium',
        vertical: 'Energy',
      };

      const response = await ThinkTankService.generateProposal(request);

      expect(response.requestId).toBe('req-123');
      expect(response.status).toBe('queued');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/generate'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should return failed status on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const request: GenerateProposalRequest = {
        prompt: 'Test proposal',
        scale: 'small',
        vertical: 'Community',
      };

      const response = await ThinkTankService.generateProposal(request);

      expect(response.status).toBe('failed');
      expect(response.error).toBeDefined();
    });

    it('should handle rate limiting', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({
          error: { code: 'RATE_LIMITED', message: 'Too many requests' },
        }),
      });

      const request: GenerateProposalRequest = {
        prompt: 'Test proposal',
        scale: 'medium',
        vertical: 'Housing',
      };

      const response = await ThinkTankService.generateProposal(request);

      expect(response.status).toBe('failed');
      expect(response.error?.code).toBe('RATE_LIMITED');
    });
  });

  describe('getStatus', () => {
    it('should return current status for a request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          requestId: 'req-123',
          status: 'processing',
          estimatedTime: 15000,
        }),
      });

      const response = await ThinkTankService.getStatus('req-123');

      expect(response.status).toBe('processing');
      expect(response.estimatedTime).toBe(15000);
    });

    it('should return output when completed', async () => {
      const mockOutput = {
        problemStatement: 'Test problem',
        proposedSolution: 'Test solution',
        budgetBreakdown: [],
        timeline: [],
        successMetrics: [],
        riskAssessment: [],
        agentContributions: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          requestId: 'req-123',
          status: 'completed',
          output: mockOutput,
        }),
      });

      const response = await ThinkTankService.getStatus('req-123');

      expect(response.status).toBe('completed');
      expect(response.output).toEqual(mockOutput);
    });
  });

  describe('refineSection', () => {
    it('should send refinement request and return updated output', async () => {
      const mockOutput = {
        problemStatement: 'Refined problem statement',
        proposedSolution: 'Original solution',
        budgetBreakdown: [],
        timeline: [],
        successMetrics: [],
        riskAssessment: [],
        agentContributions: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          requestId: 'req-123',
          status: 'completed',
          output: mockOutput,
        }),
      });

      const response = await ThinkTankService.refineSection(
        'req-123',
        'problemStatement',
        'Make it more specific to local community needs'
      );

      expect(response.status).toBe('completed');
      expect(response.output?.problemStatement).toBe('Refined problem statement');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/refine'),
        expect.objectContaining({
          method: 'POST',
        })
      );
    });
  });
});

describe('Error utilities', () => {
  describe('getErrorMessage', () => {
    it('should return user-friendly message for known error codes', () => {
      const error: ThinkTankError = { code: 'RATE_LIMITED', message: 'Too many requests' };
      // The error message comes from the ERROR_MESSAGES map
      expect(getErrorMessage(error)).toContain('limit');
    });

    it('should return default message for unknown codes', () => {
      const error: ThinkTankError = { code: 'UNKNOWN', message: 'Something went wrong' };
      // Unknown codes return a default "unexpected error" message
      expect(getErrorMessage(error)).toContain('unexpected error');
    });
  });

  describe('isRetryable', () => {
    it('should return true for retryable errors', () => {
      // RATE_LIMITED is not retryable per implementation (daily limit)
      expect(isRetryable({ code: 'TIMEOUT', message: '' })).toBe(true);
      expect(isRetryable({ code: 'AI_UNAVAILABLE', message: '' })).toBe(true);
    });

    it('should return false for non-retryable errors', () => {
      expect(isRetryable({ code: 'INVALID_INPUT', message: '' })).toBe(false);
      expect(isRetryable({ code: 'NOT_MEMBER', message: '' })).toBe(false);
      // RATE_LIMITED is not retryable (daily limit per implementation)
      expect(isRetryable({ code: 'RATE_LIMITED', message: '' })).toBe(false);
    });
  });
});
