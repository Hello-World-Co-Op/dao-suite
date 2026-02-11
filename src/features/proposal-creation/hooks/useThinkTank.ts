/**
 * useThinkTank Hook
 *
 * React hook wrapper for ThinkTankService providing state management
 * and convenient methods for proposal generation workflow.
 *
 * Story: 9-1-1-think-tank-proposal-creation
 */

import { useState, useCallback, useRef } from 'react';
import {
  ThinkTankService,
  GenerateProposalRequest,
  GenerateProposalResponse,
  ThinkTankOutput,
  GenerationStatus,
  ThinkTankError,
  getErrorMessage,
  isRetryable,
} from '../../../services/thinkTank';

export interface UseThinkTankState {
  isGenerating: boolean;
  isRefining: boolean;
  status: GenerationStatus | null;
  estimatedTime: number | null;
  output: ThinkTankOutput | null;
  error: ThinkTankError | null;
  requestId: string | null;
}

export interface UseThinkTankActions {
  generate: (request: GenerateProposalRequest) => Promise<GenerateProposalResponse>;
  refine: (section: keyof ThinkTankOutput, feedback: string) => Promise<GenerateProposalResponse>;
  reset: () => void;
  retry: () => Promise<GenerateProposalResponse | null>;
}

export type UseThinkTankReturn = UseThinkTankState & UseThinkTankActions;

const initialState: UseThinkTankState = {
  isGenerating: false,
  isRefining: false,
  status: null,
  estimatedTime: null,
  output: null,
  error: null,
  requestId: null,
};

export function useThinkTank(): UseThinkTankReturn {
  const [state, setState] = useState<UseThinkTankState>(initialState);
  const lastRequestRef = useRef<GenerateProposalRequest | null>(null);

  const generate = useCallback(
    async (request: GenerateProposalRequest): Promise<GenerateProposalResponse> => {
      // Store request for potential retry
      lastRequestRef.current = request;

      setState((prev) => ({
        ...prev,
        isGenerating: true,
        status: 'queued',
        error: null,
        output: null,
      }));

      // Initiate generation
      const initResponse = await ThinkTankService.generateProposal(request);

      if (initResponse.status === 'failed') {
        setState((prev) => ({
          ...prev,
          isGenerating: false,
          status: 'failed',
          error: initResponse.error ?? null,
        }));
        return initResponse;
      }

      setState((prev) => ({
        ...prev,
        requestId: initResponse.requestId,
        status: initResponse.status,
        estimatedTime: initResponse.estimatedTime ?? null,
      }));

      // Poll until completion
      const finalResponse = await ThinkTankService.pollStatus(
        initResponse.requestId,
        (status, estimatedTime) => {
          setState((prev) => ({
            ...prev,
            status,
            estimatedTime: estimatedTime ?? null,
          }));
        }
      );

      setState((prev) => ({
        ...prev,
        isGenerating: false,
        status: finalResponse.status,
        output: finalResponse.output ?? null,
        error: finalResponse.error ?? null,
      }));

      return finalResponse;
    },
    []
  );

  const refine = useCallback(
    async (section: keyof ThinkTankOutput, feedback: string): Promise<GenerateProposalResponse> => {
      if (!state.requestId) {
        const error: ThinkTankError = {
          code: 'UNKNOWN',
          message: 'No active proposal to refine',
        };
        return { requestId: '', status: 'failed', error };
      }

      setState((prev) => ({
        ...prev,
        isRefining: true,
        error: null,
      }));

      const response = await ThinkTankService.refineSection(state.requestId, section, feedback);

      if (response.status === 'completed' && response.output) {
        setState((prev) => ({
          ...prev,
          isRefining: false,
          output: response.output ?? prev.output,
        }));
      } else {
        setState((prev) => ({
          ...prev,
          isRefining: false,
          error: response.error ?? null,
        }));
      }

      return response;
    },
    [state.requestId]
  );

  const reset = useCallback(() => {
    lastRequestRef.current = null;
    setState(initialState);
  }, []);

  const retry = useCallback(async (): Promise<GenerateProposalResponse | null> => {
    if (!lastRequestRef.current) {
      return null;
    }
    return generate(lastRequestRef.current);
  }, [generate]);

  return {
    ...state,
    generate,
    refine,
    reset,
    retry,
  };
}

// Export utility functions
export { getErrorMessage, isRetryable };
