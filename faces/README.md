# Caras compartidas

Si pones aquí la foto de alguien, **todos** los que abran el juego la verán en su cabeza 3D
(siempre que el jugador se llame igual en la partida).

1. Sube una foto de la cara, lo más cuadrada y centrada posible (frente → barbilla), p. ej. `carlos.jpg`.
2. Añádela a `index.json` usando el nombre del jugador en minúsculas, sin tildes y con guiones en lugar de espacios:

```json
{
  "carlos": "carlos.jpg",
  "juan": "juan.jpg",
  "angel": "angel.jpg"
}
```

Una foto subida desde el propio juego (botones 📷 / 🖼️) tiene prioridad y solo se guarda en ese navegador.

> Ojo: el repositorio es público, así que cualquiera puede ver las fotos que subáis aquí.
