# IDEAMEX Backend

API REST de **IDEAMEX** (*Integrative Differential Expression Analysis for
Multiple EXperiments*): gestiona las cuentas de usuario, las solicitudes de
contacto y los proyectos de análisis de expresión diferencial de RNA-seq. Está
construida con Node.js, Express y TypeScript, guarda su estado en MariaDB y
delega el análisis estadístico a un pipeline de R que se ejecuta en un
contenedor aparte.

## Arquitectura

| Componente | Función |
| --- | --- |
| API (este repositorio) | Autenticación local y con Google, recuperación de contraseña, formulario de contacto y ciclo de vida de los proyectos. |
| MariaDB | Usuarios, solicitudes de contacto y metadatos de los proyectos. |
| `projects/` | Tablas de conteos cargadas y resultados generados. No se versiona. |
| Motor R | Ejecuta DESeq2, edgeR, limma-voom y NOISeq mediante [`R/ideamexCLI/`](R/README.md). |
| Swagger | Documentación interactiva protegida con autenticación básica en `/docs/`. |

El backend nunca escribe resultados por su cuenta: prepara el directorio del
proyecto, lanza el pipeline de R y después lee lo que este dejó en disco. Esa
separación permite correr el análisis en el mismo host (`local`) o dentro del
contenedor `ideamex-r` (`docker`) sin tocar el código.

## Requisitos

- Node.js 20 o superior.
- MariaDB accesible por red.
- Un servidor SMTP válido: la API verifica la conexión durante el arranque y
  aborta si no responde.
- Docker, si se usará el motor de R en contenedor (modo recomendado).

## Configuración local

```bash
npm ci
mkdir -p projects
```

Crea un archivo `.env` en la raíz. No lo subas al repositorio: contiene secretos
y ya está excluido por `.gitignore`.

```dotenv
NODE_ENV=development
PORT=5000
JWT_SECRET=usa-una-cadena-larga-y-aleatoria

DB_HOST=127.0.0.1
DB_USER=root
DB_PASSWORD=tu-contrasena
DB_NAME=ideamex

SMTP_HOST=smtp.example.org
SMTP_PORT=587
SMTP_USER=usuario@example.org
SMTP_PASSWORD=tu-contrasena-smtp
SMTP_FROM_NAME=IDEAMEX
SMTP_FROM_EMAIL=usuario@example.org
CONTACT_NOTIFICATION_EMAIL=ideamex.unam@gmail.com
```

Importa [`deploy/schema.sql`](deploy/schema.sql) en una base vacía antes de
arrancar:

```bash
mysql -u root -p ideamex < deploy/schema.sql
```

### Variables de entorno

| Variable | Obligatoria | Valor por defecto | Descripción |
| --- | --- | --- | --- |
| `NODE_ENV` | No | `production` | Activa el logging con morgan cuando no es `production`. |
| `PORT` | No | `5000` | Puerto de escucha. |
| `JWT_SECRET` | **Sí** | — | Clave de firma de los tokens de sesión. Sin respaldo a propósito: el arranque falla si falta o si conserva el valor inseguro histórico. |
| `PUBLIC_API_URL` | No | URL de producción | Solo se usa para los mensajes de arranque y Swagger. |
| `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | **Sí** | — | Conexión a MariaDB. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` | **Sí** | — | Servidor de correo para activación de cuentas y recuperación de contraseña. |
| `SMTP_FROM_NAME`, `SMTP_FROM_EMAIL` | **Sí** | — | Remitente de los correos. |
| `CONTACT_NOTIFICATION_EMAIL` | No | `ideamex.unam@gmail.com` | Buzón que recibe los avisos del formulario de contacto. |
| `SWAGGER_USER`, `SWAGGER_PASSWORD` | No | `admin` / `password123` | Credenciales de `/docs/`. Cámbialas en cualquier despliegue accesible. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` | No | — | Necesarias solo para el inicio de sesión con Google. |
| `PROJECTS_BASE_PATH` | No | `./projects` | Raíz donde se guardan archivos y resultados. |
| `ANALYSIS_EXECUTION_MODE` | No | `local` | `local` o `docker`. |

En modo `local` el pipeline se invoca con `ANALYSIS_SCRIPT_PATH`,
`ANALYSIS_SOURCES_PATH` y, opcionalmente, `ANALYSIS_RSCRIPT_BIN`,
`ANALYSIS_ZIP_BIN` y `ANALYSIS_PDFTOPPM_BIN`.

## Motor de análisis R

Para desarrollo conviene el modo Docker. Añade a `.env`:

```dotenv
ANALYSIS_EXECUTION_MODE=docker
ANALYSIS_DOCKER_CONTAINER=ideamex-r
ANALYSIS_DOCKER_SCRIPT_PATH=/app/ideamexCLI/src/RunMainIDEAMEX.r
ANALYSIS_DOCKER_SOURCES_PATH=/app/ideamexCLI/src
ANALYSIS_DOCKER_HOST_PROJECTS_PATH=/ruta/absoluta/ideamex_backend/projects
ANALYSIS_DOCKER_CONTAINER_PROJECTS_PATH=/workspace/projects
```

Levanta el contenedor antes de iniciar la API:

```bash
npm run r:up
npm run dev
```

`ANALYSIS_DOCKER_HOST_PROJECTS_PATH` debe ser una ruta absoluta del host: es la
que Docker monta dentro del contenedor. Consulta [`R/README.md`](R/README.md)
para la procedencia, licencia y verificación de integridad del pipeline.

## Comandos

| Comando | Función |
| --- | --- |
| `npm run dev` | Inicia la API con `ts-node`, sin compilar. |
| `npm run build` | Compila TypeScript a `dist/`. |
| `npm start` | Ejecuta la versión compilada. |
| `npm test` | Corre las pruebas unitarias con Jest. |
| `npm run test:watch` | Pruebas en modo interactivo. |
| `npm run test:coverage` | Genera el reporte de cobertura en `coverage/`. |
| `npm run r:up` | Construye e inicia el contenedor del motor R. |
| `npm run r:down` | Detiene el contenedor del motor R. |
| `npm run r:logs` | Sigue los registros del motor R. |

Con la API iniciada, la raíz responde en `http://127.0.0.1:5000/` y Swagger vive
en `http://127.0.0.1:5000/docs/`.

