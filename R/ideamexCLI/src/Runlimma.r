### Copyright (c) 2025 [Leticia Vega Alvarado]
### 
### Este archivo forma parte del proyecto IDEAMEX.
### Licencia: Creative Commons Atribución-NoComercial 4.0 Internacional (CC BY-NC 4.0)
### Puede copiarse y modificarse libremente con fines no comerciales, siempre que se otorgue crédito al autor original.
### Más información: https://creativecommons.org/licenses/by-nc/4.0/deed.es
###

#!/usr/local/bin/Rscript

### Nombre: buildlimmaDataObjet
### Autora: Leticia Vega Alvarado
### Fecha de creacion: 20/05/20
### Ultima actualizacion: 20/05/20
### Parametros:
###           - fnSamplesName: Vector con los nombres de los experimentos
###           - fnBatch: Vector de valores numericos indicando el numero de lote por muestra. Por defecto es vacio
###           - fnConditions: Vector que contiene los nombres de la condicion a la que pertenece cada experimento
### Valores de regreso:
###           - fnDesign: Objeto propio de limma, el diseño experimental (nombres de experimentos y condicion asociada)
### Descripcion: Funcion que permite generar el diseño experimental
buildLimmaDesign<-function(fnSamplesName,fnBatch,fnConditions)
{
    if(length(fnBatch))
    {
        fnBatch<-factor(fnBatch)
        fnDesign<-model.matrix(~fnBatch+fnSamplesName)
        print("      Batch effect .......................... OK")
    }
    else{
        fnDesign <- model.matrix (~ fnSamplesName)
    }
    rownames(fnDesign) <- fnConditions
    return(fnDesign)
}

