### Copyright (c) 2025 [Leticia Vega Alvarado]
### 
### Este archivo forma parte del proyecto IDEAMEX.
### Licencia: Creative Commons Atribución-NoComercial 4.0 Internacional (CC BY-NC 4.0)
### Puede copiarse y modificarse libremente con fines no comerciales, siempre que se otorgue crédito al autor original.
### Más información: https://creativecommons.org/licenses/by-nc/4.0/deed.es
###

#!/usr/local/bin/Rscript

### Nombre: printErrorMessage
### Autora: Leticia Vega Alvarado
### Fecha de creacion: 12/Mayo/2015
### Ultima actualizacion: 12/Mayo/2015
### Parametros:
###           - fnMessage: Mensaje que se imprimira. Valor alfanumerico
###           - fnError: Mensaje de error. Valor alfanumerico que se genera cuando hay un error, este parametro no es obligatorio
### Descripcion: Funcion que imprime un mensaje (fnMessage) y un código (fnError) de error
printErrorMessage<-function(fnMessage,fnError="")
{
    print(fnMessage)
    if(fnError !=""){
        print(fnError)
    }
}

### Nombre: printOKMessage
### Autora: Leticia Vega Alvarado
### Fecha de creacion: 12/Mayo/2015
### Ultima actualizacion: 12/Mayo/2015
### Parametros:
###           - fnMessage: Mensaje que se imprimira. Valor alfanumerico
### Descripcion: Funcion que imprime un mensaje (fnMessage)
printOKMessage<-function(fnMessage)
{
    print(fnMessage)
}
