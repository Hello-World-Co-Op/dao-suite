/**
 * Think Tank API Service
 *
 * Handles communication with the Think Tank AI service for proposal generation.
 * Implements polling pattern with visibility API awareness.
 *
 * Story: 9-1-1-think-tank-proposal-creation
 * ACs: 5, 7, 11
 */

// BL-031: Access token is in httpOnly cookie, unavailable to JS.
// Use oracle-bridge proxy when available. getAccessToken() was removed in BL-030.2.

// Environment configuration
const THINK_TANK_API_URL = import.meta.env.VITE_THINK_TANK_API ?? 'http://localhost:3001';
const THINK_TANK_MOCK_ENABLED = import.meta.env.VITE_THINK_TANK_MOCK === 'true';
const POLL_INTERVAL_MS = 2000;
const GENERATION_TIMEOUT_MS = 60000;
const MOCK_GENERATION_DELAY_MS = 3000; // Simulated AI generation time

// Debug: Log mock mode status on load
console.log(
  '[ThinkTank] Mock mode enabled:',
  THINK_TANK_MOCK_ENABLED,
  'env value:',
  import.meta.env.VITE_THINK_TANK_MOCK
);

// Logger utility for structured logging
const logger = {
  info: (message: string, data?: Record<string, unknown>) => {
    console.log(
      JSON.stringify({
        level: 'info',
        service: 'ThinkTankService',
        message,
        ...data,
        timestamp: new Date().toISOString(),
      })
    );
  },
  error: (message: string, data?: Record<string, unknown>) => {
    console.error(
      JSON.stringify({
        level: 'error',
        service: 'ThinkTankService',
        message,
        ...data,
        timestamp: new Date().toISOString(),
      })
    );
  },
  warn: (message: string, data?: Record<string, unknown>) => {
    console.warn(
      JSON.stringify({
        level: 'warn',
        service: 'ThinkTankService',
        message,
        ...data,
        timestamp: new Date().toISOString(),
      })
    );
  },
};

// Error codes
export type ThinkTankErrorCode =
  | 'RATE_LIMITED'
  | 'TIMEOUT'
  | 'AI_UNAVAILABLE'
  | 'INVALID_INPUT'
  | 'NOT_MEMBER'
  | 'NETWORK_ERROR'
  | 'UNKNOWN';

// Error messages for user display
export const ERROR_MESSAGES: Record<ThinkTankErrorCode, string> = {
  RATE_LIMITED: 'Daily limit reached. Try again tomorrow.',
  TIMEOUT: 'AI generation took too long. Please try again.',
  AI_UNAVAILABLE: 'Think Tank service unavailable. Please try again later.',
  INVALID_INPUT: 'Please check your input and try again.',
  NOT_MEMBER: 'Membership required to create proposals.',
  NETWORK_ERROR: 'Network error. Please check your connection and try again.',
  UNKNOWN: 'An unexpected error occurred. Please try again.',
};

// Types
export type ProposalScale = 'small' | 'medium' | 'large';
export type ProposalVertical =
  | 'Housing'
  | 'Food'
  | 'Energy'
  | 'Education'
  | 'Community'
  | 'Infrastructure'
  | 'Other';

export interface GenerateProposalRequest {
  prompt: string;
  scale: ProposalScale;
  vertical: ProposalVertical;
}

export interface BudgetItem {
  category: string;
  amount: number;
  description: string;
}

export interface TimelineItem {
  phase: string;
  duration: string;
  deliverables: string[];
}

export interface RiskItem {
  risk: string;
  likelihood: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  mitigation: string;
}

export interface AgentContribution {
  agent: string;
  contribution: string;
}

export interface ThinkTankOutput {
  problemStatement: string;
  proposedSolution: string;
  budgetBreakdown: BudgetItem[];
  timeline: TimelineItem[];
  successMetrics: string[];
  riskAssessment: RiskItem[];
  agentContributions: AgentContribution[];
}

export interface ThinkTankError {
  code: ThinkTankErrorCode;
  message: string;
  retryAfter?: number;
}

export type GenerationStatus = 'queued' | 'processing' | 'completed' | 'failed';

export interface GenerateProposalResponse {
  requestId: string;
  status: GenerationStatus;
  estimatedTime?: number;
  output?: ThinkTankOutput;
  error?: ThinkTankError;
}

