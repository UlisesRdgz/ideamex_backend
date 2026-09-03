### Copyright (c) 2025 [Leticia Vega Alvarado]
### 
### Este archivo forma parte del proyecto IDEAMEX.
### Licencia: Creative Commons Atribución-NoComercial 4.0 Internacional (CC BY-NC 4.0)
### Puede copiarse y modificarse libremente con fines no comerciales, siempre que se otorgue crédito al autor original.
### Más información: https://creativecommons.org/licenses/by-nc/4.0/deed.es
###

#!/usr/local/bin/Rscript

### Nombre: heatmapDEGenes
### Autora: Leticia Vega Alvarado
### Fecha de creacion: 18/10/2018
### Ultima actualizacion: 24/01/2021
### Parametros:
###           - fnDEListGenes: Valor alfanumerico con el nombre del archivo en donde se encuentran los genes DE que se van a graficar
###           - fnCountTable: dataframe con la tabla de conteos crudos
###           - fnOutputPath: Path de salida en donde se guardaran los resultados
###           - fnConditionsNames: Valor alfanumerico con el nombre de las condiciones que se estan comparando
###           - fnNameSufix: Valor alfanumerico que se colocara despues del nombre
### Valores de regreso:
###           - fnDds: Objeto de tipo DDs de DESeq2 que contiene la tabla de conteos y el diseño de las condiciones
### Descripcion: Funcion que se encarga de graficar un heatmap

heatmapDEGenes<-function(fnDEListGenes,fnCountTable,fnOutputPath,fnConditionsNames,fnNameSufix)
{
    fnPks<-c("ComplexHeatmap","DESeq2","circlize")
    fnRequierePkgs<-loadPkgValidate(fnPks)
    print("*************************  Running Heatmap  *************************")
    fnDEGenes<-scan(fnDEListGenes,what=as.character(),quiet = TRUE)
    fnNumberOfGenes<-length(fnDEGenes)
    if(fnNumberOfGenes>200)
    {
        fnDEGenes<-fnDEGenes[1:200]
        fnNumberOfGenes<-200
    }
    fnGenesFontSize<-5 - ((fnNumberOfGenes - 1) %/% 50)

    ####  Inicializacion de variables
    fnSamplesName=factor(sub("_[a-zA-Z0-9]+$","",colnames(fnCountTable)))
    fnFileName<-paste(fnOutputPath,"/",fnConditionsNames,fnNameSufix,collapse="",sep = "")

    ####  Initializacion de un objecto de tipo DESeq
    fnColData<-data.frame(condition=fnSamplesName,row.names=colnames(fnCountTable))
    fnDds <- try(DESeqDataSetFromMatrix(countData = as.matrix(fnCountTable),colData = fnColData,design = ~ condition),silent=TRUE)
    if(!(is(fnDds,"try-error")))
    {
        fnPlotFileName<-paste(fnFileName,"_heatmap",collapse="",sep = "")
        pdf(paste(fnPlotFileName,".pdf",collapse="",sep=""))
        fnRld = rlog(fnDds, blind = FALSE)
        fnGenes<-assay(fnRld)[fnDEGenes,]
        fnZ.mat <- t(scale(t(fnGenes), center=TRUE, scale=TRUE))
        # colour palette
        fnMyPalette <- c("red3", "ivory", "blue3")
        fnMyRamp = colorRamp2(c(-2, 0, 2), fnMyPalette)
        print(Heatmap(fnZ.mat, name = "z-score", col = fnMyRamp, show_row_name = TRUE, row_names_gp = gpar(fontsize = fnGenesFontSize),column_title = fnConditionsNames))
        graphics.off()
        printOKMessage("       Heatmap .......................... OK")
    }
    else{
        printErrorMessage("      Objeto Dds .......................... Failed")
        return(fnDds)
    }
}

### Nombre: doHetmaps
### Autora: Leticia Vega Alvarado
### Fecha de creacion: 24/01/2021
### Ultima actualizacion: 24/01/2021
### Parametros:
###           - fnProgamsPath: Directorio en donde se guradaran los resultados
###           - fnOutputPath: Directorio en donde se guardaran los resultados
###           - fnCountTable: Tabla de conteos crudos
###           - fnCombinationNames: Valor alfanumerico con el nombre de las
### Descripcion: Funcion que sirve
doHeatmaps<-function(fnProgamsPath,fnOutputPath,fnCountTable,fnCombinationNames)
{
    ####  Cargando los programas y paquetes necesarios
    if(!exists("loadPkgValidate", mode="function")) source(paste(fnProgamsPath,"/RunInstallloadValidatePkg.r",collapse="",sep = ""))
    fnMethods<-c("printOKMessage")
    fnSource<-c("RunPrintMessage.r")
    loadScripts(fnProgamsPath,fnMethods,fnSource)
    fnExt<-c("intesrsect","union")
    for(i in fnExt)
    {
        fnDEGenes<-paste(fnOutputPath,"/Integration_Results/",fnCombinationNames,"/",fnCombinationNames,"_",i,"_TOP_IDs.txt",collapse="",sep = "")
        if(is(try(heatmapDEGenes(fnDEGenes,fnCountTable,paste(fnOutputPath,"/Integration_Results/",fnCombinationNames,collapse="",sep = ""),fnCombinationNames,paste("_",i,collapse="",sep = "")),silent=TRUE),"try-error"))
        { printErrorMessage(paste("      RunHeatmap",i,".......................... Failed")) }
        else{printOKMessage(paste("      RunHeatmap",i,".......................... OK"))}
    }
}



