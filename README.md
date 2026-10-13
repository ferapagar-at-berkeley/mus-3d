# 🃏 Mus 3D · Bar El Órdago

Mus de toda la vida, en 3D y en el navegador: te sientas en la mesa de un bar con tres bots
que llevan **la cara de tus amigos**, puedes **mover la cabeza** para mirar alrededor y, si estás atento,
**pillar las señas** de los rivales.

### ▶️ Jugar: https://ferapagar-at-berkeley.github.io/mus-3d/

Funciona en ordenador y en móvil (mejor en horizontal). No hay que instalar nada.

## Qué tiene

- **Mus completo**: mus y descartes, grande, chica, pares (par, medias, duples), juego (31 > 32 > 40 > 37…) y punto,
  envites, reenvites, órdago, «no quiero» con su deje, conteo al final de la mano y partidas a 30 o 40 tantos.
  Baraja de 8 reyes (treses = reyes, doses = ases) o de 4 reyes.
- **Caras de verdad**: en «👥 Jugadores» le pones nombre y cara a cada uno, con una foto o con la cámara.
  La foto se recorta y se pega en un cabezón 3D. Las fotos se quedan solo en tu navegador
  (o en la carpeta [`faces/`](faces/) si queréis compartirlas con todos).
- **Mueve la cabeza**: arrastra con el ratón o el dedo, usa las flechas / WASD, o activa el 🧭 giroscopio
  en el móvil y mira moviendo el teléfono. Doble clic o `C` para volver a mirar al frente.
- **Señas**: tu compañero te hace señas con la cara (😉 31, 😬 dos reyes, 😛 dos pitos…). Los rivales también se
  las hacen entre ellos: si en ese momento estás mirando a uno, se la pillas. Tú también puedes hacerle señas a tu compañero
  con el botón 🤫 (y a veces los rivales te la pillan).
- **Bots que piensan**: estiman su probabilidad de ganar cada lance simulando cientos de repartos compatibles con lo
  que saben (sus cartas, lo que han dicho los demás y las señas que han visto), y a veces se tiran faroles.
- **Un bar con ambiente**: neón, botellas, cañas, aceitunas, azulejos, el Campanile de Berkeley por la ventana,
  un reloj con la hora real, voces en castellano para los cantes y piedras para llevar los tantos.
- **Ayudas** opcionales: descripción de tu mano, probabilidad estimada de ganar el lance y sugerencia de descarte.

## Controles

| Acción | Ratón / teclado | Móvil |
| --- | --- | --- |
| Mirar alrededor | arrastrar · ←→↑↓ · WASD | arrastrar · 🧭 giroscopio |
| Mirar al frente | doble clic · `C` · 🎯 | 🎯 |
| Elegir descartes | clic en las cartas · `1`-`4` | tocar las cartas |
| Siguiente mano | `Enter` | botón |

## Desarrollo

No hay paso de compilación: es HTML + módulos ES con [three.js](https://threejs.org/) desde CDN.

```bash
python -m http.server 8000   # y abre http://localhost:8000
npm test                     # tests del motor de reglas y partidas completas entre bots (Node 18+)
```

| Archivo | Qué hace |
| --- | --- |
| `js/mus.js` | Reglas y flujo de la partida (sin DOM, testeable en Node) |
| `js/ai.js` | Bots: estimación Monte Carlo y estrategia de apuestas, mus y descartes |
| `js/scene.js` | Escena 3D: jugadores, cartas, animaciones, cámara/cabeza, señas |
| `js/decor.js` | El bar: sala, mesa, lámpara y atrezo procedural |
| `js/cards.js` | Baraja española dibujada en canvas (con sus pintas) |
| `js/faces.js` | Caras: fotos recortadas o caras de dibujo generadas por nombre |
| `js/main.js` | Interfaz, turnos del jugador, conteo y configuración |
| `js/audio.js` | Efectos sintetizados y voz de los cantes |

Hecho con [Claude Code](https://claude.com/claude-code).
