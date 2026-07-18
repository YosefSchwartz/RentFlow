import React, { useState } from 'react';
import { Alert, Pressable, View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Text, TextInput, Button, Snackbar, Avatar, ActivityIndicator, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import type { ProfileStackParamList } from '../../types';
import { useAuth } from '../../store/AuthContext';
import { useUpdateProfile, useUploadAvatar } from '../../hooks/useProfile';
import { getInitials } from '../../utils/userDisplay';
import { AvatarSourceSheet } from '../../components/AvatarSourceSheet';
import type { PickResult } from '../../components/media/mediaPicker';

type NavigationProp = NativeStackNavigationProp<ProfileStackParamList, 'EditProfile'>;

const EditProfileScreen: React.FC = () => {
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { t } = useTranslation();
  const { user } = useAuth();
  const updateProfile = useUpdateProfile();
  const uploadAvatar = useUploadAvatar();

  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [avatarSheetVisible, setAvatarSheetVisible] = useState(false);
  const [snackbar, setSnackbar] = useState<{ visible: boolean; message: string; error?: boolean }>({
    visible: false,
    message: '',
  });

  // Avatar upload fires immediately on picking — independent of the
  // firstName/lastName/phone Save button below — matching common mobile UX
  // (tap-to-change avatar takes effect right away, no separate confirm step).
  const handleAvatarPicked = (result: PickResult) => {
    if (result.canceled) return;

    if (result.denied) {
      // Previously silent — a denied camera/library permission looked
      // identical to "nothing happened" with no way to tell what went wrong.
      setSnackbar({
        visible: true,
        message: t('profile.editProfile.avatarPermissionDenied'),
        error: true,
      });
      return;
    }

    if (result.files.length === 0) return;

    uploadAvatar.mutate(result.files[0], {
      onSuccess: () => {
        setSnackbar({ visible: true, message: t('profile.editProfile.saveSuccess') });
      },
      onError: (err: any) => {
        setSnackbar({
          visible: true,
          message: err.response?.data?.message || t('profile.editProfile.avatarUploadError'),
          error: true,
        });
      },
    });
  };

  const isDirty =
    firstName.trim() !== (user?.firstName ?? '') ||
    lastName.trim() !== (user?.lastName ?? '') ||
    phone.trim() !== (user?.phone ?? '');

  const handleCancel = () => {
    if (!isDirty) {
      navigation.goBack();
      return;
    }
    Alert.alert(
      t('profile.editProfile.unsavedChangesTitle'),
      t('profile.editProfile.unsavedChangesMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.discard'), style: 'destructive', onPress: () => navigation.goBack() },
      ],
    );
  };

  const handleSave = () => {
    if (!firstName.trim() || !lastName.trim()) {
      setSnackbar({ visible: true, message: t('auth.errors.fillRequiredFields'), error: true });
      return;
    }

    updateProfile.mutate(
      {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim() || undefined,
      },
      {
        onSuccess: () => {
          setSnackbar({ visible: true, message: t('profile.editProfile.saveSuccess') });
          navigation.goBack();
        },
        onError: (err: any) => {
          setSnackbar({
            visible: true,
            message: err.response?.data?.message || t('profile.editProfile.saveError'),
            error: true,
          });
        },
      },
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.form}>
            <View style={styles.avatarSection}>
              <Pressable
                onPress={() => setAvatarSheetVisible(true)}
                disabled={uploadAvatar.isPending}
                style={styles.avatarTouchable}
              >
                {user?.avatarUrl ? (
                  <Avatar.Image size={96} source={{ uri: user.avatarUrl }} />
                ) : (
                  <Avatar.Text
                    size={96}
                    label={getInitials(user)}
                    style={{ backgroundColor: theme.colors.primary }}
                  />
                )}
                {uploadAvatar.isPending && (
                  <View style={styles.avatarSpinnerOverlay}>
                    <ActivityIndicator size="small" color="#fff" />
                  </View>
                )}
              </Pressable>
              <Text variant="labelLarge" onPress={() => setAvatarSheetVisible(true)}>
                {t('profile.editProfile.changePhoto')}
              </Text>
            </View>

            <View style={styles.row}>
              <TextInput
                label={t('auth.firstName')}
                value={firstName}
                onChangeText={setFirstName}
                autoCapitalize="words"
                mode="outlined"
                style={[styles.input, styles.halfInput]}
              />
              <TextInput
                label={t('auth.lastName')}
                value={lastName}
                onChangeText={setLastName}
                autoCapitalize="words"
                mode="outlined"
                style={[styles.input, styles.halfInput]}
              />
            </View>

            <TextInput
              label={t('profile.phone')}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              mode="outlined"
              style={styles.input}
              left={<TextInput.Icon icon="phone" />}
            />

            <TextInput
              label={t('profile.email')}
              value={user?.email ?? ''}
              editable={false}
              mode="outlined"
              style={styles.input}
              left={<TextInput.Icon icon="email" />}
            />

            <View style={styles.actions}>
              <Button mode="outlined" onPress={handleCancel} style={styles.actionButton}>
                {t('common.cancel')}
              </Button>
              <Button
                mode="contained"
                onPress={handleSave}
                loading={updateProfile.isPending}
                disabled={updateProfile.isPending}
                style={styles.actionButton}
              >
                {t('profile.editProfile.saveButton')}
              </Button>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Snackbar
        visible={snackbar.visible}
        onDismiss={() => setSnackbar((s) => ({ ...s, visible: false }))}
        duration={3000}
        style={snackbar.error ? { backgroundColor: theme.colors.error } : undefined}
      >
        {snackbar.message}
      </Snackbar>

      <AvatarSourceSheet
        visible={avatarSheetVisible}
        onDismiss={() => setAvatarSheetVisible(false)}
        onResult={handleAvatarPicked}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
  },
  form: {
    width: '100%',
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 24,
    gap: 8,
  },
  avatarTouchable: {
    borderRadius: 48,
  },
  avatarSpinnerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 48,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  input: {
    marginBottom: 16,
  },
  halfInput: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
  },
});

export default EditProfileScreen;
