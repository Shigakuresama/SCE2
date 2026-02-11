import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../../App';

vi.mock('../QRScanner', () => ({
  QRScanner: () => <div data-testid="mock-qr-scanner">Mock scanner</div>,
}));

describe('Route pack shortcut', () => {
  it('shows route pack shortcut when scanner is visible', () => {
    window.history.replaceState({}, '', '/');

    render(<App />);

    expect(screen.getByRole('link', { name: /create route pdf/i })).toHaveAttribute(
      'href',
      expect.stringMatching(/\/#\/mobile-pack$/)
    );
  });
});
