/**
 * @file __mocks__/expo-location.ts
 * Mock de expo-location para el entorno de Jest.
 */

export enum Accuracy {
  Lowest    = 1,
  Low       = 2,
  Balanced  = 3,
  High      = 4,
  Highest   = 5,
  BestForNavigation = 6,
}

export const requestForegroundPermissionsAsync = jest.fn().mockResolvedValue({
  status: 'granted',
});

export const getForegroundPermissionsAsync = jest.fn().mockResolvedValue({
  status: 'granted',
});

export const watchPositionAsync = jest.fn().mockResolvedValue({
  remove: jest.fn(),
});
