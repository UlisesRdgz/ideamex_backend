### Copyright (c) 2025 [Leticia Vega Alvarado]
### 
### Este archivo forma parte del proyecto IDEAMEX.
### Licencia: Creative Commons Atribución-NoComercial 4.0 Internacional (CC BY-NC 4.0)
### Puede copiarse y modificarse libremente con fines no comerciales, siempre que se otorgue crédito al autor original.
### Más información: https://creativecommons.org/licenses/by-nc/4.0/deed.es
###

#!/usr/local/bin/Rscript

### Nombre: printToFile
### Autora: Leticia Vega Alvarado
### Fecha de creacion: 25/09/20
### Ultima actualizacion: 28/10/20
### Parametros:
###           - fnTab: data.frame con los resultados de la evaluacion de la expresion diferencial con las cuentas normalizadas y la clasificación up y down
###           - fnFileName: Prefijo del nombre del archivo (con "path" incluido) donde se guardaran los resultados
###           - fnTOP: Valor booleano que indica si evaluan los genes Top o no. Por defecto es TRUE
###           - fnColumns: Nombre de las columnas donde se encuentran el pvalue y el logfoldchange2 y la expresion
### Valores de regreso:
###           - fnTopName: Vector con los genes DE que cumplieron con el corte en terminos del pval y del logfc
### Descripcion: Funcion que sirve para almacenar los resultados finales de la expresion diferencial. Se generan 4 archivos:
###              1) archivo con la tabla de todos los resultados, 2) archivo con todos los logFC, 3) archivo con todos los FDR
###              4) archivo con los resultados de los genes significativamente diferenciados (Los top, que cumplen con los valores de corte)
printToFile<-function(fnTab,fnFileName,TOP=TRUE,fnColumns)
{
    fnTopName=c()
    fnOutputFileName<-paste(fnFileName,".txt",collapse="",sep = "")
    
    fnTab<-cbind(ID=row.names(fnTab),fnTab)
    write.table(fnTab, file=fnOutputFileName, sep="\t",quote=FALSE,row.names=FALSE)
    fnFeatureFileName<-paste(fnFileName,"_logFC.txt",collapse="",sep = "")
    write.table(fnTab[,c("ID",unname(fnColumns["logFC"]))], file=fnFeatureFileName, sep="\t",quote=FALSE,row.names=FALSE)
    fnFeatureFileName<-paste(fnFileName,"_pval.txt",collapse="",sep = "")
    write.table(fnTab[,c("ID",unname(fnColumns["pval"]))], file=fnFeatureFileName, sep="\t",quote=FALSE,row.names=FALSE)
    if(TOP)
    {
        fnOutputFileNameTop<-paste(fnFileName,"_TOP.txt",collapse="",sep = "")
        fnTopRows<-row.names(fnTab[fnTab$Expression != unname(fnColumns["expression"]),,drop=FALSE])
        if(length(fnTopRows)>0){
            write.table(fnTab[fnTopRows,],file=fnOutputFileNameTop, sep="\t",quote=FALSE,row.names=FALSE)
            fnTopName<-fnTopRows
            print("      Top file .......................... OK")
        }
        else{
            print("      Top File not generated .......................... No significantly ED genes were detected")
        }
    }
    print("      Final Results table to file .......................... OK")
    return(fnTopName)
}

### Nombre: abundaceTable
### Autora: Leticia Vega Alvarado
### Fecha de creacion: 25/09/20
### Ultima actualizacion: 30/09/20
### Parametros:
###           - fnRawCounts: data.frame con la tabla de conteos sin normalizar
###           - fnNormalizedCounts: data.frame con la tabla de conteos normalizada
###           - fnFileName: Nombre del archivo (con "path" incluido) donde se guardaran los resultados.
### Valores de regreso:
###           - fnAbundance: Dataframe con los conteos crudos y normalizados
### Descripcion: Funcion que sirve para evaluar las abundancias normalizadas.
###              Esta función regresa la tabla de abundancias normalizadas y además las guarda en un archivo
abundaceTable<-function(fnRawCounts,fnNormalizedCounts,fnFileName)
{
    ####  Calculo de la abundancia normalizada
    fnNamesNormalized<-paste(names(fnNormalizedCounts),"normalized",sep = "_")
    names(fnNormalizedCounts)<-fnNamesNormalized
    fnAbundance<-cbind(fnRawCounts,fnNormalizedCounts)
    fnAbundance<-fnAbundance[order(row.names(fnAbundance)),]
    fnAbundanceFileName<-paste(fnFileName,"_abundances.txt",collapse="",sep = "")
    write.table(cbind(ID=row.names(fnNormalizedCounts),fnNormalizedCounts), file=fnAbundanceFileName, sep="\t",quote=FALSE,row.names=FALSE)
    print("      Abundance estimation .......................... OK")
    return(fnAbundance)
}

