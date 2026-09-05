/**
 * @file Pruebas del conteo de genes diferenciales que reporta la API.
 * Un fallo aqui no rompe nada visiblemente: da un numero plausible y falso. Los
 * archivos reproducen la convencion del pipeline, con el signo invertido
 * respecto al nombre del contraste; alinearlos ocultaba la inversion.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { countSignificantGenesFromTopFile } from '../../src/api/analysis/controllers/analysis.shared.controller';

let carpeta: string;

beforeAll(() => {
  carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'ideamex-conteos-'));
});

afterAll(() => {
  fs.rmSync(carpeta, { recursive: true, force: true });
});

const ARRIBA = 'Up_treated_Down_untreated';
const ABAJO = 'Down_treated_Up_untreated';

/** Genera un archivo TOP con el signo invertido, tal como lo escribe R. */
const archivoTop = (nombre: string, sobre: number, sub: number): string => {
  const lineas = ['ID\tlogFC\tlogCPM\tPValue\tFDR\tExpression'];
  for (let i = 0; i < sobre; i += 1) {
    lineas.push(`GEN_UP_${i}\t${(-2 - i / 100).toFixed(4)}\t5.1\t1e-10\t1e-8\t${ARRIBA}`);
  }
  for (let i = 0; i < sub; i += 1) {
    lineas.push(`GEN_DOWN_${i}\t${(2 + i / 100).toFixed(4)}\t5.1\t1e-10\t1e-8\t${ABAJO}`);
  }
  const ruta = path.join(carpeta, nombre);
  fs.writeFileSync(ruta, lineas.join('\n'));
  return ruta;
};

describe('countSignificantGenesFromTopFile', () => {
  it('cuenta todos los genes, no solo los primeros', () => {
    // El caso que motiva estas pruebas: con 100 genes se reportaban 20, que era
    // el tamano de la vista previa que consume la interfaz.
    const ruta = archivoTop('cien.txt', 47, 53);
    expect(countSignificantGenesFromTopFile(ruta)).toEqual({
      upregulated: 47,
      downregulated: 53,
      significant: 100,
    });
  });

  it('separa por la columna Expression, no por el signo del logFC', () => {
    // La comprobacion que faltaba: por el signo saldrian intercambiados.
    const ruta = archivoTop('signos.txt', 3, 7);
    expect(countSignificantGenesFromTopFile(ruta)).toEqual({
      upregulated: 3,
      downregulated: 7,
      significant: 10,
    });
  });

  it('no se deja llevar por un logFC que contradice a Expression', () => {
    const ruta = path.join(carpeta, 'contradictorio.txt');
    fs.writeFileSync(
      ruta,
      `ID\tlogFC\tFDR\tExpression\n` +
        `GEN_A\t4.61\t1e-8\t${ABAJO}\n` +
        `GEN_B\t-2.90\t1e-8\t${ARRIBA}\n`
    );
    expect(countSignificantGenesFromTopFile(ruta)).toEqual({
      upregulated: 1,
      downregulated: 1,
      significant: 2,
    });
  });

  it('cuenta correctamente cuando todos van en el mismo sentido', () => {
    const ruta = archivoTop('solo-sobre.txt', 105, 0);
    expect(countSignificantGenesFromTopFile(ruta)).toEqual({
      upregulated: 105,
      downregulated: 0,
      significant: 105,
    });
  });

  it('descarta los renglones que Expression marca como no diferenciales', () => {
    const ruta = path.join(carpeta, 'nonde.txt');
    fs.writeFileSync(
      ruta,
      `ID\tlogFC\tFDR\tExpression\n` +
        `GEN_A\t-2.5\t1e-8\t${ARRIBA}\n` +
        `GEN_B\t0.1\t0.9\tNonDE\n`
    );
    expect(countSignificantGenesFromTopFile(ruta)).toEqual({
      upregulated: 1,
      downregulated: 0,
      significant: 1,
    });
  });

  it('devuelve null si el archivo no tiene columna logFC ni Expression', () => {
    // Es el caso del archivo de abundancias, que el codigo llegaba a elegir por
    // orden alfabetico creyendolo el archivo principal.
    const ruta = path.join(carpeta, 'abundancias.txt');
    fs.writeFileSync(ruta, 'ID\ttreated_1\tuntreated_1\nGEN_A\t10\t20\n');
    expect(countSignificantGenesFromTopFile(ruta)).toBeNull();
  });

  it('devuelve null si el archivo no existe', () => {
    expect(countSignificantGenesFromTopFile(path.join(carpeta, 'ausente.txt'))).toBeNull();
  });

  it('devuelve null si solo hay encabezado', () => {
    const ruta = path.join(carpeta, 'vacio.txt');
    fs.writeFileSync(ruta, 'ID\tlogFC\tFDR\tExpression\n');
    expect(countSignificantGenesFromTopFile(ruta)).toBeNull();
  });
});

describe('respaldo por signo cuando falta la columna Expression', () => {
  // El pipeline siempre la escribe; esto cubre solo archivos ajenos a el, donde
  // no hay forma de conocer cual es la condicion basal.
  it('trata el cero como sobreexpresado, sin descartarlo', () => {
    const ruta = path.join(carpeta, 'cero.txt');
    fs.writeFileSync(ruta, 'ID\tlogFC\tFDR\nGEN_A\t0\t1e-8\nGEN_B\t-1.9\t1e-8\n');
    expect(countSignificantGenesFromTopFile(ruta)).toEqual({
      upregulated: 1,
      downregulated: 1,
      significant: 2,
    });
  });

  it('ignora renglones cuyo logFC no es numerico', () => {
    const ruta = path.join(carpeta, 'sucio.txt');
    fs.writeFileSync(ruta, 'ID\tlogFC\tFDR\nGEN_A\t2.5\t1e-8\nGEN_B\tNA\t1e-8\nGEN_C\t-3.1\t1e-8\n');
    expect(countSignificantGenesFromTopFile(ruta)).toEqual({
      upregulated: 1,
      downregulated: 1,
      significant: 2,
    });
  });
});

describe('nombres de columna por metodo', () => {
  // Cada paquete de R rotula distinto el cambio de expresion. Reconocer solo
  // el de edgeR dejaba los conteos de NOISeq y DESeq2 en cero.
  it.each([
    ['edgeR y limma', 'logFC'],
    ['NOISeq', 'log2FC'],
    ['DESeq2', 'log2FoldChange'],
  ])('reconoce la columna de %s (%s)', (_metodo, columna) => {
    const ruta = path.join(carpeta, `col-${columna}.txt`);
    fs.writeFileSync(
      ruta,
      `ID\t${columna}\tFDR\tExpression\nGEN_A\t-2.5\t1e-8\t${ARRIBA}\nGEN_B\t3.1\t1e-8\t${ABAJO}\n`
    );
    expect(countSignificantGenesFromTopFile(ruta)).toEqual({
      upregulated: 1,
      downregulated: 1,
      significant: 2,
    });
  });
});
