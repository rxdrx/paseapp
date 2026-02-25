/**
 * @file types/index.ts
 * Definiciones de tipos del dominio de PaseApp.
 * Tipado estricto para todas las entidades de negocio.
 */

// ---------------------------------------------------------------------------
// Coordenadas geográficas
// ---------------------------------------------------------------------------

/** Par de coordenadas geográficas (WGS84). */
export interface Coordinates {
  /** Latitud en grados decimales. */
  readonly latitude: number;
  /** Longitud en grados decimales. */
  readonly longitude: number;
}

/** Coordenadas con metadatos de calidad de señal GPS. */
export interface GpsReading extends Coordinates {
  /** Exactitud horizontal en metros (radio del círculo de incertidumbre). */
  readonly accuracy: number;
  /** Timestamp Unix en milisegundos. */
  readonly timestamp: number;
  /** Velocidad en m/s, null si no está disponible. */
  readonly speed: number | null;
}

// ---------------------------------------------------------------------------
// Intersecciones / Esquinas
// ---------------------------------------------------------------------------

/** Identificador único de una intersección. */
export type IntersectionId = string;

/** Representa una intersección de calles en la base de datos. */
export interface Intersection {
  readonly id: IntersectionId;
  /** Nombre de la calle primaria. */
  readonly streetA: string;
  /** Nombre de la calle secundaria. */
  readonly streetB: string;
  /** Coordenadas del punto de intersección. */
  readonly coordinates: Coordinates;
  /** Indica si la esquina tiene semáforo accesible (para futuras iteraciones). */
  readonly hasAccessibleLight?: boolean;
}

// ---------------------------------------------------------------------------
// Geofencing
// ---------------------------------------------------------------------------

/**
 * Umbrales de proximidad en metros.
 * El orden importa: de mayor a menor distancia.
 */
export enum ProximityZone {
  /** Sin alerta: fuera de rango de todas las zonas. */
  NONE = 'NONE',
  /** 40 m – Zona de Aviso: el usuario se acerca a la esquina. */
  AWARENESS = 'AWARENESS',
  /** 20 m – Zona de Alerta: cercanía inmediata. */
  CAUTION = 'CAUTION',
  /** 10 m – Zona Crítica: detener el avance. */
  DANGER = 'DANGER',
}

/** Estado completo de un evento de geofencing. */
export interface GeofenceEvent {
  /** Zona detectada. */
  readonly zone: ProximityZone;
  /** Intersección que disparó el evento. */
  readonly intersection: Intersection;
  /** Distancia calculada en metros. */
  readonly distanceMeters: number;
  /** La distancia está disminuyendo (el usuario se acerca). */
  readonly isApproaching: boolean;
  /** Timestamp del evento. */
  readonly timestamp: number;
}

/** Estado interno del hook useGeofence. */
export interface GeofenceState {
  /** Evento más reciente, null si no hay ninguno activo. */
  readonly activeEvent: GeofenceEvent | null;
  /** Intersección más cercana en el radio de búsqueda. */
  readonly nearestIntersection: Intersection | null;
  /** Distancia a la intersección más cercana en metros. */
  readonly nearestDistanceMeters: number | null;
  /** Indica si el sistema de geofencing está activo. */
  readonly isActive: boolean;
  /** Error del sistema de permisos o GPS. */
  readonly error: string | null;
}

// ---------------------------------------------------------------------------
// Filtros GPS
// ---------------------------------------------------------------------------

/** Configuración del filtro de media móvil. */
export interface MovingAverageConfig {
  /** Cantidad de muestras a promediar (ventana deslizante). @default 5 */
  readonly windowSize: number;
  /**
   * Descarta lecturas cuya exactitud supere este valor en metros.
   * @default 25
   */
  readonly maxAccuracyMeters: number;
}

// ---------------------------------------------------------------------------
// Vibración
// ---------------------------------------------------------------------------

/**
 * Patrón de vibración: array de duraciones en ms.
 * Índices pares = pausa, índices impares = vibración.
 * Compatible con Android Vibration API y expo-haptics.
 */
export type VibrationPattern = readonly number[];

/** Mapeado de zona a patrón de vibración. */
export type ZoneVibrationMap = {
  readonly [K in ProximityZone]: VibrationPattern | null;
};
