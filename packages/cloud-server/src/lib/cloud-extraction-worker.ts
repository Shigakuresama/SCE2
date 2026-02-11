import { prisma } from './database.js';
import { decryptJson } from './encryption.js';
import { config } from './config.js';
import type { SCEAutomationClient } from './sce-automation/types.js';

const SHARED_SESSION_FAILURE_PATTERNS = [
  'sce login required',
  'sce session expired',
  'does not have access to customer-search',
  'landed on',
  'could not find sce address fields',
  'could not find sce zip field',
];

function isSharedSessionFailure(message: string): boolean {
  const normalized = message.toLowerCase();
  return SHARED_SESSION_FAILURE_PATTERNS.some((pattern) =>
    normalized.includes(pattern)
  );
}

export async function processExtractionRun(
  runId: number,
  deps: { client: SCEAutomationClient }
): Promise<void> {
  const run = await prisma.extractionRun.findUnique({
    where: { id: runId },
    include: {
      session: true,
      items: {
        where: { status: 'QUEUED' },
        orderBy: { id: 'asc' },
      },
    },
  });

  if (!run) {
    throw new Error(`Extraction run ${runId} not found`);
  }

  let processedCount = run.processedCount;
  let successCount = run.successCount;
  let failureCount = run.failureCount;
  let sharedFailureMessage: string | null = null;
  try {
    const sessionStateJson = decryptJson(
      run.session.encryptedStateJson,
      config.sceSessionEncryptionKey
    );

    await prisma.extractionRun.update({
      where: { id: runId },
      data: {
        status: 'RUNNING',
        startedAt: run.startedAt ?? new Date(),
        errorSummary: null,
      },
    });

    for (let index = 0; index < run.items.length; index += 1) {
      const item = run.items[index];
      await prisma.extractionRunItem.update({
        where: { id: item.id },
        data: { status: 'PROCESSING', error: null },
      });

      const property = await prisma.property.findUnique({
        where: { id: item.propertyId },
      });

      if (!property) {
        processedCount += 1;
        failureCount += 1;
        await prisma.extractionRunItem.update({
          where: { id: item.id },
          data: { status: 'FAILED', error: `Property ${item.propertyId} not found` },
        });
        continue;
      }

      try {
        const extraction = await deps.client.extractCustomerData(
          {
            streetNumber: property.streetNumber ?? '',
            streetName: property.streetName ?? '',
            zipCode: property.zipCode ?? '',
          },
          { storageStateJson: sessionStateJson }
        );

        const hasExtractedCustomerData = [
          extraction.customerName,
          extraction.customerPhone,
          extraction.customerEmail,
        ].some((value) => typeof value === 'string' && value.trim().length > 0);

        if (!hasExtractedCustomerData) {
          throw new Error(
            `No customer data extracted for property ${property.id}; keeping status as ${property.status}`
          );
        }

        await prisma.property.update({
          where: { id: property.id },
          data: {
            customerName: extraction.customerName ?? property.customerName,
            customerPhone: extraction.customerPhone ?? property.customerPhone,
            customerEmail: extraction.customerEmail ?? property.customerEmail,
            dataExtracted: true,
            extractedAt: new Date(),
            status: 'READY_FOR_FIELD',
          },
        });

        processedCount += 1;
        successCount += 1;
        await prisma.extractionRunItem.update({
          where: { id: item.id },
          data: { status: 'SUCCEEDED', error: null },
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown extraction error';
        processedCount += 1;
        failureCount += 1;
        await prisma.extractionRunItem.update({
          where: { id: item.id },
          data: {
            status: 'FAILED',
            error: errorMessage,
          },
        });

        if (isSharedSessionFailure(errorMessage)) {
          sharedFailureMessage = errorMessage;
          const queuedItemIds = run.items
            .slice(index + 1)
            .map((queuedItem) => queuedItem.id);

          if (queuedItemIds.length > 0) {
            const sharedFailureSummary = `Skipped after shared SCE session failure: ${errorMessage}`;
            const skipped = await prisma.extractionRunItem.updateMany({
              where: {
                id: { in: queuedItemIds },
                status: 'QUEUED',
              },
              data: {
                status: 'FAILED',
                error: sharedFailureSummary,
              },
            });

            processedCount += skipped.count;
            failureCount += skipped.count;
          }

          break;
        }
      }
    }

    const finalStatus =
      failureCount > 0
        ? successCount > 0
          ? 'COMPLETED_WITH_ERRORS'
          : 'FAILED'
        : 'COMPLETED';

    await prisma.extractionRun.update({
      where: { id: runId },
      data: {
        status: finalStatus,
        processedCount,
        successCount,
        failureCount,
        finishedAt: new Date(),
        errorSummary: sharedFailureMessage,
      },
    });
  } catch (error) {
    await prisma.extractionRun.update({
      where: { id: runId },
      data: {
        status: 'FAILED',
        processedCount,
        successCount,
        failureCount,
        startedAt: run.startedAt ?? new Date(),
        finishedAt: new Date(),
        errorSummary: error instanceof Error ? error.message : 'Unexpected extraction failure',
      },
    });
    throw error;
  }
}
