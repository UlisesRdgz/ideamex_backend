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
| `SMTP_HOST` | Servidor SMTP para correos transaccionales | `smtp.gmail.com` |
| `SMTP_PORT` | Puerto SMTP | `587` |
| `SMTP_USER` | Usuario SMTP | `""` |
| `SMTP_PASSWORD` | Contraseña SMTP | `""` |
| `SMTP_FROM_NAME` | Nombre del remitente en los correos | `""` |
| `SMTP_FROM_EMAIL` | Correo remitente | `""` |
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

## Compilar y ejecutar en producción local

```bash
npm run build
npm start
```

El comando `npm run build` genera la carpeta `dist/` con el código JavaScript compilado. `npm start` levanta el servidor utilizando esos archivos compilados.

## Scripts disponibles

- `npm run dev`: Ejecuta la API con `ts-node` y recarga en caliente.
- `npm run build`: Transpila TypeScript a JavaScript dentro de `dist/`.
- `npm start`: Arranca la versión compilada (`dist/index.js`).

## Problemas frecuentes

- **Error de conexión a la base de datos**: revisa credenciales en `.env` y que el servicio MariaDB esté en ejecución.
- **Errores al subir archivos**: valida que `PROJECTS_BASE_PATH` apunte a un directorio existente y con permisos de escritura.
- **No carga la documentación Swagger**: confirma que las credenciales básicas (`SWAGGER_USER`, `SWAGGER_PASSWORD`) coinciden y que el prefijo `BASE_PATH` sea el mismo que usas en la URL.
