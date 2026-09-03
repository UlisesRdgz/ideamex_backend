### Copyright (c) 2025 [Leticia Vega Alvarado]
### 
### Este archivo forma parte del proyecto IDEAMEX.
### Licencia: Creative Commons Atribución-NoComercial 4.0 Internacional (CC BY-NC 4.0)
### Puede copiarse y modificarse libremente con fines no comerciales, siempre que se otorgue crédito al autor original.
### Más información: https://creativecommons.org/licenses/by-nc/4.0/deed.es
###

#!/usr/local/bin/Rscript

### Nombre: evalDispTestWithOutRep
### Autora: Leticia Vega Alvarado
### Fecha de creacion: 20/04/20
### Ultima actualizacion: 20/04/20
### Parametros:
###           - fnDge: Objeto de tipo dge List, propio de edgeR
###           - fnConditions: vector que contiene los nombres de las condiciones a comparar
### Valores de regreso:
###           - fnEt: Objeto propio de edgeR, con los resutados de la ED, despues de aplicar la prueba de hipotesis
### Descripcion: Funcion que sirve para evaluar la prueba de hipotesis de edgeR (exactTest), cuando no hay replicas
evalDispTestWithOutRep<-function(fnDge,fnConditions)
{
    fnDispersion = 0.4
    fnEt = exactTest(fnDge, dispersion=fnDispersion , pair=c(fnConditions[1],fnConditions[2]))
    printOKMessage("      Differential expression estimation.......................... OK")
    return(fnEt)
}

### Nombre: evalDispTestWithRep
### Autora: Leticia Vega Alvarado
### Fecha de creacion: 20/04/20
### Ultima actualizacion: 21/04/20
### Parametros:
###           - fnDge: Objeto de tipo dge List, propio de edgeR
###           - fnConditions: vector que contiene los nombres de las condiciones a comparar
### Valores de regreso:
###           - fnEt: Objeto propio de edgeR, con los resutados de la ED, despues de aplicar la prueba de hipotesis
### Descripcion: Funcion que sirve para evaluar la prueba de hipotesis de edgeR (exactTest) entre dos condiciones, con replicas utilizando el metodo clasico
evalDispTestWithRep<-function(fnDge,fnConditions)
{
    ####  Calculo de la dispersion de los datos
    fnDge = estimateDisp(fnDge)
    printOKMessage("      Dispersion estimation .......................... OK")
    ####  Calculo de la Expresion diferencial
    fnEt = exactTest(fnDge,pair=c(fnConditions[1],fnConditions[2]))
    printOKMessage("      Differential expression estimation.......................... OK")
    return(fnEt)
}

### Nombre: evalDispTestWithBatch
### Autora: Leticia Vega Alvarado
### Fecha de creacion: 21/04/20
### Ultima actualizacion: 22/04/20
### Parametros:
###           - fnDge: Objeto de tipo dge List, propio de edgeR
###           - fnConditionsRef: vector que contiene los nombres de las condiciones a comparar
###           - fnSamplesName: Condición basal para las comparaciones, la cual me permite establecer el orden de comparación entre las condiciones
###           - fnBatch: Vector de valores numericos indicando el numero de lote por muestra. Puede ser vacío
### Valores de regreso:
###           - fnQlf: Objeto propio de edgeR, con los resutados de la ED, despues de aplicar la prueba de hipotesis
### Descripcion: Funcion que sirve para evaluar la prueba de hipotesis de edgeR (exactTest) entre dos condiciones, con replicas.
###              este método funciona para modelar el efecto batch o para cuando no hay batch y deseamos utilizar el método de "quasilikehood
evalDispTestWithBatch<-function(fnDge,fnConditionsRef,fnSamplesName,fnBatch)
{
    ####  Calculo de la dispersion de los datos
    fnSamplesName<-relevel(fnSamplesName,ref=fnConditionsRef)
    if(length(fnBatch))
    {
        fnDesign<-model.matrix(~fnBatch+fnSamplesName)
    }
    else
    {
        fnDesign<-model.matrix(~fnSamplesName)
    }
    fnDge = estimateDisp(fnDge, fnDesign, robust = TRUE)
    fnFit <- glmQLFit(fnDge, fnDesign, robust = TRUE)
    fnQlf <- glmQLFTest(fnFit)
    printOKMessage("      Differential expression estimation.......................... OK")
    return(fnQlf)
}

