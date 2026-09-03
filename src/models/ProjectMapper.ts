/**
 * @file Mapper estricto de `projects` (DB) a entidad interna `ProjectRecord`.
 * Centraliza parseo/validación para no mezclar lógica en el modelo.
 *
 * @module models/ProjectMapper
 *
 * @author Ulises Rodríguez García
 */

import {
  type AnalysisParameters,
  type MethodsSelection,
  type NullableDateValue,
  type ProjectComparison,
  ProjectRecord,
  type ProjectRow,
  type Sample,
} from './Project';

/**
 * Normaliza fechas provenientes de MariaDB.
 * El driver puede devolver `Date` o la cadena cruda según la configuración de la
 * conexión, así que se homogeneiza antes de construir la entidad.
 *
 * @param value - Valor de fecha tal como llega de la fila.
 * @returns Fecha normalizada, o `null` si la columna venía vacía.
 */
const normalizeDate = (value: NullableDateValue): Date | null => {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value : new Date(value);
};

/**
 * Deserializa una de las columnas JSON de `projects`.
 *
 * Estas columnas guardan la configuración del análisis como texto, así que su
 * contenido no lo valida la base: puede venir corrupto o con el formato de una
 * versión anterior del esquema. Se falla con el nombre de la columna para que el
 * error identifique el origen y no un `SyntaxError` anónimo.
 *
 * @param columnName - Columna de la que proviene el valor, usada en el error.
 * @param value - Texto JSON almacenado.
 * @returns El valor deserializado, o `null` si la columna estaba vacía.
 * @throws {Error} Si el texto no es JSON válido.
 */
const parseJsonOrNull = (
  columnName: 'samples_json' | 'selected_methods_json' | 'comparisons_json' | 'parameters_json',
  value: string | null | undefined
): unknown | null => {
  if (!value || value.trim().length === 0) {
    return null;
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new Error(`Invalid JSON in projects.${columnName}`);
  }
};

/*
 * Validadores estrictos.
 *
 * No hacen coerción de tipos a propósito: un `"true"` en texto o un número donde
 * se espera cadena indican que lo guardado no corresponde al contrato, y es
 * preferible fallar al leer que arrastrar un valor mal tipado hasta el pipeline
 * de R, donde el error aparecería como un resultado incorrecto y no como una
 * excepción. El `fieldName` se propaga para que el mensaje señale la ruta exacta
 * dentro del JSON (por ejemplo `samples[3].name`).
 */

const toStrictNonEmptyString = (value: unknown, fieldName: string): string => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Invalid ${fieldName}: expected non-empty string`);
  }

  return value.trim();
};

const toStrictBoolean = (value: unknown, fieldName: string): boolean => {
  if (typeof value !== 'boolean') {
    throw new Error(`Invalid ${fieldName}: expected boolean`);
  }

  return value;
};

const toStrictRecord = (value: unknown, fieldName: string): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Invalid ${fieldName}: expected object`);
  }

  return value as Record<string, unknown>;
};

/**
 * Valida la selección de métodos de expresión diferencial.
 * Los seis campos son obligatorios: el pipeline de R los traduce a una cadena
 * compacta de dígitos, y un campo ausente cambiaría silenciosamente qué métodos
 * se ejecutan.
 */
const normalizeSelectedMethods = (value: unknown): MethodsSelection => {
  const methods = toStrictRecord(value, 'selectedMethods');
  return {
    edgeR: toStrictBoolean(methods.edgeR, 'selectedMethods.edgeR'),
    limma: toStrictBoolean(methods.limma, 'selectedMethods.limma'),
    noiseq: toStrictBoolean(methods.noiseq, 'selectedMethods.noiseq'),
    deseq2: toStrictBoolean(methods.deseq2, 'selectedMethods.deseq2'),
    dataAnalysis: toStrictBoolean(methods.dataAnalysis, 'selectedMethods.dataAnalysis'),
    integrationResults: toStrictBoolean(methods.integrationResults, 'selectedMethods.integrationResults'),
  };
};

