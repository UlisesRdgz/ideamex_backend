# IDEAMEX Backend

API de IDEAMEX para autenticacion de usuarios, solicitudes de contacto y gestion
de proyectos de analisis de expresion diferencial de RNA-seq. Esta construida con
Node.js, Express y TypeScript; almacena sus datos en MariaDB y delega el analisis
estadistico a un pipeline de R.

## Componentes

| Componente | Funcion |
| --- | --- |
| API | Autenticacion local y con Google, recuperacion de contrasena, contacto y proyectos de analisis. |
| MariaDB | Usuarios, solicitudes de contacto y metadatos de los proyectos. |
| `projects/` | Archivos cargados y resultados generados; no se versiona. |
| Motor R | Ejecuta DESeq2, edgeR, limma-voom y NOISeq mediante `R/ideamexCLI/`. |
| Swagger | Documentacion interactiva protegida en `/docs/`. |

## Requisitos

- Node.js 20 o superior.
- MariaDB accesible por red.
- Un servidor SMTP valido; la API verifica la conexion al arrancar.
- Docker y acceso al daemon de Docker si se usara el motor R en contenedor.

## Configuracion local

Instala las dependencias y crea un archivo `.env` en la raiz. No lo subas al
repositorio: contiene secretos y ya esta excluido por `.gitignore`.

```bash
npm ci
mkdir -p projects
```

Configuracion minima:

```dotenv
NODE_ENV=development
PORT=5000
JWT_SECRET=usa-una-cadena-larga-aleatoria

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
```

Importa [`deploy/schema.sql`](deploy/schema.sql) en una base vacia antes de
arrancar. `JWT_SECRET` es obligatorio y la aplicacion rechaza el valor inseguro
que se uso historicamente como respaldo.

## Motor de analisis R

El modo recomendado para desarrollo es Docker. Anade estas variables a `.env`:

```dotenv
ANALYSIS_EXECUTION_MODE=docker
ANALYSIS_DOCKER_CONTAINER=ideamex-r
ANALYSIS_DOCKER_SCRIPT_PATH=/app/ideamexCLI/src/RunMainIDEAMEX.r
ANALYSIS_DOCKER_SOURCES_PATH=/app/ideamexCLI/src
ANALYSIS_DOCKER_HOST_PROJECTS_PATH=/ruta/absoluta/ideamex_backend/projects
ANALYSIS_DOCKER_CONTAINER_PROJECTS_PATH=/workspace/projects
```

Levanta el contenedor antes de ejecutar la API:

```bash
npm run r:up
npm run dev
```

Tambien puede ejecutarse R directamente en el host con
`ANALYSIS_EXECUTION_MODE=local`, `ANALYSIS_SCRIPT_PATH` y
`ANALYSIS_SOURCES_PATH`. Consulta [`R/README.md`](R/README.md) para la
procedencia, licencia y verificacion de integridad del pipeline integrado.

## Ejecucion y pruebas

| Comando | Funcion |
| --- | --- |
| `npm run dev` | Inicia la API con TypeScript en modo desarrollo. |
| `npm run build` | Compila el codigo a `dist/`. |
| `npm start` | Ejecuta la version compilada. |
| `npm test` | Ejecuta las pruebas unitarias. |
| `npm run test:coverage` | Genera el reporte de cobertura. |
| `npm run r:up` | Construye e inicia el contenedor del motor R. |
| `npm run r:down` | Detiene el contenedor del motor R. |
| `npm run r:logs` | Muestra los registros del motor R. |

Con la API iniciada, la raiz responde en `http://127.0.0.1:5000/` y Swagger se
encuentra en `http://127.0.0.1:5000/docs/`. Las credenciales de Swagger se
configuran con `SWAGGER_USER` y `SWAGGER_PASSWORD`.

## Despliegue

La configuracion de produccion esta documentada en
[`deploy/README.md`](deploy/README.md). El archivo
[`deploy/docker-compose.yml`](deploy/docker-compose.yml) orquesta frontend,
backend, MariaDB, Redis y el motor R desde el directorio padre de los dos
repositorios.

## Seguridad y datos

- No subas archivos `.env`, credenciales SMTP, secretos JWT ni datos de usuarios.
- `projects/` se monta como volumen en produccion y debe tener permisos de
  escritura para el proceso backend y el contenedor R.
- El pipeline integrado `R/ideamexCLI/` es codigo de terceros bajo CC BY-NC 4.0;
  conserva su atribucion y condiciones de uso.
