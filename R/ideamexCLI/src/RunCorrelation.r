### Copyright (c) 2025 [Leticia Vega Alvarado]
### 
### Este archivo forma parte del proyecto IDEAMEX.
### Licencia: Creative Commons Atribución-NoComercial 4.0 Internacional (CC BY-NC 4.0)
### Puede copiarse y modificarse libremente con fines no comerciales, siempre que se otorgue crédito al autor original.
### Más información: https://creativecommons.org/licenses/by-nc/4.0/deed.es
###

#!/usr/local/bin/Rscript

### Nombre: listMultimerge
### Autora: Leticia Vega Alvarado
### Fecha de creacion: 15/05/20
### Ultima actualizacion: 24/05/20
### Parametros:
###           - fnList: lista de data.frames a combinar
### Valores de regreso:
###           - fnFinalOut: data.frame con la informacion ya combinada
### Descripcion: Funcion que sirve para  combinar multiples data.frames.
listMultimerge <- function (fnList) {
    fnUniqNames <- unique(unlist(lapply(fnList, rownames)))
    fnRows <- length(fnUniqNames)
    fnOutDF <- lapply(fnList,
    function(fnDF) {
        fnTemp <- matrix(nr = fnRows, nc = ncol(fnDF), dimnames = list(fnUniqNames,colnames(fnDF)))
        fnTemp[rownames(fnDF), ] <- as.matrix(fnDF)
        rm(fnDF)
        gc()
        return(fnTemp)
    }
    )
    stopifnot( all( sapply(fnOutDF, function(x) identical(rownames(x), fnUniqNames)) ) )
    fnFinalOut <- do.call(cbind, fnOutDF)
    fnFinalOut[is.na(fnFinalOut)]<-0
    return(fnFinalOut)
}

### Nombre: fileMerge
### Autora: Leticia Vega Alvarado
### Fecha de creacion: 15/05/20
### Ultima actualizacion: 24/05/20
### Parametros:
###           - fnOutputPath: path de salida en donde quedaran los resultados
###           - fnDEMethods: vector con los nombres de los métodos, de cuya carpeta se obtiene información
###           - fnFileName: nombre de archivo (combinacion que se esta analizando)
###           - fnList: vector con los identificadores de las regiones DE
###           - fnType: Tipo de información con la que vamos a trabajar (Abundances, pval, logFC)
### Valores de regreso:
###           - fnMyMerge:data.frame, con la información combinada
### Descripcion: Funcion para combinar la información de un tipo determinado(fnType), obtenida en los diferentes
###              metodos(fnDEMethods).
fileMerge<-function(fnOutputPath,fnDEMethods,fnFileName,fnList,fnType)
{
    fnMyList<-list()
    for(i in fnDEMethods)
    {
        fnFileMethod<-paste(fnOutputPath,"/",i,"_Results/",fnFileName,"/",fnFileName,"_",fnType,".txt",collapse="",sep = "")
        fnTableMethod<-read.table(fnFileMethod,header=T,row.names=1,sep="\t",stringsAsFactors =FALSE)
        fnTableMethod<-fnTableMethod[fnList,,drop=FALSE]
        fnNewNames<-paste(i,names(fnTableMethod),sep="_")
        names(fnTableMethod)<-fnNewNames
        fnMyList[[i]]<-fnTableMethod
    }
    fnMyMerge<-data.frame(listMultimerge(fnMyList))
    return(fnMyMerge)
}

