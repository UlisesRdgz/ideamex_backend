# Manual de referencia de IDEAMEX

## Descripción general
**IDEAMEX** es una aplicación desarrollada para el análisis y visualización de datos de expresión diferencial.  
El sistema integra un entorno web (backend y frontend) junto con un entorno de análisis en **R**, todo desplegado mediante contenedores **Docker** para garantizar portabilidad y reproducibilidad.

---

## Contenido
- [Introducción](#introducción)
- [Arquitectura del sistema](#arquitectura-del-sistema)
- [Requisitos previos](#requisitos-previos)
- [Instalación y despliegue](#instalación-y-despliegue)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Uso de IDEAMEX](#uso-de-ideamex)
- [Datos de ejemplo](#datos-de-ejemplo)
- [Ejemplo de flujo de análisis](#ejemplo-de-flujo-de-análisis)
- [Licencia](#licencia)
- [Créditos](#créditos)

---

## Introducción
IDEAMEX proporciona una interfaz interactiva que permite realizar análisis de expresión diferencial de forma automatizada y reproducible.  
Su diseño modular facilita la ejecución en distintos entornos de servidor mediante contenedores **Docker**, lo que simplifica la instalación y reduce los conflictos de dependencias.

---

## Arquitectura del sistema
El sistema está dividido en **dos contenedores Docker** principales:

1. **Contenedor principal (backend + frontend)**  
   - Contiene la aplicación web, sus dependencias y los servicios necesarios para la interacción con el usuario.  
   - Incluye el servidor de aplicaciones y los módulos de comunicación con R.

2. **Contenedor de R**  
   - Contiene el entorno de **R**, los programas desarrollados específicamente para IDEAMEX y los paquetes necesarios para ejecutar los análisis estadísticos.  
   - Este contenedor interactúa con el backend mediante llamadas internas para procesar los datos y devolver resultados.

---

## Requisitos previos
- **Docker** versión 24 o superior  
- **Docker Compose**  
- Conexión a internet para descargar las imágenes necesarias  
- (Opcional) Permisos de administrador en el servidor

---

## Instalación y despliegue

1. Clonar el repositorio (si se cuenta con autorización):
   ```bash
   git clone https://github.com/[usuario]/IDEAMEX.git
   cd IDEAMEX
