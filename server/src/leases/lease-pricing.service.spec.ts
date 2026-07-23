import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { LeasePricingService } from './lease-pricing.service';
import { PrismaService } from '../prisma/prisma.service';
import { LeaseTermInputDto } from './dto';

const lease = (start: string, end: string | null) => ({
  startDate: new Date(start),
  endDate: end ? new Date(end) : null,
});

const term = (
  startDate: string,
  endDate: string | null,
  monthlyRent = 4500,
  extra: Partial<LeaseTermInputDto> = {},
): LeaseTermInputDto => ({
  startDate,
  endDate: endDate ?? undefined,
  monthlyRent,
  ...extra,
});

describe('LeasePricingService', () => {
  let service: LeasePricingService;
  let prisma: {
    lease: { findUnique: jest.Mock };
    leaseTerm: { findMany: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      lease: { findUnique: jest.fn() },
      leaseTerm: { findMany: jest.fn() },
    };
    service = new LeasePricingService(prisma as unknown as PrismaService);
  });

  describe('normalizeSchedule', () => {
    const fixedLease = lease('2026-01-01', '2026-12-31');

    it('accepts a single period covering the whole lease', () => {
      const result = service.normalizeSchedule(fixedLease, [
        term('2026-01-01', '2026-12-31'),
      ]);
      expect(result).toHaveLength(1);
      expect(result[0].displayOrder).toBe(1);
      expect(result[0].currency).toBe('ILS');
    });

    it('accepts contiguous periods and sorts them by start date', () => {
      const result = service.normalizeSchedule(fixedLease, [
        term('2026-07-01', '2026-12-31', 5400),
        term('2026-01-01', '2026-03-31', 4500),
        term('2026-04-01', '2026-06-30', 5000),
      ]);
      expect(result.map((t) => t.monthlyRent)).toEqual([4500, 5000, 5400]);
      expect(result.map((t) => t.displayOrder)).toEqual([1, 2, 3]);
    });

    it('accepts an open-ended final period on an open-ended lease', () => {
      const result = service.normalizeSchedule(lease('2026-01-01', null), [
        term('2026-01-01', '2026-06-30'),
        term('2026-07-01', null, 5000),
      ]);
      expect(result[1].endDate).toBeNull();
    });

    it('rejects an empty schedule', () => {
      expect(() => service.normalizeSchedule(fixedLease, [])).toThrow(
        BadRequestException,
      );
    });

    it('rejects overlapping periods', () => {
      expect(() =>
        service.normalizeSchedule(fixedLease, [
          term('2026-01-01', '2026-06-30'),
          term('2026-06-30', '2026-12-31'),
        ]),
      ).toThrow('Pricing periods must not overlap');
    });

    it('rejects gaps between periods', () => {
      expect(() =>
        service.normalizeSchedule(fixedLease, [
          term('2026-01-01', '2026-06-30'),
          term('2026-07-05', '2026-12-31'),
        ]),
      ).toThrow('Pricing periods must not leave gaps in the schedule');
    });

    it('rejects a schedule that starts after the lease start', () => {
      expect(() =>
        service.normalizeSchedule(fixedLease, [
          term('2026-02-01', '2026-12-31'),
        ]),
      ).toThrow('The pricing schedule must start on the lease start date');
    });

    it('rejects a schedule that ends before the lease end', () => {
      expect(() =>
        service.normalizeSchedule(fixedLease, [
          term('2026-01-01', '2026-11-30'),
        ]),
      ).toThrow('The pricing schedule must end on the lease end date');
    });

    it('rejects periods outside the lease dates', () => {
      expect(() =>
        service.normalizeSchedule(fixedLease, [
          term('2025-12-01', '2026-12-31'),
        ]),
      ).toThrow('Pricing periods must stay within the lease dates');
    });

    it('rejects an open-ended period that is not last', () => {
      expect(() =>
        service.normalizeSchedule(lease('2026-01-01', null), [
          term('2026-01-01', null),
          term('2026-07-01', null, 5000),
        ]),
      ).toThrow('Only the last pricing period may be open-ended');
    });

    it('rejects a closed final period on an open-ended lease', () => {
      expect(() =>
        service.normalizeSchedule(lease('2026-01-01', null), [
          term('2026-01-01', '2026-12-31'),
        ]),
      ).toThrow(
        'An open-ended lease requires an open-ended final pricing period',
      );
    });

    it('rejects a period that ends before it starts', () => {
      expect(() =>
        service.normalizeSchedule(fixedLease, [
          term('2026-06-30', '2026-01-01'),
        ]),
      ).toThrow('A pricing period must end on or after its start date');
    });

    it('rejects duplicate explicit displayOrders', () => {
      expect(() =>
        service.normalizeSchedule(fixedLease, [
          term('2026-01-01', '2026-06-30', 4500, { displayOrder: 1 }),
          term('2026-07-01', '2026-12-31', 5000, { displayOrder: 1 }),
        ]),
      ).toThrow('displayOrder must be unique per pricing period');
    });

    it('keeps unique explicit displayOrders', () => {
      const result = service.normalizeSchedule(fixedLease, [
        term('2026-01-01', '2026-06-30', 4500, { displayOrder: 2 }),
        term('2026-07-01', '2026-12-31', 5000, { displayOrder: 1 }),
      ]);
      expect(result.map((t) => t.displayOrder)).toEqual([2, 1]);
    });
  });

  describe('singleTermSchedule', () => {
    it('covers the entire lease with one default-currency period', () => {
      const [only] = service.singleTermSchedule(
        lease('2026-01-01', '2026-12-31'),
        4500,
      );
      expect(only).toMatchObject({
        monthlyRent: 4500,
        currency: 'ILS',
        displayOrder: 1,
      });
      expect(only.startDate).toEqual(new Date('2026-01-01'));
      expect(only.endDate).toEqual(new Date('2026-12-31'));
    });

    it('mirrors an open-ended lease', () => {
      const [only] = service.singleTermSchedule(
        lease('2026-01-01', null),
        4500,
      );
      expect(only.endDate).toBeNull();
    });
  });

  describe('termForDate', () => {
    const terms = [
      {
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-03-31'),
        rent: 4500,
      },
      {
        startDate: new Date('2026-04-01'),
        endDate: new Date('2026-06-30'),
        rent: 5000,
      },
      { startDate: new Date('2026-07-01'), endDate: null, rent: 5400 },
    ];

    it('picks the period containing the date (boundaries inclusive)', () => {
      expect(service.termForDate(terms, new Date('2026-01-01'))?.rent).toBe(
        4500,
      );
      expect(service.termForDate(terms, new Date('2026-03-31'))?.rent).toBe(
        4500,
      );
      expect(service.termForDate(terms, new Date('2026-04-01'))?.rent).toBe(
        5000,
      );
      expect(service.termForDate(terms, new Date('2027-05-15'))?.rent).toBe(
        5400,
      );
    });

    it('returns null before the schedule starts', () => {
      expect(service.termForDate(terms, new Date('2025-12-31'))).toBeNull();
    });

    it('returns null after a closed schedule ends', () => {
      const closed = terms.slice(0, 2);
      expect(service.termForDate(closed, new Date('2026-07-01'))).toBeNull();
    });
  });

  describe('rent reads (access control)', () => {
    const dbTerms = [
      {
        id: 't1',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-06-30'),
      },
      { id: 't2', startDate: new Date('2026-07-01'), endDate: null },
    ];

    it('throws NotFound for a missing lease', async () => {
      prisma.lease.findUnique.mockResolvedValue(null);
      await expect(service.getLeaseTerms('nope', 'u1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws Forbidden for a stranger', async () => {
      prisma.lease.findUnique.mockResolvedValue({
        tenantId: 'tenant',
        property: { ownerId: 'owner' },
      });
      await expect(service.getLeaseTerms('l1', 'stranger')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it.each(['owner', 'tenant'])('allows the %s', async (userId) => {
      prisma.lease.findUnique.mockResolvedValue({
        tenantId: 'tenant',
        property: { ownerId: 'owner' },
      });
      prisma.leaseTerm.findMany.mockResolvedValue(dbTerms);
      await expect(service.getLeaseTerms('l1', userId)).resolves.toEqual(
        dbTerms,
      );
    });

    it('getRentForDate resolves the period in effect', async () => {
      prisma.lease.findUnique.mockResolvedValue({
        tenantId: 'tenant',
        property: { ownerId: 'owner' },
      });
      prisma.leaseTerm.findMany.mockResolvedValue(dbTerms);
      const result = await service.getRentForDate(
        'l1',
        new Date('2026-08-15'),
        'owner',
      );
      expect(result?.id).toBe('t2');
    });
  });
});