### Nombre: diffExpedgeR
### Autora: Leticia Vega Alvarado
### Fecha de creacion: 21/04/20
### Ultima actualizacion: 22/04/20
### Parametros:
###           - fnDge: Objeto de tipo dge List, propio de edgeR
###           - fnConditions: vector que contiene los nombres de las condiciones a comparar
###           - fnSamplesName: factor con la descripción de las condiciones
###           - fnFileName: Nombre del archivo (con "path" incluido) donde se guardara la grafica.
###           - fnBatch: Vector de valores numericos indicando el numero de lote por muestra. Puede ser vacío.
###           - fnConditionsNames: Nombre de las condiciones que se comparan, por ejemplo: "AvsB"
### Valores de regreso:
###           - fnEt: Objeto propio de edgeR, con los resutados de la ED, despues de aplicar la prueba de hipotesis
### Descripcion: Funcion que sirve para evaluar la prueba de hipotesis de edgeR (exactTest) entre dos condiciones, con replicas utilizando el metodo clasico
diffExpedgeR<-function(fnDge,fnConditions,fnSamplesName,fnFileName,fnBatch,fnConditionsNames)
{
    if(length(fnDge$samples$group)<=2){
        fnEt<-evalDispTestWithOutRep(fnDge,fnConditions)}
    else if(length(fnBatch))
    {
        fnEt<-evalDispTestWithBatch(fnDge,fnConditions[1],fnSamplesName,factor(fnBatch))
    }
    else{
        fnEt<-evalDispTestWithRep(fnDge,fnConditions)}
    return(fnEt)
}

### Nombre: callSmearPlot
### Autora: Leticia Vega Alvarado
### Fecha de creacion:  18/09/20
### Ultima actualizacion: 18/09/20
### Parametros:
###           - fnTab: data.frame con los resultados de la evaluacion de la expresion diferencial con las cuentas normalizadas y la clasificación up y down
###           - fnDEGenes: data.frame con los genes clasificados en up, down y NonDE
###           - fnFileName: Nombre del archivo (con "path" incluido) donde se guardaran la grafica
###           - fnUmbral: Valor de corte para el FDR
###           - fnUmbralFoldChange: Valor de corte para el Log2FC.
###           - fnTitle: Titulo de la grafica.
### Descripcion: Funcion que sirve para realizar la grafica de Smear
callSmearPlot<-function(fnDETab,fnFileName,fnUmbral,fnUmbralFoldChange,fnTitle)
{
    ####  Generando la grafica de Smear
    fnMaxValY<-as.integer(max(abs(fnDETab$logFC)))
    if(fnMaxValY%%2){fnMaxValY=fnMaxValY+1}
    fnBreaksY<-unique(sort(c(seq(-fnMaxValY,fnMaxValY,2),-fnUmbralFoldChange,fnUmbralFoldChange)))
    fnPlotFileName<-paste(fnFileName,"_plotSmear",collapse="",sep = "")
    pdf(paste(fnPlotFileName,".pdf",collapse="",sep=""))
    fnUp<-grepl('^Down', fnDETab$Expression)
    fnDown<-grepl('^Up', fnDETab$Expression)
    fnDETab$Regulation<-fnDETab$Expression
    fnDETab[fnUp,"Regulation"]<-"Up"
    fnDETab[fnDown,"Regulation"]<-"Down"
    
    fnSmear<-ggplot(fnDETab, aes_string(x = "logCPM", y = "logFC", colour = "Regulation")) +
    geom_point(size=1) + theme_bw() +
    theme(plot.title = element_text(size=16, hjust=0.5),legend.title = element_blank()) +
    labs(title=paste("Smear plot ",gsub("vs"," vs ",fnTitle)),y=bquote(log[2] ~ "Fold Change")) +
    scale_y_continuous(breaks=fnBreaksY) +
    scale_color_manual(breaks = c("Down", "NonDE","Up"),values=c("red3", "black", "forestgreen")) +
    geom_hline(yintercept=-fnUmbralFoldChange, linetype="dashed", color = "blue",size=0.75) +
    geom_hline(yintercept=fnUmbralFoldChange, linetype="dashed", color = "blue",size=0.75)
    print(fnSmear)
    graphics.off()
    printOKMessage("      Smear plot .......................... OK")
}

