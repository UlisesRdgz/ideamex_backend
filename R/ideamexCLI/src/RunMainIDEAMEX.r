### Copyright (c) 2025 [Leticia Vega Alvarado]
### 
### Este archivo forma parte del proyecto IDEAMEX.
### Licencia: Creative Commons Atribución-NoComercial 4.0 Internacional (CC BY-NC 4.0)
### Puede copiarse y modificarse libremente con fines no comerciales, siempre que se otorgue crédito al autor original.
### Más información: https://creativecommons.org/licenses/by-nc/4.0/deed.es
###

#!/usr/local/bin/Rscript

if(!("package:optparse" %in% search()))
{
    suppressWarnings(library(optparse))
}
### Nombre: argsValidation
### Autora: Leticia Vega Alvarado
### Fecha de creacion: 15/05/20
### Ultima actualizacion: 14/06/22
### Parametros:
###           - fnArgs: vector de argumentos y valores
###           - fnScriptsPath: ruta completa de los scripts
### Valores de regreso:
###            - fnOpt: lista con los argumentos y valores, con base a las opciones válidas
### Descripcion: Funcion que sirve para validar los argumentos, pasados a línea de comandos para correr IDEAMEX
### Dependencias: paquete optparse
argsValidation<-function(fnArgs,fnScriptsPath)
{
    fnDescription<-"Description: \nScript to perform differential expression analyses of RNA-Seq by four different methods(edgeR, DESeq2,limma and NOISeq), it also integrates the information outcomes. The program needs a raw count table for as many desired replicates and conditions, allowing the user to select which conditions will be compared, or doing all-vs-all comparisons."
    fnUsage<-"Usage: \nRunMainIDEAMEX -i rawTableFile -o /results/path [optionals parameters]\n"
    fnEpilogue<-"Questions, suggestions, comments, etc? Contact Leticia Vega Alvarado at leticia.vega@icat.unam.mx"
    fnMyOptions = list(
    make_option(c("-i", "--inputfile"), metavar="<string>", type= 'character', dest="fnInputFileName", help='<Required> Input file name'),
    make_option(c("-o", "--outputpath"), metavar="<string>", type= 'character', dest="fnOutputPath",help='<Required> Ouput path directory'),
    make_option(c("-c", "--comparison"), metavar="<string>", type= 'character', dest="fnCombinations", help='[Optional] Comparison vector(string values separated by commas, not spaces)'),
    make_option(c("-t", "--top"), metavar="<logical>", type= 'logical', dest="TOP", default=TRUE, help='[Optional] Logical value, TRUE if TOP is evaluated, default value: %default'),
    make_option(c("-u", "--threshold"), metavar="<numerical>", type= 'double', dest="fnUmbral", default=0.05, help='[Optional] Threshold for pajust/FDR, default value: %default'),
    make_option(c("-f", "--filter"), metavar="<numerical>", type= 'double', dest="fnFilterValue", default=1, help='[Optional] Filter value by cpm, default value: %default'),
    make_option(c("-l", "--logfc"), metavar="<numerical>", type= 'double', dest="fnUmbralFoldChange", default=1.5, help='[Optional] Threshold for log fold change, default value: %default'),
    make_option(c("-m", "--methods"), metavar="<numerical>", type= 'integer', dest="fnSelectMethods", default=123456, help='[Optional] Numeric code for the methods to apply in the analysis, default value: %default.\n\t\t\t(1.edgeR, 2.limma, 3.NOISeq, 4.DESeq2, 5.Data Analysis, 6.Integration Results)'),
    make_option(c("-g", "--gziptar"), metavar="<logical>", type= 'logical', dest="fnFileGzipTar", default=TRUE, help='[Optional] Logical value, TRUE if commpressed results are save, default value: %default'),
    make_option(c("-b", "--batch"), metavar="<string>", type= 'character', dest="fnBatch",help='[Optional] Vector of batch, default value: no batch'),
    make_option(c("-s", "--scriptpath"), metavar="<string>",type= 'character', dest="fnProgamsPath", default=fnScriptsPath, help='[Optional] Scripts path. Use this option only if you know the scripts path, default value: %default')
    )
    fnOptPar<-OptionParser(usage = fnUsage,option_list=fnMyOptions,description = fnDescription,epilogue = fnEpilogue)
    if(length(fnArgs) == 0) fnArgs="-h"
    fnOpt <- parse_args(fnOptPar,args=fnArgs)
    if("fnBatch" %in% names(fnOpt)){
        fnOpt$fnBatch<-as.integer(gsub(" ", "",unlist(strsplit(fnOpt$fnBatch,","))))
        fnOpt$fnBatch<-fnOpt$fnBatch[nzchar(fnOpt$fnBatch)]
    }
    if("fnCombinations" %in% names(fnOpt)){
        fnOpt$fnCombinations<-gsub(" ","",unlist(strsplit(fnOpt$fnCombinations,",")))
        fnOpt$fnCombinations<-fnOpt$fnCombinations[nzchar(fnOpt$fnCombinations)]
    }
    return(fnOpt)
}

