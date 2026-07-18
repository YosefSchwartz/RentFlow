import React, { useRef } from 'react';
import { I18nManager, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

interface OtpInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  error?: boolean;
  autoFocus?: boolean;
}

/**
 * A row of digit boxes backed by a single hidden TextInput — avoids the
 * fragility of per-box focus-advance logic (especially with Android
 * autofill). The box row is forced LTR regardless of app RTL state: OTP
 * codes are numeric data like a phone number, and I18nManager.forceRTL would
 * otherwise visually reverse the digit order under Hebrew.
 */
export const OtpInput: React.FC<OtpInputProps> = ({
  length = 6,
  value,
  onChange,
  error,
  autoFocus,
}) => {
  const theme = useTheme();
  const inputRef = useRef<TextInput>(null);

  const digits = Array.from({ length }, (_, i) => value[i] ?? '');

  return (
    <Pressable onPress={() => inputRef.current?.focus()}>
      <View style={[styles.row, { flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row' }]}>
        {digits.map((digit, i) => (
          <View
            key={i}
            style={[
              styles.box,
              {
                borderColor: error ? theme.colors.error : theme.colors.outline,
                backgroundColor: theme.colors.surface,
              },
              value.length === i && styles.boxFocused,
            ]}
          >
            <Text variant="headlineSmall" style={styles.digit}>
              {digit}
            </Text>
          </View>
        ))}
      </View>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(text) => onChange(text.replace(/[^0-9]/g, '').slice(0, length))}
        keyboardType="number-pad"
        autoFocus={autoFocus}
        maxLength={length}
        style={styles.hiddenInput}
      />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  row: {
    justifyContent: 'center',
    gap: 8,
  },
  box: {
    width: 44,
    height: 52,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxFocused: {
    borderWidth: 2,
  },
  digit: {
    writingDirection: 'ltr',
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    height: 1,
    width: 1,
  },
});
