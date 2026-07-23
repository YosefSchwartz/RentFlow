import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  Platform,
  Pressable,
} from 'react-native';
import {
  Text,
  TextInput,
  Button,
  useTheme,
  HelperText,
  Portal,
  Modal,
  Card,
  IconButton,
} from 'react-native-paper';
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useCreateLease } from '../../hooks/useLeases';
import KeyboardAwareScrollView from '../../components/KeyboardAwareScrollView';
import { formatNumberInput, parseNumberInput } from '../../utils';
import type { LeaseTermInput, PropertiesStackParamList } from '../../types';

type NavigationProp = NativeStackNavigationProp<PropertiesStackParamList>;
type RouteType = RouteProp<PropertiesStackParamList, 'CreateLease'>;

// Local date-only string (YYYY-MM-DD) so the picked calendar day is preserved
// regardless of timezone (avoids UTC off-by-one from toISOString()).
const toISODate = (d: Date): string => {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
};

const addDays = (d: Date, days: number): Date => {
  const result = new Date(d);
  result.setDate(result.getDate() + days);
  return result;
};

interface DateFieldProps {
  label: string;
  value: Date | null;
  onChange: (date: Date) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  error?: string;
}

// A tappable field that opens the native date picker (Android dialog / iOS modal).
const DateField: React.FC<DateFieldProps> = ({
  label,
  value,
  onChange,
  minimumDate,
  maximumDate,
  error,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const handleChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') {
      setOpen(false);
      if (event.type === 'set' && selected) onChange(selected);
    } else if (selected) {
      onChange(selected);
    }
  };

  return (
    <View>
      <Pressable onPress={() => setOpen(true)}>
        {/* pointerEvents none lets the whole row's Pressable receive the tap
            instead of the (disabled) input swallowing it. */}
        <View pointerEvents="none">
          <TextInput
            label={label}
            value={value ? value.toLocaleDateString() : ''}
            mode="outlined"
            editable={false}
            error={!!error}
            style={styles.input}
            right={<TextInput.Icon icon="calendar" />}
          />
        </View>
      </Pressable>
      <HelperText type="error" visible={!!error}>
        {error}
      </HelperText>

      {open && Platform.OS === 'android' && (
        <DateTimePicker
          value={value ?? minimumDate ?? new Date()}
          mode="date"
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onChange={handleChange}
        />
      )}

      {Platform.OS === 'ios' && (
        <Portal>
          <Modal
            visible={open}
            onDismiss={() => setOpen(false)}
            contentContainerStyle={[
              styles.pickerModal,
              { backgroundColor: theme.colors.surface },
            ]}
          >
            <DateTimePicker
              value={value ?? minimumDate ?? new Date()}
              mode="date"
              display="spinner"
              minimumDate={minimumDate}
              maximumDate={maximumDate}
              onChange={handleChange}
            />
            <Button mode="contained" onPress={() => setOpen(false)}>
              {t('common.done')}
            </Button>
          </Modal>
        </Portal>
      )}
    </View>
  );
};

// One pricing period draft. Start dates are derived (first period starts with
// the lease; each next period starts the day after the previous one ends) and
// the last period always ends with the lease, so overlapping or gapped
// schedules are unrepresentable in the UI. The user only edits the split
// boundaries ("until") plus rent and notes.
interface PeriodDraft {
  key: number;
  // End boundary; editable on every period except the last (which is derived
  // from the lease end date / open-ended lease).
  endDate: Date | null;
  monthlyRent: string;
  notes: string;
}