/**
 * Valida los umbrales estadísticos del análisis.
 * `fdr`, `logFC` y `cpm` se conservan como cadena, no como número, porque viajan
 * tal cual a los argumentos de línea de comandos del script de R y convertirlos
 * a `number` introduciría cambios de representación (por ejemplo `0.05` a `5e-2`).
 */
const normalizeParameters = (value: unknown): AnalysisParameters => {
  const params = toStrictRecord(value, 'parameters');
  return {
    fdr: toStrictNonEmptyString(params.fdr, 'parameters.fdr'),
    logFC: toStrictNonEmptyString(params.logFC, 'parameters.logFC'),
    cpm: toStrictNonEmptyString(params.cpm, 'parameters.cpm'),
    top: toStrictBoolean(params.top, 'parameters.top'),
    corrplot: toStrictBoolean(params.corrplot, 'parameters.corrplot'),
  };
};

/**
 * Valida la lista de muestras del proyecto.
 *
 * A diferencia del resto, aquí sí se acepta más de un tipo de entrada: `batch` y
 * `originalName` se convierten con `String()` porque el frontend puede mandar el
 * lote como número. Lo que no se tolera es la cadena vacía tras recortar
 * espacios: `""` y `null` significan cosas distintas para el pipeline (sin lote
 * frente a lote en blanco), y confundirlos altera la corrección por lotes.
 */
const normalizeSamples = (value: unknown): Sample[] => {
  if (!Array.isArray(value)) {
    throw new Error('Invalid samples: expected array');
  }

  return value.map((row, index) => {
    const sample = toStrictRecord(row, `samples[${index}]`);
    const name = toStrictNonEmptyString(sample.name, `samples[${index}].name`);
    const batch =
      sample.batch === undefined || sample.batch === null
        ? null
        : String(sample.batch).trim();

    if (batch !== null && batch.length === 0) {
      throw new Error(`Invalid samples[${index}].batch: expected non-empty string or null`);
    }

    const originalName =
      sample.originalName === undefined || sample.originalName === null
        ? undefined
        : String(sample.originalName).trim();

    if (originalName !== undefined && originalName.length === 0) {
      throw new Error(`Invalid samples[${index}].originalName: expected non-empty string`);
    }

    return {
      name,
      batch,
      // Se omite la llave por completo cuando no hay valor, en lugar de fijarla
      // en `undefined`: así el objeto serializado no gana un campo vacío al
      // volver a guardarse en la columna JSON.
      ...(originalName !== undefined ? { originalName } : {}),
    };
  });
};

const normalizeComparisons = (value: unknown): ProjectComparison[] => {
  if (!Array.isArray(value)) {
    throw new Error('Invalid comparisons: expected array');
  }

  return value.map((row, index) => {
    const comparison = toStrictRecord(row, `comparisons[${index}]`);
    return {
      base: toStrictNonEmptyString(comparison.base, `comparisons[${index}].base`),
      target: toStrictNonEmptyString(comparison.target, `comparisons[${index}].target`),
      selected: toStrictBoolean(comparison.selected, `comparisons[${index}].selected`),
    };
  });
};

/*
 * Envolturas que dejan pasar el `null`.
 *
 * Un proyecto recién creado existe en la base con su archivo subido pero sin
 * configuración de análisis: esas cuatro columnas quedan en `NULL` hasta que el
 * usuario lanza la corrida. Los validadores de arriba son estrictos por diseño,
 * así que se antepone este filtro en lugar de relajarlos.
 */

const normalizeSelectedMethodsOrNull = (value: unknown | null): MethodsSelection | null => {
  if (value === null) {
    return null;
  }

  return normalizeSelectedMethods(value);
};

const normalizeParametersOrNull = (value: unknown | null): AnalysisParameters | null => {
  if (value === null) {
    return null;
  }

  return normalizeParameters(value);
};

const normalizeSamplesOrNull = (value: unknown | null): Sample[] | null => {
  if (value === null) {
    return null;
  }

  return normalizeSamples(value);
};

const normalizeComparisonsOrNull = (value: unknown | null): ProjectComparison[] | null => {
  if (value === null) {
    return null;
  }

  return normalizeComparisons(value);
};

