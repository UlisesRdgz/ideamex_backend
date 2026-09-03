### Copyright (c) 2025 [Leticia Vega Alvarado]
### 
### Este archivo forma parte del proyecto IDEAMEX.
### Licencia: Creative Commons Atribución-NoComercial 4.0 Internacional (CC BY-NC 4.0)
### Puede copiarse y modificarse libremente con fines no comerciales, siempre que se otorgue crédito al autor original.
### Más información: https://creativecommons.org/licenses/by-nc/4.0/deed.es
###

#!/usr/local/bin/Rscript

### Nombre: printMDS
### Autora: Leticia Vega Alvarado
### Fecha de creacion: 30/09/20
### Ultima actualizacion: 03/10/20
### Parametros:
###           - fnDge: Objeto de tipo dge List, propio de edgeR
###           - fnFileName: Nombre del archivo (con "path" incluido) donde se guardara la grafica.
###           - fnBatch: Vector de valores numericos indicando el numero de lote por muestra. Puede ser vacío.
###           - fnTitle: Titulo de la grafica. Por defecto es "MDS Plot"
###           - fnTextAnnSize: Tamaño de la letra en los puntos de la grafica. Por defecto es de 3.
###           - fnCorrection: Valor booleano que si es verdadero, permite graficar modelando el efecto batch. Por defecto el valor es Falso.
### Descripcion: Funcion que realiza la gráfica MDS, usando el paquete ggplot2
printMDS<-function(fnDge,fnFileName,fnBatch=c(),fnTitle="MDS Plot",fnTextAnnSize=3,fnCorrection=FALSE)
{
    if(length(fnDge$samples$group)>2)
    {
        fnPlotFileName<-paste(fnFileName,"_plotMDS",collapse="",sep = "")
        pdf(paste(fnPlotFileName,".pdf",collapse="",sep=""),onefile=FALSE)
        fnSampleNames<-row.names(fnDge$samples)
        
        fnExp=fnDge$samples$group
        if(fnCorrection)
        {
            fnLogCPM <- edgeR::cpm(fnDge, log=TRUE, prior.count=5)
            fnDge<- limma::removeBatchEffect(fnLogCPM, batch=fnBatch)
        }
        fnDataPlot<-plotMDS(fnDge,main=fnTitle,plot = FALSE)
        fnDataPlotDF<-data.frame(fnX=fnDataPlot$x,fnY=fnDataPlot$y,fnNames=fnSampleNames,fnCondition=fnExp)
        fnPlot<-ggplot(fnDataPlotDF,aes(fnX,fnY,color=fnCondition)) +
        geom_point() +
        theme_bw() +
        ggtitle(fnTitle) +
        xlab(bquote("Leading" ~ log[2] ~ "Fold Change dim 1")) + #ylab(expression(log[2](count + 1))) bquote("Hello" ~ r[xy] == .(cor) ~ "and" ~ B^2))
        ylab(bquote("Leading" ~ log[2] ~ "Fold Change dim 2")) +
        geom_text(aes(label=fnNames),vjust=-0.5,size=fnTextAnnSize,show.legend = F) +
        theme(plot.title = element_text(size=16, hjust=0.5),legend.position = "none",legend.title = element_blank(), panel.grid.minor = element_blank())
        print(fnPlot)
        #### Cierre del modo de guardado de graficos
        graphics.off()
        printOKMessage("      MDS Plot .......................... OK")
    }
}
