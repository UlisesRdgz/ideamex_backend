/**
 * @file Contratos y entidad de proyecto.
 * Este módulo define únicamente tipos/entidades, sin parseo de DB.
 *
 * @module models/Project
 *
 * @author Ulises Rodríguez García
 */

/**
 * Estado de un proyecto dentro del ciclo de análisis.
 * Avanza en un solo sentido: `PENDING` al subir el archivo, `PROCESSING` al
 * lanzar la corrida de R, y de ahí a `COMPLETED` o `FAILED`. No se vuelve a
 * `PENDING`; relanzar un análisis exige crear otro proyecto.
 */
export type ProjectStatus = 'PENDING' | 'PROCESSING' | 'FAILED' | 'COMPLETED';

/**
 * Fecha tal como puede llegar del driver de MariaDB, que devuelve `Date` o la
 * cadena cruda según la configuración de la conexión.
 */
export type NullableDateValue = Date | string | null | undefined;

/**
 * Muestra del experimento, es decir una columna de la tabla de conteos.
 */
export interface Sample {
  /**
   * Nombre con formato `grupo_replica` (por ejemplo `control_1`). El prefijo
   * anterior al último guion bajo identifica la condición experimental, y de ahí
   * se deduce a qué grupo pertenece la muestra al construir la corrección por
   * lotes.
   */
  name: string;

  /**
   * Lote al que pertenece la muestra, o `null` si el experimento no tiene
   * efecto de lote que corregir. Debe ser `null` en todas las muestras o tener
   * valor en todas: el pipeline de R no admite lotes parciales.
   */
  batch: string | null;

  /**
   * Nombre original en el archivo subido, cuando el usuario lo renombró desde la
   * interfaz. Permite localizar la columna en la tabla de conteos sin depender
   * del nombre nuevo.
   */
  originalName?: string;
}

/**
 * Métodos de expresión diferencial elegidos por el usuario.
 * El backend los traduce a una cadena compacta de dígitos para el argumento
 * `-m` del script de R, en este mismo orden: edgeR 1, limma 2, NOISeq 3,
 * DESeq2 4, análisis de datos 5, integración de resultados 6.
 */
export interface MethodsSelection {
  edgeR: boolean;
  limma: boolean;
  noiseq: boolean;
  deseq2: boolean;
  dataAnalysis: boolean;
  integrationResults: boolean;
}

/**
 * Contraste entre dos condiciones experimentales.
 */
export interface ProjectComparison {
  /** Condición de referencia del contraste. */
  base: string;

  /** Condición que se compara contra la base. */
  target: string;

  /**
   * Si el usuario incluyó este contraste en la corrida. Las comparaciones no
   * seleccionadas se conservan para que la interfaz recuerde la elección, pero
   * no se envían a R.
   */
  selected: boolean;
}

/**
 * Umbrales estadísticos de la corrida.
 *
 * Los tres primeros son cadenas y no números a propósito: viajan literalmente a
 * los argumentos de línea de comandos del script de R, y convertirlos a `number`
 * arriesgaría cambios de representación (por ejemplo `0.05` a `5e-2`).
 */
export interface AnalysisParameters {
  /** Tasa de falsos descubrimientos (p-valor ajustado) para considerar significativo un gen. */
  fdr: string;

  /** Umbral mínimo de log fold-change. */
  logFC: string;

  /** Umbral de conteos por millón, usado para descartar genes poco expresados. */
  cpm: string;

  /** Si deben generarse las tablas y gráficas de genes más significativos. */
  top: boolean;

  /** Si debe generarse la gráfica de correlación entre muestras. */
  corrplot: boolean;
}

/**
 * Contrato de proyecto expuesto al frontend.
 *
 * Es una de las tres representaciones de un mismo proyecto, y conviene no
 * confundirlas: `ProjectRow` es la fila cruda de MariaDB con sus columnas en
 * `snake_case` y su configuración serializada como texto; `ProjectRecord` es la
 * entidad interna ya validada con la que trabaja el backend; y `Project` es lo
 * que finalmente viaja en las respuestas de la API. `ProjectMapper` convierte de
 * la primera a la segunda, y `ProjectRecord.toProject` de la segunda a esta.
 *
 * Los cuatro campos de configuración inician en `null` y solo se llenan al
 * lanzar la corrida.
 */
