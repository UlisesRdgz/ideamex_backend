### Copyright (c) 2025 [Leticia Vega Alvarado]
### 
### Este archivo forma parte del proyecto IDEAMEX.
### Licencia: Creative Commons Atribución-NoComercial 4.0 Internacional (CC BY-NC 4.0)
### Puede copiarse y modificarse libremente con fines no comerciales, siempre que se otorgue crédito al autor original.
### Más información: https://creativecommons.org/licenses/by-nc/4.0/deed.es
###

#!/usr/local/bin/Rscript

### Nombre: buildNOISeqDataObjet
### Autora: Leticia Vega Alvarado
### Fecha de creacion: 21/04/20
### Ultima actualizacion: 21/04/20
### Parametros:
###           - fnCondition: Vector con los nombres de las condiciones a comparar
###           - fnCountTable: Dataframe con la tabla de conteos
###           - fnBatch: Vector de valores numericos indicando el numero de lote por muestra. Puede ser vacío
### Valores de regreso:
###           - fnMyData: Objeto propio de NOISeq, con la tabla de conteos y el diseño experimental
### Descripcion: Funcion para inicializar un objeto de tipo NOISeq, el cual contiene la tabla de conteos y el diseño experimental
buildNOISeqDataObjet<-function(fnCondition,fnCountTable,fnBatch)
{
    ####  Initializacion de un objecto de tipo NOISeq
    fnExpDesign<-data.frame(fnSamples = colnames(fnCountTable),fnFactor =fnCondition)
    if(length(fnBatch)){
        fnExpDesign$Batch<-factor(fnBatch)}
    fnMyData<-try(NOISeq::readData( data=fnCountTable, factors=fnExpDesign),silent=T)
    return(fnMyData)
}

### Nombre: selectColumn
### Autora: Leticia Vega Alvarado
### Fecha de creacion: 21/04/20
### Ultima actualizacion: 21/04/20
### Parametros:
###           - fnColNames: Valor alfanumerico (nombre de una columna)
### Valores de regreso:
###           - fnColLog2: Valor alfanumerico que uede tomar el valor de M o log2FC
### Descripcion: Funcion que permite seleccionar el valor M o log2FC, dependiendo del valor de entrada fnColNames
selectColumn<-function(fnColNames)
{
    fnColLog2<-"M"
    if("log2FC" %in% fnColNames){
        fnColLog2<-"log2FC"}
    return(fnColLog2)
}

### Nombre: plotPCANOISeq
### Autora: Leticia Vega Alvarado
### Fecha de creacion: 21/04/20
### Ultima actualizacion: 21/04/20
### Parametros:
###           - fnNOISeqObj: Objeto de tipo NOISeq
###           - fnFileName: Prefijo del nombre del archivo de salida
###           - fnBatch: Vector de valores numericos indicando el numero de lote por muestra. Puede ser vacío
###           - fnTitle: Valor alfanumerico con el titulo de la grafica
###           - fnDesingMat: Matriz con el diseño experimental
### Descripcion: Funcion que grafica la PCA
###
###
plotPCANOISeq<-function(fnNOISeqObj,fnFileName,fnBatch=c(),fnTitle="PCA Plot",fnDesingMat)
{
    fnReplicates<-getTypeofAnalysis(fnDesingMat$fnFactor)
    if(fnReplicates)
    {
        fnPlotFileName<-paste(fnFileName,"_plotPCA",collapse="",sep = "")
        pdf(paste(fnPlotFileName,".pdf",collapse="",sep=""),onefile=FALSE)
        fnMyPCA<-NOISeq::dat(fnNOISeqObj,type="PCA")
        fnDatPCA<-dat2save(fnMyPCA)
        fnDat2Plot<-data.frame(fnX=fnDatPCA$scores[,1],fnY=fnDatPCA$scores[,2],fnCond=fnDesingMat$fnFactor)
        fnCorrPerc<-round((fnDatPCA$var.exp[1:2,1])*100,0)
        fnPlot<-ggplot(fnDat2Plot,aes(fnX,fnY,color=fnCond,shape=fnCond)) +
        geom_point(size=3) +
        theme_bw() +
        labs(title=paste("PCA plot ",fnTitle),x=bquote("PC1: " ~ .(fnCorrPerc[1])*"% variance"), y=bquote("PC2: " ~ .(fnCorrPerc[2])*"% variance")) +
        scale_shape_manual(values=c(17,16)) +
        geom_text(aes(label=fnDesingMat$fnSamples),vjust=-0.7,size=3,show.legend = F) +
        theme(plot.title = element_text(size=16, hjust=0.5),legend.title = element_blank(), panel.grid.minor = element_blank())
        print(fnPlot)
        #### Cierre del modo de guardado de graficos
        graphics.off()
        printOKMessage("      PCA Plot .......................... OK")
    }
}

