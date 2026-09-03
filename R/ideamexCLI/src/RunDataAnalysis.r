### Copyright (c) 2025 [Leticia Vega Alvarado]
### 
### Este archivo forma parte del proyecto IDEAMEX.
### Licencia: Creative Commons Atribución-NoComercial 4.0 Internacional (CC BY-NC 4.0)
### Puede copiarse y modificarse libremente con fines no comerciales, siempre que se otorgue crédito al autor original.
### Más información: https://creativecommons.org/licenses/by-nc/4.0/deed.es
###

#!/usr/local/bin/Rscript

### Nombre: callMDS
### Autora: Leticia Vega Alvarado
### Fecha de creacion: 11/03/20
### Ultima actualizacion: 12/03/20
### Parametros:
###           - fnTable: data.frame con las abundancias
###           - fnCondition: vector de condiciones, sin número de replica, por ejemplo ("Ctrl","Ctrl","Ctrl","Trat","Trat","Trat")
###           - fnBatch: vector, con la información de efecto de lote
### Valores de regreso:
###           - fnPlot: Objeto de tipo grafica
### Descripcion: Funcion que hace la grafica MDS
callMDS<-function(fnTable,fnCondition,fnBatch=c(),fnTitle="Global MDS Plot",fnCorrection=FALSE,fnTextAnnSize=3)
{
    fnDge<-DGEList(counts=fnTable, group=factor(fnCondition))
    fnDge=calcNormFactors(fnDge)
    fnLogCPM <- cpm(fnDge, log=TRUE, prior.count=5)
    fnColors=as.numeric(fnDge$samples$group)+1
    if(fnCorrection)
    {
        fnLogCPM <- removeBatchEffect(fnLogCPM, batch=fnBatch)
    }
    fnDataPlot<-plotMDS(fnLogCPM,col=fnColors,main=fnTitle,plot = FALSE)
    fnDataPlotDF<-data.frame(fnX=fnDataPlot$x,fnY=fnDataPlot$y,fnNames=names(fnDataPlot$x),fnCondition=fnCondition)
    fnPlot<-ggplot(fnDataPlotDF,aes(fnX,fnY,color=fnCondition)) +
                   geom_point() +
                   theme_bw() +
                   ggtitle(fnTitle) +
                   theme(plot.title = element_text(size=10, hjust=0.5),legend.position = "none",legend.title = element_blank(), panel.grid.minor = element_blank()) +
                   xlab(bquote("Leading" ~ log[2] ~ "Fold Change dim 1")) +
                   ylab(bquote("Leading" ~ log[2] ~ "Fold Change dim 2")) +
                   geom_text(aes(label=fnNames),vjust=-0.5,size=fnTextAnnSize,show.legend = F)
    return(fnPlot)
}

### Nombre: callPCA
### Autora: Leticia Vega Alvarado
### Fecha de creacion: 11/03/20
### Ultima actualizacion: 28/01/21
### Parametros: Funcion para generar la grafica de PCA
###           - fnTable: data.frame con las abundancias
###           - fnCondition: vector de condiciones, sin número de replica, por ejemplo ("Ctrl","Ctrl","Ctrl","Trat","Trat","Trat")
###           - fnBatch: vector, con la información de efecto de lote
### Valores de regreso:
###           - fnPlot: Objeto de tipo grafica
### Descripcion: Funcion que sirve
callPCA<-function(fnTable,fnCondition,fnBatch=c(),fnTitle="Global PCA Plot",fnCorrection=FALSE,fnTextAnnSize=3)
{
    fnPlot=NULL
    fnColData<-data.frame(condition=factor(fnCondition),row.names=colnames(fnTable))
    if(length(fnBatch)){
        fnColData$fnBatch<-factor(fnBatch)
        fnDds <- try(DESeqDataSetFromMatrix(countData = as.matrix(fnTable),colData = fnColData,design = ~ fnBatch + condition),silent=TRUE)
    }
    else{
        fnDds <- try(DESeqDataSetFromMatrix(countData = as.matrix(fnTable),colData = fnColData,design = ~ condition),silent=TRUE)
    }
    if(class(fnDds)!="try-error")
    {
        if( length(fnCondition)==length(levels(factor(fnCondition))) || length(fnCondition) >= 20 ){ #
            fnVsd<-try(vst(fnDds,blind=TRUE,fitType = "local"),silent=TRUE)
        }else{fnVsd<-rlogTransformation(fnDds,blind=FALSE,fitType = "local")} #,fitType = "local",rlogTransformation(fnDds,blind=FALSE)
        if(fnCorrection){
            fnRemBatch<-assay(fnVsd)
            fnRemBatch <- limma::removeBatchEffect(fnRemBatch, fnVsd$fnBatch)
            assay(fnVsd) <- fnRemBatch }
        fnPlot<-plotPCA(fnVsd,intgroup="condition") +
                theme_bw() +
                ggtitle(fnTitle) +
                theme(plot.title = element_text(size=10, hjust=0.5), legend.title = element_blank(), panel.grid.minor = element_blank()) +
                geom_text(aes(label=colnames(fnVsd)), vjust=-0.5,size=fnTextAnnSize)
    }
    return(fnPlot)
}

