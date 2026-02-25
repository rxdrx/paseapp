/**
 * @file constants/geofence.ts
 * Constantes de negocio para el sistema de geofencing.
 * Centralizar aquí facilita el ajuste y los tests parametrizados.
 */

import type { MovingAverageConfig, VibrationPattern, ZoneVibrationMap } from '../types';
import { ProximityZone } from '../types';

// ---------------------------------------------------------------------------
// Umbrales de distancia (metros)
// ---------------------------------------------------------------------------

export const THRESHOLD_AWARENESS_M = 40 as const;
export const THRESHOLD_CAUTION_M   = 20 as const;
export const THRESHOLD_DANGER_M    = 10 as const;

/**
 * Radio máximo de búsqueda de intersecciones cercanas.
 * Las que estén fuera de este radio se ignoran.
 */
export const MAX_SEARCH_RADIUS_M = 60 as const;

// ---------------------------------------------------------------------------
// Patrones de vibración (ms)
// Formato: [pausa_inicial, vibra, pausa, vibra, ...]
// ---------------------------------------------------------------------------

/** 40 m – Un pulso largo suave (500 ms). */
export const PATTERN_AWARENESS: VibrationPattern = [0, 500] as const;

/** 20 m – Dos pulsos cortos. */
export const PATTERN_CAUTION: VibrationPattern = [0, 200, 100, 200] as const;

/**
 * 10 m – Tren de pulsos rápidos (señal de peligro).
 * Cuatro pulsos de 100 ms separados por 50 ms.
 */
export const PATTERN_DANGER: VibrationPattern = [
  0, 100, 50, 100, 50, 100, 50, 100,
] as const;

/** Tabla de zona → patrón. null = sin vibración. */
export const ZONE_VIBRATION_MAP: ZoneVibrationMap = {
  [ProximityZone.NONE]:      null,
  [ProximityZone.AWARENESS]: PATTERN_AWARENESS,
  [ProximityZone.CAUTION]:   PATTERN_CAUTION,
  [ProximityZone.DANGER]:    PATTERN_DANGER,
} as const;

// ---------------------------------------------------------------------------
// Configuración del filtro GPS
// ---------------------------------------------------------------------------

/**
 * Ventana de 5 muestras para el Moving Average.
 * Probado efectivo contra el "GPS Jitter" de edificios del microcentro BB.
 */
export const GPS_FILTER_CONFIG: MovingAverageConfig = {
  windowSize: 5,
  maxAccuracyMeters: 25,
} as const;

// ---------------------------------------------------------------------------
// Filtro de dirección – Validación "approaching"
// ---------------------------------------------------------------------------

/**
 * Cantidad mínima de lecturas consecutive de acercamiento necesarias
 * para confirmar tendencia DANGER (zona de 10 m – filtro de ruido crítico).
 */
export const MIN_CONSISTENT_READINGS_DANGER = 3 as const;

/**
 * Tolerancia de histeresis en metros.
 * Si la distancia no cambió más de HYSTERESIS_M entre lecturas,
 * se considera "sin cambio" y no se re-dispara la misma zona.
 */
export const HYSTERESIS_M = 2 as const;

// ---------------------------------------------------------------------------
// Configuración de watchPosition
// ---------------------------------------------------------------------------

/**
 * Intervalo mínimo entre actualizaciones de posición (ms).
 * 1000 ms balancea precisión y consumo de batería.
 */
export const LOCATION_UPDATE_INTERVAL_MS = 1_000 as const;

/**
 * Distancia mínima de desplazamiento para emitir una nueva posición (m).
 * 2 m evita spam de eventos cuando el usuario está quieto.
 */
export const LOCATION_DISTANCE_INTERVAL_M = 2 as const;
