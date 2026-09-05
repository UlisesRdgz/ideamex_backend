/**
 * @file Pruebas del conteo de genes diferenciales que reporta la API.
 *
 * Es la cifra que el investigador lee en pantalla y la que resume el resultado
 * del analisis. Un fallo aqui no rompe nada visiblemente: entrega un numero
 * plausible pero equivocado, que es la clase de error mas dificil de notar.
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

/** Genera un archivo TOP con la cantidad pedida de genes por sentido. */
const archivoTop = (nombre: string, sobre: number, sub: number): string => {
  const lineas = ['ID\tlogFC\tlogCPM\tPValue\tFDR'];
  for (let i = 0; i < sobre; i += 1) {
    lineas.push(`GEN_UP_${i}\t${(2 + i / 100).toFixed(4)}\t5.1\t1e-10\t1e-8`);
  }
  for (let i = 0; i < sub; i += 1) {
    lineas.push(`GEN_DOWN_${i}\t${(-2 - i / 100).toFixed(4)}\t5.1\t1e-10\t1e-8`);
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

  it('separa por el signo del logFC', () => {
    const ruta = archivoTop('signos.txt', 3, 7);
    const r = countSignificantGenesFromTopFile(ruta);
    expect(r).toEqual({ upregulated: 3, downregulated: 7, significant: 10 });
  });

  it('cuenta correctamente cuando todos van en el mismo sentido', () => {
    const ruta = archivoTop('solo-sobre.txt', 105, 0);
    expect(countSignificantGenesFromTopFile(ruta)).toEqual({
      upregulated: 105,
      downregulated: 0,
      significant: 105,
    });
  });

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

  it('devuelve null si el archivo no tiene columna logFC', () => {
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
    fs.writeFileSync(ruta, 'ID\tlogFC\tFDR\n');
    expect(countSignificantGenesFromTopFile(ruta)).toBeNull();
  });
});
