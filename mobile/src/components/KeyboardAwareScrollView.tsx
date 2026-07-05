import React, { useContext } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { HeaderHeightContext } from '@react-navigation/elements';

interface KeyboardAwareScrollViewProps {
  children: React.ReactNode;
  /** Style for the outer KeyboardAvoidingView (usually the screen container). */
  style?: StyleProp<ViewStyle>;
  /** Style applied to the ScrollView's content container. */
  contentContainerStyle?: StyleProp<ViewStyle>;
  keyboardShouldPersistTaps?: 'always' | 'never' | 'handled';
  /** Extra offset added on top of the navigation header height. */
  extraOffset?: number;
}

/**
 * A scroll container that keeps inputs visible when the keyboard is open.
 *
 * It combines a KeyboardAvoidingView (offset by the navigation header height so
 * the bottom of the form is never hidden) with a ScrollView that can always be
 * scrolled while the keyboard is up. Use this instead of a bare ScrollView on
 * any screen that contains text inputs.
 */
export const KeyboardAwareScrollView: React.FC<KeyboardAwareScrollViewProps> = ({
  children,
  style,
  contentContainerStyle,
  keyboardShouldPersistTaps = 'handled',
  extraOffset = 0,
}) => {
  // Safe even when there is no header (returns 0) — never throws.
  const headerHeight = useContext(HeaderHeightContext) ?? 0;

  return (
    <KeyboardAvoidingView
      style={[styles.flex, style]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight + extraOffset : 0}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, contentContainerStyle]}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    // Breathing room so the last field/button clears the keyboard.
    paddingBottom: 24,
  },
});

export default KeyboardAwareScrollView;
