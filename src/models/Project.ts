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
 * Avanza en un solo sentido: `PENDING`, `PROCESSING`, y de ahí a `COMPLETED` o
 * `FAILED`. No vuelve a `PENDING`; relanzar exige crear otro proyecto.
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
   * anterior al último guion bajo identifica la condición experimental, de la
   * que se deduce el grupo al construir la corrección por lotes.
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
 * Se traducen a la cadena compacta del argumento `-m` de R, en este orden:
 * edgeR 1, limma 2, NOISeq 3, DESeq2 4, análisis 5, integración 6.
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
 * Los tres primeros son cadena y no número a propósito: viajan literalmente a
 * los argumentos de R, y convertirlos arriesgaría cambios de representación.
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
 * Es la última de tres representaciones: `ProjectRow` es la fila cruda de la
 * base, `ProjectRecord` la entidad interna ya validada, y `Project` lo que viaja
 * en la API. Convierten `ProjectMapper` y `ProjectRecord.toProject`.
 * Los cuatro campos de configuración inician en `null`.
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
 * Las columnas `_json` guardan la configuración como texto y la base no valida
 * su contenido: `ProjectMapper` las deserializa y verifica antes de usarlas.
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
 * Conserva los nombres de columna de la base; la traducción al contrato público
 * vive solo en `toProject`. Se construye desde `mapProjectRowToRecord`.
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
