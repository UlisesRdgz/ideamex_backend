### Copyright (c) 2025 [Leticia Vega Alvarado]
### 
### Este archivo forma parte del proyecto IDEAMEX.
### Licencia: Creative Commons Atribución-NoComercial 4.0 Internacional (CC BY-NC 4.0)
### Puede copiarse y modificarse libremente con fines no comerciales, siempre que se otorgue crédito al autor original.
### Más información: https://creativecommons.org/licenses/by-nc/4.0/deed.es
###

#!/usr/local/bin/Rscript

# La línea de abajo es para que no se imprima el archivo log que genera la función venn.plot
futile.logger::flog.threshold(futile.logger::ERROR, name = "VennDiagramLogger")

### Nombre: IntersectionSummary
### Autora: Leticia Vega Alvarado
### Fecha de creacion: 25/05/18
### Ultima actualizacion: 01/10/20
### Parametros:
###           - fnIntersectionTable: Tabla de ceros y unos con los genes identificados cada método
###           - fnFileName: Nombre del archivo donde se guardan los resultados
### Valores de regreso:
###           - fnMatrix: Matriz con los resultados de la interseccion entre los diferentes conjutos
### Descripcion: Funcion que sirve para calcular el numero de genes identificados por cada metodo
IntersectionSummary<-function(fnIntersectionTable,fnFileName)
{
    fnAllTableSumm<-vennCounts(fnIntersectionTable)
    fnAllTableSumm<-fnAllTableSumm[seq(nrow(fnAllTableSumm),1),]
    fnColSumm<-as.integer(colSums(fnIntersectionTable))
    fnWeightMatrix<-matrix(0,nrow=nrow(fnAllTableSumm)-1,ncol=ncol(fnAllTableSumm)-1)
    fnMatrix<-sweep(fnAllTableSumm[c(seq(nrow(fnAllTableSumm)-1)),c(seq(ncol(fnAllTableSumm)-1))],MARGIN=1,fnAllTableSumm[c(seq(nrow(fnAllTableSumm)-1)),ncol(fnAllTableSumm)],'*')
    fnMatrix<-sweep(fnMatrix,MARGIN=2,fnColSumm,'/')
    fnColSumm<-c(fnColSumm,sum(fnColSumm))
    fnAllTableSumm["1",]<-fnColSumm
    write.table(fnAllTableSumm,file=fnFileName,sep="\t",quote=FALSE,row.names=F)
    return(fnMatrix)
}

### Nombre: VennDiag
### Autora: Leticia Vega Alvarado
### Fecha de creacion: 25/05/18
### Ultima actualizacion: 30/09/20
### Parametros:
###           - fnSetList: Lista de vectores, con los identificadores de los genes DE, por metodo
###           - fnOutputPath: Path de Salida en donde se guardaran los resultados
###           - fnOutputFileName: Nombre del archivo de salida en donde se guardaran los resultados
### Valores de regreso:
###           - fnDataForVenn: Lista con los genes DE, por cada metodo
### Descripcion: Esta funcion sirve para graficar en un diagrama de Venn la interseccion de los genes DE detectados por cada metodo
### Return: La funcion regresa un data.frame
VennDiag<-function(fnSetList,fnOutputPath,fnOutputFileName)
{
    print("*************************  Running Venn Diagram  *******************")
    fnMethodToPrint<-paste("VennDiag(fnSetList,",fnOutputPath,",",fnOutputFileName,")",collapse="",sep="")
    
    if(length(unlist(fnSetList)>0))
    {
       fnColor<-c("yellow","red","#56B4E9","green","purple","orchid3")
       fnOutputFileNameVenn<-paste(fnOutputPath,"/",fnOutputFileName,"_venndiagram",collapse="",sep = "")
       if(is.null(names(fnSetList))){
           names(fnSetList)<-paste("Set",1:length(fnSetList),sep="")}
       fnDataForVenn<-Filter(length,fnSetList)
       fnDataForVenn<-fnDataForVenn[names(sort(sapply(fnDataForVenn,length)))]
       ven.plot<-venn.diagram(fnDataForVenn,fill = fnColor[1:length(fnDataForVenn)],alpha =rep(0.5,length(fnDataForVenn)), cex = 2,cat.fontface = 4,lty =1,filename=NULL,main="",sub=fnOutputFileName,euler.d=TRUE,scaled=TRUE,main.fontface=0,sub.fontface=1,sep.dist=0,offset=0.7)
       pdf(paste(fnOutputFileNameVenn,".pdf",collapse="",sep = ""))
       grid.draw(ven.plot)
       dev.off()
       return(fnDataForVenn)
    }
}

