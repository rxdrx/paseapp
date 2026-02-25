/**
 * @file __mocks__/expo-haptics.ts
 * Mock de expo-haptics para el entorno de Jest.
 */

export enum ImpactFeedbackStyle {
  Light  = 'light',
  Medium = 'medium',
  Heavy  = 'heavy',
}

export enum NotificationFeedbackType {
  Success = 'success',
  Warning = 'warning',
  Error   = 'error',
}

export const impactAsync        = jest.fn().mockResolvedValue(undefined);
export const notificationAsync  = jest.fn().mockResolvedValue(undefined);
export const selectionAsync     = jest.fn().mockResolvedValue(undefined);
