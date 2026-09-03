# Motor de analisis (R)

Esta carpeta contiene la receta del contenedor `ideamex-r` y una copia integrada
del pipeline de analisis que el backend ejecuta con `docker exec`.

| Ruta | Origen |
| --- | --- |
| `Dockerfile` | Receta del contenedor de R. Autor: Carlos Perez Calderon (30-oct-2025). |
| `ideamexCLI/` | **Codigo de terceros.** Ver abajo. |

## `ideamexCLI/` — obra de la Dra. Leticia Vega Alvarado

**IDEAMEX-CLI** (*Integrative Differential Expression Analysis for Multiple
EXperiments*) es una interfaz de linea de comandos en R para analisis de
expresion diferencial de datos de RNA-seq, que automatiza DESeq2, edgeR,
limma-voom y NOISeq de Bioconductor e integra sus resultados.

| | |
| --- | --- |
| Autora | Dra. Leticia Vega Alvarado |
| Repositorio de origen | `https://github.com/leticiaVega/ideamexCLI.git` (privado) |
| Commit de referencia | `244c981` — "Create arab.txt", 12-nov-2025, rama `main` |
| Licencia | **CC BY-NC 4.0** (ver `ideamexCLI/LICENSE`) |
| Procedencia de esta copia | Arbol de trabajo del clon desplegado en el servidor de produccion (`xwing:~/ideamex2/ideamex_backend/R/ideamexCLI`), cuyo `HEAD` es `244c981`. |

## Por que esta copiado aqui y no como submodulo

Un submodulo seria lo natural: guardaria solo un apuntador a la URL y al commit
exacto, sin copiar codigo ajeno. Pero el repositorio de origen es privado e
inaccesible, y un submodulo que apunta a una URL que no se puede clonar rompe el
`git clone --recurse-submodules` de cualquiera. Por eso este repositorio
versiona una copia integrada del commit usado para los analisis de la tesis.

La licencia CC BY-NC 4.0 permite expresamente "copiar y redistribuir el material
en cualquier medio o formato" con atribucion y sin fines comerciales, que es el
caso de un trabajo academico.

Si mas adelante hay acceso de lectura al repositorio de origen, conviene migrar a
submodulo:

```bash
git rm -r --cached R/ideamexCLI && rm -rf R/ideamexCLI
git submodule add https://github.com/leticiaVega/ideamexCLI.git R/ideamexCLI
cd R/ideamexCLI && git checkout 244c981 && cd -
```

## El codigo no se modifica

La copia se integra tal cual. `MANIFEST-ideamexCLI.sha256` registra el SHA-256 de
cada archivo; para comprobar que nada cambio:

```bash
cd R/ideamexCLI && shasum -a 256 -c ../MANIFEST-ideamexCLI.sha256
```

Las correcciones al pipeline deben conservar la atribucion y respetar su
licencia CC BY-NC 4.0.

### Procedencia verificada

Esta copia se tomo del arbol de trabajo del clon en el servidor de produccion.
Se comprobo que ese arbol no tenia modificaciones locales:

```
$ git -C ~/ideamex2/ideamex_backend/R/ideamexCLI status --short
$
```

Salida vacia, con `HEAD` en `244c981`: la copia corresponde exactamente a ese
commit de la autora.
