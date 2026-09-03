### Copyright (c) 2025 [Leticia Vega Alvarado]
### 
### Este archivo forma parte del proyecto IDEAMEX.
### Licencia: Creative Commons Atribución-NoComercial 4.0 Internacional (CC BY-NC 4.0)
### Puede copiarse y modificarse libremente con fines no comerciales, siempre que se otorgue crédito al autor original.
### Más información: https://creativecommons.org/licenses/by-nc/4.0/deed.es
###

#!/usr/local/bin/Rscript

### Nombre: getPackageVersion
### Autora: Leticia Vega Alvarado
### Fecha de creacion: 18/10/2018
### Ultima actualizacion: 25/02/2020
### Parametros:
###           - fnMethods: Vector con los nombres de los paquetes
### Valores de regreso:
###           - fnPackageVersions: lista con dos vectores. El vector fnInstalled contiene los paquetes que se encuentran instalados y su version
###             con base en fnMethods y el vector fnNotInstalled contiene los paquetes que no se encuentran instalados con base en fnMethods.
### Descripcion: Funcion que sirve para obtener las versiones actuales de los paquetes que se utilizan en IDEAMEX
getPackageVersion<-function(fnMethods)
{
    fnPackageVersions<-list(fnInstalled=NULL,fnNotInstalled=NULL)
    fnPackInfo<-installed.packages(fields=c("Package","Version"))
    fnMetNotInstalledPkg <- fnMethods[!(fnMethods %in% fnPackInfo[, "Package"])]
    fnMetInstalledPkg <- fnMethods[fnMethods %in% fnPackInfo[, "Package"]]
    fnPackInfo<-fnPackInfo[fnMetInstalledPkg,"Version"]
    fnPackageVersions$fnInstalled<-paste(names(fnPackInfo),fnPackInfo,sep=" ")
    fnPackageVersions$fnInstalled<-c(R.version.string,fnPackageVersions$fnInstalled)
    if(length(fnMetNotInstalledPkg))
    {
        fnPackageVersions$fnNotInstalled<-paste(fnMetNotInstalledPkg," package is not installed",sep="")
    }
    return(fnPackageVersions)
}

### Nombre: printParameters
### Autora: Leticia Vega Alvarado
### Fecha de creacion: 29/03/2022
### Ultima actualizacion: 29/03/2022
### Parametros:
###           - fnParamList: Cadena con los parametros con los que se corrio el analisis
### Valores de regreso:
###              - Sin valores de regreso
### Descripcion: Funcion que sirve para imprimir en el archivo log, los parámetros de corte
printParameters<-function(fnParamList)
{
    cat(" ............. Parameters list .............","\n")
    Etiquetas<-c("","","","FDR/padjust cutoff: ","Count per million threshold: ","Log2FC cutoff: ","Selected methods: ")
    for(i in 4:7)
    {
        cat(paste(Etiquetas[i],fnParamList[i],"\n",sep="",collapse=""))
    }
}

### Nombre: printRunInitInfo
### Autora: Leticia Vega Alvarado
### Fecha de creacion: 18/10/2018
### Ultima actualizacion: 16/10/2019
### Parametros:
###           - fnRunParameters: Cadena con los parametros con los que se corrio el analisis
###           - fnMethods: vector con la lista de paquetes que se utilizaran para el analisis
### Valores de regreso:
###           - fnPkgVer: lista con dos vectores. El vector fnInstalled contiene los paquetes instalados y su version
###                       con base en el vector fnMethods. El vector fnNotInstalled contiene los paquetes no instalados
###                       con base en el vector fnMethods.
### Descripcion: Funcion que sirve para imprimir en el archivo log, las versiones de los programas utilizados,
###              la fecha de ejecucion y los parametros con que se corrio
printRunInitInfo<-function(fnRunParameters,fnMethods,fnParamList)
{
    today <-format(Sys.Date(),"%B %d %Y")
    cat("**************\n<RUNNING DATE>\n**************","\n")
    cat(today,"\n")
    cat("*************************\n<PROGRAM CALL PARAMETERS>\n*************************","\n")
    cat(fnRunParameters,"\n")
    printParameters(fnParamList)
    cat("*******************\n<SOFTWARE VERSIONS>\n*******************","\n")
    fnPkgVer<-getPackageVersion(fnMethods)
    cat(paste(fnPkgVer$fnInstalled,"\n",sep="",collapse=""))
    if(length(fnPkgVer$fnNotInstalled))
    {
        cat("----- Error -----\n")
        cat(paste(fnPkgVer$fnNotInstalled,"\n",sep="",collapse=""))
    }
    return(fnPkgVer)
}