const CreateLeaseScreen: React.FC = () => {
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { t } = useTranslation();
  const route = useRoute<RouteType>();
  const { propertyId } = route.params;

  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  // Default behavior: one pricing period automatically covering the lease.
  const [periods, setPeriods] = useState<PeriodDraft[]>([
    { key: 1, endDate: null, monthlyRent: '', notes: '' },
  ]);
  const [nextPeriodKey, setNextPeriodKey] = useState(2);
  const [depositAmount, setDepositAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const createLease = useCreateLease();

  // Derived start date of each period (see PeriodDraft).
  const periodStart = (index: number): Date | null => {
    if (!startDate) return null;
    if (index === 0) return startDate;
    const previousEnd = periods[index - 1].endDate;
    return previousEnd ? addDays(previousEnd, 1) : null;
  };

  const handleStartChange = (date: Date) => {
    setStartDate(date);
    // Keep the range valid: drop an end date that is now on/before the start.
    if (endDate && endDate.getTime() <= date.getTime()) {
      setEndDate(null);
    }
    setErrors((e) => ({ ...e, startDate: '', endDate: '' }));
  };

  const handleEndChange = (date: Date) => {
    setEndDate(date);
    setErrors((e) => ({ ...e, endDate: '' }));
  };

  const updatePeriod = (key: number, patch: Partial<PeriodDraft>) => {
    setPeriods((current) =>
      current.map((p) => (p.key === key ? { ...p, ...patch } : p)),
    );
    setErrors((e) => ({ ...e, [`period-${key}`]: '' }));
  };

  const addPeriod = () => {
    setPeriods((current) => [
      ...current,
      { key: nextPeriodKey, endDate: null, monthlyRent: '', notes: '' },
    ]);
    setNextPeriodKey((k) => k + 1);
  };

  // Removing a period merges its time span into the neighbors (the previous
  // period's boundary simply moves), so the schedule stays contiguous.
  const removePeriod = (key: number) => {
    setPeriods((current) => current.filter((p) => p.key !== key));
    setErrors((e) => ({ ...e, [`period-${key}`]: '' }));
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!startDate) {
      newErrors.startDate = t('leases.errors.startDateRequired');
    }
    if (endDate && startDate && endDate.getTime() <= startDate.getTime()) {
      newErrors.endDate = t('leases.errors.endDateAfterStart');
    }
    if (notes.length > 1000) {
      newErrors.notes = t('leases.errors.notesMaxLength');
    }

    // Pricing schedule. A single period with no rent means "no pricing yet"
    // (rent has always been optional); anything else must be complete.
    const pricingUsed =
      periods.length > 1 || periods.some((p) => p.monthlyRent !== '');
    if (pricingUsed && startDate) {
      periods.forEach((period, index) => {
        const isLast = index === periods.length - 1;
        if (period.monthlyRent === '') {
          newErrors[`period-${period.key}`] = t(
            'leases.errors.periodRentRequired',
          );
          return;
        }
        if (isLast) return; // last boundary is derived from the lease end
        const start = periodStart(index);
        if (!period.endDate) {
          newErrors[`period-${period.key}`] = t(
            'leases.errors.periodEndRequired',
          );
          return;
        }
        const boundaryInvalid =
          (start && period.endDate.getTime() < start.getTime()) ||
          (endDate && period.endDate.getTime() >= endDate.getTime());
        if (boundaryInvalid) {
          newErrors[`period-${period.key}`] = t(
            'leases.errors.periodEndOutOfRange',
          );
        }
      });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const buildLeaseTerms = (): LeaseTermInput[] | undefined => {
    const pricingUsed =
      periods.length > 1 || periods.some((p) => p.monthlyRent !== '');
    if (!pricingUsed) return undefined;

    return periods.map((period, index) => {
      const isLast = index === periods.length - 1;
      const start = periodStart(index) as Date; // validated
      const end = isLast ? endDate : period.endDate;
      return {
        startDate: toISODate(start),
        endDate: end ? toISODate(end) : undefined,
        monthlyRent: parseFloat(period.monthlyRent),
        notes: period.notes.trim() || undefined,
        displayOrder: index + 1,
      };
    });
  };

  const handleSubmit = async () => {
    if (!validateForm() || !startDate) return;

    try {
      const lease = await createLease.mutateAsync({
        propertyId,
        startDate: toISODate(startDate),
        endDate: endDate ? toISODate(endDate) : undefined,
        leaseTerms: buildLeaseTerms(),
        depositAmount: depositAmount ? parseFloat(depositAmount) : undefined,
        notes: notes.trim() || undefined,
      });

      // Show the activation code to share with the tenant. Replace so Back
      // returns to the property, not the (now-submitted) form.
      navigation.replace('LeaseActivationCode', {
        leaseId: lease.id,
        code: lease.activationCode || '',
      });
    } catch (err: any) {
      const errorMessage =
        err?.response?.data?.message || t('leases.errors.createFailed');
      Alert.alert(t('common.error'), errorMessage);
    }
  };

  const renderPeriod = (period: PeriodDraft, index: number) => {
    const isLast = index === periods.length - 1;
    const start = periodStart(index);
    const error = errors[`period-${period.key}`];

    return (
      <Card key={period.key} style={styles.periodCard} mode="outlined">
        <Card.Content>
          <View style={styles.periodHeader}>
            <Text variant="titleSmall" style={styles.periodTitle}>
              {t('leases.period', { number: index + 1 })}
            </Text>
            {periods.length > 1 && (
              <IconButton
                icon="delete-outline"
                size={20}
                accessibilityLabel={t('leases.removePeriod')}
                onPress={() => removePeriod(period.key)}
              />
            )}
          </View>

          <Text variant="bodySmall" style={styles.periodRange}>
            {t('leases.startDate')}:{' '}
            {start ? start.toLocaleDateString() : t('common.notAvailable')}
          </Text>

          {isLast ? (
            <Text variant="bodySmall" style={styles.periodRange}>
              {t('leases.periodUntil')}:{' '}
              {endDate ? endDate.toLocaleDateString() : t('leases.openEnded')}
            </Text>
          ) : (
            <View style={styles.periodUntilField}>
              <DateField
                label={t('leases.periodUntil')}
                value={period.endDate}
                onChange={(date) => updatePeriod(period.key, { endDate: date })}
                minimumDate={start ?? undefined}
                maximumDate={endDate ? addDays(endDate, -1) : undefined}
              />
            </View>
          )}

          <TextInput
            label={t('leases.monthlyRent')}
            value={formatNumberInput(period.monthlyRent)}
            onChangeText={(text) =>
              updatePeriod(period.key, { monthlyRent: parseNumberInput(text) })
            }
            mode="outlined"
            keyboardType="decimal-pad"
            left={<TextInput.Affix text="₪" />}
            error={!!error}
            style={styles.input}
          />

          <TextInput
            label={`${t('properties.notes')} (${t('common.optional')})`}
            value={period.notes}
            onChangeText={(text) => updatePeriod(period.key, { notes: text })}
            mode="outlined"
            style={styles.input}
            maxLength={1000}
          />

          <HelperText type="error" visible={!!error}>
            {error}
          </HelperText>
        </Card.Content>
      </Card>
    );
  };

  return (
    <KeyboardAwareScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
    >
        {/* Tenant is connected later via an activation code, not at creation. */}
        <View style={[styles.infoBox, { backgroundColor: theme.colors.secondaryContainer }]}>
          <Icon name="ticket-confirmation-outline" size={20} color={theme.colors.onSecondaryContainer} />
          <Text variant="bodySmall" style={[styles.infoText, { color: theme.colors.onSecondaryContainer }]}>
            {t('leases.activationHint')}
          </Text>
        </View>

        <Text variant="titleMedium" style={styles.sectionTitle}>
          {t('leases.leasePeriod')}
        </Text>

        <DateField
          label={t('leases.startDate')}
          value={startDate}
          onChange={handleStartChange}
          error={errors.startDate}
        />

        <DateField
          label={`${t('leases.endDate')} (${t('common.optional')})`}
          value={endDate}
          onChange={handleEndChange}
          // End must be after start: block earlier dates in the picker too.
          minimumDate={startDate ?? undefined}
          error={errors.endDate}
        />

        <Text variant="titleMedium" style={styles.sectionTitle}>
          {t('leases.pricingPeriods')}
        </Text>
        <Text variant="bodySmall" style={styles.sectionHint}>
          {t('leases.pricingPeriodsHint')}
        </Text>

        {periods.map(renderPeriod)}

        <Button
          mode="outlined"
          icon="plus"
          onPress={addPeriod}
          disabled={!startDate}
          style={styles.addPeriodButton}
        >
          {t('leases.addPeriod')}
        </Button>

        <Text variant="titleMedium" style={styles.sectionTitle}>
          {t('leases.financialDetails')}
        </Text>

        <TextInput
          label={t('leases.securityDeposit')}
          value={formatNumberInput(depositAmount)}
          onChangeText={(text) => setDepositAmount(parseNumberInput(text))}
          mode="outlined"
          keyboardType="decimal-pad"
          left={<TextInput.Affix text="₪" />}
          style={styles.input}
        />

        <TextInput
          label={t('properties.notes')}
          value={notes}
          onChangeText={setNotes}
          mode="outlined"
          multiline
          numberOfLines={3}
          error={!!errors.notes}
          style={styles.input}
          maxLength={1000}
        />
        <HelperText type="error" visible={!!errors.notes}>
          {errors.notes}
        </HelperText>

        <View style={styles.buttonContainer}>
          <Button
            mode="outlined"
            onPress={() => navigation.goBack()}
            style={styles.button}
          >
            {t('common.cancel')}
          </Button>
          <Button
            mode="contained"
            onPress={handleSubmit}
            loading={createLease.isPending}
            disabled={createLease.isPending}
            style={styles.button}
          >
            {t('leases.createLease')}
          </Button>
        </View>
    </KeyboardAwareScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  sectionTitle: {
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 12,
  },
  sectionHint: {
    opacity: 0.7,
    marginTop: -8,
    marginBottom: 12,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  infoText: {
    flex: 1,
  },
  input: {
    marginBottom: 4,
  },
  periodCard: {
    marginBottom: 12,
  },
  periodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  periodTitle: {
    fontWeight: '600',
  },
  periodRange: {
    opacity: 0.7,
    marginBottom: 4,
  },
  periodUntilField: {
    marginTop: 8,
  },
  addPeriodButton: {
    marginBottom: 8,
  },
  pickerModal: {
    margin: 24,
    padding: 16,
    borderRadius: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    marginBottom: 32,
  },
  button: {
    flex: 1,
  },
});

export default CreateLeaseScreen;
