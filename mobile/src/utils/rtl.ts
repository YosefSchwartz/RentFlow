import { I18nManager } from 'react-native';

// App is configured for RTL (Hebrew)
export const isRTL = true;

// Force RTL layout
export const forceRTL = () => {
  if (!I18nManager.isRTL) {
    I18nManager.forceRTL(true);
    // Note: App restart required for this to take effect
  }
};

// Force LTR layout
export const forceLTR = () => {
  if (I18nManager.isRTL) {
    I18nManager.forceRTL(false);
    // Note: App restart required for this to take effect
  }
};

// Get flex direction based on RTL
export const getFlexDirection = () => (isRTL ? 'row-reverse' : 'row');

// Get text alignment based on RTL
export const getTextAlign = () => (isRTL ? 'right' : 'left');
