/**
 * @file __tests__/gpsFilter.test.ts
 * Tests unitarios para el filtro de media móvil GPS.
 *
 * Valida:
 *   - Descarte de lecturas de baja calidad
 *   - Promedio correcto de ventana deslizante
 *   - Comportamiento de warm-up
 *   - Reset del buffer
 */

import { GpsMovingAverageFilter, averageCoordinates } from '../../utils/gpsFilter';
import type { GpsReading } from '../../types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeReading = (
  lat: number,
  lon: number,
  accuracy = 5,
  timestamp = Date.now(),
): GpsReading => ({ latitude: lat, longitude: lon, accuracy, timestamp, speed: null });

// ---------------------------------------------------------------------------
// GpsMovingAverageFilter
// ---------------------------------------------------------------------------

describe('GpsMovingAverageFilter', () => {

  describe('warm-up', () => {
    it('isWarmedUp es false con 0 muestras', () => {
      const filter = new GpsMovingAverageFilter({ windowSize: 5, maxAccuracyMeters: 25 });
      expect(filter.isWarmedUp).toBe(false);
    });

    it('isWarmedUp es true al alcanzar ceil(windowSize/2) muestras', () => {
      const filter = new GpsMovingAverageFilter({ windowSize: 5, maxAccuracyMeters: 25 });
      filter.push(makeReading(0, 0));
      filter.push(makeReading(0, 0));
      filter.push(makeReading(0, 0)); // 3 = ceil(5/2)
      expect(filter.isWarmedUp).toBe(true);
    });
  });

  describe('descarte de lecturas de baja calidad', () => {
    it('descarta lecturas con accuracy > maxAccuracyMeters', () => {
      const filter = new GpsMovingAverageFilter({ windowSize: 5, maxAccuracyMeters: 20 });
      const result = filter.push(makeReading(10, 20, 50)); // accuracy=50 > 20
      expect(result).toBeNull(); // Buffer vacío → retorna null
      expect(filter.sampleCount).toBe(0);
    });

    it('con buffer no vacío, retorna la última media si llega lectura mala', () => {
      const filter = new GpsMovingAverageFilter({ windowSize: 5, maxAccuracyMeters: 20 });
      filter.push(makeReading(10, 20, 5)); // Lectura buena
      const result = filter.push(makeReading(99, 99, 50)); // Lectura mala
      expect(result).not.toBeNull();
      // Debe retornar el promedio previo (solo {10, 20})
      expect(result!.latitude).toBeCloseTo(10);
      expect(result!.longitude).toBeCloseTo(20);
    });
  });

  describe('ventana deslizante', () => {
    it('promedia correctamente 3 lecturas', () => {
      const filter = new GpsMovingAverageFilter({ windowSize: 5, maxAccuracyMeters: 25 });
      filter.push(makeReading(10, 20));
      filter.push(makeReading(12, 22));
      const result = filter.push(makeReading(14, 24));
      expect(result!.latitude).toBeCloseTo(12);        // (10+12+14)/3
      expect(result!.longitude).toBeCloseTo(22);       // (20+22+24)/3
    });

    it('expulsa la muestra más antigua al superar windowSize', () => {
      const filter = new GpsMovingAverageFilter({ windowSize: 3, maxAccuracyMeters: 25 });
      filter.push(makeReading(0, 0));   // Muestra "0" (se expulsará)
      filter.push(makeReading(3, 3));
      filter.push(makeReading(3, 3));
      const result = filter.push(makeReading(3, 3)); // Ahora window=[3,3,3]
      expect(result!.latitude).toBeCloseTo(3);
      expect(filter.sampleCount).toBe(3);
    });
  });

  describe('reset', () => {
    it('vacía el buffer correctamente', () => {
      const filter = new GpsMovingAverageFilter({ windowSize: 5, maxAccuracyMeters: 25 });
      filter.push(makeReading(1, 1));
      filter.push(makeReading(2, 2));
      filter.reset();
      expect(filter.sampleCount).toBe(0);
      expect(filter.isWarmedUp).toBe(false);
    });

    it('permite volver a agregar lecturas tras el reset', () => {
      const filter = new GpsMovingAverageFilter({ windowSize: 5, maxAccuracyMeters: 25 });
      filter.push(makeReading(1, 1));
      filter.reset();
      const result = filter.push(makeReading(5, 10));
      expect(result).not.toBeNull();
      expect(result!.latitude).toBeCloseTo(5);
    });
  });
});

// ---------------------------------------------------------------------------
// averageCoordinates (función pura)
// ---------------------------------------------------------------------------

describe('averageCoordinates', () => {
  it('lanza error si el array está vacío', () => {
    expect(() => averageCoordinates([])).toThrow();
  });

  it('retorna la misma coordenada si solo hay una lectura', () => {
    const result = averageCoordinates([{ latitude: 5, longitude: 10 }]);
    expect(result.latitude).toBe(5);
    expect(result.longitude).toBe(10);
  });

  it('promedia correctamente múltiples lecturas', () => {
    const result = averageCoordinates([
      { latitude: 0, longitude: 0 },
      { latitude: 2, longitude: 4 },
      { latitude: 4, longitude: 8 },
    ]);
    expect(result.latitude).toBeCloseTo(2);
    expect(result.longitude).toBeCloseTo(4);
  });

  it('es determinista: mismo input → mismo output', () => {
    const coords = [
      { latitude: 1.1, longitude: 2.2 },
      { latitude: 3.3, longitude: 4.4 },
    ];
    expect(averageCoordinates(coords)).toEqual(averageCoordinates(coords));
  });
});