### Nombre: diffExpNOISeq
### Autora: Leticia Vega Alvarado
### Fecha de creacion: 21/04/20
### Ultima actualizacion: 21/04/20
### Parametros:
###           - fnNOISeqObj: Objeto de tipo NOISeq
###           - fnConditions: Vector con los nombres de las condiciones a comparar
###           - fnExpDesign: Matriz con el diseño experimental
###           - fnBatch: Vector de valores numericos indicando el numero de lote por muestra. Puede ser vacío
### Valores de regreso:
###           - fnMyResults: Ojeto de NOISeq que contiene los resultados del analisis de ED
### Descripcion: Funcion que realiza el analisis de expresion diferencial, con replicas tecnicas o con replicas biologicas
diffExpNOISeq<-function(fnNOISeqObj,fnConditions,fnExpDesign,fnBatch)
{
    fnNorm="tmm"
    fnK=0.5
    
    fnReplicates<-getTypeofAnalysis(fnExpDesign$fnFactor)
    if(!fnReplicates){
        #fnMyResults <- noiseq(fnNOISeqObj, factor = "fnFactor",conditions=c(fnConditions[1],fnConditions[2]), k = NULL, nss = 3, norm = fnNorm, replicates = "no")
        invisible(capture.output(fnMyResults <- noiseq(fnNOISeqObj, factor = "fnFactor",conditions=c(fnConditions[1],fnConditions[2]), k = fnK, norm = fnNorm, replicates = "no") ))
    }
    else
    {
        if(length(fnBatch)){
            fnNorm="n"}
        #fnMyResults <-noiseqbio(fnNOISeqObj, k = fnK, norm = fnNorm, factor = "fnFactor",conditions=c(fnConditions[1],fnConditions[2]), r = 20,filter =0)
        invisible(capture.output(fnMyResults <-noiseqbio(fnNOISeqObj, k = fnK, norm = fnNorm, factor = "fnFactor",conditions=c(fnConditions[1],fnConditions[2]), r = 20,filter =0) ))
    }
    printOKMessage("      Differential expression estimation.......................... OK")
    return(fnMyResults)
}