/**
 * Verifica que la configuración del análisis esté completa o ausente por entero.
 *
 * Las cuatro columnas se escriben juntas al lanzar la corrida, así que un estado
 * intermedio —por ejemplo muestras sin comparaciones— solo puede venir de una
 * escritura interrumpida o de una migración a medias. Es un caso que el resto
 * del código no contempla: los controladores asumen que si hay muestras hay
 * parámetros. Se detecta aquí, al leer, en vez de fallar más adelante con un
 * `undefined` inexplicable al construir el comando de R.
 *
 * @throws {Error} Si unas están presentes y otras no.
 */
const ensureProjectConfigConsistency = (args: {
  samples: Sample[] | null;
  selectedMethods: MethodsSelection | null;
  comparisons: ProjectComparison[] | null;
  parameters: AnalysisParameters | null;
}): void => {
  const values = [args.samples, args.selectedMethods, args.comparisons, args.parameters];
  const nullCount = values.filter((value) => value === null).length;

  if (nullCount !== 0 && nullCount !== 4) {
    throw new Error(
      'Invalid project config: samples, selectedMethods, comparisons and parameters must be all null or all present'
    );
  }
};

/**
 * Deserializa y valida las cuatro columnas JSON de configuración de una fila.
 *
 * @param row - Fila cruda de `projects`.
 * @returns La configuración ya tipada, con los cuatro campos en `null` si el
 *          proyecto todavía no tiene corrida lanzada.
 */
const normalizeProjectConfig = (row: ProjectRow): {
  samples: Sample[] | null;
  selectedMethods: MethodsSelection | null;
  comparisons: ProjectComparison[] | null;
  parameters: AnalysisParameters | null;
} => {
  const samples = normalizeSamplesOrNull(parseJsonOrNull('samples_json', row.samples_json));
  const selectedMethods = normalizeSelectedMethodsOrNull(
    parseJsonOrNull('selected_methods_json', row.selected_methods_json)
  );
  const comparisons = normalizeComparisonsOrNull(
    parseJsonOrNull('comparisons_json', row.comparisons_json)
  );
  const parameters = normalizeParametersOrNull(
    parseJsonOrNull('parameters_json', row.parameters_json)
  );

  ensureProjectConfigConsistency({ samples, selectedMethods, comparisons, parameters });
  return { samples, selectedMethods, comparisons, parameters };
};

/**
 * Convierte una fila de `projects` en la entidad interna `ProjectRecord`.
 *
 * Único punto de entrada del módulo: todo lo que el backend lee de la tabla pasa
 * por aquí, de modo que el resto del código trabaja siempre con datos ya
 * validados y nunca con la fila cruda.
 *
 * El criterio ante un campo faltante difiere según su papel. Las columnas JSON
 * son estrictas y hacen fallar la lectura, porque de ellas depende la corrección
 * del análisis. Los campos descriptivos, en cambio, degradan a un valor por
 * defecto: un título vacío afea la interfaz, pero no justifica dejar
 * inaccesible un proyecto con resultados válidos.
 *
 * @param row - Fila tal como la devuelve MariaDB.
 * @returns Entidad lista para usarse en servicios y controladores.
 * @throws {Error} Si la configuración del análisis está corrupta o incompleta.
 */
export const mapProjectRowToRecord = (row: ProjectRow): ProjectRecord => {
  const config = normalizeProjectConfig(row);

  return new ProjectRecord({
    id_project: row.id_project,
    user_id: row.user_id,
    title: typeof row.title === 'string' ? row.title.trim() : '',
    description: row.description || '',
    path: row.path,
    // La columna admite NULL y cadena vacía; ambas significan "sin portada".
    imageUrl: row.image_url || undefined,
    samples: config.samples,
    selectedMethods: config.selectedMethods,
    comparisons: config.comparisons,
    parameters: config.parameters,
    status: row.status,
    // `ProjectRecord` exige fechas no nulas. Ante una columna vacía se recurre a
    // la época Unix, que al ordenar por fecha manda el proyecto al final y hace
    // evidente el dato faltante, en lugar de fingir que se creó ahora mismo.
    created_at: normalizeDate(row.created_at) || new Date(0),
    updated_at: normalizeDate(row.updated_at) || new Date(0),
  });
};
