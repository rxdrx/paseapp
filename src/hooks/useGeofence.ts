/**
 * @file hooks/useGeofence.ts
 * Hook central de la lógica de geofencing.
 *
 * Orquesta:
 *   1. Lectura GPS cruda (via useLocation)
 *   2. Suavizado de coordenadas (GpsMovingAverageFilter)
 *   3. Búsqueda de intersecciones cercanas (intersectionService)
 *   4. Determinación de zona de proximidad (haversineDistance)
 *   5. Filtro de dirección (isApproaching) → bloquea alertas al alejarse
 *   6. Filtro de consistencia para zona DANGER (min. 3 lecturas)
 *   7. Disparo de vibración (vibrationService)
 *
 *  ┌──────────┐     ┌───────────┐     ┌───────────────┐
 *  │useLocation│────▶│GPS Filter │────▶│ Haversine +   │
 *  │ (raw GPS) │     │(mov. avg) │     │ Zone Resolver │
 *  └──────────┘     └───────────┘     └──────┬────────┘
 *                                             │
 *                              ┌──────────────▼──────────────┐
 *                              │ Direction Filter             │
 *                              │ + Danger Consistency Check   │
 *                              └──────────────┬──────────────┘
 *                                             │
 *                                    ┌────────▼────────┐
 *                                    │ VibrationService│
 *                                    └─────────────────┘
 */

import { useState, useEffect, useRef, useCallback } from 'react';

import { ProximityZone } from '../types';
import type { GeofenceState, GeofenceEvent, Coordinates } from '../types';
import {
  THRESHOLD_DANGER_M,
  THRESHOLD_CAUTION_M,
  THRESHOLD_AWARENESS_M,
  MAX_SEARCH_RADIUS_M,
  MIN_CONSISTENT_READINGS_DANGER,
  HYSTERESIS_M,
  GPS_FILTER_CONFIG,
} from '../constants/geofence';
import { haversineDistance, isApproaching, findNearest } from '../utils/haversine';
import { GpsMovingAverageFilter } from '../utils/gpsFilter';
import { getIntersectionsInRadius } from '../services/intersectionService';
import { vibrateForZone, cancelVibration } from '../services/vibrationService';
import { useLocation } from './useLocation';

// ---------------------------------------------------------------------------
// Estado inicial
// ---------------------------------------------------------------------------

const INITIAL_STATE: GeofenceState = {
  activeEvent:           null,
  nearestIntersection:   null,
  nearestDistanceMeters: null,
  isActive:              false,
  error:                 null,
};

// ---------------------------------------------------------------------------
// Función pura: determinar zona según distancia
// ---------------------------------------------------------------------------

/**
 * Convierte una distancia en metros a la zona de proximidad correspondiente.
 * @pure
 */
export function resolveProximityZone(distanceMeters: number): ProximityZone {
  if (distanceMeters <= THRESHOLD_DANGER_M)    return ProximityZone.DANGER;
  if (distanceMeters <= THRESHOLD_CAUTION_M)   return ProximityZone.CAUTION;
  if (distanceMeters <= THRESHOLD_AWARENESS_M) return ProximityZone.AWARENESS;
  return ProximityZone.NONE;
}

// ---------------------------------------------------------------------------
// Hook principal
// ---------------------------------------------------------------------------

export interface UseGeofenceOptions {
  /**
   * Radio de búsqueda de intersecciones en metros.
   * @default MAX_SEARCH_RADIUS_M (60 m)
   */
  searchRadiusMeters?: number;
  /**
   * Desactiva la vibración (útil para testing o modo "silencioso").
   * @default false
   */
  disableVibration?: boolean;
}

export interface UseGeofenceReturn extends GeofenceState {
  /** Pausa el sistema de geofencing sin desmontar el GPS. */
  pause: () => void;
  /** Reanuda el sistema de geofencing. */
  resume: () => void;
}

/**
 * Hook de geofencing dinámico.
 *
 * @example
 * const { activeEvent, nearestIntersection, nearestDistanceMeters } = useGeofence();
 *
 * if (activeEvent?.zone === ProximityZone.DANGER) {
 *   // Mostrar alerta visual de respaldo
 * }
 */
