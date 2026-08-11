/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  CountTokensParameters,
  CountTokensResponse,
  EmbedContentParameters,
  EmbedContentResponse,
  GenerateContentParameters,
  GenerateContentResponse,
} from '@google/genai';
import type { ContentGenerator } from './contentGenerator.js';
import {
  TerminalQuotaError,
  RetryableQuotaError,
} from '../utils/googleQuotaErrors.js';
import { getErrorStatus } from '../utils/httpErrors.js';
import { debugLogger } from '../utils/debugLogger.js';
import type { LlmRole } from '../telemetry/llmRole.js';
import type { UserTierId, GeminiUserTier } from '../code_assist/types.js';

const QUOTA_ERROR_STATUSES = new Set([429, 499, 503]);

export class RotatingContentGenerator implements ContentGenerator {
  private static rotationIndex = 0;

  private readonly generators: readonly ContentGenerator[];

  private readonly keyIds: readonly string[];

  constructor(
    generators: ReadonlyArray<ContentGenerator>,
    keyIds: ReadonlyArray<string> = [],
  ) {
    if (generators.length < 2) {
      throw new Error(
        'RotatingContentGenerator requires at least 2 generators',
      );
    }
    if (generators.length > 5) {
      throw new Error(
        'RotatingContentGenerator supports at most 5 generators',
      );
    }
    this.generators = [...generators];
    this.keyIds = [...keyIds];
  }

  /** @internal Resets the process-wide rotation counter (test isolation). */
  static resetRotationIndexForTesting(): void {
    RotatingContentGenerator.rotationIndex = 0;
  }

  get userTier(): UserTierId | undefined {
    return this.generators[0]?.userTier;
  }

  get userTierName(): string | undefined {
    return this.generators[0]?.userTierName;
  }

  get paidTier(): GeminiUserTier | undefined {
    return this.generators[0]?.paidTier;
  }

  private nextGenerator(): ContentGenerator {
    const index =
      RotatingContentGenerator.rotationIndex % this.generators.length;
    RotatingContentGenerator.rotationIndex += 1;
    debugLogger.debug(
      `[api-key-rotation] request #${RotatingContentGenerator.rotationIndex} -> apiKey[${
        this.keyIds[index] ?? index + 1
      }]`,
    );
    return this.generators[index];
  }

  private currentGenerator(): ContentGenerator {
    const index =
      RotatingContentGenerator.rotationIndex % this.generators.length;
    return this.generators[index];
  }

  private static isQuotaError(error: unknown): boolean {
    if (
      error instanceof TerminalQuotaError ||
      error instanceof RetryableQuotaError
    ) {
      return true;
    }
    const status = getErrorStatus(error);
    return status !== undefined && QUOTA_ERROR_STATUSES.has(status);
  }

  async generateContent(
    req: GenerateContentParameters,
    userPromptId: string,
    role: LlmRole,
  ): Promise<GenerateContentResponse> {
    let lastError: unknown;
    for (let attempt = 0; attempt < this.generators.length; attempt++) {
      const generator = this.nextGenerator();
      try {
        return await generator.generateContent(req, userPromptId, role);
      } catch (error) {
        if (!RotatingContentGenerator.isQuotaError(error)) {
          throw error;
        }
        lastError = error;
      }
    }
    throw lastError;
  }

  async generateContentStream(
    req: GenerateContentParameters,
    userPromptId: string,
    role: LlmRole,
  ): Promise<AsyncGenerator<GenerateContentResponse>> {
    let lastError: unknown;
    for (let attempt = 0; attempt < this.generators.length; attempt++) {
      const generator = this.nextGenerator();
      try {
        return await generator.generateContentStream(req, userPromptId, role);
      } catch (error) {
        if (!RotatingContentGenerator.isQuotaError(error)) {
          throw error;
        }
        lastError = error;
      }
    }
    throw lastError;
  }

  async countTokens(
    req: CountTokensParameters,
  ): Promise<CountTokensResponse> {
    return this.currentGenerator().countTokens(req);
  }

  async embedContent(
    req: EmbedContentParameters,
  ): Promise<EmbedContentResponse> {
    return this.currentGenerator().embedContent(req);
  }
}