### Nombre: createResultDir
### Autora: Leticia Vega Alvarado
### Fecha de creacion: 22/05/2017
### Ultima actualizacion: 18/10/2018
### Parametros:
###           - fnOutputPath: Directorio comun donde se crearan las carpetas
###           - fnMethods: Vector con los nombres de carpetas a crear
### Descripcion: Funcion que sirve para crear los directorios de resultados
createResultDir<-function(fnOutputPath,fnDEMethods)
{
    for(i in fnDEMethods){
        dir.create(paste(fnOutputPath,"/",i,"_Results",collapse="",sep = ""), showWarnings = FALSE, recursive = FALSE, mode = "0777")}
}

### Nombre: getCombinations
### Autora: Leticia Vega Alvarado
### Fecha de creacion: 18/10/2018
### Ultima actualizacion: 18/10/2018
### Parametros:
###           - fnSamplesName: Vector con los nombres de carpetas a crear
### Valores de regreso:
###           - fnCombVect: Vector con las combinaciones pareadas para realizar el analisis de ED
### Descripcion: Funcion que sirve para obtener la combinatoria de comparaciones pareadas
getCombinations<-function(fnSamplesName)
{
    fnCombVect<-unlist(combn(fnSamplesName,2,simplify=F))
    return(fnCombVect)
}

### Nombre: findSeparator
### Autora: Leticia Vega Alvarado
### Fecha de creacion: 04/02/2020
### Ultima actualizacion: 11/02/2020
### Parametros:
###           - fnInputFileName: Nombre del archivo de texto (tabla de conteos)
### Valores de regreso:
###           - fnSymbol: valor de tipo alfanumerico que contiene el separador de la
###                       tabla de conteos. Si el separador no es valido, regresa el
###                       valor sera "None"
### Descripcion: Funcion que sirve para buscar el separador de la tabla de conteos
findSeparator<-function(fnInputFileName)
{
    fnSymbolsSet<-c(",","\t","None")
    fnNumOfSymbols<-length(fnSymbolsSet)
    fnCont<-1
    fnLine<-readLines(fnInputFileName, n = 1)
    fnLineSize<-nchar(fnLine)
    while(!(fnLineSize-nchar(gsub(fnSymbolsSet[fnCont],"",fnLine)) ) && (fnCont < fnNumOfSymbols)){
        fnCont<-fnCont+1
    }
    fnSymbol=fnSymbolsSet[fnCont]
    return(fnSymbol)
}

### Nombre: ValidateCountTable
### Autora: Leticia Vega Alvarado
### Fecha de creacion: 04/02/2020
### Ultima actualizacion: 18/02/2020
### Parametros:
###           - fnInputFileName: Nombre del archivo de texto (tabla de conteos)
### Descripcion: Funcion que sirve que sirve para validar el formato de la tabla de conteos
ValidateCountTable<-function(fnInputFileName)
{
    cat("******************\n<LOAD COUNT TABLE>\n******************","\n")
    fnSeparator<-findSeparator(fnInputFileName)
    if(fnSeparator !="None"){
        if(class(fnCounts<-try(read.table(fnInputFileName,header=TRUE, row.names=1,as.is=TRUE,sep=fnSeparator,quote=""),silent=T))!= "try-error")
        {
            if(!(any(is.na(fnCounts)))){
                fnMatrix<-data.matrix(round(fnCounts,0))
                mode(fnMatrix) <- "integer"
                fnFinal<-data.frame(fnMatrix)
                return(fnFinal)}
            else{ stop("Count Table has blank fields",call. = FALSE)}}
        else{ stop("Unable to read Count Table File",call. = FALSE)}}
    else{ stop("Count Table has no valid delimiter fields.",call. = FALSE)}
}

