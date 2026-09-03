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

### Variables requeridas en `ideamex2/.env`

`MARIADB_DATABASE`, `MARIADB_USER`, `MARIADB_PASSWORD`, `MARIADB_ROOT_PASSWORD`.

El resto de la configuración del backend (`JWT_SECRET`, `SMTP_*`, `GOOGLE_*`) **no**
pasa por este archivo.

> **Cuidado.** El backend no tiene `.dockerignore`, así que el `COPY . .` del Dockerfile
> hornea `ideamex_backend/.env` dentro de la imagen, y de ahí salen esos valores en
> producción. Dos consecuencias:
>
> 1. Los secretos quedan en una capa de la imagen.
> 2. **Agregar un `.dockerignore` que excluya `.env` tumba el servicio** en la siguiente
>    reconstrucción, porque hoy no hay otra fuente para esas variables. El orden correcto
>    es primero moverlas a `env_file`/`environment` del compose, y después excluir `.env`.

> **Nota.** El Dockerfile fija `ENV NODE_ENV=development` para que `npm install` traiga las
> dependencias de desarrollo que necesita `npm run build`. Ese valor persiste en la imagen y
> `dotenv` no lo sobrescribe, así que **el contenedor de producción corre con
> `NODE_ENV=development`** (verificado con `docker exec`). Se corrige volviendo a
> `ENV NODE_ENV=production` después del `npm prune`.

### Nota sobre `group_add: "125"`

Es el GID del grupo `docker` en el host, necesario para que el backend pueda hacer
`docker exec` sobre `ideamex-r` a través del socket montado. Si se despliega en otra
máquina hay que ajustarlo (`getent group docker`).

## Reconstruir el backend tras un cambio de código

El código va compilado dentro de la imagen (`npm run build` → `dist/`), no montado,
así que reiniciar el contenedor no basta:

```bash
cd ~/ideamex2
docker compose build backend && docker compose up -d backend
```
