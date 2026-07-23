import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Chip, Divider, Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { formatMoney, leaseTermForDate } from '../utils';
import type { Lease, LeaseTerm } from '../types';

interface LeaseScheduleSectionProps {
  lease: Lease;
}

// The lease's pricing schedule ("Lease Schedule") — the single way lease
// pricing is displayed across the app. Falls back to the legacy single
// monthlyRent for leases that predate pricing periods.
export const LeaseScheduleSection: React.FC<LeaseScheduleSectionProps> = ({
  lease,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();

  const formatDay = (dateString: string) =>
    new Date(dateString).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

  // Legacy fallback: a lease without periods behaves like a one-period lease.
  const terms: LeaseTerm[] =
    lease.leaseTerms && lease.leaseTerms.length > 0
      ? lease.leaseTerms
      : lease.monthlyRent != null
        ? [
            {
              id: 'legacy',
              leaseId: lease.id,
              startDate: lease.startDate,
              endDate: lease.endDate ?? null,
              monthlyRent: lease.monthlyRent,
              currency: 'ILS',
              displayOrder: 1,
              createdAt: lease.createdAt,
              updatedAt: lease.updatedAt,
            },
          ]
        : [];

  const currentTerm = leaseTermForDate(terms, new Date());

  return (
    <>
      <Text variant="titleMedium" style={styles.sectionTitle}>
        {t('leases.leaseSchedule')}
      </Text>
      <Card style={styles.card} mode="outlined">
        <Card.Content>
          {terms.length === 0 ? (
            <View style={styles.emptyRow}>
              <Icon name="cash-off" size={20} color={theme.colors.outline} />
              <Text variant="bodyMedium" style={styles.emptyText}>
                {t('leases.noPricingPeriods')}
              </Text>
            </View>
          ) : (
            terms.map((term, index) => (
              <View key={term.id}>
                {index > 0 && <Divider style={styles.divider} />}
                <View style={styles.termRow}>
                  <Icon
                    name="cash"
                    size={20}
                    color={
                      term.id === currentTerm?.id
                        ? theme.colors.primary
                        : theme.colors.secondary
                    }
                  />
                  <View style={styles.termInfo}>
                    <Text variant="labelMedium" style={styles.termDates}>
                      {formatDay(term.startDate)}
                      {' – '}
                      {term.endDate
                        ? formatDay(term.endDate)
                        : t('leases.openEnded')}
                    </Text>
                    <Text variant="bodyMedium" style={styles.termRent}>
                      {formatMoney(term.monthlyRent, term.currency)}
                      {t('rentals.perMonth')}
                    </Text>
                    {!!term.notes && (
                      <Text variant="bodySmall" style={styles.termNotes}>
                        {term.notes}
                      </Text>
                    )}
                  </View>
                  {term.id === currentTerm?.id && (
                    <Chip
                      compact
                      style={{
                        backgroundColor: theme.colors.primary + '20',
                        alignSelf: 'center',
                      }}
                      textStyle={{ color: theme.colors.primary, fontSize: 12 }}
                    >
                      {t('leases.currentPeriod')}
                    </Chip>
                  )}
                </View>
              </View>
            ))
          )}
        </Card.Content>
      </Card>
    </>
  );
};

const styles = StyleSheet.create({
  sectionTitle: {
    fontWeight: '600',
    marginBottom: 12,
    marginTop: 8,
    paddingHorizontal: 16,
  },
  card: {
    marginBottom: 16,
    marginHorizontal: 16,
  },
  termRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
    gap: 12,
  },
  termInfo: {
    flex: 1,
  },
  termDates: {
    opacity: 0.7,
    marginBottom: 2,
  },
  termRent: {
    fontWeight: '600',
  },
  termNotes: {
    opacity: 0.7,
    marginTop: 2,
  },
  emptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  emptyText: {
    opacity: 0.7,
  },
  divider: {
    marginVertical: 4,
  },
});