### Nombre: countFilterByCPM
### Autora: Leticia Vega Alvarado
### Fecha de creacion: 04/02/2020
### Ultima actualizacion: 04/02/2020
### Parametros:
###           - fnCountTable: dataframe, con la tabla de conteos
###           - fnFilterValue: Valor de corte
### Valores de regreso:
###           - fnFilterCountTable: dataframe, con la tabla de conteos filtrada
### Descripcion: Funcion que sirve para filtrar la tabla de conteos, por medio del CPM
### Dependencias: Paquete edgeR
countFilterByCPM<-function(fnCountTable,fnFilterValue=1)
{
    fnPks<-c("edgeR")
    fnRequierePkgs<-loadPkgValidate(fnPks)
    #### Validar que se pudo cargar edgeR
    fnSamplesName=factor(sub("_[a-zA-Z0-9]+$","",colnames(fnCountTable)))
    fnN<-min(table(fnSamplesName))
    ####  Filtrando los genes con pocas lecturas, en terminos del conteo por millon (cpm)
    fnFilterCountTable<-fnCountTable[rowSums(edgeR::cpm(fnCountTable) >= fnFilterValue) >= fnN,]  #keep = rowSums(cpms > 1) > = 3
    printOKMessage("      FILTER RAW COUNT TABLE .......................... OK")
    return(fnFilterCountTable)
}

### Nombre: compressInfo
### Autora: Leticia Vega Alvarado
### Fecha de creacion: 18/10/2018
### Ultima actualizacion: 18/10/2018
### Parametros:
###           - fnOutputPath: Directorio raiz donde se hara la compresion de archivos y lugar donde quedara el resultado
### Descripcion: Funcion que sirve
compressInfo<-function(fnOutputPath)
{
    setwd(fnOutputPath)
    fnFilestoCZip<-c(list.dirs(recursive=FALSE,full.names=FALSE),list.files(pattern="*.log"))
    tar("DiffExpAllResults.tar.gz",files=fnFilestoCZip,tar='tar',compression='gzip')
}

### Nombre: runDEMethod
### Autora: Leticia Vega Alvarado
### Fecha de creacion: 30/Septiembre/2019
### Ultima actualizacion: 03/Octubre/2019
### Parametros:
###           - fnParamList: Lista de parámetros de inicio:
###                         ProgamsPath,OutputPath, TOP,Umbral,FilterValue,LogFC,DEMethods,Integration,DataAnalysis
###           - fnCombinationsNames: Vector con los nombres de las condiciones
###           - fnCountTableFilter: Dataframe con la tabla de conteos
###           - fnBatch: Vector de valores numericos indicando el numero de lote por muestra, de un par de condiciones
###           - fnCombinations: Vector con los nombres de la condicion a la que pertene e cada experimento
### Valores de regreso:
###           - fnInfoForVenn: Lista con tres elementos:
###                            - genED: genes DE por metodo
###                            - methodED: Nombres de los metodos con genes ED
###                            - filterTable: Tabla de conteos filtrada
### Descripcion: Funcion que sirve para realizar el análisis de ED por cada metodo seleccionado, para un par de condicones
###              en particular
runDEMethod<-function(fnParamList,fnCombinationsNames,fnCountTableFilter,fnBatch,fnCombinations)
{
    fnDataForVenn<-list()
    fnNamesVenn<-c()
    for(k in 1:length(fnParamList$DEMethods))
    {
        fnOutputPathMethod<-paste(fnParamList$OutputPath,"/",fnParamList$DEMethods[k],"_Results/",fnCombinationsNames,collapse="",sep = "")
        dir.create(fnOutputPathMethod, showWarnings = FALSE, recursive = FALSE, mode = "0777")
        fnMethod<-paste("Run",fnParamList$DEMethods[k],"(fnParamList$fnProgamsPath,fnCountTableFilter,fnOutputPathMethod,TOP=fnParamList$TOP,fnUmbral=fnParamList$Umbral,fnUmbralFoldChange=fnParamList$LogFC, fnBatch=fnBatch,fnConditions=c(fnCombinations[1],fnCombinations[2]))",collapse="",sep = "")
        fnVar<-try(eval(parse(text=fnMethod)),silent=TRUE)
        if((class(fnVar)!="try-error"))
        {
            if(length(fnVar)>0)
            {
                fnDataForVenn[[fnParamList$DEMethods[k]]]<-fnVar
                fnNamesVenn<-c(fnNamesVenn,fnParamList$DEMethods[k])
            }
        }
        else{    printErrorMessage(paste(" ",fnParamList$DEMethods[k],"  .......................... Failed"),as.character(attr(fnVar,"condition")))}
    }
    fnInfoForVenn<-list(genED=fnDataForVenn,methodED=fnNamesVenn,filterTable=fnCountTableFilter)
    return(fnInfoForVenn)
}

