import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from '@testing-library/react';
import { CompleteVisitButton } from '../CompleteVisitButton';
import { mobileAPI } from '../../lib/api';
import type { MobilePropertyData } from '../../types';

vi.mock('../../lib/api', () => ({
  mobileAPI: {
    completeVisit: vi.fn(),
  },
  APIError: class APIError extends Error {
    response?: { message?: string };

    constructor(message: string, response?: { message?: string }) {
      super(message);
      this.name = 'APIError';
      this.response = response;
    }
  },
}));

const makeProperty = (overrides: Partial<MobilePropertyData> = {}): MobilePropertyData => ({
  id: 10,
  addressFull: '100 Test Ave, Santa Ana, CA 92706',
  streetNumber: '100',
  streetName: 'Test Ave',
  zipCode: '92706',
  status: 'VISITED',
  documents: [],
  ...overrides,
});

describe('CompleteVisitButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('is disabled until BILL and SIGNATURE exist', () => {
    render(
      <CompleteVisitButton
        propertyId={10}
        documents={[{ id: 1, docType: 'BILL' } as any]}
        status="READY_FOR_FIELD"
        onCompleted={() => {}}
      />
    );

    expect(
      screen.getByRole('button', { name: /complete visit/i })
    ).toBeDisabled();
  });

  it('calls API and callback when requirements are met', async () => {
    const completedProperty = makeProperty({
      id: 22,
      status: 'VISITED',
      documents: [
        { id: 3, docType: 'BILL' } as any,
        { id: 4, docType: 'SIGNATURE' } as any,
      ],
    });
    const onCompleted = vi.fn();
    vi.mocked(mobileAPI.completeVisit).mockResolvedValue(completedProperty);

    render(
      <CompleteVisitButton
        propertyId={22}
        status="READY_FOR_FIELD"
        documents={[
          { id: 3, docType: 'BILL' } as any,
          { id: 4, docType: 'SIGNATURE' } as any,
        ]}
        onCompleted={onCompleted}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /complete visit/i }));

    await waitFor(() => {
      expect(mobileAPI.completeVisit).toHaveBeenCalledWith(22);
      expect(onCompleted).toHaveBeenCalledWith(completedProperty);
    });
  });
});
