# RECETA DE CONSTRUCCIÓN DEL CONTENEDOR DE R
# Author: Carlos Pérez Calderón
# Date: 30 de Octubre de 2025
# Descripción: Este Dockerfile crea un contenedor de R con paquetes específicos instalados para análisis bioinformáticos
# ---------------------------------------------


# ---------------------------------------------
# PASO 1: Elegir la imagen base
# ---------------------------------------------
# Usa la versión 4.3.3 de R preinstalada
FROM r-base:4.3.3

# ---------------------------------------------
# PASO 2: Convertirse en Administrador
# ---------------------------------------------
# Le decimos a Docker que ejecute los siguientes comandos como root
USER root

# ---------------------------------------------
# PASO 3: Instalar dependencias del sistema (Linux)
# ---------------------------------------------
# Incluye compiladores y librerías del sistema que algunas dependencias de R necesitan
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gfortran \
    cmake \
    libnlopt-dev \
    libxml2-dev \
    libcurl4-openssl-dev \
    libssl-dev \
    libfontconfig1-dev \
    libharfbuzz-dev \
    libfribidi-dev \
    libfreetype6-dev \
    libpng-dev \
    libtiff5-dev \
    libjpeg-dev \
    && rm -rf /var/lib/apt/lists/*

# ---------------------------------------------
# PASO 4: Instalar paquetes de R (binarios del sistema)
# ---------------------------------------------
# Se instalan por apt para evitar compilaciones inestables durante build
RUN apt-get update && apt-get install -y --no-install-recommends \
    r-cran-optparse \
    r-cran-ggplot2 \
    r-cran-rcolorbrewer \
    r-cran-reshape2 \
    r-cran-ggpubr \
    r-cran-corrplot \
    r-cran-venndiagram \
    r-cran-upsetr \
    r-cran-circlize \
    r-bioc-edger \
    r-bioc-limma \
    r-bioc-noiseq \
    r-bioc-deseq2 \
    r-bioc-complexheatmap \
    && rm -rf /var/lib/apt/lists/*

# ---------------------------------------------
# PASO 5: Crear la carpeta de trabajo
# ---------------------------------------------
# Crea un directorio llamado '/app' dentro del contenedor
WORKDIR /app

# ---------------------------------------------
# PASO 6: Copiar los scripts de R al contenedor
# ---------------------------------------------
# Copia todos los archivos de la carpeta R del proyecto al contenedor
COPY . .

# ---------------------------------------------
# PASO 7: Validar paquetes requeridos
# ---------------------------------------------
# Falla el build si falta algún paquete clave
RUN Rscript -e "pkgs<-c('optparse','ggplot2','RColorBrewer','reshape2','ggpubr','corrplot','VennDiagram','UpSetR','circlize','edgeR','DESeq2','NOISeq','limma','ComplexHeatmap'); missing<-pkgs[!vapply(pkgs, requireNamespace, logical(1), quietly=TRUE)]; if(length(missing)>0) stop(paste('Missing required R packages:', paste(missing, collapse=', ')))"

# ---------------------------------------------
# PASO 8: (Reservado para ajustes futuros)
# ---------------------------------------------
# Este paso se deja intencionalmente para cambios futuros de configuración

# ---------------------------------------------
# PASO 9: Comando final (Mantener el contenedor encendido)
# ---------------------------------------------
# Este contenedor queda en espera para que el backend ejecute comandos con 'docker exec'
CMD ["tail", "-f", "/dev/null"]