export function useGeofence(options: UseGeofenceOptions = {}): UseGeofenceReturn {
  const {
    searchRadiusMeters = MAX_SEARCH_RADIUS_M,
    disableVibration   = false,
  } = options;

  const [state, setState] = useState<GeofenceState>(INITIAL_STATE);

  // ---------------------------------------------------------------------------
  // Refs de estado intergeneracional (no causan re-renders)
  // ---------------------------------------------------------------------------

  /** Filtro GPS con estado interno (ventana deslizante). */
  const gpsFilter = useRef(new GpsMovingAverageFilter(GPS_FILTER_CONFIG));

  /** Última distancia calculada a la intersección más cercana. */
  const previousDistanceRef = useRef<number | null>(null);

  /** Zona actualmente activa (para evitar re-disparar la misma zona). */
  const activeZoneRef = useRef<ProximityZone>(ProximityZone.NONE);

  /**
   * Contador de lecturas consecutivas en zona DANGER.
   * Se necesitan MIN_CONSISTENT_READINGS_DANGER para disparar la vibración.
   */
  const dangerConsistencyCountRef = useRef(0);

  /** Indica si el geofencing está pausado. */
  const isPausedRef = useRef(false);

  // ---------------------------------------------------------------------------
  // Fuente de datos GPS
  // ---------------------------------------------------------------------------

  const { lastReading, hasPermission, error: locationError, isLoading } = useLocation();

  // Propagar errores de permisos al estado del geofence
  useEffect(() => {
    if (locationError) {
      setState(prev => ({ ...prev, error: locationError }));
    }
  }, [locationError]);

  useEffect(() => {
    setState(prev => ({ ...prev, isActive: hasPermission && !isLoading }));
  }, [hasPermission, isLoading]);

  // ---------------------------------------------------------------------------
  // Procesamiento de cada nueva lectura GPS
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (lastReading === null || isPausedRef.current) return;

    // --- PASO 1: Filtrar la lectura con el Moving Average ---
    const smoothed: Coordinates | null = gpsFilter.current.push(lastReading);
    if (smoothed === null) return; // Lectura descartada por baja calidad

    // --- PASO 2: Buscar intersecciones dentro del radio ---
    const candidates = getIntersectionsInRadius(smoothed, searchRadiusMeters);
    const nearest    = findNearest(smoothed, candidates);

    if (nearest === null) {
      // No hay intersecciones cercanas: resetear zona sin vibrar
      handleNoIntersection();
      return;
    }

    const { item: intersection, distanceMeters } = nearest;

    // --- PASO 3: Actualizar estado de la intersección más cercana ---
    setState(prev => ({
      ...prev,
      nearestIntersection:   intersection,
      nearestDistanceMeters: distanceMeters,
    }));

    // --- PASO 4: Determinar zona ---
    const zone = resolveProximityZone(distanceMeters);

    // --- PASO 5: Filtro de dirección (approaching) ---
    const prevDist   = previousDistanceRef.current;
    const approaching = prevDist !== null
      ? isApproaching(prevDist, distanceMeters, HYSTERESIS_M)
      : true; // Primera lectura: asumir acercamiento para no bloquear

    previousDistanceRef.current = distanceMeters;

    // Si el usuario se aleja y está fuera de zona DANGER, no vibrar
    if (!approaching && zone !== ProximityZone.DANGER) {
      return;
    }

    // --- PASO 6: Filtro de consistencia para zona DANGER ---
    if (zone === ProximityZone.DANGER) {
      dangerConsistencyCountRef.current += 1;

      // Solo disparar DANGER tras N lecturas consistentes
      if (dangerConsistencyCountRef.current < MIN_CONSISTENT_READINGS_DANGER) {
        return;
      }
    } else {
      // Resetear contador de consistencia si salimos de zona DANGER
      dangerConsistencyCountRef.current = 0;
    }

    // --- PASO 7: Evitar re-disparar la misma zona (histeresis) ---
    if (zone === activeZoneRef.current && zone !== ProximityZone.NONE) {
      // Misma zona: actualizar distancia pero no revibrar
      setState(prev => ({
        ...prev,
        activeEvent: prev.activeEvent
          ? { ...prev.activeEvent, distanceMeters, isApproaching: approaching }
          : null,
      }));
      return;
    }

    // --- PASO 8: Construir evento y disparar vibración ---
    activeZoneRef.current = zone;

    const event: GeofenceEvent = {
      zone,
      intersection,
      distanceMeters,
      isApproaching: approaching,
      timestamp: Date.now(),
    };

    setState(prev => ({
      ...prev,
      activeEvent: zone !== ProximityZone.NONE ? event : null,
    }));

    if (!disableVibration) {
      void vibrateForZone(zone);
    }
  }, [lastReading, searchRadiusMeters, disableVibration]);

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function handleNoIntersection(): void {
    if (activeZoneRef.current !== ProximityZone.NONE) {
      activeZoneRef.current              = ProximityZone.NONE;
      dangerConsistencyCountRef.current  = 0;
      previousDistanceRef.current        = null;
      cancelVibration();
      setState(prev => ({
        ...prev,
        activeEvent:           null,
        nearestIntersection:   null,
        nearestDistanceMeters: null,
      }));
    }
  }

  // ---------------------------------------------------------------------------
  // Controles de pausa/reanudación
  // ---------------------------------------------------------------------------

  const pause = useCallback(() => {
    isPausedRef.current = true;
    cancelVibration();
    setState(prev => ({ ...prev, isActive: false }));
  }, []);

  const resume = useCallback(() => {
    isPausedRef.current = false;
    gpsFilter.current.reset(); // Resetear filtro para evitar datos rancios
    previousDistanceRef.current       = null;
    dangerConsistencyCountRef.current = 0;
    setState(prev => ({ ...prev, isActive: true }));
  }, []);

  return { ...state, pause, resume };
}