### Nombre: printPCAorMDSPlot
### Autora: Leticia Vega Alvarado
### Fecha de creacion: 11/03/20
### Ultima actualizacion: 11/03/20
### Parametros:
###           - fnTable: data.frame con las abundancias
###           - fnCondition: vector de condiciones, sin número de replica, por ejemplo ("Ctrl","Ctrl","Ctrl","Trat","Trat","Trat")
###           - fnBatch: vector, con la información de efecto de lote
### Descripcion: Funcion que manda a graficar la MDS o la PCA. Esta funcion llama a las funciones callPCA y callMDS.
printPCAorMDSPlot<-function(fnTable,fnPlotFileName,fnCondition,fnPlotMethod,fnBatch=c())
{
    pdf(paste(fnPlotFileName,".pdf",collapse="",sep=""),onefile=FALSE)
    fnPlotList<-list()
    fnLegend="right"
    i=0
    fnTitle=paste("Global",fnPlotMethod,"plot",collapse="",sep = " ")
    fnMethod<-paste("call",fnPlotMethod,"(fnTable,fnCondition,fnBatch)",collapse="",sep = "")
    fnPlot<-try(eval(parse(text=fnMethod)),silent=TRUE)
    if((class(fnPlot)[1]!="try-error"))
    {
        i=i+1
        fnPlotList[[i]]<-fnPlot
    }
    else{
        printErrorMessage(paste(" ",fnPlotMethod,"  .......................... Failed"),as.character(attr(fnPlot,"condition")))
    }
    if(length(fnBatch))
    {
        fnTitle=paste(fnTitle,"\n with batch variation removed",collapse="",sep="")
        fnCorrection=TRUE
        fnMethod<-paste("call",fnPlotMethod,"(fnTable,fnCondition,fnBatch,fnTitle,fnCorrection)",collapse="",sep = "")
        fnPlot<-try(eval(parse(text=fnMethod)),silent=TRUE)
        if(class(fnPlot)[1]!="try-error")
        {
            i=i+1
            fnPlotList[[i]]<-fnPlot
        }
        else{
            printErrorMessage(paste(" ",fnPlotMethod,"  .......................... Failed"),as.character(attr(fnPlot,"condition")))
        }
    }
    print( ggarrange(plotlist=fnPlotList, common.legend = TRUE, legend = fnLegend, nrow=i, ncol=1) )
    graphics.off()
}

