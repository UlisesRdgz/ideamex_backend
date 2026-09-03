### Copyright (c) 2025 [Leticia Vega Alvarado]
### 
### Este archivo forma parte del proyecto IDEAMEX.
### Licencia: Creative Commons Atribución-NoComercial 4.0 Internacional (CC BY-NC 4.0)
### Puede copiarse y modificarse libremente con fines no comerciales, siempre que se otorgue crédito al autor original.
### Más información: https://creativecommons.org/licenses/by-nc/4.0/deed.es
###

#!/usr/local/bin/Rscript

### Nombre: buildDESeqDataObjet
### Autora: Leticia Vega Alvarado
### Fecha de creacion: 25/04/20
### Ultima actualizacion: 25/04/20
### Parametros:
###           - fnCondition: Vector con los nombres de las condiciones a comparar
###           - fnCountTable: Dataframe con la tabla de conteos
###           - fnBatch: Vector de valores numericos indicando el numero de lote por muestra. Puede ser vacío
### Valores de regreso:
###           - fnDds: Objeto propio de DESeq, con la tabla de conteos y el diseño experimental y efecto batch si es el caso
### Descripcion: Funcion para inicializar un objeto de tipo DESeq, el cual contiene la tabla de conteos y el diseño experimental
buildDESeqDataObjet<-function(fnCondition,fnCountTable,fnBatch)
{
    fnColData<-data.frame(condition=fnCondition,row.names=colnames(fnCountTable))
    if(length(fnBatch))
    {
        printOKMessage("      Batch effects .......................... OK")
        fnColData$fnBatch<-factor(fnBatch)
        fnDds <- try(DESeqDataSetFromMatrix(countData = as.matrix(fnCountTable),colData = fnColData,design = ~ fnBatch + condition),silent=TRUE)
    }
    else{
        fnDds <- try(DESeqDataSetFromMatrix(countData = as.matrix(fnCountTable),colData = fnColData,design = ~ condition),silent=TRUE)
    }
    return(fnDds)
}

### Nombre: printPCA
### Autora: Leticia Vega Alvarado
### Fecha de creacion: 25/04/20
### Ultima actualizacion: 25/04/20
### Parametros:
###           - fnDds: objeto de tipo DESeq
###           - fnFileName: prefijo del nombre de archivo de salida
###           - fnTitle: Valor alfanumerio con el titulo de la grafica
###           - fnTextAnnSize: Tamaño de las letras de las etiquetas de la grafica
###           - fnCorrection: Valor booleano para saber si se graficaran los valores modelando el efecto batch
### Descripcion: Funcion para graficar la PCA
printPCA<-function(fnDds,fnFileName,fnTitle="PCA Plot",fnTextAnnSize=3,fnCorrection=FALSE)
{
    fnPlotFileName<-paste(fnFileName,"_plotPCA",collapse="",sep = "")
    pdf(paste(fnPlotFileName,".pdf",collapse="",sep=""))
    fnCondition<-factor(sub("_[a-zA-Z0-9]+$","",colnames(fnDds)))
    if( length(fnCondition)==length(levels(factor(fnCondition))) || length(fnCondition) >= 20 )
    {
            fnVsd<-try(vst(fnDds,blind=TRUE,fitType = "local"),silent=TRUE)
    }
    else{
        fnVsd<-rlogTransformation(fnDds,blind=FALSE,fitType = "local")
        
    }
    if(fnCorrection){
        fnRemBatch<-assay(fnVsd)
        fnRemBatch <- limma::removeBatchEffect(fnRemBatch, fnVsd$fnBatch)
        assay(fnVsd) <- fnRemBatch
    }
    fnPlot<-plotPCA(fnVsd,intgroup="condition") +
    theme_bw() +
    ggtitle(fnTitle) +
    theme(plot.title = element_text(size=10, hjust=0.5), legend.title = element_blank(), panel.grid.minor = element_blank()) +
    geom_text(aes(label=colnames(fnVsd)), vjust=-0.5,size=fnTextAnnSize)
    print(fnPlot)
    #### Cierre del modo de guardado de graficos
    graphics.off()
    printOKMessage("      PCA plot .......................... OK")
}

### Nombre: callMAPlot
### Autora: Leticia Vega Alvarado
### Fecha de creacion: 25/04/20
### Ultima actualizacion: 25/04/20
### Parametros:
###           - fnRes: Objeto de tipo results, propio de DESeq con los resultados de la ED
###           - fnFileName: Prefijo del nombre de archivo de salida
###           - fnConditionsNames: Vector con los nobres de las condiciones a comparar
### Descripcion: Funcion que realiza la grafica MA para representar los datos DE
callMAPlot<-function(fnRes,fnFileName,fnConditionsNames)
{
    fnPlotFileName<-paste(fnFileName,"_plotMA",collapse="",sep = "")
    pdf(paste(fnPlotFileName,".pdf",collapse="",sep=""))
    DESeq2::plotMA(fnRes, ylim=c(-4, 4), main=fnConditionsNames,xlab = "mean of normalized counts", ylab = expression(log[2]~fold~change),log = "x",cex=0.45)
    graphics.off()
    printOKMessage("      MA plot .......................... OK")
}

