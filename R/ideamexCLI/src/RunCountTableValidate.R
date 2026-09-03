### Copyright (c) 2025 [Leticia Vega Alvarado]
### 
### Este archivo forma parte del proyecto IDEAMEX.
### Licencia: Creative Commons Atribución-NoComercial 4.0 Internacional (CC BY-NC 4.0)
### Puede copiarse y modificarse libremente con fines no comerciales, siempre que se otorgue crédito al autor original.
### Más información: https://creativecommons.org/licenses/by-nc/4.0/deed.es
###

#!/usr/local/bin/Rscript

### Nombre: findSeparator
### Autora: Leticia Vega Alvarado
### Fecha de creacion:
### Ultima actualizacion:
### Parametros:
###           - fnInputFileName:
### Descripcion: Funcion que sirve para buscar el separador de la tabla de conteos
findSeparator<-function(fnInputFileName)
{
  fnSymbol = "Failed"
  fnSymbolsSet<-c(",","\t","None")
  fnNumOfSymbols<-length(fnSymbolsSet)
  fnCont<-1
  if(file.exists(fnInputFileName))
  {
     fnLine<-readLines(fnInputFileName, n = 1)
     if(length(fnLine))
     {
        if(validUTF8(fnLine))
        {
            fnLineSize<-nchar(fnLine)
            while(!(fnLineSize-nchar(gsub(fnSymbolsSet[fnCont],"",fnLine)) ) && (fnCont < fnNumOfSymbols)){
               fnCont<-fnCont+1
            }
            fnSymbol=fnSymbolsSet[fnCont]
        }
     } 
  }
  return(fnSymbol)
}

### Nombre: findTypeofData
### Autora: Leticia Vega Alvarado
### Fecha de creacion: 02/Dic/2021
### Ultima actualizacion:02/Dic/2021
### Parametros:
###           - fnDataFrame: Dataframe con la tabla de conteos
###
### Descripcion: Funcion que sirve verificar de qué tipo son todas las columnas de la
###              de la tabla de conteos.
### Return: Esta función regresa  de 0 si los valores de las columnas
###         son de tipo numérico o 1 en caso contrario.
findTypeofData<-function(fnCounts)
{
  fnDFType<-table(unlist(lapply(fnCounts, class)))
  if( all((names(fnDFType) %in% c("integer","numeric"))) ){
    fnRes<-0}
  else{fnRes<-1}
  return(fnRes)
}

### Nombre: ValidateCountTable
### Autora: Leticia Vega Alvarado
### Fecha de creacion:
### Ultima actualizacion:
### Parametros:
###           - fnInputFileName:
### Descripcion: Funcion que sirve para validar el formato de la tabla de conteos
### Return: Esta función regresa los siguientes valores:
###         0: Count table read ..........OK
###         1: Count Table has blank fields
###         2: Unable to read Count Table File
###         3: Invalid delimiter fields in count table
###         4: No such file or directory
###         5: Table has non-numeric values
###         6: Table is empty. Only headers are availables
### Run: Rscript ~/bin/DifferentialExp/RunCountTableValidate.R archivo.txt
###      Rscript ~/bin/DifferentialExp/RunCountTableValidate.R ~/Downloads/Prueba.txt
###      Rscript ~/bin/DifferentialExp/RunCountTableValidate.R ~/Proyectos/IDEA/Data/vacio.txt
ValidateCountTable<-function(fnInputFileName)
{
#  cat("******************\n<LOAD COUNT TABLE>\n******************","\n")
    if(file.exists(fnInputFileName))
    {
            fnSeparator<-suppressWarnings(findSeparator(fnInputFileName))
            if(fnSeparator !="None"){
                if(suppressWarnings(class(fnCounts<-try(read.table(fnInputFileName,header=TRUE, row.names=1,as.is=TRUE,sep=fnSeparator,quote=""),silent=TRUE)))!= "try-error"){
                  if(nrow(fnCounts) > 0){
                    if(!(any(is.na(fnCounts)))){
                      if(findTypeofData(fnCounts) == 0){
                        fnRes<-0}
                      else{fnRes<-5}}
                    else{fnRes<-1}}
                  else{fnRes<-6}}
                else{fnRes<-2}}
            else{fnRes<-3}
    }
    else{fnRes<-4}
    return(fnRes)
}

args <- commandArgs(trailingOnly = TRUE)
#print(length(args))
fnRes<-ValidateCountTable(args[1])
write(fnRes, stdout())

