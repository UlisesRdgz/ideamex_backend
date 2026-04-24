/**
 * @file Mapper estricto de `projects` (DB) a entidad interna `ProjectRecord`.
 * Centraliza parseo/validación para no mezclar lógica en el modelo.
 *
 * @module models/ProjectMapper
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

const normalizeDate = (value: NullableDateValue): Date | null => {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value : new Date(value);
};

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

    return { name, batch };
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

export const mapProjectRowToRecord = (row: ProjectRow): ProjectRecord => {
  const config = normalizeProjectConfig(row);

  return new ProjectRecord({
    id_project: row.id_project,
    user_id: row.user_id,
    title: typeof row.title === 'string' ? row.title.trim() : '',
    description: row.description || '',
    path: row.path,
    imageUrl: row.image_url || undefined,
    samples: config.samples,
    selectedMethods: config.selectedMethods,
    comparisons: config.comparisons,
    parameters: config.parameters,
    status: row.status,
    created_at: normalizeDate(row.created_at) || new Date(0),
    updated_at: normalizeDate(row.updated_at) || new Date(0),
  });
};
