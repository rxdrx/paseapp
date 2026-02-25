/**
 * @file services/vibrationService.ts
 * Servicio de abstracción de vibración háptica.
 *
 * Unifica la API de Vibration (React Native core) con expo-haptics para
 * proveer retroalimentación háptica accesible según la zona de proximidad.
 *
 * Prioridad de uso:
 *   1. expo-haptics (feedback rico, soporte nativo iOS/Android)
 *   2. Vibration API (fallback cross-platform – patrones personalizados)
 */

import { Vibration, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

import { ProximityZone } from '../types';
import { ZONE_VIBRATION_MAP } from '../constants/geofence';
import type { VibrationPattern } from '../types';

// ---------------------------------------------------------------------------
// Tipos internos
// ---------------------------------------------------------------------------

type HapticLevel = 'light' | 'medium' | 'heavy';

const ZONE_HAPTIC_LEVEL: Record<ProximityZone, HapticLevel | null> = {
  [ProximityZone.NONE]:      null,
  [ProximityZone.AWARENESS]: 'light',
  [ProximityZone.CAUTION]:   'medium',
  [ProximityZone.DANGER]:    'heavy',
} as const;

// ---------------------------------------------------------------------------
// Funciones principales
// ---------------------------------------------------------------------------

/**
 * Dispara el patrón de vibración correspondiente a una zona de proximidad.
 *
 * Lógica de selección:
 * - iOS: usa ImpactFeedbackGenerator de expo-haptics (sin soporte nativo
 *   para patrones arbitrarios en iOS < 13).
 * - Android: usa Vibration.vibrate con el patrón completo definido en
 *   ZONE_VIBRATION_MAP para aprovechar la granularidad del motor de vibración.
 *
 * @param zone - Zona geofence que disparó la alerta.
 */
export async function vibrateForZone(zone: ProximityZone): Promise<void> {
  if (zone === ProximityZone.NONE) {
    cancelVibration();
    return;
  }

  if (Platform.OS === 'ios') {
    await vibrateIos(zone);
  } else {
    vibrateAndroid(zone);
  }
}

/**
 * Cancela cualquier vibración en curso.
 * Siempre seguro de llamar aunque no haya vibración activa.
 */
export function cancelVibration(): void {
  Vibration.cancel();
}

// ---------------------------------------------------------------------------
// Implementaciones por plataforma
// ---------------------------------------------------------------------------

async function vibrateIos(zone: ProximityZone): Promise<void> {
  const level = ZONE_HAPTIC_LEVEL[zone];
  if (level === null) return;

  const impactStyle: Haptics.ImpactFeedbackStyle = {
    light:  Haptics.ImpactFeedbackStyle.Light,
    medium: Haptics.ImpactFeedbackStyle.Medium,
    heavy:  Haptics.ImpactFeedbackStyle.Heavy,
  }[level];

  // Para zona DANGER en iOS: repetir el impacto feedback 4 veces
  if (zone === ProximityZone.DANGER) {
    for (let i = 0; i < 4; i++) {
      await Haptics.impactAsync(impactStyle);
      // Pausa entre pulsos (50 ms)
      await delay(50);
    }
  } else {
    await Haptics.impactAsync(impactStyle);
  }
}

function vibrateAndroid(zone: ProximityZone): void {
  const pattern: VibrationPattern | null = ZONE_VIBRATION_MAP[zone];
  if (pattern === null) return;

  // repeat = -1 → no repetir
  Vibration.vibrate(pattern as number[], false);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const delay = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));
