import { describe, expect, it } from 'vitest';
import { PURCHASE_STATUSES, isPurchaseResult } from './purchase-result.model';

describe('isPurchaseResult', () => {
  it('accepts a body for every status the API can send', () => {
    for (const status of PURCHASE_STATUSES) {
      expect(isPurchaseResult({ status })).toBe(true);
    }
  });

  it('rejects validation problem details, whose numeric status is also truthy', () => {
    const problem = {
      type: 'https://tools.ietf.org/html/rfc9110#section-15.5.1',
      title: 'One or more validation errors occurred.',
      status: 400,
      errors: { ProductCode: ['The ProductCode field is required.'] },
    };

    expect(isPurchaseResult(problem)).toBe(false);
  });

  it('rejects the ProgressEvent handed over when the request never completed', () => {
    expect(isPurchaseResult(new ProgressEvent('error'))).toBe(false);
  });

  it('rejects bodies that are absent or not objects', () => {
    expect(isPurchaseResult(null)).toBe(false);
    expect(isPurchaseResult(undefined)).toBe(false);
    expect(isPurchaseResult('Internal Server Error')).toBe(false);
  });
});