### Nombre: runAPairAnalysis
### Autora: Leticia Vega Alvarado
### Fecha de creacion: 30/Septiembre/2019
### Ultima actualizacion: 03/Octubre/2019
### Parametros:
###           - fnCounTable: data.frame con los conteos por regiones de interes, de un par de condiciones experimentales
###           - fnCombinations: Vector con los nombres de las condiciones a comparar
###           - fnBatch: Vector de valores numericos indicando el numero de lote por muestra, de un par de condiciones.
###           - fnParamList: Lista de parámetros de inicio:
###                         ProgamsPath,OutputPath, TOP,Umbral,FilterValue,LogFC,DEMethods,Integration,DataAnalysis
### Descripcion: Funcion que sirve para realizar el analisis de ED para un par de condicones definido. Esta funcion llama a la
###              la funcion runDEMethod e RunIntegration.
runAPairAnalysis<-function(fnCounTable,fnCombinations,fnBatch,fnParamList)
{
    if(class(fnCountTableFilter<-try(countFilterByCPM(fnCounTable,fnFilterValue=fnParamList$FilterValue),silent=T))!="try-error")
    {
        fnCombinationNames<-paste(fnCombinations[1],"vs",fnCombinations[2],collapse="",sep = "")
        fnVennInfo<-runDEMethod(fnParamList,fnCombinationNames,fnCountTableFilter,fnBatch,c(fnCombinations[1],fnCombinations[2]))
        if(fnParamList$Integration && fnParamList$TOP){
            if(length(fnVennInfo$methodED) > 0)
            {
                dir.create(paste(fnParamList$OutputPath,"/Integration_Results/",fnCombinationNames,collapse="",sep = ""), showWarnings = FALSE, recursive = FALSE, mode = "0777")
                fnVennDiagram<-try(RunIntegration(fnParamList$fnProgamsPath,fnVennInfo,fnParamList$OutputPath,fnCombinationNames),silent=TRUE)
                if((class(fnVennDiagram) == "try-error"))
                {   printErrorMessage("      Integration Results .......................... Failed",as.character(attr(fnVennDiagram,"condition")))}
            }
            else{printOKMessage("      Integration Results: No significantly ED genes were detected by any method ................. OK")}
        }
    }
    else{   printErrorMessage("      Filter count table.......................... Failed",as.character(attr(fnCountTableFilter,"condition")))}
}

### Nombre: runAllDEPairAnalysis
### Autora: Leticia Vega Alvarado
### Fecha de creacion: 30/Septiembre/2019
### Ultima actualizacion: 03/Octubre/2019
### Parametros:
###           - fnParamList: Lista de parámetros de inicio:
###                         OutputPath, TOP,Umbral,FilterValue,LogFC,DEMethods,Integration,DataAnalysis
###           - fnCombinations: Vector con las combinaciones de condiciones para hacer el analisis pareado.
###           - fnAllCond: Vector con los nombres de todas las muestras
###           - fnCounts: data.frame con los conteos por regiones de interes, de todas las condiciones experimentales
###           - fnBatch: Vector de valores numericos indicando el numero de lote por muestra.
### Valores de regreso:
###           - fnReturn: Variable que toma el valor de 0 si el analisis de ED se pudo realizar y toma
###                       el valor de 1 si existe algun error en el nombre de los experimentos
### Descripcion: Funcion que genera las carpetas de resultados, las combinaciones (si no fueron definidas) y
###              manda llamar a la funcion runAPairAnalysis, para realizar el analisis de ED por cada par definido en
###              en el vector de condiciones
runAllDEPairAnalysis<-function(fnParamList,fnCombinations,fnAllCond,fnCounts,fnBatch,fnMethods)
{
    cat("*****************\n<DIFFERENTIAL EXPESION>\n*****************","\n")
    fnReturn<-0
    if(!length(fnCombinations)){
        fnCombinations<-getCombinations(unique(fnAllCond))}
    if(all(unique(fnCombinations) %in% unique(fnAllCond)))
    {
        createResultDir(fnParamList$OutputPath,fnMethods)
        fnBatchCombination=c()
        for(i in seq(1,(length(fnCombinations)-1),by=2))
        {
            fnCondition1<-which(fnAllCond == fnCombinations[i])
            fnCondition2<-which(fnAllCond == fnCombinations[i+1])
            fnCounTable<-fnCounts[,c(fnCondition1,fnCondition2)]
            if(length(fnBatch)){
                if( length(unique(fnBatch[fnCondition1])) != 1 || length(unique(fnBatch[fnCondition2])) != 1)
                {
                    fnBatchCombination<- unname(fnBatch[names(fnCounTable)])
                }
                else{
                    fnBatchCombination<-c()
                    printErrorMessage("      Batch effect incorrect .......................... switch to the classic mode")
                }
            }
            runAPairAnalysis(fnCounTable,c(fnCombinations[i],fnCombinations[i+1]),fnBatchCombination,fnParamList)
        }
    }
    else{fnReturn<-1}
    return(fnReturn)
}

