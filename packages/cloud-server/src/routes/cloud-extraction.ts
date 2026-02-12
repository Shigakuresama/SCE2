import { Router } from 'express';
import { prisma } from '../lib/database.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { NotFoundError, ValidationError } from '../types/errors.js';
import { decryptJson, encryptJson } from '../lib/encryption.js';
import { config } from '../lib/config.js';
import { logger } from '../lib/logger.js';
import { processExtractionRun } from '../lib/cloud-extraction-worker.js';
import { PlaywrightSCEAutomationClient } from '../lib/sce-automation/playwright-client.js';

export const cloudExtractionRoutes = Router();

type SessionCredentialsInput = {
  username: string;
  password: string;
};

type SessionValidationInput = {
  storageStateJson: string;
};

let runLauncher = async (runId: number) => {
  await processExtractionRun(runId, {
    client: new PlaywrightSCEAutomationClient(),
  });
};
let sessionStateFactory = async (
  credentials: SessionCredentialsInput
): Promise<string> => {
  const client = new PlaywrightSCEAutomationClient();
  return client.createStorageStateFromCredentials(credentials);
};
let sessionValidator = async (
  input: SessionValidationInput
): Promise<{ currentUrl: string }> => {
  const client = new PlaywrightSCEAutomationClient();
  return client.validateSessionAccess({ storageStateJson: input.storageStateJson });
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

export function setCloudExtractionSessionStateFactoryForTests(
  factory: ((credentials: SessionCredentialsInput) => Promise<string>) | null
) {
  sessionStateFactory = factory ?? (async (credentials: SessionCredentialsInput) => {
    const client = new PlaywrightSCEAutomationClient();
    return client.createStorageStateFromCredentials(credentials);
  });
}

export function setCloudExtractionSessionValidatorForTests(
  validator:
    | ((input: SessionValidationInput) => Promise<{ currentUrl: string }>)
    | null
) {
  sessionValidator = validator ?? (async (input: SessionValidationInput) => {
    const client = new PlaywrightSCEAutomationClient();
    return client.validateSessionAccess({ storageStateJson: input.storageStateJson });
  });
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

function parseSceUsername(value: unknown): string {
  if (typeof value !== 'string') {
    throw new ValidationError('username is required and must be a string');
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new ValidationError('username cannot be empty');
  }
  if (trimmed.length > 320) {
    throw new ValidationError('username must be 320 characters or less');
  }
  return trimmed;
}

function parseScePassword(value: unknown): string {
  if (typeof value !== 'string') {
    throw new ValidationError('password is required and must be a string');
  }

  if (!value.trim()) {
    throw new ValidationError('password cannot be empty');
  }
  if (value.length > 500) {
    throw new ValidationError('password must be 500 characters or less');
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

cloudExtractionRoutes.post(
  '/sessions/login-bridge',
  asyncHandler(async (req, res) => {
    const label = parseSessionLabel(req.body?.label);
    const username = parseSceUsername(req.body?.username);
    const password = parseScePassword(req.body?.password);
    const expiresAt = parseExpiration(req.body?.expiresAt);
    const encryptionKey = requireEncryptionKey();
    let sessionStateJson: string;
    try {
      sessionStateJson = await sessionStateFactory({ username, password });
    } catch (error) {
      const reason =
        error instanceof Error && error.message
          ? error.message
          : 'Unknown login bridge failure while creating session state.';

      logger.warn('Cloud extraction login bridge failed', {
        username,
        reason,
      });

      throw new ValidationError(`Unable to create session from SCE login: ${reason}`);
    }
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
  '/sessions/:id/validate',
  asyncHandler(async (req, res) => {
    const sessionId = parseSessionId(Number(req.params.id));

    const session = await prisma.extractionSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        isActive: true,
        expiresAt: true,
        encryptedStateJson: true,
      },
    });

    if (!session) {
      throw new NotFoundError('ExtractionSession', sessionId);
    }

    const checkedAt = new Date().toISOString();
    if (!session.isActive) {
      return res.json({
        success: true,
        data: {
          sessionId,
          valid: false,
          checkedAt,
          message: 'Session is inactive. Create a new login bridge session.',
        },
      });
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      return res.json({
        success: true,
        data: {
          sessionId,
          valid: false,
          checkedAt,
          message: 'Session expired. Create a new login bridge session.',
        },
      });
    }

    const sessionStateJson = decryptJson(
      session.encryptedStateJson,
      requireEncryptionKey()
    );

    try {
      const result = await sessionValidator({ storageStateJson: sessionStateJson });
      return res.json({
        success: true,
        data: {
          sessionId,
          valid: true,
          checkedAt,
          message: 'Session can access SCE customer-search.',
          currentUrl: result.currentUrl,
        },
      });
    } catch (error) {
      const reason =
        error instanceof Error && error.message
          ? error.message
          : 'Unknown session validation failure.';
      logger.warn('Cloud extraction session validation failed', {
        sessionId,
        reason,
      });
      return res.json({
        success: true,
        data: {
          sessionId,
          valid: false,
          checkedAt,
          message: reason,
        },
      });
    }
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
      select: { id: true, status: true },
    });

    if (!run) {
      throw new NotFoundError('ExtractionRun', runId);
    }
    if (run.status !== 'QUEUED') {
      return res.status(409).json({
        success: false,
        error: { message: `Run ${runId} cannot be started from status ${run.status}` },
      });
    }

    await prisma.extractionRun.update({
      where: { id: runId },
      data: {
        status: 'RUNNING',
        startedAt: new Date(),
      },
    });

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
