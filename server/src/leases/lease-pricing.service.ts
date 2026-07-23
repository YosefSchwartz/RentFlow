import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LeaseTerm } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LeaseTermInputDto } from './dto';

const DEFAULT_CURRENCY = 'ILS';
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** The lease fields a pricing schedule is validated against. */
export interface LeaseDateRange {
  startDate: Date;
  endDate: Date | null;
}

/** A validated pricing period, ready to persist. */
export interface NormalizedLeaseTerm {
  startDate: Date;
  endDate: Date | null;
  monthlyRent: number;
  currency: string;
  notes: string | null;
  displayOrder: number;
}

/** Truncate to a UTC calendar day — all schedule rules are day-granular. */
const toUtcDay = (date: Date): number =>
  Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());

/**
 * The single home for lease pricing. All rent reads and schedule writes go
 * through this service — business code must never read Lease.monthlyRent
 * (a legacy mirror of the first term) directly.
 *
 * Future pricing features (CPI indexation, annual increases, discounts,
 * promotional pricing, additional monthly charges) extend this service and
 * the LeaseTerm model; callers keep using the same entry points.
 */
@Injectable()
export class LeasePricingService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------
  // Pure schedule logic (no DB) — used by LeasesService on create/update.
  // ---------------------------------------------------------------------

  /**
   * Sort, default and validate a pricing schedule against the lease dates.
   * Throws BadRequestException on any rule violation:
   * - at least one period
   * - no overlaps and no gaps (periods are contiguous, day-granular)
   * - the schedule exactly covers the lease duration
   * - only the last period of an open-ended lease may be open-ended
   * - displayOrder unique per lease
   */
  normalizeSchedule(
    lease: LeaseDateRange,
    inputs: LeaseTermInputDto[],
  ): NormalizedLeaseTerm[] {
    if (!inputs || inputs.length === 0) {
      throw new BadRequestException('At least one pricing period is required');
    }

    const terms = inputs
      .map((input, index) => ({
        startDate: new Date(input.startDate),
        endDate: input.endDate ? new Date(input.endDate) : null,
        monthlyRent: input.monthlyRent,
        currency: input.currency ?? DEFAULT_CURRENCY,
        notes: input.notes ?? null,
        displayOrder: input.displayOrder ?? index + 1,
      }))
      .sort((a, b) => toUtcDay(a.startDate) - toUtcDay(b.startDate));

    // Explicit displayOrders must be unique; defaulted ones are re-assigned
    // from the chronological position below only when none were provided.
    const explicitOrders = inputs.filter((i) => i.displayOrder != null);
    if (explicitOrders.length === 0) {
      terms.forEach((term, index) => (term.displayOrder = index + 1));
    } else if (
      new Set(terms.map((t) => t.displayOrder)).size !== terms.length
    ) {
      throw new BadRequestException(
        'displayOrder must be unique per pricing period',
      );
    }

    const leaseStart = toUtcDay(lease.startDate);
    const leaseEnd = lease.endDate ? toUtcDay(lease.endDate) : null;

    terms.forEach((term, index) => {
      const isLast = index === terms.length - 1;
      const start = toUtcDay(term.startDate);

      if (term.endDate === null && !isLast) {
        throw new BadRequestException(
          'Only the last pricing period may be open-ended',
        );
      }
      if (term.endDate !== null && toUtcDay(term.endDate) < start) {
        throw new BadRequestException(
          'A pricing period must end on or after its start date',
        );
      }
      if (start < leaseStart || (leaseEnd !== null && start > leaseEnd)) {
        throw new BadRequestException(
          'Pricing periods must stay within the lease dates',
        );
      }
      if (
        term.endDate !== null &&
        leaseEnd !== null &&
        toUtcDay(term.endDate) > leaseEnd
      ) {
        throw new BadRequestException(
          'Pricing periods must stay within the lease dates',
        );
      }

      if (index > 0) {
        const previousEnd = terms[index - 1].endDate as Date; // non-null: checked above
        const expectedStart = toUtcDay(previousEnd) + MS_PER_DAY;
        if (start < expectedStart) {
          throw new BadRequestException('Pricing periods must not overlap');
        }
        if (start > expectedStart) {
          throw new BadRequestException(
            'Pricing periods must not leave gaps in the schedule',
          );
        }
      }
    });

    // Full coverage of the lease duration.
    if (toUtcDay(terms[0].startDate) !== leaseStart) {
      throw new BadRequestException(
        'The pricing schedule must start on the lease start date',
      );
    }
    const lastEnd = terms[terms.length - 1].endDate;
    if (leaseEnd === null) {
      if (lastEnd !== null) {
        throw new BadRequestException(
          'An open-ended lease requires an open-ended final pricing period',
        );
      }
    } else if (lastEnd === null || toUtcDay(lastEnd) !== leaseEnd) {
      throw new BadRequestException(
        'The pricing schedule must end on the lease end date',
      );
    }

    return terms;
  }

  /** The single default period covering the entire lease (legacy input path). */
  singleTermSchedule(
    lease: LeaseDateRange,
    monthlyRent: number,
  ): NormalizedLeaseTerm[] {
    return [
      {
        startDate: lease.startDate,
        endDate: lease.endDate,
        monthlyRent,
        currency: DEFAULT_CURRENCY,
        notes: null,
        displayOrder: 1,
      },
    ];
  }

  /** The period in effect on the given day, if any. */
  termForDate<T extends { startDate: Date; endDate: Date | null }>(
    terms: T[],
    date: Date,
  ): T | null {
    const day = toUtcDay(date);
    return (
      terms.find(
        (term) =>
          toUtcDay(term.startDate) <= day &&
          (term.endDate === null || toUtcDay(term.endDate) >= day),
      ) ?? null
    );
  }

  // ---------------------------------------------------------------------
  // Rent reads (DB-backed, owner- or tenant-scoped).
  // ---------------------------------------------------------------------

  /** The lease's pricing schedule, sorted by start date. */
  async getLeaseTerms(leaseId: string, userId: string): Promise<LeaseTerm[]> {
    await this.ensureLeaseAccess(leaseId, userId);
    return this.prisma.leaseTerm.findMany({
      where: { leaseId },
      orderBy: { startDate: 'asc' },
    });
  }

  /** The pricing period in effect on the given date, if any. */
  async getRentForDate(
    leaseId: string,
    date: Date,
    userId: string,
  ): Promise<LeaseTerm | null> {
    const terms = await this.getLeaseTerms(leaseId, userId);
    return this.termForDate(terms, date);
  }

  /** The pricing period in effect today, if any. */
  async getCurrentRent(
    leaseId: string,
    userId: string,
  ): Promise<LeaseTerm | null> {
    return this.getRentForDate(leaseId, new Date(), userId);
  }

  private async ensureLeaseAccess(
    leaseId: string,
    userId: string,
  ): Promise<void> {
    const lease = await this.prisma.lease.findUnique({
      where: { id: leaseId },
      select: { tenantId: true, property: { select: { ownerId: true } } },
    });
    if (!lease) {
      throw new NotFoundException('Lease not found');
    }
    if (lease.property.ownerId !== userId && lease.tenantId !== userId) {
      throw new ForbiddenException('You do not have access to this lease');
    }
  }
}