### Nombre: RunAllComparisionMain
### Autora: Leticia Vega Alvarado
### Fecha de creacion: 12/Mayo/2015
### Ultima actualizacion: 24/julio/2020
### Parametros:
###           - fnProgamsPath: Directorio donde se encuentran los programas fuentes. No tiene valor por defecto.
###           - fnInputFileName: Nombre del archivo (con "path" incluido) de la tabla de conteos. No tiene valor por defecto.
###           - fnOutputPath: Directorio donde se guardaran los resultados del análisis. No tiene valor por defecto.
###           - fnCombinations: Vector con las combinaciones de condiciones para hacer el analisis pareado. Por defecto es vacio.
###           - TOP: Valor logico que indica si se obtendrán los genes TOP, por metodo. Por defecto es TRUE
###           - fnUmbral: Valor de corte para el pvalue o FDR. Por defecto es 0.01. Se utiliza solo cuando TOP es TRUE
###           - fnFilterValue: Valor de corte, en terminos de los conteos por millon (CPM). Por defecto es 1.
###           - fnUmbralFoldChange: valor de corte para el Log2FC. Por defecto es 1. Se utiliza solo cuando TOP es TRUE
###           - fnSelectMethods: Código, que permite saber que procesos se realizaran. Por defecto es 123456.
###             1. edgeR, 2.limma, 3. NOISeq, 4. DESeq2, 5. DataAnalysis, 6. VennDiagram, ejemplo: fnSelectMethods="12456"
###           - fnFileGzipTar: Valor lógico que indica si se guardarán todos los resultados en un archivo comprimido. Por defecto es FALSE.
###           - fnBatch: Vector de valores numericos indicando el numero de lote por muestra. Por defecto es vacio
### Valores de regreso:
###           - fnResPkg: Variable que regresa un codigo numerico de error: 0 si no hay error, 3 si hubo algun error al leer la tabla de conteos
### Descripcion: Funcion que sirve como programa principal para iniciar el análisis de ED. En este paso se genera el archivo
###              log, donde se guarda la bitacora del analisis. Ademas, se lee el archivo con la tabla de conteos y manda a llamar
###              las funciones que permiten, validar dicha tabla, también se encarga de validar los nombres de las condiciones.
### Dependencias: scripts:
###               "RunedgeR.r","Runlimma.r","RunNOISeq.r","RunDESeq2.","RunDataAnalysis.r","RunIntegration.r","RunInstallloadValidatePkg.r","RunPrintMessage.r"
RunAllComparisionMain<-function(fnProgamsPath,fnInputFileName,fnOutputPath,fnCombinations=c(),TOP=TRUE,fnUmbral=0.01,fnFilterValue=1,fnUmbralFoldChange=1,fnSelectMethods=123456,fnFileGzipTar=TRUE,fnBatch=c())
{
   ##### Apertura del archivo .log
   sink(paste(fnOutputPath,"/","RunSummary.log",collapse="",sep = ""))
   #####  Definicion de variables
   fnMethods<-c("edgeR","limma","NOISeq","DESeq2","DataAnalysis","Integration")
   fnResPkg<-0
   fnNomenclature<-sort(as.integer(unlist(strsplit(as.character(fnSelectMethods),""))))
   fnVennPackage<-c()
   source(paste(fnProgamsPath,"/RunInstallloadValidatePkg.r",collapse="",sep = ""))

   fnParamList<-list(fnProgamsPath=fnProgamsPath,OutputPath=fnOutputPath,TOP=TOP,Umbral=fnUmbral,FilterValue=fnFilterValue,LogFC=fnUmbralFoldChange,DEMethods=fnMethods[fnNomenclature[fnNomenclature>0 & fnNomenclature<5]],Integration=ifelse(6 %in% fnNomenclature,TRUE,FALSE),DataAnalysis=ifelse(5 %in% fnNomenclature,TRUE,FALSE))
   ##### Imprimiendo en el archivo log la fecha de corrida, las versiones de paquetes utilizados y la línea de comandos con la que fue llamada la funcion RunAllComparisionMain
   fnMethodToPrint<-paste("RunAllComparisionMain(",fnProgamsPath,",",fnInputFileName,",",fnOutputPath,",fnCombinations=c(",paste(fnCombinations,collapse=",",sep=""),"),TOP=",TOP,",fnUmbral=",fnUmbral,",fnFilterValue=",fnFilterValue,",fnUmbralFoldChange=",fnUmbralFoldChange,",fnSelectMethods=",fnSelectMethods,",fnFileGzipTar=",fnFileGzipTar,",fnBatch=c(",paste(fnBatch,collapse=",",sep=""),"))",collapse="",sep="")
   if(6 %in% fnNomenclature){fnVennPackage<-c("VennDiagram","ggplot2","UpSetR","corrplot","ComplexHeatmap","grDevices","grid")}
   fnInstPkg<-printRunInitInfo(fnMethodToPrint,c(fnMethods[fnNomenclature[fnNomenclature %in% 1:4]],fnVennPackage),fnParamList)
   if(!length(fnInstPkg$fnNotInstalled))
   {
       #####  Cargando los programas necesarios para el analisis
       loadScripts(fnProgamsPath,c(paste("Run",fnMethods[fnNomenclature],sep = ""),"printOKMessage"),c(paste("Run",fnMethods[fnNomenclature],".r",sep = ""),"RunPrintMessage.r"))
       cat("*******************\n<ANALYSIS STARTS>\n*******************","\n")
       #####  Lectura de la tabla de conteos y de las condiciones
       if(class(fnCounts<-try(ValidateCountTable(fnInputFileName),silent=TRUE)) != "try-error")
       {
           printOKMessage("      Read count table .......................... OK")
           fnNamesNotOrder<-names(fnCounts)
           fnCounts<-fnCounts[ ,order(sub("_[a-zA-Z0-9]+$","",colnames(fnCounts)))]
           if(length(fnBatch)){
               names(fnBatch)<-fnNamesNotOrder
               fnBatch<- fnBatch[names(fnCounts)]
           }
           fnAllCond=sub("_[a-zA-Z0-9]+$","",colnames(fnCounts))
           #####  Generando los directorios de salida
           if(fnParamList$DataAnalysis){
               createResultDir(fnOutputPath,fnMethods[5])
               fnOutputFileName<-paste(fnOutputPath,"/DataAnalysis_Results/AllConditions",collapse="",sep = "")
               dataAnalysis(fnProgamsPath,fnCounts,fnAllCond,fnOutputFileName,unname(fnBatch))
           }
           if(length(fnParamList$DEMethods)>0)
           {
               fnReturn<-runAllDEPairAnalysis(fnParamList,fnCombinations,fnAllCond,fnCounts,fnBatch, fnMethods[fnNomenclature [fnNomenclature!= 5]])
               if(!fnReturn){
                   if(fnFileGzipTar)
                   {
                       compressInfo(fnOutputPath)
                   }
               }
               else{
                   printErrorMessage("      Condition names are not the same as samples prefix  .......................... Failed")
               }
           }
           
       }
       else{   printErrorMessage("      Read count table .......................... Failed",as.character(attr(fnCounts,"condition")))}
   }
   else{fnResPkg<-3}
   cat("*******************\n<ANALYSIS FINISHED>\n*******************","\n")
   closeAllConnections() # Para cerrar todo closeAllConnections()
   return(fnResPkg)
}