### Nombre: getDEGenes
### Autora: Leticia Vega Alvarado
### Fecha de creacion: 25/09/20
### Ultima actualizacion: 25/09/20
### Parametros:
###           - fnRes: Dataframe con los resultados de la ED
###           - lfc: Valor de corte para el Log2FC.
###           - p.value: Valor de corte para el FDR
###           - fnCol: Nombre de las columnas donde se encuentra la informacion del logFC2 y al pvalue
### Valores de regreso:
###           - fnRes: Dataframe con la clasificacion, en terminos de expresion, de los genes (Up, Down y None)
### Descripcion: Funcion que sirve para etiquetar a los genes diferencialmente exprespresados que cumplen con un los valores de corte
getDEGenes<-function(fnRes,lfc=0,p.value = 0.05,fnCol,fnComparison)
{
    fnRes$Expression<-"NonDE"
    fnRes[fnCol][is.na(fnRes[fnCol])] <- 0
    fnRes[(fnRes[,fnCol[2]] >= lfc & fnRes[,fnCol[1]] <= p.value),"Expression"] <- paste("Down_",fnComparison[1],"_Up_",fnComparison[2],sep="",collapse="")
    fnRes[(fnRes[,fnCol[2]] <= -lfc & fnRes[,fnCol[1]] <= p.value),"Expression"] <-paste("Up_",fnComparison[1],"_Down_",fnComparison[2],sep="",collapse="")
    return(fnRes[,"Expression", drop = FALSE])
}

### Nombre: resulTable
### Autora: Leticia Vega Alvarado
### Fecha de creacion: 26/09/20
### Ultima actualizacion: 30/09/20
### Parametros:
###           - fnAllTables: Dataframe con los resultados de la ED
###           - fnFileName: Nombre del archivo (con "path" incluido)
###           - fnUmbralFoldChange: Valor de corte para el Log2FC
###           - fnUmbral: Valor de corte para el pvalue
###           - fnCol: Nombre de las columnas donde se encuentra la informacion del logFC2 y al pvalue
###           - fnComparison: Vector con las condiciones que se comparan, el primer elemento es la condicion basal
### Valores de regreso:
###           - fnFinalTab: Dataframe con los resultados de la ED, que incluye los conteos crudos y normalizados, asi como la clasificacion de los genes
### Descripcion: Funcion que sirve para obtener la tabla de resultados con las abundancias normalizadas y con la clasificacion de
###              sobreexpresado(UP) y subexpresado(DOWN)
resulTable<-function(fnAllTables,fnFileName,fnUmbralFoldChange,fnUmbral,fnCol,fnComparison)
{
    fnAllTables$fnDeTab <- fnAllTables$fnDeTab[order(row.names(fnAllTables$fnDeTab)),]
    fnDEGenes<-getDEGenes(fnAllTables$fnDeTab,lfc=fnUmbralFoldChange,p.value = fnUmbral,fnCol,fnComparison)
    fnAbundance<-abundaceTable(fnAllTables$RawCounts,fnAllTables$NormalizedCounts,fnFileName)
    fnFinalTab<-cbind(fnAllTables$fnDeTab[,],fnAbundance[,],fnDEGenes)
    fnFinalTab <- fnFinalTab[order(fnFinalTab[,fnCol[1]]),]
    print("      Results table .......................... OK")
    return(fnFinalTab)
}

### Nombre: getTypeofAnalysis
### Autora: Leticia Vega Alvarado
### Fecha de creacion: 26/09/20
### Ultima actualizacion: 26/09/20
### Parametros:
###           - fnConditions:Vector con la condicion a la que pertenece cada experimento
### Valores de regreso:
###           - fnReplicates: Valor booleano que indica si hay o no replicas en todas las condiciones a comparar
### Descripcion: Funcion que permite saber si las condiciones a tratar tienen replicas o no.
getTypeofAnalysis<-function(fnConditions)
{
    fnConditions<-factor(fnConditions)
    fnReplicates<-TRUE
    if(min(table(fnConditions)) < 2)
    {
        fnReplicates<-FALSE
    }
    return(fnReplicates)
}