### Nombre: RunDESeq2
### Autora: Leticia Vega Alvarado
### Fecha de creacion: 17/04/18
### Ultima actualizacion: 12/10/22
### Parametros:
###           - fnProgamsPath: Directorio donde se encuentran los programas fuentes necesarios. Es decir, las dependencias de este programa
###           - fnCountTable: data.frame con la tabla de conteos de un par de condiciones, con o sin replicas
###           - fnOutputPath: Directorio donde se guardaran los resultados del análisis con DESeq2
###           - TOP: Valor logico que indica si se obtendrán los genes TOP
###           - fnUmbral: Valor de corte para el padjust
###           - fnUmbralFoldChange: Valor de corte para el Log2FC.
###           - fnMAPlot: Valor logico que indica si se realizará la grafica MA
###           - fnBatch: Vector de valores numericos indicando el numero de lote por muestra. Por defecto es vacio
###           - fnConditions: vector que contiene los nombres de las condiciones a comparar
### Descripcion: Funcion Principal que se encarga de hacer el analisis de ED para una tabla de conteos determinada, usando el metodo DESeq2
RunDESeq2<- function(fnProgamsPath,fnCountTable,fnOutputPath,TOP=FALSE,fnUmbral=0.01,fnUmbralFoldChange=1,fnMAPlot=TRUE,fnBatch=c(),fnConditions)
{
   print("*************************  Running DESeq2  *************************")
   fnMethodToPrint<-paste("RunDESeq2(",fnProgamsPath,",fnCounTable,",fnOutputPath,",TOP=",TOP,",fnUmbral=",fnUmbral,",fnUmbralFoldChange=",fnUmbralFoldChange,",fnMAPlot=",fnMAPlot,",fnBatch=(",paste(fnBatch,collapse=",",sep=""),")",",fnConditions=c(",fnConditions[1],",",fnConditions[2],")",")",collapse="",sep="")
   print(fnMethodToPrint)
   if(!exists("loadPkgValidate", mode="function")) source(paste(fnProgamsPath,"/RunInstallloadValidatePkg.r",collapse="",sep = ""))
   fnTopName<-NULL
   fnMethods<-c("printOKMessage","printToFile")
   fnSource<-c("RunPrintMessage.r","CommonFunctions.r")
   loadScripts(fnProgamsPath,fnMethods,fnSource)
   fnPks<-c("DESeq2","ggplot2")
   fnRequierePkgs<-loadPkgValidate(fnPks)
   
   if("DESeq2" %in% fnRequierePkgs$fnLoaded)
   {
       ####  Iicializacion de variables
       fnSamplesName=factor(sub("_[a-zA-Z0-9]+$","",colnames(fnCountTable)))
       fnConditionsNames<-paste(fnConditions[1],"vs",fnConditions[2],collapse="",sep = "")
       fnFileName<-paste(fnOutputPath,"/",fnConditionsNames,collapse="",sep = "")
       fnOutputFileNameTop<-paste(fnFileName,"_TOP.txt",collapse="",sep = "")
       fnOutputFileName<-paste(fnFileName,".txt",collapse="",sep = "")
       print("############")
       print(paste("Samples: ",fnConditionsNames))
       print("############")
       
       fnReplicates<-summary(fnSamplesName) > 1
       if(all(fnReplicates))
       {
           ####  Initializacion de un objecto de tipo DESeq
           fnDds<-buildDESeqDataObjet(fnSamplesName,fnCountTable,fnBatch)
           if(!(is(fnDds,"try-error")))
           {
               printOKMessage("      Objeto Dds .......................... OK")
               fnDds$condition <- factor(fnDds$condition, levels=c(fnConditions[1],fnConditions[2]))
               #### Calculo de la Expresion diferencial
               fnDds<-DESeq2::DESeq(fnDds,quiet = TRUE)
               fnRes<-DESeq2::results(fnDds)
               fnRes$padj <- ifelse(is.na(fnRes$padj), 1, fnRes$padj)
               printOKMessage("      Differential expression estimation.......................... OK")
               ####  Obtencion de la tabla de resultados
               fnTables<-list(fnDeTab=data.frame(fnRes),RawCounts=DESeq2::counts(fnDds),NormalizedCounts=data.frame(DESeq2::counts(fnDds,normalized=TRUE)))
               fnDeTab<-resulTable(fnTables,fnFileName,fnUmbralFoldChange,fnUmbral,c("padj","log2FoldChange"),c(fnConditions[1],fnConditions[2]))
               ####  Guardado de los datos en archivo
               fnTopName<-printToFile(fnDeTab,fnFileName,TOP=TOP,c(logFC="log2FoldChange",pval="padj",expression="NonDE"))
               if("ggplot2" %in% fnRequierePkgs$fnLoaded)
               {
                   ####  Grafica de agrupamiento de los datos
                   printPCA(fnDds,fnFileName,fnTitle=paste("PCA Plot",fnConditionsNames),fnTextAnnSize=3,fnCorrection=FALSE)
                   if(length(fnBatch))
                   {
                       printPCA(fnDds,paste(fnFileName,"_RemovedBatch",sep="",collapse=""),fnTitle=paste("Removed Batch PCA Plot",fnConditionsNames),fnTextAnnSize=3,fnCorrection=TRUE)
                   }
                   if(length(fnTopName) > 0){
                       ####  Generando la grafica de MA
                       callMAPlot(fnRes,fnFileName,fnConditionsNames)
                   }
                   else{
                       printOKMessage("      MA Plot was not generated .......................... No significantly ED genes were detected")
                   }
               }
           }
           else{
               printErrorMessage("      Objeto Dds .......................... Failed")
           }
       }
       else{
           printErrorMessage("      DESeq2 (no replicates) .......................... Failed")
       }
   }
   else{printErrorMessage("      Load DESeq2 package .......................... Failed")}
   return(fnTopName)
}