### Nombre: plotCPM
### Autora: Leticia Vega Alvarado
### Fecha de creacion: 25/05/2018
### Ultima actualizacion: 15/03/20
### Parametros:
###           - fnTable: data.frame con las abundancias
###           - fnCondition: vector de condiciones, sin número de replica, por ejemplo ("Ctrl","Ctrl","Ctrl","Trat","Trat","Trat")
###           - fnBatch: vector, con la información de efecto de lote
### Descripcion: Funcion que se encarga de realizar la grafica de barras para representar los conteos por millon por experimento
plotCPM<-function(fnTable,fnPlotFileName,fnLabelSize)
{
    fnCPMsTable = cpm(fnTable)
    fnCPMHistogram<-data.frame()
    fnCPMHistogram<- rbind(fnCPMHistogram,colSums(fnCPMsTable>10))
    fnCPMHistogram<- rbind(fnCPMHistogram,colSums(fnCPMsTable>5 & fnCPMsTable<= 10))
    fnCPMHistogram<- rbind(fnCPMHistogram,colSums(fnCPMsTable>=3 & fnCPMsTable<= 5))
    fnCPMHistogram<- rbind(fnCPMHistogram,colSums(fnCPMsTable>=2 & fnCPMsTable<3))
    fnCPMHistogram<- rbind(fnCPMHistogram,colSums(fnCPMsTable>=1 & fnCPMsTable<2))
    fnCPMHistogram<- rbind(fnCPMHistogram,colSums(fnCPMsTable < 1))
    names(fnCPMHistogram)<-colnames(fnCPMsTable)
    fnCPMHistogram<-fnCPMHistogram*100/nrow(fnTable)
    fnCPMHistogram$interval<-c("  CPM>10","  5< CPM <= 10","  2 < CPM <= 5","  CPM=2","  CPM=1","  CPM=0")
    fnCPMHistogram<-melt(fnCPMHistogram,id.vars="interval",variable.name = "Condition", value.name = "Genes")
    fnCPMHistogram<-fnCPMHistogram[rev(row.names(fnCPMHistogram)),]
    fnCPMHistogram<-transform(fnCPMHistogram, interval=factor(interval, levels=unique(interval)))
    pdf(paste(fnPlotFileName,".pdf",collapse="",sep=""))
    print(ggplot(fnCPMHistogram, aes(x=Condition,y=Genes,fill=interval)) + scale_fill_manual(values=c("#9ACD32","#FF00FF","#FF8C00","#1E90FF","#B22222","#BEBEBE")) + geom_bar(stat="identity",position="stack",color="black") + ggtitle("Global Counts Per Million") +
        theme_bw() +
        theme(plot.title = element_text(size=10, hjust=0.5),panel.grid.major = element_blank(), panel.grid.minor = element_blank(),legend.title=element_blank(),axis.title.x=element_blank(),axis.text.x = element_text(size=fnLabelSize,angle=90,hjust=1.5,vjust=0.5), axis.ticks.x = element_blank()) +ylab("%  genes") )
    graphics.off()
}

### Nombre: callBoxPlo
### Autora: Leticia Vega Alvarado
### Fecha de creacion: 25/05/2018
### Ultima actualizacion: 15/03/20
### Parametros:
###           - fnTable: data.frame con las abundancias
###           - fnCondition: vector de condiciones, sin número de replica, por ejemplo ("Ctrl","Ctrl","Ctrl","Trat","Trat","Trat")
###           - fnBatch: vector, con la información de efecto de lote
### Descripcion: Funcion que realiza la grafica de cajas y bigotes para representar la distribucion de los conteos por experimento
callBoxPlot<-function(fnTable,fnPlotFileName,fnCondition,fnYlab,fnLabelSize)
{
    fnTableMelt<-melt(fnTable,id.vars=NULL,variable.name="Samples",value.name="Counts")
    fnTableMelt$Condition<-sub("_[a-zA-Z0-9]+$","",fnTableMelt$Samples)
    pdf(paste(fnPlotFileName,".pdf",collapse="",sep=""))
    print( ggplot(fnTableMelt,aes(x=Samples,y=Counts,fill=Condition)) + geom_boxplot(outlier.shape=NA) +
        theme_bw() +
        coord_cartesian(ylim = quantile(fnTableMelt$Counts, c(0.1, 0.87))) +
        ggtitle("Global Boxplot of counts") +
        theme(plot.title = element_text(size=10, hjust=0.5),panel.grid.major = element_blank(), panel.grid.minor = element_blank(),legend.title=element_blank(),axis.title.x=element_blank(),axis.text.x = element_text(size=fnLabelSize,angle=90,hjust=1.5,vjust=0.5), axis.ticks.x = element_blank()) + ylab(fnYlab) )
    graphics.off()
}

