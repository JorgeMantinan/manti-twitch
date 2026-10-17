# manti-twitch (frontend)

Frontend del bot de Twitch "manti-twitch": aplicación **Expo / React Native**
(con React 19) que se ejecuta también en web y ofrece al streamer y a sus
moderadores una interfaz para sortear con el chat y jugar en directo (ruleta,
barcos, bingo y ahorcado), además de consultar suscriptores y seguidores del
canal. Se autentica con Twitch OAuth contra el backend y se comunica con él por
HTTP y Socket.IO.

Web publicada en https://manti-twitch.vercel.app (el backend está en
https://manti-twitch-backend.onrender.com).

## Características

- **Login con Twitch**: botón que redirige al OAuth del backend; el JWT llega en
  un `?code=` de un solo uso que se canjea con `POST /auth/exchange`, se guarda
  (SecureStore en nativo, localStorage en web) y la sesión dura 30 días con
  refresh deslizante (`ensureFreshToken` al montar la app). Botón de cerrar
  sesión en la pantalla de inicio.
- **Paneles por rol**: `ToolsUsers` (usuarios), `ToolsMods` (moderadores, con
  buscador de seguidores) y `ToolsStreamer` (streamer, con suscriptores
  actuales).
- **Ruleta (SmartRoulette)**: ruleta de premios con pesos, sorteos automáticos
  y por lotes, duelos, cadenas de premios, anti-repetición, anuncio del ganador
  en el chat, filtros por suscriptor/seguidor, badges de regalo, vista mini y
  vista overlay para OBS, tema oscuro, modo anónimo, exportación CSV, registro
  de acciones y configuración por URL.
- **Barcos (Ships)**: juego de batalla naval con participantes del chat, modo
  solo suscriptores, añadir participantes manualmente y controles de moderador.
- **Bingo**: cartones de bingo con participantes del chat, modo automático,
  sorteo de números y avisos de línea/bingo.
- **Ahorcado**: frase secreta del canal, letras sorteadas, fallos por jugador
  (6 por nick), modo solo subs, figurita del ahorcado y audio de la frase al
  adivinarla desde el chat (`!ahorcado <frase>`).
- **Datos del canal**: listado de suscriptores actuales e históricos
  (`MySubs`) y buscador de seguidores por streamer y fechas (`ListFollowers`).

## Stack

- Expo ~54 (React Native 0.81, React 19.1) con **expo-router** (enrutado por
  ficheros, `typedRoutes` y `reactCompiler` activados)
- react-native-web (objetivo web, bundler Metro, output estático)
- socket.io-client (juegos en tiempo real, con token en `handshake.auth`)
- expo-secure-store, expo-auth-session, expo-web-browser, jwt-decode
- patch-package (postinstall), ESLint (eslint-config-expo)
- Jest + Testing Library (unit) y Cypress (E2E)

## Estructura

```
manti-twitch-frontend/
├── app/                      páginas (expo-router)
│   ├── _layout.tsx           raíz: tema + refresh del token
│   ├── index.tsx             inicio: login/logout y paneles por rol
│   ├── SmartRoulette.tsx     ruleta de premios
│   ├── Ships.tsx             barcos
│   ├── Bingo.tsx             bingo
│   ├── Ahorcado.tsx          ahorcado
│   ├── MySubs.tsx            suscriptores del canal
│   ├── ListFollowers.tsx     buscador de seguidores
│   └── ToolsMods.tsx / ToolsStreamer.tsx / ToolsUsers.tsx  paneles
├── components/               modales (bingo, ahorcado), figurita, rueda SVG
├── services/
│   ├── api.ts                cliente HTTP del backend (BASE_URL fija en Render)
│   └── auth.ts               token, exchange, refresh y cierre de sesión
├── constants/                api (endpoints) y tema
├── utils/                    ahorcado, audio del ahorcado, cartones, sesión
├── hooks/                    esquema de color y colores por tema
├── assets/                   iconos, fondos y clips de audio del ahorcado
├── __tests__/                Jest (api, bingoCard, ahorcado) + helpers mock
├── cypress/                  E2E (specs en e2e/, soporte y tsconfig propios)
├── patches/                  patch de react-native-web (pointerEvents)
├── app.json / vercel.json / jest.config.js / cypress.config.js / tsconfig.json
└── package.json              name "ruleta-frontend", v1.3.0
```

## Requisitos

- Node.js **24.x** (fijado en `engines`; 20.x está discontinuado en Vercel).
- Backend desplegado (o local) al que apuntar; la URL base está en
  `constants/api.ts`.
- `.npmrc` con `legacy-peer-deps=true`: obligatorio, `jest-expo@56` tiene
  conflicto de peers con `react@19.1.0` y sin esa opción `npm install` falla.
- El `postinstall` ejecuta patch-package (aplica
  `patches/react-native-web+0.21.2.patch`).

## Puesta en marcha

```bat
npm install
npm run start        :: servidor de desarrollo Expo (puerto 8081)
npm run web          :: variante para el objetivo web
```

No usa `.env`: la base URL del backend es la constante `BASE_URL` de
`constants/api.ts`. En desarrollo conviene usar `expo start` (Metro), no
webpack/vite. El alias de rutas `@/` apunta a `app/` (`tsconfig.json`).

```bat
npm run lint         :: ESLint (config plana, eslint-config-expo)
```

## Tests

```bat
npm test             :: Jest (3 suites, 16 pruebas)
npm run test:watch
npm run cypress:open :: Cypress en modo interactivo (requiere el dev server)
npm run cypress:run  :: Cypress en modo headless
```

- **Jest** (`jest.config.js`, preset `react-native`): `api.test.ts`,
  `bingoCard.test.ts` y `ahorcado.test.ts`. Hay que aplicar los mocks de
  `__tests__/helpers/` (expo-secure-store, expo-haptics).
- **Cypress** (`cypress/e2e/`): `smart-roulette.cy.ts`, `ships.cy.ts`,
  `bingo.cy.ts`, `ahorcado.cy.ts`, `roulette-features.cy.ts` y `home.cy.ts`
  (48 pruebas). El mock de auth está en `cypress/support/commands.ts`
  (`setAuth(role)` genera un JWT falso en localStorage) y Socket.IO se
  intercepta en `beforeEach` para que las specs no toquen el backend real.

## Despliegue

- **Vercel**, publicando la rama `main`: `vercel.json` usa
  `buildCommand: npx expo export --platform web` y `outputDirectory: dist`.
  `cleanUrls: true` es necesario porque Expo emite `Bingo.html` y el router
  navega a `/Bingo`.
- En la configuración del proyecto de Vercel: `CYPRESS_INSTALL_BINARY=0` (para
  no descargar Cypress en cada build) y Node 24.x.
- GitHub Pages quedó retirado (rama `gh-pages` y carpeta `docs/` eliminadas).
- El backend (Render) y el frontend (Vercel) se despliegan por separado; el
  CORS del backend está limitado al dominio de Vercel.

## Estado

- Activo y desplegado en producción; v1.3.0 con los cuatro juegos operativos.
- Cobertura actual: 16 pruebas Jest y 48 E2E de Cypress en verde; no hay
  pipeline de CI/CD (se ejecutan en local).
- Notas de implementación y decisiones de diseño en `../AGENTS.md`; pendientes
  en `../MEJORAS.md`.