## Endpoints

Todas las rutas cuelgan de la raíz porque en producción nginx elimina el prefijo
`/ideamex2/api/` antes de reenviar la petición.

### Autenticación (`/auth`)

| Método | Ruta | Descripción |
| --- | --- | --- |
| `POST` | `/auth/register` | Registra un usuario y envía el correo de activación. |
| `GET` | `/auth/activate` | Activa la cuenta con el token recibido por correo. |
| `POST` | `/auth/resend-activation` | Reenvía el correo de activación con un token nuevo. Limitado a 3 peticiones cada 15 min. |
| `POST` | `/auth/login` | Inicia sesión y devuelve el JWT. |
| `POST` | `/auth/request-password-reset` | Envía el enlace de recuperación. |
| `POST` | `/auth/reset-password` | Establece la nueva contraseña. |
| `GET` | `/auth/google` | Inicia el flujo OAuth de Google. |
| `GET` | `/auth/google/callback` | Callback de Google. |
| `POST` | `/auth/google/login` | Canjea el resultado de Google por un JWT. |

### Análisis (`/analysis`)

| Método | Ruta | Descripción |
| --- | --- | --- |
| `POST` | `/analysis/upload` | Sube la tabla de conteos y crea el proyecto. |
| `GET` | `/analysis/user-projects` | Lista los proyectos del usuario autenticado. |
| `POST` | `/analysis/project/:projectId/run` | Lanza el pipeline de R. |
| `GET` | `/analysis/project/:projectId/results` | Estado y resumen de la corrida. |
| `GET` | `/analysis/project/:projectId/results/structured` | Resultados normalizados para el frontend. |
| `GET` | `/analysis/project/:projectId/results/file` | Descarga un archivo concreto. |
| `GET` | `/analysis/project/:projectId/results/archive` | Descarga todos los resultados comprimidos. |
| `DELETE` | `/analysis/project/:projectId` | Elimina el proyecto y sus archivos. |

### Contacto (`/contact`)

| Método | Ruta | Descripción |
| --- | --- | --- |
| `POST` | `/contact` | Envía una solicitud de contacto. Limitado a 2 peticiones cada 15 minutos por IP. |

## Estructura del proyecto

```
src/
├── api/
│   ├── analysis/     Proyectos, ejecución del pipeline y lectura de resultados
│   ├── auth/         Registro, sesión, Google OAuth y contraseñas
│   └── contact/      Formulario de contacto
├── assets/           Logotipo incrustado en los correos
├── config/           Conexión a base, correo, idiomas, multer, Swagger y configuración global
├── middlewares/      Validación de peticiones y autenticación de Swagger
├── models/           Tipos de dominio y mapeo de filas de la base
├── utils/            Correo, archivos, tokens y formato de respuestas
└── index.ts          Arranque: valida configuración, base y correo antes de escuchar

deploy/               Infraestructura de producción (compose, esquema SQL y migraciones)
R/                    Contenedor del motor R y pipeline ideamexCLI integrado
tests/                Pruebas unitarias con Jest
```

## Pruebas

```bash
npm test
npm run test:coverage
```

Las pruebas cubren la configuración obligatoria, la resolución de rutas de
proyectos, la construcción del payload que recibe R, el manejo de lotes y las
utilidades de archivos. No requieren base de datos ni servidor SMTP.

## Despliegue

La configuración de producción está documentada en
[`deploy/README.md`](deploy/README.md).
[`deploy/docker-compose.yml`](deploy/docker-compose.yml) orquesta frontend,
backend, MariaDB, Redis y el motor R desde el directorio padre de los
repositorios; no se ejecuta desde la carpeta `deploy/`.

## Seguridad y datos

- Nunca subas archivos `.env`, credenciales SMTP, secretos JWT ni datos de
  usuarios.
- `JWT_SECRET` es obligatoria y la aplicación rechaza el valor de respaldo que
  estuvo publicado en el código hasta septiembre de 2026.
- `projects/` se monta como volumen en producción y debe tener permisos de
  escritura tanto para el proceso backend como para el contenedor de R.
- Cambia `SWAGGER_USER` y `SWAGGER_PASSWORD`: los valores por defecto son
  públicos.

## Créditos

Desarrollado por Ulises Rodríguez García como trabajo de titulación
(Facultad de Ciencias, UNAM).

El pipeline integrado en `R/ideamexCLI/` es obra de la Dra. Leticia Vega
Alvarado y se distribuye bajo CC BY-NC 4.0; se incluye sin modificaciones,
conservando su atribución y condiciones de uso.