### Nombre: callDensityPlot
### Autora: Leticia Vega Alvarado
### Fecha de creacion: 26/05/2018
### Ultima actualizacion: 15/03/20
### Parametros:
###           - fnTable: data.frame con las abundancias
###           - fnCondition: vector de condiciones, sin número de replica, por ejemplo ("Ctrl","Ctrl","Ctrl","Trat","Trat","Trat")
###           - fnBatch: vector, con la información de efecto de lote
### Descripcion: Funcion que realiza la grafica de densidad de los experimentos por condicion.
callDensityPlot<-function(fnTable,fnPlotFileName,fnLabelSize)
{
    fnSquareSize<-0.6
    if(ncol(fnTable) >= 40){ fnSquareSize<-0.3}
    fnDf = melt(fnTable,id.vars=NULL,variable.name="Samples",value.name="Counts")
    fnDf$Condition <- sub("_[a-zA-Z0-9]+$","",fnDf$Samples)
    pdf(paste(fnPlotFileName,".pdf",collapse="",sep=""))
    print(ggplot(fnDf, aes(x=Counts,colour = Samples, fill = Samples)) + ylim(c(0, 0.25)) + geom_density(alpha=0.3) +
        theme_bw() +
        ggtitle("Global Density plot of counts") +
        facet_wrap(~ Condition) +
        xlab(expression(log[2](count + 1))) +
        theme(plot.title = element_text(size=10, hjust=0.5), panel.grid.minor = element_blank(), legend.title = element_blank(),legend.text = element_text(size = fnLabelSize),legend.position="bottom",legend.key.size = unit(fnSquareSize, "cm"),strip.background = element_rect(fill="gray95")) +
        guides(col=guide_legend(ncol=8)) ) #azure3
    graphics.off()
}

### Nombre: dataAnalysis
### Autora: Leticia Vega Alvarado
### Fecha de creacion: 22/05/2018
### Ultima actualizacion: 28/01/21
### Parametros:
###           - fnTable: data.frame con las abundancias
###           - fnCondition: vector de condiciones, sin número de replica, por ejemplo ("Ctrl","Ctrl","Ctrl","Trat","Trat","Trat")
###           - fnBatch: vector, con la información de efecto de lote
### Descripcion: Funcion principal que se encarga de llamar a las funciones que se encargan de realizar todas las graficas
dataAnalysis<-function(fnSourcePath,fnCountTable,fnCondition,fnOutputPath,fnBatch)
{
   if(!exists("loadPkgValidate", mode="function")) source(paste(fnSourcePath,"/RunInstallloadValidatePkg.r",collapse="",sep=""))
   cat("*****************\n<DATA ANALYSIS>\n*****************","\n")
   fnMethodToPrint<-paste("dataAnalysis(",fnSourcePath,",fnCountTable,c(",paste(fnCondition,collapse=",",sep=""),"),",fnOutputPath,", fnBatch= c(",paste(fnBatch,collapse=",",sep=""),")", ")",collapse="",sep="")
   print(fnMethodToPrint)
   fnPkg<-c("ggplot2","DESeq2","edgeR","NOISeq","RColorBrewer","reshape2","limma","ggpubr")
   fnLoadedPkg<-loadPkgValidate(fnPkg)
   
   fnPseudoCountTable<-log2(fnCountTable + 1)
   fnExpDesign<-data.frame(fnSamples = colnames(fnCountTable),fnFactor =fnCondition)
   fnMyData<-readData( data=fnCountTable, factors=fnExpDesign)
   fnNormalizedCountTable<-data.frame(tmm(assayData(fnMyData)$exprs, k=0.5, lc = 0))
   fnNumofSam<-ncol(fnCountTable)
   fnLabelSize<-9
   if(fnNumofSam >= 40){fnLabelSize<-12-(fnNumofSam %/% 10)}
   
   fnMethods<-c("callBoxPlot(fnNormalizedCountTable,fnPlotFileName,fnCondition,\"TMM normalization\",fnLabelSize)","callDensityPlot(fnPseudoCountTable,fnPlotFileName,fnLabelSize)","plotCPM(fnCountTable,fnPlotFileName,fnLabelSize)","printPCAorMDSPlot(fnCountTable,fnPlotFileName,fnCondition,\"MDS\",fnBatch)","printPCAorMDSPlot(fnCountTable,fnPlotFileName,fnCondition,\"PCA\",fnBatch)")
   fnExt<-c("BoxPlotNorm","DensitiesPlot","CPMPlot","MDSPlot","PCAPlot")
   
   for(i in 1:length(fnMethods))
   {
       fnPlotFileName<-paste(fnOutputPath,"_",fnExt[i],collapse="",sep = "")
       if(is(try(eval(parse(text=fnMethods[i])),silent=TRUE),"try-error")){
           printErrorMessage(paste("   ",fnExt[i],"    .......................... Failed"))
           if(!(is.null(dev.list()))){
               graphics.off()}
           fnFilestoRemove<-list.files(path=dirname(fnPlotFileName),pattern=basename(fnPlotFileName),full.names=TRUE)
           if(length(fnFilestoRemove)>0){
               file.remove(fnFilestoRemove)}
       }
       else{
           printOKMessage(paste("   ",fnExt[i],"    .......................... OK"))}
   }
}