### Nombre: UpSetPlot
### Autora: Leticia Vega Alvarado
### Fecha de creacion: 17/Noviembre/2020
### Ultima actualizacion: 17/Noviembre/2020
### Parametros:
###           - fnSetList: Lista de vectores, con los identificadores de los genes DE, por metodo
###           - fnOutputPath: Path de Salida en donde se guardaran los resultados
###           - fnOutputFileName: Nombre del archivo de salida en donde se guardaran los resultados
### Descripcion: Funcion que sirve para mostrar en una grafica upset la interseccion de los genes DE detectados por cada metodo
UpSetPlot<-function(fnSetList,fnOutputPath,fnOutputFileName)
{
    print("*************************  Running UpSetPlot  *******************")
    fnMethodToPrint<-paste("UpSetPlot(fnSetList,",fnOutputPath,",",fnOutputFileName,")",collapse="",sep="")
    fnColor<-c("yellow","red","#56B4E9","green","purple","orchid3")
    
    if(length(names(fnSetList))>1 & length(unlist(fnSetList)>0))
    {
        fnOutputFileNameUpSet<-paste(fnOutputPath,"/",fnOutputFileName,"_upsetplot",collapse="",sep = "")
        if(is.null(names(fnSetList))){
            names(fnSetList)<-paste("Set",1:length(fnSetList),sep="")}
        fnDE_gns<-Filter(length,fnSetList)
        fnDE_gns <- UpSetR::fromList(fnDE_gns)
        pdf(paste(fnOutputFileNameUpSet,".pdf",collapse="",sep=""),onefile=FALSE)
        print(UpSetR::upset(fnDE_gns,order.by = "freq",sets.bar.color = rev(fnColor[1:length(fnDE_gns)]) ))
        grid.text(fnOutputFileName,x = 0.65,y = 0.95,gp = gpar(fontsize = 12))
        graphics.off()
    }
}

### Nombre: printIntersection2File
### Autora: Leticia Vega Alvarado
### Fecha de creacion: 17/Noviembre/2020
### Ultima actualizacion: 17/Noviembre/2020
### Parametros:
###           - fnResVenn: Tabla de ceros y unos con los genes identificados cada método
###           - fnOutputPath: Path de salida donde se colocan los resultados
###           - fnOutputFileName: Nombre del archivo de resultados
### Descripcion: Funcion que sirve para generar los diagramas de Venn de diversos conjuntos de datos
printIntersection2File<-function(fnResVenn,fnOutputPath,fnOutputFileName)
{
    fnOutputFileNameIntersect<-paste(fnOutputPath,"/",fnOutputFileName,collapse="",sep = "")
    fnUniverse<-sort(unique(unlist(fnResVenn)))
    fnSetNames<-names(fnResVenn)
    fnTableInters<- matrix(0, nrow=length(fnUniverse), ncol=length(fnSetNames))
    rownames(fnTableInters)<-fnUniverse
    colnames(fnTableInters) <- fnSetNames
    for(i in fnSetNames){
        fnTableInters[fnResVenn[[i]],i] <- 1}
    fnTableInters<-fnTableInters[order(rowSums(fnTableInters),decreasing=TRUE),,drop=FALSE]
    if(length(names(fnResVenn))>1)
    {
        fnMethodWeightMatrix<-IntersectionSummary(fnTableInters,paste(fnOutputFileNameIntersect,"_intersectSummary.txt",collapse="",sep = ""))
        write.table(fnMethodWeightMatrix,file=paste(fnOutputFileNameIntersect,"_matrixWeight.txt",collapse="",sep = ""),row.names=F, sep="\t",quote=FALSE)
    }
    fnTableInters<-cbind(ID=row.names(fnTableInters),fnTableInters)
    write.table(fnTableInters, file=paste(fnOutputFileNameIntersect,"_table.txt",collapse="",sep = ""), sep="\t",quote=FALSE,row.names=FALSE)
}

### Nombre: getInfoFromFile
### Autora: Leticia Vega Alvarado
### Fecha de creacion: 17/Noviembre/2020
### Ultima actualizacion: 30/Noviembre/2020
### Parametros:
###           - fnOutputPath: Path raiz, es decir, donde se generaron todas las carpetas de resultados de ED
###           - fnDEMethods: Vector con los metodos donde se obtuvieron resultados de ED
###           - fnFileName: Nombre del archivo donde se guardaran los resultados
### Descripcion: Funcion que sirve para generar los archivos Intersect, que contienen la informacion de ED por metodo,
###              de los genes que se encuentran en la interseccion. Tambien genera los archivos con los identificadores
###              de los genes que se encuentran en la interseccion y los que se encuentran en la union. Estos archivos
###              seran utilizados posteriormente para hacer los heatmaps, tanto de la interseccion como la union.
###              para realizar el análisis de ED.
putInfoToFile<-function(fnOutputPath,fnDEMethods,fnFileName)
{
    fnVennFileName<-paste(fnOutputPath,"/Integration_Results/",fnFileName,"/",fnFileName,"_table.txt",collapse="",sep = "")
    fnVennTable<-read.table(fnVennFileName,header=T,row.names=1,sep="\t")
    fnTop<-row.names(fnVennTable[rowSums(fnVennTable)==length(fnDEMethods),,drop=FALSE])
    for(i in fnDEMethods)
    {
        fnFileMethod<-paste(fnOutputPath,"/",i,"_Results/",fnFileName,"/",fnFileName,".txt",collapse="",sep = "")
        fnTableMethod<-read.table(fnFileMethod,header=T,row.names=1,sep="\t")
        write.table(cbind(ID=row.names(fnTableMethod[fnTop,]),fnTableMethod[fnTop,]), file=paste(fnOutputPath,"/",i,"_Results/",fnFileName,"/",fnFileName,"_intersect.txt",collapse="",sep = ""), sep="\t",quote=FALSE,row.names=FALSE)
        #write.table(fnTableMethod[fnTop,],paste(fnOutputPath,"/",i,"_Results/",fnFileName,"/",fnFileName,"_Intersect.txt",collapse="",sep = ""),sep="\t",quote=F,col.names=T,row.names=T)
    }
    write(fnTop,file=paste(fnOutputPath,"/Integration_Results/",fnFileName,"/",fnFileName,"_intesrsect_TOP_IDs.txt",collapse="",sep = ""))
    write(row.names(fnVennTable),file=paste(fnOutputPath,"/Integration_Results/",fnFileName,"/",fnFileName,"_union_TOP_IDs.txt",collapse="",sep = ""))
}