### Nombre: RunMain
### Autora: Leticia Vega Alvarado
### Fecha de creacion: 15/05/20
### Ultima actualizacion: 14/06/22
### Parametros:
###           - fnOpt: lista de argumentos y valores de los mismos
### Valores de regreso:
###            - fnRes: La función regresa un valor entero, dependiendo de si hubo errores al momento de correr el programa o no:
###                     0:  Main program Run OK
###                     1:  Main program Failed
###                     2:  Mandatory parameters were ommited
###                     3:  Mandatory package are not installed
###                     4:  Scripts directory is incorrect
### Descripcion: Funcion que sirve armar la el comando que permite llamar y correr al programa RunAllComparision.r
###              para realizar el análisis de ED.
### Dependencias: script RunAllComparision.r

RunMain<-function(fnOpt)
{
    if(all(c("fnInputFileName","fnOutputPath") %in% names(fnOpt)))
    {
        if(file.exists(paste(fnOpt$fnProgamsPath,"/RunAllComparision.r",collapse="",sep = "")))
        {
            source(paste(fnOpt$fnProgamsPath,"/RunAllComparision.r",collapse="",sep = ""))
            fnOptnames<-names(fnOpt)
            fnOptnames<-fnOptnames[!(fnOptnames %in% c("help"))]
            fnOptnames_fn<-paste("fnOpt$",fnOptnames,sep = "")
            fnFinal<-paste(fnOptnames,fnOptnames_fn,collapse=",",sep="=")
            fnRunAllComparison<-paste("RunAllComparisionMain(",fnFinal,")",collapse = "",sep="")
            fnFuncReturn<-try(eval(parse(text=fnRunAllComparison)),silent=TRUE)
            if(is(fnFuncReturn,"try-error")){
                fnRes<-1}
            else{fnRes<-fnFuncReturn}
        }
        else{fnRes<-4}
    }
    else{fnRes<-2}
    return(fnRes)
}

###  Autora:
###      Leticia Vega Alvarado.
### Fecha de creacion: 15/05/20
### Ultima actualizacion: 14/06/2022
### Parametros:
###           -i/--inputfile  <string>
###           -o/--outputpath <string>
###       Opcioneles:
###           -c/--comparison <comma-separated list of strings>
###           -t/--top        <logical>
###           -u/--threshold  <numeric>
###           -f/--filter     <numeric>
###           -l/--logfc      <numeric>
###           -m/--methods    <numeric>
###           -g/--gziptar    <logical>
###           -b/--batch      <comma-separated list of numeric values>
###           -s/--scriptpath <string>
### Descripcion:
###      Programa que lee y valida los parámetros de entrada de IDEAMEX y manda llamar
###      al script RunAllComparision.r , para realizar todo el análisis de Expresión Diferencial
###  Ejemplos:
### Rscript ~/bin/DifferentialExp/RunMainIDEAMEX.r -s ~/bin/DifferentialExp -i ~/Proyectos/IDEA/DrosofilaCount.txt -o ~/Proyectos/IDEA/Temp
### Rscript ~/bin/DifferentialExp/RunMainIDEAMEX.r -s ~/bin/DifferentialExp -i ~/Proyectos/IDEA/Data/DrosofilaCount.txt -o ~/Proyectos/IDEA/Temp -m 123456
### Rscript ~/bin/DifferentialExp/RunMainIDEAMEX.r -s ~/bin/DifferentialExp -i ~/Proyectos/IDEA/Temp/ALL_counts.txt -o ~/Proyectos/IDEA/Temp -c NvM,TxM,ECM,ECL,NvM,ECM,ECM,ECWM -m 2356

# ********* main program ***************
# Leyendo los argumentos de la linea de comandos
argsInput = commandArgs(trailingOnly=TRUE)
scriptsPath="/Users/leticia/bin/DifferentialExp"
# Recuperando y validando los argumentos
argsOutput<-suppressPackageStartupMessages(argsValidation(argsInput,scriptsPath))
# Corriendo el analisis de ED con los argumentos seleccionados por el usuario
runStatus<-suppressPackageStartupMessages(RunMain(argsOutput))
write(runStatus, stdout())