### Nombre: RunNOISeq
### Autora: Leticia Vega Alvarado
### Fecha de creacion: 21/04/18
### Ultima actualizacion: 28/09/23
### Parametros:
###           - fnProgamsPath: Directorio donde se encuentran los programas fuentes necesarios. Es decir, las dependencias de este programa
###           - fnCountTable: data.frame con la tabla de conteos de un par de condiciones, con o sin replicas
###           - fnOutputPath: Directorio donde se guardaran los resultados del análisis con NOISeq
###           - TOP: Valor logico que indica si se obtendrán los genes TOP
###           - fnUmbral: Valor de corte para el FDR
###           - fnUmbralFoldChange: Valor de corte para el Log2FC.
###           - fnBatch: Vector de valores numericos indicando el numero de lote por muestra. Por defecto es vacio
###           - fnConditions: vector que contiene los nombres de las condiciones a comparar
### Descripcion: Funcion Principal que se encarga de hacer el analisis de ED para una tabla de conteos determinada, usando el metodo NOISeq
RunNOISeq<- function(fnProgamsPath,fnCountTable,fnOutputPath,TOP=FALSE,fnUmbral=0.01,fnUmbralFoldChange=1,fnBatch=c(),fnConditions)
{
   print("*************************  Running NOISeq  *************************")
   fnMethodToPrint<-paste("RunNOISeq(",fnProgamsPath,",fnCounTable,",fnOutputPath,",TOP=",TOP,",fnUmbral=",fnUmbral,",fnUmbralFoldChange=",fnUmbralFoldChange,",fnBatch=(",paste(fnBatch,collapse=",",sep=""),")",",fnConditions=c(",fnConditions[1],",",fnConditions[2],")",")",collapse="",sep="")
   print(fnMethodToPrint)
   if(!exists("loadPkgValidate", mode="function")) source(paste(fnProgamsPath,"/RunInstallloadValidatePkg.r",collapse="",sep = ""))
   fnTopName<-NULL
   fnMethods<-c("printOKMessage","printToFile")
   fnSource<-c("RunPrintMessage.r","CommonFunctions.r")
   loadScripts(fnProgamsPath,fnMethods,fnSource)
   fnPks<-c("NOISeq","ggplot2")
   fnRequierePkgs<-loadPkgValidate(fnPks)
   
   if("NOISeq" %in% fnRequierePkgs$fnLoaded)
   {
       ####  Iicializacion de variables
       fnSamplesName=factor(sub("_[a-zA-Z0-9]+$","",colnames(fnCountTable)))
       fnSamplesName=relevel(fnSamplesName,ref=fnConditions[1])
       fnConditionsNames<-paste(fnConditions[1],"vs",fnConditions[2],collapse="",sep = "")
       fnFileName<-paste(fnOutputPath,"/",fnConditionsNames,collapse="",sep = "")
       print("############")
       print(paste("Samples: ",fnConditionsNames))
       print("############")
       
       ####  Initializacion de un objecto de tipo NOISeq
       fnMyData<-buildNOISeqDataObjet(fnSamplesName,fnCountTable,fnBatch)
       if(!(is(fnMyData,"try-error")))
       {
           printOKMessage("      Objeto NOISeq .......................... OK")
           ####  Grafica PCA
           plotPCANOISeq(fnMyData,fnFileName,fnBatch=fnBatch,fnTitle=fnConditionsNames,list(fnSamples=colnames(fnCountTable),fnFactor=fnSamplesName))
           if(length(fnBatch))
           {
               fnMyData<-ARSyNseq(fnMyData,factor="Batch",batch=TRUE,norm="tmm",logtransf=FALSE)
               plotPCANOISeq(fnMyData,paste(fnFileName,"_RemovedBatch",sep="",collapse=""),fnBatch=fnBatch,fnTitle=paste("batch removed",gsub("vs"," vs ",fnConditionsNames)),list(fnSamples=colnames(fnCountTable),fnFactor=fnSamplesName))
           }
           fnMyResults<-diffExpNOISeq(fnMyData,fnConditions,list(fnSamples=colnames(fnCountTable),fnFactor=fnSamplesName),fnBatch)
           ####  Obtencion de la tabla de resultados
           fnRes<-fnMyResults@results[[1]]
           fnRes <- fnRes[order(row.names(fnRes)),]
           fnRes$lminusProb <- 1-fnRes$prob
           fnParam<-selectColumn(colnames(fnRes))
           fnRes$log2FC_SigInv<-fnRes[,fnParam]*(-1)
           fnTables<-list(fnDeTab=fnRes,RawCounts=data.frame(assayData(fnMyData)$exprs), NormalizedCounts=data.frame(tmm(assayData(fnMyData)$exprs, k=0.5, lc = 0)))
           fnDeTab<-resulTable(fnTables,fnFileName,fnUmbralFoldChange,fnUmbral,c("lminusProb","log2FC_SigInv"),c(fnConditions[1],fnConditions[2]))
           fnTopName<-printToFile(fnDeTab,fnFileName,TOP=TOP,c(logFC="log2FC_SigInv",pval="lminusProb",expression="NonDE"))
           return(fnTopName)
      }
      else{
           printErrorMessage("      Objeto NOISeq .......................... Failed")
           return(fnMyData)
      }
   }
   else{
       printErrorMessage("      Load NOISeq package .......................... Failed")
   }
}
