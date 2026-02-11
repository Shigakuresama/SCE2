import { Router } from 'express';
import { prisma } from '../lib/database.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { NotFoundError, ValidationError } from '../types/errors.js';
import { encryptJson } from '../lib/encryption.js';
import { config } from '../lib/config.js';
import { logger } from '../lib/logger.js';
import { processExtractionRun } from '../lib/cloud-extraction-worker.js';
import { PlaywrightSCEAutomationClient } from '../lib/sce-automation/playwright-client.js';

export const cloudExtractionRoutes = Router();

let runLauncher = async (runId: number) => {
  await processExtractionRun(runId, {
    client: new PlaywrightSCEAutomationClient(),
  });
};
let cloudExtractionEnabledOverride: boolean | null = null;

function isCloudExtractionEnabled(): boolean {
  return cloudExtractionEnabledOverride ?? config.sceAutomationEnabled;
}

export function setCloudExtractionRunLauncherForTests(
  launcher: typeof runLauncher
) {
  runLauncher = launcher;
}

export function setCloudExtractionEnabledForTests(enabled: boolean | null) {
  cloudExtractionEnabledOverride = enabled;
}

function parseSessionId(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new ValidationError('sessionId must be a positive integer');
  }
  return value;
}

function parsePropertyIds(value: unknown): number[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ValidationError('propertyIds must be a non-empty array');
  }
  if (value.some((id) => typeof id !== 'number' || !Number.isInteger(id) || id <= 0)) {
    throw new ValidationError('propertyIds must contain only positive integers');
  }

  return value as number[];
}

function parseSessionLabel(value: unknown): string {
  if (typeof value !== 'string') {
    throw new ValidationError('label is required and must be a string');
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new ValidationError('label cannot be empty');
  }
  if (trimmed.length > 200) {
    throw new ValidationError('label must be 200 characters or less');
  }
  return trimmed;
}

function parseSessionStateJson(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ValidationError('sessionStateJson is required and must be a JSON string');
  }

  try {
    JSON.parse(value);
  } catch {
    throw new ValidationError('sessionStateJson must be valid JSON');
  }

  return value;
}

function parseExpiration(value: unknown): Date {
  if (typeof value !== 'string') {
    throw new ValidationError('expiresAt is required and must be an ISO date string');
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new ValidationError('expiresAt must be a valid ISO date string');
  }

  if (parsed.getTime() <= Date.now()) {
    throw new ValidationError('expiresAt must be in the future');
  }

  return parsed;
}

function requireEncryptionKey(): string {
  const key = config.sceSessionEncryptionKey?.trim();
  if (!key) {
    throw new ValidationError('SCE session encryption key is not configured');
  }

  return key;
}

cloudExtractionRoutes.use((req, res, next) => {
  if (!isCloudExtractionEnabled()) {
    res.status(503).json({
      success: false,
      error: { message: 'Cloud extraction disabled' },
    });
    return;
  }
  next();
});

cloudExtractionRoutes.post(
  '/sessions',
  asyncHandler(async (req, res) => {
    const label = parseSessionLabel(req.body?.label);
    const sessionStateJson = parseSessionStateJson(req.body?.sessionStateJson);
    const expiresAt = parseExpiration(req.body?.expiresAt);
    const encryptionKey = requireEncryptionKey();
    const encryptedStateJson = encryptJson(sessionStateJson, encryptionKey);

    const session = await prisma.extractionSession.create({
      data: {
        label,
        encryptedStateJson,
        expiresAt,
      },
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        label: true,
        expiresAt: true,
        isActive: true,
      },
    });

    res.status(201).json({ success: true, data: session });
  })
);

cloudExtractionRoutes.get(
  '/sessions',
  asyncHandler(async (req, res) => {
    const sessions = await prisma.extractionSession.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        label: true,
        expiresAt: true,
        isActive: true,
      },
    });

    res.json({ success: true, data: sessions });
  })
);

cloudExtractionRoutes.post(
  '/runs',
  asyncHandler(async (req, res) => {
    const sessionId = parseSessionId(req.body?.sessionId);
    const propertyIds = parsePropertyIds(req.body?.propertyIds);

    const session = await prisma.extractionSession.findUnique({
      where: { id: sessionId },
      select: { id: true },
    });

    if (!session) {
      throw new NotFoundError('ExtractionSession', sessionId);
    }

    const run = await prisma.extractionRun.create({
      data: {
        sessionId,
        status: 'QUEUED',
        totalCount: propertyIds.length,
        items: {
          create: propertyIds.map((propertyId) => ({
            propertyId,
            status: 'QUEUED',
          })),
        },
      },
      select: {
        id: true,
        status: true,
        totalCount: true,
        processedCount: true,
        successCount: true,
        failureCount: true,
        sessionId: true,
      },
    });

    res.status(201).json({ success: true, data: run });
  })
);

cloudExtractionRoutes.post(
  '/runs/:id/start',
  asyncHandler(async (req, res) => {
    const runId = parseSessionId(Number(req.params.id));

    const run = await prisma.extractionRun.findUnique({
      where: { id: runId },
      select: { id: true },
    });

    if (!run) {
      throw new NotFoundError('ExtractionRun', runId);
    }

    void runLauncher(runId).catch((error) => {
      logger.error('Cloud extraction run failed', {
        runId,
        message: error instanceof Error ? error.message : String(error),
      });
    });

    res.status(202).json({
      success: true,
      data: {
        id: runId,
        status: 'RUNNING',
      },
    });
  })
);

cloudExtractionRoutes.get(
  '/runs/:id',
  asyncHandler(async (req, res) => {
    const runId = parseSessionId(Number(req.params.id));

    const run = await prisma.extractionRun.findUnique({
      where: { id: runId },
      include: {
        items: {
          orderBy: { id: 'asc' },
        },
      },
    });

    if (!run) {
      throw new NotFoundError('ExtractionRun', runId);
    }

    res.json({ success: true, data: run });
  })
);
