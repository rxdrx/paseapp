/**
 * @file hooks/useLocation.ts
 * Hook personalizado para gestión de permisos y lectura continua de GPS.
 *
 * Responsabilidades:
 *   - Solicitar y verificar permisos de ubicación en foreground y background.
 *   - Iniciar watchPositionAsync con configuración optimizada batería/precisión.
 *   - Exponer el stream de lecturas crudas al hook useGeofence.
 *   - Limpiar la suscripción al desmontar el componente.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import * as Location from 'expo-location';

import type { GpsReading } from '../types';
import {
  LOCATION_UPDATE_INTERVAL_MS,
  LOCATION_DISTANCE_INTERVAL_M,
} from '../constants/geofence';

// ---------------------------------------------------------------------------
// Tipos del hook
// ---------------------------------------------------------------------------

export interface UseLocationReturn {
  /** Última lectura GPS cruda (sin filtrar). null hasta la primera lectura. */
  readonly lastReading: GpsReading | null;
  /** Permiso de ubicación concedido. */
  readonly hasPermission: boolean;
  /** Mensaje de error (permisos denegados, GPS desactivado, etc.). */
  readonly error: string | null;
  /** Indica si se está esperando la primera lectura GPS. */
  readonly isLoading: boolean;
  /** Fuerza una re-solicitud de permiso (útil tras denegación). */
  readonly requestPermission: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Implementación
// ---------------------------------------------------------------------------

/**
 * Gestiona el ciclo de vida completo del GPS:
 * permisos → watch → cleanup.
 *
 * @example
 * const { lastReading, hasPermission, error } = useLocation();
 */
export function useLocation(): UseLocationReturn {
  const [lastReading, setLastReading]   = useState<GpsReading | null>(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [isLoading, setIsLoading]       = useState(true);

  // Ref para la suscripción de posición (evita re-renders innecesarios)
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);

  // ---------------------------------------------------------------------------
  // Control del watch
  // ---------------------------------------------------------------------------

  const startWatching = useCallback(async () => {
    // Asegurarse de no tener dos suscripciones activas
    subscriptionRef.current?.remove();

    try {
      subscriptionRef.current = await Location.watchPositionAsync(
        {
          /**
           * BestForNavigation en iOS; High en Android.
           * Ambos usan GPS + WiFi + redes móviles para la mejor exactitud.
           */
          accuracy: Location.Accuracy.BestForNavigation,
          /**
           * timeInterval: mínimo entre actualizaciones (ms).
           * distanceInterval: movimiento mínimo para emitir evento (m).
           * Combinados balancean precisión vs. consumo de batería.
           */
          timeInterval:     LOCATION_UPDATE_INTERVAL_MS,
          distanceInterval: LOCATION_DISTANCE_INTERVAL_M,
        },
        (locationUpdate) => {
          const reading: GpsReading = {
            latitude:  locationUpdate.coords.latitude,
            longitude: locationUpdate.coords.longitude,
            accuracy:  locationUpdate.coords.accuracy ?? 999,
            timestamp: locationUpdate.timestamp,
            speed:     locationUpdate.coords.speed,
          };

          setLastReading(reading);
          setIsLoading(false);
        },
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error desconocido al iniciar GPS.';
      setError(`[GPS] ${message}`);
      setIsLoading(false);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Solicitud de permisos
  // ---------------------------------------------------------------------------

  const requestPermission = useCallback(async () => {
    setError(null);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        setHasPermission(false);
        setError(
          'Permiso de ubicación denegado. Por favor habilitá el acceso en Ajustes.',
        );
        setIsLoading(false);
        return;
      }

      setHasPermission(true);
      await startWatching();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error solicitando permisos.';
      setError(`[Permisos] ${message}`);
      setIsLoading(false);
    }
  }, [startWatching]);

  // ---------------------------------------------------------------------------
  // Inicialización y cleanup
  // ---------------------------------------------------------------------------

  useEffect(() => {
    // Verificar si ya existe un permiso concedido antes de solicitarlo nuevamente
    void (async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === 'granted') {
        setHasPermission(true);
        await startWatching();
      } else {
        await requestPermission();
      }
    })();

    return () => {
      // Cleanup: detener el GPS al desmontar
      subscriptionRef.current?.remove();
      subscriptionRef.current = null;
    };
  }, [requestPermission, startWatching]);

  return { lastReading, hasPermission, error, isLoading, requestPermission };
}
