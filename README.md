# IDEAMEX Backend

Backend de la plataforma IDEAMEX construido con Node.js, Express y TypeScript. Este documento describe cómo preparar el entorno local para desarrollo y pruebas.

## Requisitos previos

- Node.js 18 o superior (incluye npm)
- MariaDB 10.6+ en ejecución local o accesible por red

## Clonar e instalar dependencias

```bash
git clone <url-del-repo>
cd ideamex_backend
npm install
```

## Configuración de variables de entorno

Antes de ejecutar el proyecto crea un archivo `.env` en la raíz con, al menos, las siguientes variables:

| Variable | Descripción | Valor por defecto |
| --- | --- | --- |
| `NODE_ENV` | Entorno de ejecución (`development`, `production`, etc.) | `development` |
| `PORT` | Puerto HTTP del servidor | `3000` |
| `BASE_PATH` | Prefijo base para las rutas de la API | `/api` |
| `JWT_SECRET` | Clave para firmar y verificar JWT | `defaultsecret` *(no recomendado)* |
| `DB_HOST` | Host del servidor MariaDB | `127.0.0.1` |
| `DB_USER` | Usuario de la base de datos | `root` |
| `DB_PASSWORD` | Contraseña del usuario de la base de datos | `""` |
| `DB_NAME` | Nombre de la base de datos | `ideamex` |
| `PROJECTS_BASE_PATH` | Carpeta donde se guardan los archivos subidos | `./projects` |
| `ANALYSIS_EXECUTION_MODE` | Modo de ejecución del pipeline (`local` o `docker`) | `local` |
| `ANALYSIS_RSCRIPT_BIN` | Binario para ejecutar R (ej. `Rscript`) | `Rscript` |
| `ANALYSIS_SCRIPT_PATH` | Ruta absoluta al script `RunMainIDEAMEX.r` | `""` |
| `ANALYSIS_SOURCES_PATH` | Ruta base para `-s` (archivos fuente del pipeline) | `""` |
| `ANALYSIS_DOCKER_CONTAINER` | Nombre del contenedor de R a usar con `docker exec` | `ideamex-r` |
| `ANALYSIS_DOCKER_SCRIPT_PATH` | Ruta del script dentro del contenedor | `/app/src/RunMainIDEAMEX.r` |
| `ANALYSIS_DOCKER_SOURCES_PATH` | Ruta de fuentes del pipeline dentro del contenedor | `/app/src` |
| `ANALYSIS_DOCKER_HOST_PROJECTS_PATH` | Ruta absoluta de `projects` en host | `./projects` |
| `ANALYSIS_DOCKER_CONTAINER_PROJECTS_PATH` | Ruta montada de `projects` dentro del contenedor | `/workspace/projects` |
| `SMTP_HOST` | Servidor SMTP para correos transaccionales | `smtp.gmail.com` |
| `SMTP_PORT` | Puerto SMTP | `587` |
| `SMTP_USER` | Usuario SMTP | `""` |
| `SMTP_PASSWORD` | Contraseña SMTP | `""` |
| `SMTP_FROM_NAME` | Nombre del remitente en los correos | `""` |
| `SMTP_FROM_EMAIL` | Correo remitente | `""` |
| `GOOGLE_CLIENT_ID` | Client ID OAuth2 de Google | `""` |
| `GOOGLE_CLIENT_SECRET` | Client Secret OAuth2 de Google (callback flow) | `""` |
| `GOOGLE_CALLBACK_URL` | URL de callback registrada en Google Console | `""` |
| `SWAGGER_USER` | Usuario básico para acceder a Swagger | `admin` |
| `SWAGGER_PASSWORD` | Contraseña básica para Swagger | `password123` |

> Ajusta las credenciales al entorno local. Asegúrate de crear la base de datos indicada en `DB_NAME` antes de iniciar el servidor.

## Ejecutar en modo desarrollo

Con la base de datos corriendo y la configuración lista:

```bash
npm run dev
```

El servidor se iniciará escuchando en `http://localhost:<PORT><BASE_PATH>`. La documentación Swagger queda disponible (tras autenticación básica) en `http://localhost:<PORT><BASE_PATH>/docs`.

Los archivos cargados mediante el módulo de análisis se almacenan en la ruta indicada por `PROJECTS_BASE_PATH`; si no la defines, se usará la carpeta `projects` en la raíz del proyecto.

## Ejecutar R en Docker (solo servicio R)

Si quieres igualar el comportamiento del servidor (backend local + R en contenedor):

1. Configura en `.env`:

```bash
ANALYSIS_EXECUTION_MODE=docker
ANALYSIS_DOCKER_CONTAINER=ideamex-r
ANALYSIS_DOCKER_SCRIPT_PATH=/app/src/RunMainIDEAMEX.r
ANALYSIS_DOCKER_SOURCES_PATH=/app/src
ANALYSIS_DOCKER_HOST_PROJECTS_PATH=/ruta/absoluta/a/ideamex_backend/projects
ANALYSIS_DOCKER_CONTAINER_PROJECTS_PATH=/workspace/projects
```

2. Levanta solo el contenedor de R:

```bash
npm run r:up
```

3. Inicia backend normal:

```bash
npm run dev
```

Comandos útiles:

- `npm run r:logs`: ver logs del contenedor de R.
- `npm run r:down`: detener y remover el contenedor de R.

## Compilar y ejecutar en producción local

```bash
npm run build
npm start
```

El comando `npm run build` genera la carpeta `dist/` con el código JavaScript compilado. `npm start` levanta el servidor utilizando esos archivos compilados.

## Login con Google

Puedes usar cualquiera de estos flujos:

- Redirect OAuth clásico:
  - `GET /auth/google` inicia la autorización en Google.
  - `GET /auth/google/callback` recibe `code`, valida identidad y devuelve JWT de IDEAMEX.
  - Requiere `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` y `GOOGLE_CALLBACK_URL`.
- Token directo (SPA/mobile):
  - `POST /auth/google/login` con `idToken`.
  - Requiere `GOOGLE_CLIENT_ID`.

Para `POST /auth/google/login`, el payload es:

```json
{
  "idToken": "TOKEN_ID_DE_GOOGLE"
}
```

Ejemplo con `curl`:

```bash
curl -X POST http://localhost:3000/auth/google/login \
  -H "Content-Type: application/json" \
  -d '{"idToken":"TOKEN_ID_DE_GOOGLE"}'
```

Si el token es válido para tu `GOOGLE_CLIENT_ID`, la API responderá con el JWT interno de IDEAMEX.

## Scripts disponibles

- `npm run dev`: Ejecuta la API con `ts-node` y recarga en caliente.
- `npm run build`: Transpila TypeScript a JavaScript dentro de `dist/`.
- `npm start`: Arranca la versión compilada (`dist/index.js`).

## Problemas frecuentes

- **Error de conexión a la base de datos**: revisa credenciales en `.env` y que el servicio MariaDB esté en ejecución.
- **Errores al subir archivos**: valida que `PROJECTS_BASE_PATH` apunte a un directorio existente y con permisos de escritura.
- **No carga la documentación Swagger**: confirma que las credenciales básicas (`SWAGGER_USER`, `SWAGGER_PASSWORD`) coinciden y que el prefijo `BASE_PATH` sea el mismo que usas en la URL.