### Nombre: correlationPlotandInfo
### Autora: Leticia Vega Alvarado
### Fecha de creacion: 15/05/20
### Ultima actualizacion: 24/05/20
### Parametros:
###           - fnOutputPath: path de salida en donde quedaran los resultados
###           - fnDEMethods: vector con los nombres de los métodos, en cuya carpeta se guardaran los resultados
###           - fnFileName: nombre de archivo (combinacion que se esta analizando)
###           - fnList: vector con los identificadores de las regiones DE
###           - fnType: Tipo de información con la que vamos a trabajar (Abundances, pval, logFC)
### Descripcion: Funcion que sirve para generar las graficas de correlacion y los archivos relacionados a las mismas
correlationPlotandInfo<-function(fnOutputPath,fnDEMethods,fnFileName,fnList,fnType)
{
    print(paste("*************************  Running Data",fnType," *******************"))
    fnPks<-c("corrplot")
    fnRequierePkgs<-loadPkgValidate(fnPks)
    fnMultiMerge<-fileMerge(fnOutputPath,fnDEMethods,fnFileName,fnList,fnType)
    ifelse(fnType=="abundances",fnCondition<-paste("_",unlist(strsplit(fnFileName,"vs")),"_",sep=""),fnCondition<-"")
    fnCorrPlotName<-paste(fnOutputPath,"/Integration_Results/",fnFileName,"/",fnFileName,"_",fnType,"Correlation",collapse="",sep = "")
    pdf(paste(fnCorrPlotName,".pdf",collapse="",sep=""))
    for(i in fnCondition)
    {
        fnSubsetCondtion<-fnMultiMerge[,grep(i,names(fnMultiMerge), value=TRUE)]
        fnCorrelation = cor(fnSubsetCondtion,method="spearman")
        corrplot(fnCorrelation, method = "number",type = "upper",number.digits=4,tl.cex = 0.6, tl.srt = 45,number.cex=0.6, mar = c(2, 2, 2, 2),xpd = TRUE,main=paste(fnType," correlation",fnFileName,ifelse(fnType=="abundances","\n",""),i))
    }
    graphics.off()
    write.table(cbind(ID=row.names(fnMultiMerge),fnMultiMerge), file=paste(fnOutputPath,"/Integration_Results/",fnFileName,"/",fnFileName,"_",fnType,"Table.txt",collapse="",sep = ""), sep="\t",quote=FALSE,row.names=FALSE)
    #write.table(fnMultiMerge,paste(fnOutputPath,"/Integration_Results/",fnFileName,"/",fnFileName,"_",fnType,"Table.txt",collapse="",sep = ""),sep="\t",quote=F,col.names=T,row.names=T)
}

### Nombre: printAllToFile
### Autora: Leticia Vega Alvarado
### Fecha de creacion: 27/05/20
### Ultima actualizacion: 27/05/20
### Parametros:
###           - fnProgamsPath: Directorio donde se encuentran los programas fuentes.
###           - fnOutputPath: Directorio donde se guardaran los resultados
###           - fnNamesVenn: vector con los nombres de cada conjunto
###           - fnCombinationNames: Valor alfanumerico con el nombre de las condiciones a comparar
###           - fnDataForVenn: Lista con los genes DE por metodo
### Descripcion: Funcion que se encarga de llamar a las funciones que hacen los correlogramas de logFC y del pval
callCorrelation<-function(fnProgamsPath,fnOutputPath,fnNamesVenn,fnCombinationNames,fnDataForVenn)
{
    ####  Cargando los programas y paquetes necesarios
    if(!exists("loadPkgValidate", mode="function")) source(paste(fnProgamsPath,"/RunInstallloadValidatePkg.r",collapse="",sep = ""))
    fnMethods<-c('"abundances"')
    if(length(fnNamesVenn) > 1){
        fnMethods<-c(fnMethods,'"logFC"','"pval"') }
    fnMethodsToEval<-paste(rep('correlationPlotandInfo(fnOutputPath,fnNamesVenn,fnCombinationNames,sort(unique(unlist(fnDataForVenn))),',length(fnMethods)),
    fnMethods,rep(')',length(fnMethods)),sep = "")
    for(i in 1:length(fnMethodsToEval))
    {
        if(is(try(eval(parse(text=fnMethodsToEval[i])),silent=TRUE),"try-error")){
            printErrorMessage(paste("    ",fnMethods[i],"    .......................... Failed"))
        }
        else{
            printOKMessage(paste("   ",fnMethods[i],"    .......................... OK"))}
    }
}