### Nombre: Runlimma
### Autora: Leticia Vega Alvarado
### Fecha de creacion: 20/05/20
### Ultima actualizacion: 22/06/23
### Parametros:
###           - fnProgamsPath: Directorio donde se encuentran los programas fuentes necesarios. Es decir, las dependencias de este programa
###           - fnCountTable: data.frame con la tabla de conteos de un par de condiciones, con o sin replicas
###           - fnOutputPath: Directorio donde se guardaran los resultados del análisis con limma
###           - TOP: Valor logico que indica si se obtendrán los genes TOP
###           - fnUmbral: Valor de corte para el FDR
###           - fnUmbralFoldChange: Valor de corte para el Log2FC.
###           - fnMDPlo: Valor logico que indica si se realizará la grafica MDS
###           - fnBatch: Vector de valores numericos indicando el numero de lote por muestra. Por defecto es vacio
###           - fnConditions: vector que contiene los nombres de las condiciones a comparar
### Valores de regreso:
###           - fnTopName: Vector con los identificadores de los genes DE
### Descripcion: Funcion Principal que se encarga de hacer el analisis de ED para una tabla de conteos determinada, usando el metodo limma
Runlimma<- function(fnProgamsPath,fnCountTable,fnOutputPath,TOP=FALSE,fnUmbral=0.01,fnUmbralFoldChange=1,fnMDPlot=TRUE,fnBatch=c(),fnConditions)
{
   print("*************************  Running limma-Voom  *************************")
   fnMethodToPrint<-paste("Runlimma(",fnProgamsPath,",fnCounTable,",fnOutputPath,",TOP=",TOP,",fnUmbral=",fnUmbral,",fnUmbralFoldChange=",fnUmbralFoldChange,",fnMDPlot=",fnMDPlot,",fnBatch=(",paste(fnBatch,collapse=",",sep=""),")",",fnConditions=c(",fnConditions[1],",",fnConditions[2],")",")",collapse="",sep="")
   print(fnMethodToPrint)
   if(!exists("loadPkgValidate", mode="function")) source(paste(fnProgamsPath,"/RunInstallloadValidatePkg.r",collapse="",sep = ""))
   fnTopName<-NULL
   fnMethods<-c("printOKMessage","printToFile","printMDS")
   fnSource<-c("RunPrintMessage.r","CommonFunctions.r","CommonGraphics.r")
   loadScripts(fnProgamsPath,fnMethods,fnSource)
   fnPks<-c("limma","ggplot2")
   fnRequierePkgs<-loadPkgValidate(fnPks)

   if("limma" %in% fnRequierePkgs$fnLoaded)
   {
       ####  Inicializacion de variables
       fnSamplesName=factor(sub("_[a-zA-Z0-9]+$","",colnames(fnCountTable)),levels=c(fnConditions[1],fnConditions[2]))
       fnConditionsNames<-paste(fnConditions[1],"vs",fnConditions[2],collapse="",sep = "")
       fnFileName<-paste(fnOutputPath,"/",fnConditionsNames,collapse="",sep = "")
       print("############")
       print(paste("Samples: ",fnConditionsNames))
       print("############")

       fnReplicates<-summary(fnSamplesName) > 1
       if(all(fnReplicates))
       {
           ### Composición del objeto DGEList
           fnDge<-try(DGEList(counts=fnCountTable, group=fnSamplesName),silent=TRUE)
           if(!(is(fnDge,"try-error")))
           {
               printOKMessage("      Objeto DGEList .......................... OK")

               ####  Normalizacion de los datos
               fnDge=calcNormFactors(fnDge)
               printOKMessage("      Normalizacion .......................... OK")
               ####  Grafica de agrupamiento de los datos
               printMDS(fnDge,fnFileName,fnBatch=fnBatch,fnTitle=paste("MDS Plot",fnConditionsNames),fnTextAnnSize=3,fnCorrection=FALSE)
               if(length(fnBatch))
               {
                   printMDS(fnDge,paste(fnFileName,"_RemovedBatch",sep="",collapse=""),fnBatch=fnBatch,fnTitle=paste("Removed Batch MDS Plot",fnConditionsNames),fnTextAnnSize=3,fnCorrection=TRUE)
               }
               fnDesign<-buildLimmaDesign(fnSamplesName,fnBatch,names(fnCountTable))
               fnVoomTransformed <- voom(fnDge, fnDesign, plot = FALSE)
               printOKMessage("      Voom transform .......................... OK")
               ####  Ajustar un modelo lineal para cada gen.
               fnVoomedFitted <- lmFit ( fnVoomTransformed , design = fnDesign )
               printOKMessage("      lmfit estimation .......................... OK")
               ####  Calcular estadísticas t moderadas, estadísticas F moderadas y registro - probabilidades de expresión diferencial
               fnVoomedFitted <- eBayes(fnVoomedFitted)
               printOKMessage("      Differential expression estimation.......................... OK")
   
               ####  Obtencion de la tabla de resultados
               fnVoomTab=topTable(fnVoomedFitted, coef = paste("fnSamplesName",fnConditions[2],sep="",collapse=""), number = Inf , adjust.method = "BH")
               fnTables<-list(fnDeTab=fnVoomTab[order(row.names(fnVoomTab)),],RawCounts=data.frame(fnDge$counts[,]), NormalizedCounts=data.frame(edgeR::cpm(fnDge,normalized.lib.size=T)))
               fnDETab<-resulTable(fnTables,fnFileName,fnUmbralFoldChange,fnUmbral,c("adj.P.Val","logFC"),c(fnConditions[1],fnConditions[2]))
               ####  Guardado de los datos en archivo
               fnTopName<-printToFile(fnDETab,fnFileName,TOP=TOP,c(logFC="logFC",pval="adj.P.Val",expression="NonDE"))
               ####  Generando la grafica MD
               if(fnMDPlot)
               {
                   if(length(fnTopName) > 0)
                   {
                      fnMaxValY<-as.integer(max(abs(fnDETab$logFC)))
                      if(fnMaxValY%%2){fnMaxValY=fnMaxValY+1}
                      fnBreaksY<-unique(sort(c(seq(-fnMaxValY,fnMaxValY,2),-fnUmbralFoldChange,fnUmbralFoldChange)))
                       fnUp<-grepl('^Down', fnDETab$Expression)
                       fnDown<-grepl('^Up', fnDETab$Expression)
                       fnDETab$Regulation<-fnDETab$Expression # Antes fnDETab$Expression
                       fnDETab[fnUp,"Regulation"]<-"Up"  #antes "Up"
                       fnDETab[fnDown,"Regulation"]<- "Down" #antes "Down"
                       fnPlotFileName<-paste(fnFileName,"_plotMD",collapse="",sep = "")
                       pdf(paste(fnPlotFileName,".pdf",collapse="",sep=""))
                       fnMyMDPlot<-ggplot(fnDETab, aes_string(x = "AveExpr", y = "logFC", colour = "Regulation")) +
                          geom_point(size=1) + 
                          theme_bw() +
                          theme(plot.title = element_text(size=16, hjust=0.5),legend.title = element_blank()) +
                          labs(title=paste("MD plot ",gsub("vs"," vs ",fnConditionsNames)),y=bquote(log[2] ~ "Fold Change"),x="Average log-expression") +
                          scale_y_continuous(breaks=fnBreaksY) +
                          scale_color_manual(breaks = c("Down", "NonDE","Up"),values=c("red3", "black", "forestgreen")) +
                          geom_hline(yintercept=-fnUmbralFoldChange, linetype="dashed", color = "blue",size=0.75) +
                          geom_hline(yintercept=fnUmbralFoldChange, linetype="dashed", color = "blue",size=0.75)
                       print(fnMyMDPlot)
                       graphics.off()
                       printOKMessage("      MD plot .......................... OK")
                   }
                   else{
                       printOKMessage("      MD Plot was not generated .......................... No significantly ED genes were detected")
                   }
               }
           }
           else{
               printErrorMessage("      Objeto DGEList .......................... Failed")
           }
       }
       else{
           printErrorMessage("      Limma (no replicates) .......................... Failed")
       }
   }
   else{
       printErrorMessage("      Load Limma package .......................... Failed")
   }
   return(fnTopName)
}
