### Copyright (c) 2025 [Leticia Vega Alvarado]
### 
### Este archivo forma parte del proyecto IDEAMEX.
### Licencia: Creative Commons Atribución-NoComercial 4.0 Internacional (CC BY-NC 4.0)
### Puede copiarse y modificarse libremente con fines no comerciales, siempre que se otorgue crédito al autor original.
### Más información: https://creativecommons.org/licenses/by-nc/4.0/deed.es
###

#!/usr/local/bin/Rscript

### Nombre: loadPkg
### Autora: Leticia Vega Alvarado
### Fecha de creacion: 10/diciembre/2020
### Ultima actualizacion: 11/diciembre/2020
### Parametros:
###           - fnPkg: nombre del paquete a cargar
### Descripcion: Funcion que sirve para cargar un paquete
loadPkg<-function(fnPkg)
{
    suppressWarnings(require(fnPkg, quietly = TRUE, character.only = TRUE))
}

### Nombre: loadPkgValidate
### Autora: Leticia Vega Alvarado
### Fecha de creacion: 10/diciembre/2020
### Ultima actualizacion: 11/diciembre/2020
### Parametros:
###           - fnPkg: vector con los nombres de los paquetes a cargar
### Valores de regreso:
###           - fnPackageRequire: Lista con dos elementos fnLoaded=paquetes que se pudieron cargar,fnNotLoaded=paquetes que no se pudieron cargar
### Descripcion: Funcion que sirve para cargar diversos paquetes, verificando si no se encuentran cargados
loadPkgValidate<-function(fnPkg)
{
    fnPackageRequire<-list(fnLoaded=NULL,fnNotLoaded=NULL)
    fnRequirePkg<- fnPkg[!(fnPkg %in% (.packages()))]
    fnLAlreadyLoaded<-fnPkg[fnPkg %in% (.packages())]
    if (length(fnRequirePkg))
    {
        fnLoadedPkg<-sapply(fnRequirePkg,loadPkg)
        fnPackageRequire$fnLoaded<-fnRequirePkg[fnLoadedPkg]
        if (any(!fnLoadedPkg))
        {
            fnPackageRequire$fnNotLoaded<-fnRequirePkg[!fnLoadedPkg]
            fnPackageRequire$fnNotLoaded<-paste(fnPackageRequire$fnNotLoaded," package was not loaded",sep="")
            cat("----- Error -----\n")
            cat(paste(fnPackageRequire$fnNotLoaded,"\n",sep="",collapse=""))
            cat("-----------------\n")
        }
    }
    if(length(fnLAlreadyLoaded))
    {
        fnPackageRequire$fnLoaded<-c(fnPackageRequire$fnLoaded,fnLAlreadyLoaded)
    }
    return(fnPackageRequire)
}

### Nombre: loadScripts
### Autora: Leticia Vega Alvarado
### Fecha de creacion: 10/diciembre/2020
### Ultima actualizacion: 11/diciembre/2020
### Parametros:
###           - fnProgamsPath: Directorio donde se encuentran los programas a cargar
###           - fnMethods: vector con Funciones asociadas a los scripts que queremos cargar
###           - fnSource: Vector con los nombres de los scripts asociados a las funciones del vector fnMethods
### Descripcion: Funcion que sirve para cargar un conjunto de programas, por medio de la funcion source
loadScripts<-function(fnProgamsPath,fnMethods,fnSource)
{
    for(i in 1:length(fnMethods))
    {
        if(!exists(fnMethods[i], mode="function"))
        {
            source(paste(fnProgamsPath,"/",fnSource[i],sep="",collapse=""))
        }
    }
}








