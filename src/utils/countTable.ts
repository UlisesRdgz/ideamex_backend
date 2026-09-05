/**
 * @file Validación técnica de la tabla de conteos que sube el usuario.
 *
 * Comprueba lo que el pipeline de R da por supuesto y no verifica por su cuenta:
 * que el archivo sea texto, que todos los renglones tengan el mismo número de
 * campos y que los nombres de columna no lleven espacios. Un error aquí no
 * detiene a R, lo desvía —renombra las columnas o interpreta mal las filas—, de
 * modo que el análisis termina "bien" con resultados que no corresponden a los
 * datos del usuario.
 *
 * @module utils/countTable
 * @requires fs
 * @requires readline
 *
 * @author Ulises Rodríguez García
 */

import fs from 'fs';
import readline from 'readline';

/** Separadores admitidos, en orden de preferencia. */
type Separator = '\t' | ',' | ';';

/** Resultado de la validación: correcto, o el motivo del rechazo. */
export type CountTableValidation = { ok: true } | { ok: false; error: string };

/** Bytes que se inspeccionan para decidir si el archivo es binario. */
const BINARY_PROBE_BYTES = 8192;

/**
 * Determina si el archivo contiene datos binarios.
 *
 * Se busca un byte nulo en la cabecera del archivo: no aparece en texto plano y
 * sí en la práctica totalidad de los formatos binarios, incluidos PNG y XLSX.
 * Hace falta porque la extensión del nombre no dice nada del contenido: basta
 * renombrar una imagen a `.txt` para sortear el filtro de multer.
 */
const looksBinary = (filePath: string): boolean => {
  const descriptor = fs.openSync(filePath, 'r');
  try {
    const buffer = Buffer.alloc(BINARY_PROBE_BYTES);
    const leidos = fs.readSync(descriptor, buffer, 0, BINARY_PROBE_BYTES, 0);
    return buffer.subarray(0, leidos).includes(0);
  } finally {
    fs.closeSync(descriptor);
  }
};

/**
 * Deduce el separador de columnas a partir del encabezado.
 *
 * Se elige el candidato que más veces aparece, en vez del primero encontrado,
 * porque un nombre de columna puede contener una coma sin que el archivo sea
 * separado por comas.
 */
const detectSeparator = (headerLine: string): Separator | null => {
  const candidatos: Separator[] = ['\t', ',', ';'];
  let mejor: Separator | null = null;
  let maximo = 0;

  for (const candidato of candidatos) {
    const apariciones = headerLine.split(candidato).length - 1;
    if (apariciones > maximo) {
      maximo = apariciones;
      mejor = candidato;
    }
  }

  return mejor;
};

/**
 * Valida la estructura de una tabla de conteos.
 *
 * @async
 * @function validateCountTableFile
 * @param filePath - Ruta absoluta del archivo recién subido.
 * @returns `{ ok: true }` o el motivo del rechazo, en un mensaje apto para el usuario.
 */
export const validateCountTableFile = async (
  filePath: string
): Promise<CountTableValidation> => {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return { ok: false, error: 'Invalid table: file could not be read' };
  }

  if (fs.statSync(filePath).size === 0) {
    return { ok: false, error: 'Invalid table: the file is empty' };
  }

  if (looksBinary(filePath)) {
    return { ok: false, error: 'Invalid table: the file is not plain text' };
  }

  // Se recorre por líneas en vez de cargar todo en memoria: el límite de subida
  // es de 25 MB y varias cargas simultáneas no deben competir por la memoria.
  const lector = readline.createInterface({
    input: fs.createReadStream(filePath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  let separador: Separator | null = null;
  let camposEncabezado = 0;
  let camposDatos = 0;
  let numeroDeLinea = 0;
  let filasDeDatos = 0;
  let fallo: string | null = null;

  try {
    for await (const lineaCruda of lector) {
      const linea = lineaCruda.replace(/\r$/, '');
      numeroDeLinea += 1;

      // Las líneas en blanco intercaladas no aportan datos ni invalidan la tabla.
      if (linea.trim() === '') {
        continue;
      }

      if (separador === null && numeroDeLinea === 1) {
        separador = detectSeparator(linea);
        if (separador === null) {
          fallo = 'Invalid table: no column separator found in the header row';
          break;
        }

        const encabezados = linea.split(separador);
        camposEncabezado = encabezados.length;

        if (camposEncabezado < 2) {
          fallo = 'Invalid table: at least one sample column is required';
          break;
        }

        // Un espacio en un nombre de columna no lo rechaza R: lo sustituye por un
        // punto. El análisis correría con nombres de muestra distintos a los que
        // escribió el usuario, sin aviso, así que se detiene aquí.
        const conEspacios = encabezados
          .map((nombre) => nombre.trim())
          .filter((nombre) => nombre !== '' && /\s/.test(nombre));

        if (conEspacios.length > 0) {
          fallo = `Invalid column names: spaces are not allowed (${conEspacios
            .slice(0, 3)
            .map((nombre) => `"${nombre}"`)
            .join(', ')}${conEspacios.length > 3 ? ', …' : ''})`;
          break;
        }

        continue;
      }

      const campos = linea.split(separador as Separator).length;
      filasDeDatos += 1;

      if (filasDeDatos === 1) {
        // R admite dos convenciones: que el encabezado nombre también la columna
        // de identificadores, o que la omita y tenga un campo menos que los datos.
        if (campos !== camposEncabezado && campos !== camposEncabezado + 1) {
          fallo =
            'Invalid table: inconsistent number of fields between the header ' +
            `and row ${numeroDeLinea}`;
          break;
        }
        camposDatos = campos;
        continue;
      }

      if (campos !== camposDatos) {
        fallo =
          'Invalid table: inconsistent number of fields ' +
          `(row ${numeroDeLinea} has ${campos}, expected ${camposDatos})`;
        break;
      }
    }
  } finally {
    lector.close();
  }

  if (fallo) {
    return { ok: false, error: fallo };
  }

  if (filasDeDatos === 0) {
    return { ok: false, error: 'Invalid table: the file has no data rows' };
  }

  return { ok: true };
};
