import type { Lease, LeaseTerm } from '../types';

// Client-side mirror of the backend LeasePricingService selection logic.
// All comparisons are day-granular with inclusive boundaries.

const toUtcDay = (date: Date): number =>
  Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());

// The pricing period in effect on the given day, if any.
export const leaseTermForDate = (
  terms: LeaseTerm[],
  date: Date,
): LeaseTerm | null => {
  const day = toUtcDay(date);
  return (
    terms.find(
      (term) =>
        toUtcDay(new Date(term.startDate)) <= day &&
        (term.endDate == null || toUtcDay(new Date(term.endDate)) >= day),
    ) ?? null
  );
};

export interface LeaseRent {
  amount: number;
  currency: string;
}

// The rent to display for a lease "now": the period in effect today, else the
// first period (lease not started yet), else the last one (lease already
// ended). Falls back to the legacy monthlyRent for leases without periods.
export const getCurrentLeaseRent = (lease: Lease): LeaseRent | null => {
  const terms = lease.leaseTerms ?? [];
  if (terms.length > 0) {
    const sorted = [...terms].sort(
      (a, b) => toUtcDay(new Date(a.startDate)) - toUtcDay(new Date(b.startDate)),
    );
    const today = new Date();
    const current =
      leaseTermForDate(sorted, today) ??
      (toUtcDay(today) < toUtcDay(new Date(sorted[0].startDate))
        ? sorted[0]
        : sorted[sorted.length - 1]);
    return { amount: Number(current.monthlyRent), currency: current.currency };
  }
  if (lease.monthlyRent != null) {
    return { amount: Number(lease.monthlyRent), currency: 'ILS' };
  }
  return null;
};