### Nombre: callVolcanoPlot
### Autora: Leticia Vega Alvarado
### Fecha de creacion: 19/09/20
### Ultima actualizacion: 19/09/20
### Parametros:
###           - fnTab: data.frame con los resultados de la evaluacion de la expresion diferencial con las cuentas normalizadas y la clasificación up y down
###           - fnFileName: Nombre del archivo (con "path" incluido) donde se guardaran la grafica
###           - fnUmbral: Valor de corte para el FDR
###           - fnUmbralFoldChange: Valor de corte para el Log2FC.
###           - fnTitle: Titulo de la grafica.
### Descripcion: Funcion que sirve para realizar la grafica de Volcano
callVolcanoPlot<-function(fnDETab,fnFileName,fnUmbral,fnUmbralFoldChange,fnTitle)
{
    fnPlotFileName<-paste(fnFileName,"_plotVolcano",collapse="",sep = "")
    pdf(paste(fnPlotFileName,".pdf",collapse="",sep=""))
    fnDETab$negLogFDR = -log10(fnDETab$FDR)
    fnMaxValX<-as.integer(max(abs(fnDETab$logFC)))
    if(fnMaxValX%%2){fnMaxValX=fnMaxValX+1}
    fnBreaksX<-unique(sort(c(seq(-fnMaxValX,fnMaxValX,2),-fnUmbralFoldChange,fnUmbralFoldChange)))
    fnUp<-grepl('^Down', fnDETab$Expression)
    fnDown<-grepl('^Up', fnDETab$Expression)
    fnDETab$Regulation<-fnDETab$Expression
    fnDETab[fnUp,"Regulation"]<-"Up"
    fnDETab[fnDown,"Regulation"]<-"Down"
    
    fnVolcanoPlot<-ggplot(fnDETab, aes(x = logFC, y = negLogFDR, colour = Regulation)) +
    geom_point(size=1) + theme_bw() +
    theme(plot.title = element_text(size=16, hjust=0.5),legend.title = element_blank()) +
    labs(title=paste("Volcano plot ",gsub("vs"," vs ",fnTitle)),x=bquote(log[2] ~ "Fold Change"),y=bquote(-log[10] ~ "FDR")) +
    scale_x_continuous(breaks=fnBreaksX) +
    scale_color_manual(breaks = c("Down", "NonDE","Up"),values=c("red3", "black", "forestgreen")) +
    geom_vline(xintercept=-fnUmbralFoldChange, linetype="dashed", color = "blue",size=0.75) +
    geom_vline(xintercept=fnUmbralFoldChange, linetype="dashed", color = "blue",size=0.75) +
    geom_hline(yintercept=-log10(fnUmbral), linetype="dashed", color = "blue",size=0.75)
    print(fnVolcanoPlot)
    graphics.off()
    printOKMessage("      Volcano plot .......................... OK")
}