export interface Project {
  id?: number;
  title: string;
  description: string;
  imageUrl: string | undefined;
  file: File;
  samples: Sample[] | null;
  selectedMethods: MethodsSelection | null;
  comparisons: ProjectComparison[] | null;
  parameters: AnalysisParameters | null;
  createdAt?: Date;
  updatedAt?: Date;
  status?: ProjectStatus;
  userId?: string;
}

/**
 * Fila cruda de la tabla `projects` en MariaDB.
 *
 * Las columnas terminadas en `_json` guardan la configuración del análisis como
 * texto serializado, no como estructuras: la base no valida su contenido, así
 * que `ProjectMapper` las deserializa y verifica antes de que el resto del
 * backend las use.
 */
export interface ProjectRow {
  id_project: number;
  title: string | null;
  description: string | null;
  image_url?: string | null;
  path: string;
  samples_json?: string | null;
  selected_methods_json?: string | null;
  comparisons_json?: string | null;
  parameters_json?: string | null;
  created_at: NullableDateValue;
  updated_at: NullableDateValue;
  status: ProjectStatus;
  user_id: number;
}

export interface ProjectRecordParams {
  id_project: number;
  user_id: number;
  title: string;
  description: string;
  path: string;
  imageUrl: string | undefined;
  samples: Sample[] | null;
  selectedMethods: MethodsSelection | null;
  comparisons: ProjectComparison[] | null;
  parameters: AnalysisParameters | null;
  status: ProjectStatus;
  created_at: Date;
  updated_at: Date;
}

/**
 * Entidad interna usada por el backend para operar un proyecto ya normalizado.
 *
 * Conserva los nombres de columna de la base (`id_project`, `user_id`,
 * `created_at`) en lugar de adoptar `camelCase`, para que el mapeo desde la fila
 * sea directo y evidente. La traducción al contrato público ocurre en un único
 * lugar, `toProject`.
 *
 * Solo se construye desde `mapProjectRowToRecord`; instanciarla a mano saltaría
 * la validación.
 */
export class ProjectRecord {
  id_project: number;
  user_id: number;
  title: string;
  description: string;
  path: string;
  imageUrl: string | undefined;
  samples: Sample[] | null;
  selectedMethods: MethodsSelection | null;
  comparisons: ProjectComparison[] | null;
  parameters: AnalysisParameters | null;
  status: ProjectStatus;
  created_at: Date;
  updated_at: Date;

  constructor(params: ProjectRecordParams) {
    this.id_project = params.id_project;
    this.user_id = params.user_id;
    this.title = params.title;
    this.description = params.description;
    this.path = params.path;
    this.imageUrl = params.imageUrl;
    this.samples = params.samples;
    this.selectedMethods = params.selectedMethods;
    this.comparisons = params.comparisons;
    this.parameters = params.parameters;
    this.status = params.status;
    this.created_at = params.created_at;
    this.updated_at = params.updated_at;
  }

  /**
   * Traduce la entidad interna al contrato que consume el frontend.
   *
   * @returns El proyecto con los nombres y tipos que espera la API.
   */
  toProject(): Project {
    return {
      id: this.id_project,
      title: this.title,
      description: this.description,
      // `undefined` no viaja en JSON; serializamos `null` para mantener la llave.
      imageUrl: (this.imageUrl ?? null) as unknown as string | undefined,
      // El contrato declara `File` porque el frontend envía ese tipo al crear el
      // proyecto, pero de vuelta solo se expone la ruta relativa del archivo. La
      // doble conversión salva esa asimetría entre lo que entra y lo que sale.
      file: this.path as unknown as File,
      samples: this.samples,
      selectedMethods: this.selectedMethods,
      comparisons: this.comparisons,
      parameters: this.parameters,
      createdAt: this.created_at,
      updatedAt: this.updated_at,
      status: this.status,
      userId: String(this.user_id),
    };
  }
}