### Nombre: IntegrationResults
### Autora: Leticia Vega Alvarado
### Fecha de creacion: 17/Noviembre/2020
### Ultima actualizacion: 04/Diciembre/2020
### Parametros:
###           - fnProgamsPath: Directorio donde se encuentran los programas fuentes
###           - fnSetList: Lista de vectores, con los identificadores de los genes DE, por metodo
###           - fnOutputPath: Path donde se almacenaran los archivos resultantes
###           - fnOutputFileName: Nombre de los archivos de salida
###           - fnCorrPlot: Valor booleano que indica si se graficaran los correlogramas
### Descripcion: Esta es la función principal que manda a llamar a diferentes funciones que permiten integrar los
###              resultados de la expresion diferencial. Las funciones que se llaman permiten hacer el diagrama de
###              Venn, la grafica upset, los correlogramas y la generacion de archivos y tablas
RunIntegration<-function(fnProgamsPath,fnSetList,fnOutputPath,fnOutputFileName,fnCorrPlot=TRUE)
{
    cat("*********************\n<INTEGRATION RESULTS>\n*********************","\n")
    ####  Cargando los programas y paquetes necesarios
    if(!exists("loadPkgValidate", mode="function")) source(paste(fnProgamsPath,"/RunInstallloadValidatePkg.r",collapse="",sep = ""))
    fnMethods<-c("printOKMessage","callCorrelation","doHeatmaps")
    fnSource<-c("RunPrintMessage.r","RunCorrelation.r","HeatmapPlots.r")
    loadScripts(fnProgamsPath,fnMethods,fnSource)
    fnPks<-c("VennDiagram","limma","UpSetR","ggplot2","grDevices","grid")
    fnRequierePkgs<-loadPkgValidate(fnPks)
    
    if(length(unlist(fnSetList$genED)>0))
    {
        if("VennDiagram" %in% fnRequierePkgs$fnLoaded)
        {
            fnResVenData<-try(VennDiag(fnSetList$genED,paste(fnOutputPath,"/Integration_Results/",fnOutputFileName,collapse="",sep = ""),fnOutputFileName),silent=TRUE)
            if(!(is(fnResVenData,"try-error"))){printOKMessage("      VennDiagram .......................... OK")}
            else{printErrorMessage("      VennDiagram plot .......................... Failed")}
            
        }
        if("UpSetR" %in% fnRequierePkgs$fnLoaded)
        {
            
            if(is(try(UpSetPlot(fnSetList$genED,paste(fnOutputPath,"/Integration_Results/",fnOutputFileName,collapse="",sep = ""),fnOutputFileName),silent=TRUE),"try-error")){
                printErrorMessage(paste("    Upset Plot","    .......................... Failed"))
            }
            else{
                printOKMessage("      Upset plot .......................... OK")}
            #UpSetPlot(fnSetList$genED,paste(fnOutputPath,"/Integration_Results/",fnOutputFileName,collapse="",sep = ""),fnOutputFileName)
        }
        print("*************************  Print info to file  *******************")
        if(is(try(printIntersection2File(fnResVenData,paste(fnOutputPath,"/Integration_Results/",fnOutputFileName,collapse="",sep = ""),fnOutputFileName),silent=TRUE),"try-error")){
            printErrorMessage(paste("    Print intersection info to file","    .......................... Failed"))
        }
        else{
            printOKMessage("      Print intersection info to file .......................... OK")}
        if(is(try(putInfoToFile(fnOutputPath,fnSetList$methodED,fnOutputFileName),silent=TRUE),"try-error")){
            printErrorMessage(paste("    Print TOP intersection info to file","    .......................... Failed"))
        }
        else{
            printOKMessage("      Print TOP intersection info to file .......................... OK")}
        
        
        doHeatmaps(fnProgamsPath,fnOutputPath,fnSetList$filterTable,fnOutputFileName)
        if(fnCorrPlot)
        {
            callCorrelation(fnProgamsPath,fnOutputPath,fnSetList$methodED,fnOutputFileName,fnSetList$genED)
        }
        
    }
}
