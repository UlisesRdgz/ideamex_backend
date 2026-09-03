# Despliegue

Archivos de infraestructura del despliegue en producción (`xwing`, 132.248.32.197),
versionados aquí para que el sistema sea reconstruible desde el repositorio.

## `docker-compose.yml`

**No se ejecuta desde esta carpeta.** Orquesta varios repositorios hermanos, así que
sus rutas de `build.context` son relativas al directorio padre. En el servidor vive en
`~/ideamex2/docker-compose.yml`, con esta estructura:

```
ideamex2/
├── docker-compose.yml      <- copia de deploy/docker-compose.yml
├── .env                    <- credenciales de MariaDB (NO versionado)
├── backend.env             <- configuracion del backend (NO versionado)
├── ideamex_backend/        <- este repositorio
└── ideamex_version2/       <- repositorio del frontend
```

Para desplegar, copiar este archivo a la raíz de `ideamex2/` antes de levantar.

### Servicios

| Servicio | Contenedor | Puerto host | Origen |
| --- | --- | --- | --- |
| `frontend` | `ideamex-frontend` | 3000 → 80 | `./ideamex_version2/Dockerfile` |
| `backend` | `ideamex-backend` | 5000 → 5000 | `./ideamex_backend/Dockerfile` |
| `db` | `ideamex-db` | — | `mariadb:10` |
| `redis` | `ideamex-redis` | — | `redis:7-alpine` |
| `r` | `ideamex-r` | — | `./ideamex_backend/R/Dockerfile` |

### Variables de entorno

Se reparten en dos archivos, ninguno versionado:

| Archivo | Contenido | Lo consume |
| --- | --- | --- |
| `ideamex2/.env` | `MARIADB_DATABASE`, `MARIADB_USER`, `MARIADB_PASSWORD`, `MARIADB_ROOT_PASSWORD` | El propio compose, por interpolacion `${VAR}` |
| `ideamex2/backend.env` | `JWT_SECRET`, `SMTP_*`, `GOOGLE_CLIENT_*`, `SWAGGER_*`, `ANALYSIS_*` | El servicio `backend`, via `env_file` |

El bloque `environment:` del servicio `backend` tiene prioridad sobre `backend.env`,
y ahi viven los valores especificos del contenedor (`DB_HOST=db`,
`PROJECTS_BASE_PATH=/usr/src/app/projects`, rutas del pipeline de R).

> **Historico.** Hasta septiembre de 2026 el backend no tenia `.dockerignore`, asi que el
> `COPY . .` del Dockerfile horneaba `ideamex_backend/.env` dentro de la imagen y de ahi
> salian los secretos en produccion. Se corrigio moviendolos a `backend.env` + `env_file`
> **antes** de excluir el `.env` del build; hacerlo al reves habria dejado sin
> `JWT_SECRET` ni credenciales SMTP al contenedor, que aborta en el arranque.

### Nota sobre `group_add: "125"`

Es el GID del grupo `docker` en el host, necesario para que el backend pueda hacer
`docker exec` sobre `ideamex-r` a través del socket montado. Si se despliega en otra
máquina hay que ajustarlo (`getent group docker`).

## Reconstruir el backend tras un cambio de código

El código va compilado dentro de la imagen (`npm run build` → `dist/`), no montado,
así que reiniciar el contenedor no basta:

```bash
cd ~/ideamex2
docker-compose build backend && docker-compose up -d backend
```

> El servidor usa el binario **`docker-compose`** (v2.39.4), no el plugin `docker compose`.

## Historia del Dockerfile del backend

La version original la escribio Carlos Perez Calderon el 30-oct-2025 sobre
`node:18-bullseye`, instalando el cliente de Docker con el paquete `docker.io`
de Debian. Se sustituyo por la actual, basada en `node:18-bookworm` con el
`docker-ce-cli` del repositorio oficial, porque el cliente de `docker.io` no
era compatible con la version del daemon del host y fallaba el `docker exec`
sobre `ideamex-r`, que es como el backend lanza el pipeline de R.

La version vieja quedo un tiempo como `Dockerfile.bak` en el servidor, sin
versionar y a medio agregar al indice de git. Se elimino en septiembre de 2026,
una vez que el Dockerfile vigente quedo versionado en este repositorio.