export interface RefineRequest {
  section: keyof ThinkTankOutput;
  feedback: string;
}

// ============================================================================
// MOCK MODE IMPLEMENTATION
// ============================================================================

// Mock request storage (simulates backend state)
const mockRequests = new Map<
  string,
  { status: GenerationStatus; output?: ThinkTankOutput; startTime: number }
>();

/**
 * Generate mock proposal output based on input
 */
function generateMockOutput(request: GenerateProposalRequest): ThinkTankOutput {
  const scaleMultiplier = request.scale === 'small' ? 1 : request.scale === 'medium' ? 3 : 10;
  const baseBudget = 5000 * scaleMultiplier;

  return {
    problemStatement: `Based on your input about "${(request.prompt ?? '').substring(0, 100)}...", the ${request.vertical} sector faces a critical challenge that requires community-driven solutions. Current approaches are fragmented and lack the coordination needed for sustainable impact.`,
    proposedSolution: `We propose a comprehensive ${request.scale}-scale initiative within the ${request.vertical} vertical that leverages DAO governance for transparent decision-making. The solution involves three phases: community engagement, implementation, and sustainability planning. Key innovations include tokenized incentives for participation and milestone-based fund release.`,
    budgetBreakdown: [
      {
        category: 'Planning & Research',
        amount: Math.round(baseBudget * 0.15),
        description: 'Initial research, stakeholder interviews, and detailed planning',
      },
      {
        category: 'Implementation',
        amount: Math.round(baseBudget * 0.5),
        description: 'Core project execution and resource deployment',
      },
      {
        category: 'Community Outreach',
        amount: Math.round(baseBudget * 0.2),
        description: 'Marketing, education, and member engagement activities',
      },
      {
        category: 'Contingency',
        amount: Math.round(baseBudget * 0.15),
        description: 'Buffer for unexpected costs and opportunities',
      },
    ],
    timeline: [
      {
        phase: 'Discovery',
        duration: '2 weeks',
        deliverables: ['Stakeholder analysis', 'Requirements document', 'Risk assessment'],
      },
      {
        phase: 'Development',
        duration:
          request.scale === 'small'
            ? '4 weeks'
            : request.scale === 'medium'
              ? '8 weeks'
              : '16 weeks',
        deliverables: ['Core implementation', 'Testing', 'Documentation'],
      },
      {
        phase: 'Launch',
        duration: '2 weeks',
        deliverables: ['Soft launch', 'Community feedback', 'Full rollout'],
      },
      {
        phase: 'Evaluation',
        duration: '4 weeks',
        deliverables: ['Impact metrics', 'Lessons learned', 'Sustainability plan'],
      },
    ],
    successMetrics: [
      'Minimum 80% community satisfaction rating',
      `At least ${scaleMultiplier * 100} members actively engaged`,
      'All milestones completed within budget',
      'Measurable improvement in target KPIs within 90 days',
      'Positive ROI demonstrated through transparent reporting',
    ],
    riskAssessment: [
      {
        risk: 'Low community engagement',
        likelihood: 'medium',
        impact: 'high',
        mitigation: 'Early stakeholder involvement and incentive structure',
      },
      {
        risk: 'Budget overrun',
        likelihood: 'low',
        impact: 'medium',
        mitigation: 'Milestone-based releases with contingency buffer',
      },
      {
        risk: 'Technical challenges',
        likelihood: 'medium',
        impact: 'medium',
        mitigation: 'Phased approach with regular check-ins',
      },
      {
        risk: 'External market changes',
        likelihood: 'low',
        impact: 'high',
        mitigation: 'Flexible scope with community vote on pivots',
      },
    ],
    agentContributions: [
      {
        agent: 'Strategic Analyst',
        contribution: 'Provided market analysis and competitive landscape assessment',
      },
      {
        agent: 'Community Expert',
        contribution: 'Designed engagement strategy and success metrics',
      },
      {
        agent: 'Financial Advisor',
        contribution: 'Developed budget breakdown and ROI projections',
      },
      {
        agent: 'Risk Manager',
        contribution: 'Identified potential risks and mitigation strategies',
      },
    ],
  };
}

