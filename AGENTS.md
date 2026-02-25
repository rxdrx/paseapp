# Contexto del Proyecto: Asistente de Movilidad Urbana (Bahía Blanca)

## Objetivo
Aplicación móvil que utiliza geofencing dinámico para alertar a personas no videntes sobre la proximidad de cruces de calles mediante patrones de vibración específicos.

## Reglas de Negocio (Triggers)
- **40 metros:** Umbral de "Conciencia". Patrón: `[0, 500]` (500ms vibración).
- **20 metros:** Umbral de "Precaución". Patrón: `[0, 200, 100, 200]` (Dos pulsos cortos).
- **10 metros:** Umbral de "Peligro/Frenado". Patrón: `[0, 100, 50, 100, 50, 100, 50, 100]`.

## Consideraciones Técnicas (Stack: React Native + Node)
- **Precisión:** Se requiere `accuracy: High` o `BestForNavigation`.
- **Filtro de Ruido:** El GPS comercial tiene un error de ~5-10m. Las alertas de 10m deben validarse con al menos 3 lecturas consistentes antes de disparar la vibración.
- **Geofencing:** Las coordenadas de las esquinas se obtendrán de [OpenStreetMap API / Overpass Turbo] o una base de datos local de las calles de Bahía Blanca.
- **Offline First:** La lógica de cálculo de distancia (Haversine Formula) debe ejecutarse en el cliente para evitar latencia de red.

## Contexto Local (Bahía Blanca)
- La ciudad tiene una cuadrícula (damero) regular, pero con zonas de alta interferencia de señal en el microcentro (edificios altos en calles como Estomba, Chiclana y Colón).
- Considerar la integración con datos de paradas de colectivos de la SAPEM en futuras iteraciones.

## Estándares de Código
- Tipado estricto con TypeScript.
- Hooks personalizados para la lógica de geolocalización (`useGeofence`).
- Manejo de permisos de ubicación siempre presente.