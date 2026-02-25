/**
 * @file utils/gpsFilter.ts
 * Filtro de Media Móvil (Moving Average) para coordenadas GPS.
 *
 * Propósito: reducir el "GPS Jitter" causado por la reflexión de señal
 * en edificios altos (multipath), especialmente crítico en el microcentro
 * de Bahía Blanca (Estomba, Chiclana, Colón).
 *
 * Estrategia:
 *   1. Se descarta cualquier lectura cuya exactitud supere maxAccuracyMeters.
 *   2. Las últimas `windowSize` lecturas válidas se promedian por separado
 *      (lat y lon), produciendo una coordenada suavizada.
 *   3. La clase expone el buffer para inspección en tests.
 */

import type { Coordinates, GpsReading, MovingAverageConfig } from '../types';
import { GPS_FILTER_CONFIG } from '../constants/geofence';

// ---------------------------------------------------------------------------
// Implementación
// ---------------------------------------------------------------------------

export class GpsMovingAverageFilter {
  private readonly windowSize: number;
  private readonly maxAccuracyMeters: number;
  private readonly buffer: GpsReading[] = [];

  constructor(config: MovingAverageConfig = GPS_FILTER_CONFIG) {
    this.windowSize        = config.windowSize;
    this.maxAccuracyMeters = config.maxAccuracyMeters;
  }

  /**
   * Agrega una nueva lectura GPS al buffer y retorna la coordenada suavizada.
   *
   * @param reading - Lectura cruda del sensor GPS.
   * @returns Coordenada filtrada, o `null` si la lectura es descartada
   *          por baja calidad y el buffer está vacío.
   */
  public push(reading: GpsReading): Coordinates | null {
    // Descartar lecturas de baja calidad (accuracy = radio de error en metros)
    if (reading.accuracy > this.maxAccuracyMeters) {
      // Si el buffer tiene datos previos, reutilizamos la última media
      return this.buffer.length > 0 ? this.computeAverage() : null;
    }

    // Agregar al buffer circular (FIFO)
    this.buffer.push(reading);
    if (this.buffer.length > this.windowSize) {
      this.buffer.shift();
    }

    return this.computeAverage();
  }

  /**
   * Vacía el buffer. Útil al retomar la app desde background.
   */
  public reset(): void {
    this.buffer.length = 0;
  }

  /**
   * Cantidad de muestras actualmente en el buffer.
   * Útil para saber si el filtro ya tiene suficientes datos ("warm-up").
   */
  public get sampleCount(): number {
    return this.buffer.length;
  }

  /**
   * Indica si el filtro tiene suficientes muestras para ser confiable.
   * Se necesita al menos la mitad de la ventana para emitir alertas DANGER.
   */
  public get isWarmedUp(): boolean {
    return this.buffer.length >= Math.ceil(this.windowSize / 2);
  }

  // ---------------------------------------------------------------------------
  // Privados
  // ---------------------------------------------------------------------------

  private computeAverage(): Coordinates {
    const n = this.buffer.length;

    // Usamos suma simple (no ponderada por accuracy) para preservar el
    // comportamiento determinista en tests. Para mayor precisión en producción
    // se podría ponderar por 1/accuracy².
    let sumLat = 0;
    let sumLon = 0;

    for (const r of this.buffer) {
      sumLat += r.latitude;
      sumLon += r.longitude;
    }

    return {
      latitude:  sumLat / n,
      longitude: sumLon / n,
    };
  }
}

// ---------------------------------------------------------------------------
// Función pura helper para tests / uso puntual sin instancia
// ---------------------------------------------------------------------------

/**
 * Versión funcional pura: promedia un array de coordenadas.
 * No mantiene estado interno. Útil para tests unitarios directos.
 *
 * @param readings - Array de coordenadas a promediar.
 * @returns Coordenada promedio.
 * @throws {Error} Si el array está vacío.
 */
export function averageCoordinates(readings: readonly Coordinates[]): Coordinates {
  if (readings.length === 0) {
    throw new Error('[GpsFilter] No se puede promediar un array vacío de coordenadas.');
  }

  const n = readings.length;
  let sumLat = 0;
  let sumLon = 0;

  for (const r of readings) {
    sumLat += r.latitude;
    sumLon += r.longitude;
  }

  return { latitude: sumLat / n, longitude: sumLon / n };
}
