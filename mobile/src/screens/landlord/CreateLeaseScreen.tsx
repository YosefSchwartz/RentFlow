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
import type { PropertiesStackParamList } from '../../types';

type NavigationProp = NativeStackNavigationProp<PropertiesStackParamList>;
type RouteType = RouteProp<PropertiesStackParamList, 'CreateLease'>;

// Local date-only string (YYYY-MM-DD) so the picked calendar day is preserved
// regardless of timezone (avoids UTC off-by-one from toISOString()).
const toISODate = (d: Date): string => {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
};

interface DateFieldProps {
  label: string;
  value: Date | null;
  onChange: (date: Date) => void;
  minimumDate?: Date;
  error?: string;
}

// A tappable field that opens the native date picker (Android dialog / iOS modal).
const DateField: React.FC<DateFieldProps> = ({
  label,
  value,
  onChange,
  minimumDate,
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
          value={value ?? new Date()}
          mode="date"
          minimumDate={minimumDate}
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
              value={value ?? new Date()}
              mode="date"
              display="spinner"
              minimumDate={minimumDate}
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

const CreateLeaseScreen: React.FC = () => {
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { t } = useTranslation();
  const route = useRoute<RouteType>();
  const { propertyId } = route.params;

  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [monthlyRent, setMonthlyRent] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const createLease = useCreateLease();

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

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm() || !startDate) return;

    try {
      const lease = await createLease.mutateAsync({
        propertyId,
        startDate: toISODate(startDate),
        endDate: endDate ? toISODate(endDate) : undefined,
        monthlyRent: monthlyRent ? parseFloat(monthlyRent) : undefined,
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
          {t('leases.financialDetails')}
        </Text>

        <TextInput
          label={t('leases.monthlyRent')}
          value={formatNumberInput(monthlyRent)}
          onChangeText={(text) => setMonthlyRent(parseNumberInput(text))}
          mode="outlined"
          keyboardType="decimal-pad"
          left={<TextInput.Affix text="₪" />}
          style={styles.input}
        />

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
