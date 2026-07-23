import { ForbiddenException } from '@nestjs/common';
import { LeasesService } from './leases.service';
import { LeasePricingService } from './lease-pricing.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

// Integration-style tests of the lease/pricing flow: a real LeasePricingService
// wired into LeasesService, with Prisma and notifications mocked at the edge.
describe('LeasesService (pricing integration)', () => {
  let service: LeasesService;
  let prisma: {
    property: { findUnique: jest.Mock };
    lease: { create: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
    leaseTerm: { deleteMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let notifications: { notifyLeaseTermsUpdated: jest.Mock };

  beforeEach(() => {
    prisma = {
      property: { findUnique: jest.fn() },
      lease: {
        create: jest
          .fn()
          .mockImplementation(({ data }) => ({ id: 'l1', ...data })),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({ id: 'l1' }),
      },
      leaseTerm: { deleteMany: jest.fn().mockReturnValue('deleteOp') },
      $transaction: jest
        .fn()
        .mockImplementation((ops: unknown[]) => Promise.all(ops)),
    };
    notifications = { notifyLeaseTermsUpdated: jest.fn() };
    service = new LeasesService(
      prisma as unknown as PrismaService,
      notifications as unknown as NotificationsService,
      new LeasePricingService(prisma as unknown as PrismaService),
    );
  });

  describe('create', () => {
    beforeEach(() => {
      prisma.property.findUnique.mockResolvedValue({ ownerId: 'owner' });
    });

    it('creates the provided pricing schedule and mirrors the first rent', async () => {
      await service.create(
        'p1',
        {
          startDate: '2026-01-01',
          endDate: '2026-12-31',
          leaseTerms: [
            {
              startDate: '2026-01-01',
              endDate: '2026-06-30',
              monthlyRent: 4500,
            },
            {
              startDate: '2026-07-01',
              endDate: '2026-12-31',
              monthlyRent: 5000,
            },
          ],
        },
        'owner',
      );

      const data = prisma.lease.create.mock.calls[0][0].data;
      expect(data.leaseTerms.create).toHaveLength(2);
      expect(data.leaseTerms.create[0].monthlyRent).toBe(4500);
      expect(data.monthlyRent).toBe(4500); // legacy mirror
    });

    it('turns a legacy monthlyRent into a single period covering the lease', async () => {
      await service.create(
        'p1',
        { startDate: '2026-01-01', endDate: '2026-12-31', monthlyRent: 4500 },
        'owner',
      );

      const data = prisma.lease.create.mock.calls[0][0].data;
      expect(data.leaseTerms.create).toEqual([
        expect.objectContaining({
          monthlyRent: 4500,
          currency: 'ILS',
          displayOrder: 1,
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-12-31'),
        }),
      ]);
      expect(data.monthlyRent).toBe(4500);
    });

    it('creates no periods when no pricing is given (rent stays optional)', async () => {
      await service.create('p1', { startDate: '2026-01-01' }, 'owner');

      const data = prisma.lease.create.mock.calls[0][0].data;
      expect(data.leaseTerms.create).toEqual([]);
      expect(data.monthlyRent).toBeNull();
    });

    it('rejects an invalid schedule before touching the database', async () => {
      await expect(
        service.create(
          'p1',
          {
            startDate: '2026-01-01',
            endDate: '2026-12-31',
            leaseTerms: [
              {
                startDate: '2026-01-01',
                endDate: '2026-05-31',
                monthlyRent: 4500,
              },
              {
                startDate: '2026-07-01',
                endDate: '2026-12-31',
                monthlyRent: 5000,
              },
            ],
          },
          'owner',
        ),
      ).rejects.toThrow('Pricing periods must not leave gaps in the schedule');
      expect(prisma.lease.create).not.toHaveBeenCalled();
    });
  });

  describe('updateTerms', () => {
    const existingLease = {
      id: 'l1',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      tenantId: 'tenant',
      property: { ownerId: 'owner', title: 'Herzl 5' },
    };
    const newTerms = {
      leaseTerms: [
        { startDate: '2026-01-01', endDate: '2026-12-31', monthlyRent: 5200 },
      ],
    };

    it('rejects a non-owner', async () => {
      prisma.lease.findUnique.mockResolvedValue(existingLease);
      await expect(
        service.updateTerms('l1', newTerms, 'tenant'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('replaces the schedule transactionally and syncs the legacy column', async () => {
      prisma.lease.findUnique.mockResolvedValue(existingLease);

      await service.updateTerms('l1', newTerms, 'owner');

      expect(prisma.leaseTerm.deleteMany).toHaveBeenCalledWith({
        where: { leaseId: 'l1' },
      });
      expect(prisma.$transaction).toHaveBeenCalled();
      const updateArgs = prisma.lease.update.mock.calls[0][0];
      expect(updateArgs.data.monthlyRent).toBe(5200);
      expect(updateArgs.data.leaseTerms.create).toHaveLength(1);
    });

    it('notifies the tenant on a tenant-assigned lease', async () => {
      prisma.lease.findUnique.mockResolvedValue(existingLease);
      await service.updateTerms('l1', newTerms, 'owner');
      expect(notifications.notifyLeaseTermsUpdated).toHaveBeenCalledWith(
        'tenant',
        'Herzl 5',
        'l1',
      );
    });

    it('does not notify when the lease has no tenant yet', async () => {
      prisma.lease.findUnique.mockResolvedValue({
        ...existingLease,
        tenantId: null,
      });
      await service.updateTerms('l1', newTerms, 'owner');
      expect(notifications.notifyLeaseTermsUpdated).not.toHaveBeenCalled();
    });
  });
});