### Nombre: RunedgeR
### Autora: Leticia Vega Alvarado
### Fecha de creacion: 21/04/20
### Ultima actualizacion: 08/02/21
### Parametros:
###           - fnProgamsPath: Directorio donde se encuentran los programas fuentes necesarios. Es decir, las dependencias de este programa
###           - fnCountTable: data.frame con la tabla de conteos de un par de condiciones, con o sin replicas
###           - fnOutputPath: Directorio donde se guardaran los resultados del análisis con edgeR
###           - TOP: Valor logico que indica si se obtendrán los genes TOP
###           - fnUmbral: Valor de corte para el FDR
###           - fnUmbralFoldChange: Valor de corte para el Log2FC.
###           - fnSmearPlot: Valor logico que indica si se realizará la grafica de Smear
###           - fnVolcanoPlot: Valor logico que indica si se realizará la grafica de Volcano
###           - fnBatch: Vector de valores numericos indicando el numero de lote por muestra. Por defecto es vacio
###           - fnConditions: vector que contiene los nombres de las condiciones a comparar
### Valores de regreso:
###           - fnTopName: Vector con los identificadores de los genes DE
### Descripcion: Funcion Principal que se encarga de hacer el analisis de ED para una tabla de conteos determinada, usando el metodo edgeR
RunedgeR<-function(fnProgamsPath,fnCountTable,fnOutputPath,TOP=FALSE,fnUmbral=0.01,fnUmbralFoldChange=1,fnSmearPlot=TRUE,fnVolcanoPlot=TRUE,fnBatch=c(),fnConditions)
{
   print("*************************  Running edgeR  *************************")
   fnMethodToPrint<-paste("RunedgeR(",fnProgamsPath,",fnCounTable,",fnOutputPath,",TOP=",TOP,",fnUmbral=",fnUmbral,",fnUmbralFoldChange=",fnUmbralFoldChange,",fnSmearPlot=",fnSmearPlot,",fnVolcanoPlot=",fnVolcanoPlot,",fnBatch=(",paste(fnBatch,collapse=",",sep=""),"), fnConditions=c(",fnConditions[1],",",fnConditions[2],")",")",collapse="",sep="")
   print(fnMethodToPrint)
   if(!exists("loadPkgValidate", mode="function")) source(paste(fnProgamsPath,"/RunInstallloadValidatePkg.r",collapse="",sep = ""))
   fnTopName<-NULL
   fnMethods<-c("printOKMessage","printToFile","printMDS")
   fnSource<-c("RunPrintMessage.r","CommonFunctions.r","CommonGraphics.r")
   loadScripts(fnProgamsPath,fnMethods,fnSource)
   fnPks<-c("edgeR","ggplot2")
   fnRequierePkgs<-loadPkgValidate(fnPks)

   if("edgeR" %in% fnRequierePkgs$fnLoaded)
   {
       ####  Inicializacion de variables
       fnSamplesName=factor(sub("_[a-zA-Z0-9]+$","",colnames(fnCountTable)))
       fnConditionsNames<-paste(fnConditions[1],"vs",fnConditions[2],collapse="",sep = "")
       fnFileName<-paste(fnOutputPath,"/",fnConditionsNames,collapse="",sep = "")
       print("############")
       print(paste("Samples: ",fnConditionsNames))
       print("############")

       ### Composición del objeto DGEList
       fnDge<-try(edgeR::DGEList(counts=fnCountTable, group=fnSamplesName),silent=TRUE)
       if(!(is(fnDge,"try-error")))
       {
           printOKMessage("      Objeto DGEList .......................... OK")
           ####  Normalizacion de los datos
           fnDge=edgeR::calcNormFactors(fnDge, method = "TMM")
           printOKMessage("      Normalizacion .......................... OK")
           fnEt<-diffExpedgeR(fnDge,fnConditions,fnSamplesName,fnFileName,fnBatch,fnConditionsNames)
           ####  Obtencion de la tabla de resultados
           fnTables<-list(fnDeTab=topTags(fnEt,n=Inf)$table,RawCounts=data.frame(fnDge$counts[,]), NormalizedCounts=data.frame(edgeR::cpm(fnDge,normalized.lib.size=T)))
           fnDeTab<-resulTable(fnTables,fnFileName,fnUmbralFoldChange,fnUmbral,c("FDR","logFC"),fnConditions)
           ####  Guardado de los datos en archivo
           fnTopName<-printToFile(fnDeTab,fnFileName,TOP=TOP,c(logFC="logFC",pval="FDR",expression="NonDE"))
           if("ggplot2" %in% fnRequierePkgs$fnLoaded)
           {
               ####  Grafica de agrupamiento de los datos
               printMDS(fnDge,fnFileName,fnBatch=fnBatch,fnTitle=paste("MDS Plot",fnConditionsNames),fnTextAnnSize=3,fnCorrection=FALSE)
               if(length(fnBatch))
               {
                   printMDS(fnDge,paste(fnFileName,"_RemovedBatch",sep="",collapse=""),fnBatch=fnBatch,fnTitle=paste("Removed Batch MDS Plot",fnConditionsNames),fnTextAnnSize=3,fnCorrection=TRUE)
               }
               if(length(fnTopName)>0)
               {
                   ####  Generando la grafica de Smear
                   callSmearPlot(fnDeTab,fnFileName,fnUmbral,fnUmbralFoldChange,fnConditionsNames)
                   ####  Generando la grafica de Volcano
                   callVolcanoPlot(fnDeTab[,c("FDR","logFC","Expression")],fnFileName,fnUmbral,fnUmbralFoldChange,fnConditionsNames)
               }
               else{
                   printOKMessage("      Volcano and Smear were not generated .......................... No significantly ED genes were detected")
               }
           }
       }
       else{
           printErrorMessage("      Objeto DGEList .......................... Failed")
       }
   }
   else{
       printErrorMessage("      Load edgeR package .......................... Failed")
   }
   return(fnTopName)
}
