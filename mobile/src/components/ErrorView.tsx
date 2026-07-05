import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';

interface ErrorViewProps {
  message?: string;
  onRetry?: () => void;
}

export const ErrorView: React.FC<ErrorViewProps> = ({
  message = 'Something went wrong',
  onRetry,
}) => {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <Icon name="alert-circle" size={64} color={theme.colors.error} />
      <Text variant="titleMedium" style={styles.title}>
        Error
      </Text>
      <Text variant="bodyMedium" style={styles.message}>
        {message}
      </Text>
      {onRetry && (
        <Button mode="contained" onPress={onRetry} style={styles.button}>
          Try Again
        </Button>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    marginTop: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  message: {
    marginTop: 8,
    opacity: 0.7,
    textAlign: 'center',
  },
  button: {
    marginTop: 24,
  },
});