/**
 * Generate a unique mock request ID
 */
function generateMockRequestId(): string {
  return `mock-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Mock implementation of generateProposal
 */
async function mockGenerateProposal(
  request: GenerateProposalRequest
): Promise<GenerateProposalResponse> {
  console.log('[MOCK] generateProposal called', {
    prompt: (request.prompt ?? '').substring(0, 50),
    scale: request.scale,
  });

  const requestId = generateMockRequestId();
  console.log('[MOCK] Created requestId:', requestId);

  // Store request data for later output generation
  mockRequestData.set(requestId, request);

  mockRequests.set(requestId, {
    status: 'processing',
    startTime: Date.now(),
  });

  // Simulate initial response
  return {
    requestId,
    status: 'processing',
    estimatedTime: MOCK_GENERATION_DELAY_MS / 1000,
  };
}

/**
 * Mock implementation of getStatus
 */
async function mockGetStatus(requestId: string): Promise<GenerateProposalResponse> {
  console.log('[MOCK] getStatus called', { requestId });
  const request = mockRequests.get(requestId);

  if (!request) {
    console.log('[MOCK] Request not found in mockRequests');
    return {
      requestId,
      status: 'failed',
      error: { code: 'UNKNOWN', message: 'Request not found' },
    };
  }

  const elapsed = Date.now() - request.startTime;
  console.log('[MOCK] Elapsed time:', elapsed, 'delay:', MOCK_GENERATION_DELAY_MS);

  // Simulate processing time
  if (elapsed < MOCK_GENERATION_DELAY_MS && request.status === 'processing') {
    console.log('[MOCK] Still processing...');
    return {
      requestId,
      status: 'processing',
      estimatedTime: Math.max(1, Math.round((MOCK_GENERATION_DELAY_MS - elapsed) / 1000)),
    };
  }

  // Generation complete - return output if not already set
  if (!request.output) {
    console.log('[MOCK] Generating output...');
    // Get original request data for generating contextual output
    const originalRequest = mockRequestData.get(requestId) ?? {
      prompt: 'Community improvement initiative',
      scale: 'medium' as ProposalScale,
      vertical: 'Community' as ProposalVertical,
    };
    request.output = generateMockOutput(originalRequest);
    request.status = 'completed';
  }

  console.log('[MOCK] Returning completed with output');
  return {
    requestId,
    status: 'completed',
    output: request.output,
  };
}

/**
 * Mock implementation of refineSection
 */
async function mockRefineSection(
  requestId: string,
  section: keyof ThinkTankOutput,
  feedback: string
): Promise<GenerateProposalResponse> {
  logger.info('[MOCK] Refining section', { requestId, section, feedbackLength: feedback.length });

  const request = mockRequests.get(requestId);
  if (!request || !request.output) {
    return {
      requestId,
      status: 'failed',
      error: { code: 'UNKNOWN', message: 'Request not found' },
    };
  }

  // Simulate refinement by adding feedback context to the section
  await new Promise((resolve) => setTimeout(resolve, 1500)); // Simulate API delay

  const output = { ...request.output };

  // Simple mock refinement - prepend feedback acknowledgment
  if (section === 'problemStatement') {
    output.problemStatement = `[Refined based on feedback: "${feedback.substring(0, 50)}..."] ${output.problemStatement}`;
  } else if (section === 'proposedSolution') {
    output.proposedSolution = `[Refined based on feedback: "${feedback.substring(0, 50)}..."] ${output.proposedSolution}`;
  }

  request.output = output;

  return {
    requestId,
    status: 'completed',
    output,
  };
}

// Store original request data for mock output generation
const mockRequestData = new Map<string, GenerateProposalRequest>();

// ============================================================================
// END MOCK MODE IMPLEMENTATION
// ============================================================================

/**
 * Get authorization headers for API calls
 */
function getAuthHeaders(): HeadersInit {
  // BL-031: Access token is in httpOnly cookie, unavailable to JS. Use oracle-bridge proxy when available.
  const token: string | null = null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/**
 * Map API error response to ThinkTankError
 */
function mapApiError(
  status: number,
  body?: { code?: string; message?: string; retryAfter?: number }
): ThinkTankError {
  if (status === 429) {
    return {
      code: 'RATE_LIMITED',
      message: ERROR_MESSAGES.RATE_LIMITED,
      retryAfter: body?.retryAfter,
    };
  }
  if (status === 401 || status === 403) {
    return {
      code: 'NOT_MEMBER',
      message: ERROR_MESSAGES.NOT_MEMBER,
    };
  }
  if (status === 400) {
    return {
      code: 'INVALID_INPUT',
      message: body?.message ?? ERROR_MESSAGES.INVALID_INPUT,
    };
  }
  if (status === 503) {
    return {
      code: 'AI_UNAVAILABLE',
      message: ERROR_MESSAGES.AI_UNAVAILABLE,
    };
  }
  return {
    code: 'UNKNOWN',
    message: body?.message ?? ERROR_MESSAGES.UNKNOWN,
  };
}

/**
 * Generate a proposal using the Think Tank AI service
 *
 * @param request - The proposal generation request
 * @returns Promise with request ID and initial status
 */
export async function generateProposal(
  request: GenerateProposalRequest
): Promise<GenerateProposalResponse> {
  // Use mock mode if enabled
  if (THINK_TANK_MOCK_ENABLED) {
    return mockGenerateProposal(request);
  }

  const startTime = Date.now();
  logger.info('Generating proposal', {
    prompt: (request.prompt ?? '').substring(0, 50),
    scale: request.scale,
    vertical: request.vertical,
  });

  try {
    // BL-031: Access token is in httpOnly cookie, unavailable to JS. Use oracle-bridge proxy when available.
    const token: string | null = null;
    const response = await fetch(`${THINK_TANK_API_URL}/proposals/generate`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        prompt: request.prompt,
        scale: request.scale,
        vertical: request.vertical,
        sessionToken: token,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      const error = mapApiError(response.status, errorBody);
      logger.error('Generate proposal failed', {
        status: response.status,
        error,
        duration: Date.now() - startTime,
      });
      return {
        requestId: '',
        status: 'failed',
        error,
      };
    }

    const data = await response.json();
    logger.info('Generate proposal initiated', {
      requestId: data.requestId,
      status: data.status,
      duration: Date.now() - startTime,
    });
    return data as GenerateProposalResponse;
  } catch (err) {
    const error: ThinkTankError = {
      code: 'NETWORK_ERROR',
      message: ERROR_MESSAGES.NETWORK_ERROR,
    };
    logger.error('Generate proposal network error', {
      error: String(err),
      duration: Date.now() - startTime,
    });
    return {
      requestId: '',
      status: 'failed',
      error,
    };
  }
}

/**
 * Poll the status of a proposal generation request
 *
 * @param requestId - The request ID to poll
 * @returns Promise with current status
 */
export async function getStatus(requestId: string): Promise<GenerateProposalResponse> {
  // Use mock mode if enabled
  if (THINK_TANK_MOCK_ENABLED) {
    return mockGetStatus(requestId);
  }

  const startTime = Date.now();
  logger.info('Polling status', { requestId });

  try {
    const response = await fetch(`${THINK_TANK_API_URL}/proposals/${requestId}/status`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      const error = mapApiError(response.status, errorBody);
      logger.error('Poll status failed', {
        requestId,
        status: response.status,
        error,
        duration: Date.now() - startTime,
      });
      return {
        requestId,
        status: 'failed',
        error,
      };
    }

    const data = await response.json();
    logger.info('Poll status success', {
      requestId,
      status: data.status,
      duration: Date.now() - startTime,
    });
    return data as GenerateProposalResponse;
  } catch (err) {
    const error: ThinkTankError = {
      code: 'NETWORK_ERROR',
      message: ERROR_MESSAGES.NETWORK_ERROR,
    };
    logger.error('Poll status network error', {
      requestId,
      error: String(err),
      duration: Date.now() - startTime,
    });
    return {
      requestId,
      status: 'failed',
      error,
    };
  }
}

/**
 * Poll status until completion or timeout
 *
 * Uses visibility API to pause polling when tab is hidden.
 *
 * @param requestId - The request ID to poll
 * @param onProgress - Optional callback for progress updates
 * @returns Promise with final status (completed or failed)
 */
export async function pollStatus(
  requestId: string,
  onProgress?: (status: GenerationStatus, estimatedTime?: number) => void
): Promise<GenerateProposalResponse> {
  const startTime = Date.now();
  logger.info('Starting poll loop', { requestId, timeout: GENERATION_TIMEOUT_MS });

  return new Promise((resolve) => {
    let isPolling = true;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;

    // Handle visibility change - pause polling when hidden
    const handleVisibilityChange = () => {
      if (document.hidden && pollTimer) {
        logger.info('Tab hidden, pausing poll', { requestId });
        clearTimeout(pollTimer);
        pollTimer = null;
      } else if (!document.hidden && isPolling) {
        logger.info('Tab visible, resuming poll', { requestId });
        poll();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    const cleanup = () => {
      isPolling = false;
      if (pollTimer) {
        clearTimeout(pollTimer);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };

    const poll = async () => {
      if (!isPolling) return;

      // Check timeout
      const elapsed = Date.now() - startTime;
      if (elapsed >= GENERATION_TIMEOUT_MS) {
        logger.warn('Poll timeout', { requestId, elapsed });
        cleanup();
        resolve({
          requestId,
          status: 'failed',
          error: {
            code: 'TIMEOUT',
            message: ERROR_MESSAGES.TIMEOUT,
          },
        });
        return;
      }

      const response = await getStatus(requestId);

      if (response.status === 'completed' || response.status === 'failed') {
        logger.info('Poll complete', { requestId, status: response.status, elapsed });
        cleanup();
        resolve(response);
        return;
      }

      // Notify progress
      if (onProgress) {
        onProgress(response.status, response.estimatedTime);
      }

      // Schedule next poll (only if tab is visible)
      if (!document.hidden) {
        pollTimer = setTimeout(poll, POLL_INTERVAL_MS);
      }
    };

    // Start polling
    poll();
  });
}

/**
 * Refine a specific section of the generated proposal
 *
 * @param requestId - The original request ID
 * @param section - The section to refine
 * @param feedback - User feedback for refinement
 * @returns Promise with updated proposal
 */
export async function refineSection(
  requestId: string,
  section: keyof ThinkTankOutput,
  feedback: string
): Promise<GenerateProposalResponse> {
  // Use mock mode if enabled
  if (THINK_TANK_MOCK_ENABLED) {
    return mockRefineSection(requestId, section, feedback);
  }

  const startTime = Date.now();
  logger.info('Refining section', { requestId, section, feedbackLength: feedback.length });

  try {
    const response = await fetch(`${THINK_TANK_API_URL}/proposals/${requestId}/refine`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        section,
        feedback,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      const error = mapApiError(response.status, errorBody);
      logger.error('Refine section failed', {
        requestId,
        section,
        status: response.status,
        error,
        duration: Date.now() - startTime,
      });
      return {
        requestId,
        status: 'failed',
        error,
      };
    }

    const data = await response.json();
    logger.info('Refine section success', {
      requestId,
      section,
      status: data.status,
      duration: Date.now() - startTime,
    });
    return data as GenerateProposalResponse;
  } catch (err) {
    const error: ThinkTankError = {
      code: 'NETWORK_ERROR',
      message: ERROR_MESSAGES.NETWORK_ERROR,
    };
    logger.error('Refine section network error', {
      requestId,
      section,
      error: String(err),
      duration: Date.now() - startTime,
    });
    return {
      requestId,
      status: 'failed',
      error,
    };
  }
}

/**
 * Get user-friendly error message for display
 *
 * @param error - The ThinkTankError object
 * @returns Human-readable error message
 */
export function getErrorMessage(error: ThinkTankError): string {
  return ERROR_MESSAGES[error.code] ?? ERROR_MESSAGES.UNKNOWN;
}

/**
 * Check if an error is retryable
 *
 * @param error - The ThinkTankError object
 * @returns true if the operation can be retried
 */
export function isRetryable(error: ThinkTankError): boolean {
  return ['TIMEOUT', 'AI_UNAVAILABLE', 'NETWORK_ERROR'].includes(error.code);
}

// Export service object for easier mocking in tests
export const ThinkTankService = {
  generateProposal,
  getStatus,
  pollStatus,
  refineSection,
  getErrorMessage,
  isRetryable,
};

export default ThinkTankService;
