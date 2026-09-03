/**
 * @file Pruebas de las utilidades de sanitizacion de nombres y rutas.
 *
 * Estas funciones deciden como se llaman las carpetas donde se guardan los
 * archivos de cada usuario, asi que un fallo aqui se traduce en rutas
 * inconsistentes o peligrosas.
 */

import path from 'path';
import {
  isValidExtension,
  sanitizeName,
  sanitizeEmailPrefix,
  buildProjectPath,
} from '../../src/utils/file';

describe('isValidExtension', () => {
  it.each(['tabla.csv', 'tabla.tsv', 'tabla.txt'])('acepta %s', (nombre) => {
    expect(isValidExtension(nombre)).toBe(true);
  });

  it('ignora mayusculas en la extension', () => {
    expect(isValidExtension('TABLA.CSV')).toBe(true);
    expect(isValidExtension('Tabla.TxT')).toBe(true);
  });

  it.each(['script.sh', 'datos.xlsx', 'imagen.png', 'sin-extension'])(
    'rechaza %s',
    (nombre) => {
      expect(isValidExtension(nombre)).toBe(false);
    }
  );

  it('mira solo la ultima extension, no una intermedia', () => {
    expect(isValidExtension('datos.csv.sh')).toBe(false);
    expect(isValidExtension('datos.sh.csv')).toBe(true);
  });
});

describe('sanitizeName', () => {
  it('convierte a slug en minusculas', () => {
    expect(sanitizeName('Mi Proyecto')).toBe('mi-proyecto');
  });

  it('translitera acentos y enes', () => {
    expect(sanitizeName('Análisis de Expresión')).toBe('analisis-de-expresion');
    expect(sanitizeName('Diseño')).toBe('diseno');
  });

  it('elimina los separadores de ruta, que es lo que evita el path traversal', () => {
    const resultado = sanitizeName('../../etc/passwd');
    expect(resultado).not.toContain('/');
    expect(resultado).not.toContain('..');
  });

  it('descarta caracteres no permitidos en nombres de archivo', () => {
    const resultado = sanitizeName('reporte<>:"|?*final');
    expect(resultado).toMatch(/^[a-z0-9-]*$/);
  });
});

describe('sanitizeEmailPrefix', () => {
  it('se queda con la parte anterior a la arroba', () => {
    expect(sanitizeEmailPrefix('ulises.rdgz@ciencias.unam.mx')).toBe('ulises.rdgz');
  });

  it('conserva punto, guion y guion bajo por legibilidad', () => {
    expect(sanitizeEmailPrefix('nombre.apellido_2@x.com')).toBe('nombre.apellido_2');
  });

  it('elimina barras y otros caracteres peligrosos para el sistema de archivos', () => {
    // Los puntos sobreviven (son legibles y seguros); las barras no.
    expect(sanitizeEmailPrefix('../../root@x.com')).toBe('....root');
  });

  it('no deja separadores de ruta aunque el correo los traiga', () => {
    const resultado = sanitizeEmailPrefix('a/b\\c@x.com');
    expect(resultado).not.toContain('/');
    expect(resultado).not.toContain('\\');
  });
});

describe('buildProjectPath', () => {
  it('arma la ruta con usuario sanitizado, id y proyecto sanitizado', () => {
    const { relativePath } = buildProjectPath('Ulises Rdgz', 7, 'Mi Análisis', 'tabla.csv');
    const segmentos = relativePath.split(path.sep);

    expect(segmentos[0]).toBe('projects');
    expect(segmentos[1]).toBe('ulises-rdgz_7');
    expect(segmentos[2]).toBe('mi-analisis');
    expect(segmentos[3]).toMatch(/^\d{4}-\d{2}-\d{2}T[\d-]+Z_tabla\.csv$/);
  });

  it('devuelve la ruta absoluta correspondiente a la relativa', () => {
    const { relativePath, fullPath } = buildProjectPath('u', 1, 'p', 'a.csv');
    expect(fullPath).toBe(path.resolve(relativePath));
  });

  it('antepone marca de tiempo para que dos subidas del mismo archivo no choquen', () => {
    const primera = buildProjectPath('u', 1, 'p', 'tabla.csv');
    const segunda = buildProjectPath('u', 1, 'p', 'tabla.csv');

    expect(path.basename(primera.relativePath)).toContain('tabla.csv');
    expect(path.basename(segunda.relativePath)).toContain('tabla.csv');
  });
});
