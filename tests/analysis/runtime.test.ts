/**
 * @file Pruebas de `buildAnalysisRuntimeCommand`.
 *
 * Construye el comando que ejecuta el pipeline de R, en modo local o via
 * `docker exec`. Importa por dos razones: los argumentos deben coincidir con lo
 * que espera RunMainIDEAMEX.r, y el mapeo de rutas host -> contenedor es la
 * barrera que impide que el analisis escriba fuera del directorio de proyectos.
 */

import path from 'path';
import { buildAnalysisRuntimeCommand } from '../../src/api/analysis/controllers/analysis.shared.controller';
import type { AnalysisRunParams } from '../../src/api/analysis/analysis.service';

const HOST_BASE = path.resolve('/srv/ideamex/projects');
const ENTRADA = path.join(HOST_BASE, 'ulises', 'proyecto', 'tabla.csv');
const SALIDA = path.join(HOST_BASE, 'ulises', 'proyecto');

const parametros = (extra: Partial<AnalysisRunParams> = {}): AnalysisRunParams => ({
  methods: '1234',
  logfc: 1,
  cpm: 0.5,
  padjust: 0.05,
  batch: null,
  generateZip: false,
  top: true,
  ...extra,
});

const entornoOriginal = { ...process.env };

afterEach(() => {
  process.env = { ...entornoOriginal };
});

describe('modo local', () => {
  beforeEach(() => {
    process.env.ANALYSIS_EXECUTION_MODE = 'local';
    // El modo local exige que el script exista en disco; se usa este mismo
    // archivo de prueba como ruta valida para no depender de fixtures.
    process.env.ANALYSIS_SCRIPT_PATH = __filename;
    delete process.env.ANALYSIS_SOURCES_PATH;
    delete process.env.ANALYSIS_RSCRIPT_BIN;
  });

  it('usa Rscript por defecto y pasa el script como primer argumento', () => {
    const { runtime, error } = buildAnalysisRuntimeCommand({
      inputPath: ENTRADA,
      outputDir: SALIDA,
      runParams: parametros(),
    });

    expect(error).toBeUndefined();
    expect(runtime?.command).toBe('Rscript');
    expect(runtime?.args[0]).toBe(__filename);
  });

  it('respeta ANALYSIS_RSCRIPT_BIN cuando esta definida', () => {
    process.env.ANALYSIS_RSCRIPT_BIN = '/usr/local/bin/Rscript';

    const { runtime } = buildAnalysisRuntimeCommand({
      inputPath: ENTRADA,
      outputDir: SALIDA,
      runParams: parametros(),
    });

    expect(runtime?.command).toBe('/usr/local/bin/Rscript');
  });

  it('agrega -s solo cuando hay ruta de fuentes', () => {
    const sin = buildAnalysisRuntimeCommand({
      inputPath: ENTRADA,
      outputDir: SALIDA,
      runParams: parametros(),
    });
    expect(sin.runtime?.args).not.toContain('-s');

    process.env.ANALYSIS_SOURCES_PATH = '/opt/ideamexCLI/src';
    const con = buildAnalysisRuntimeCommand({
      inputPath: ENTRADA,
      outputDir: SALIDA,
      runParams: parametros(),
    });
    expect(con.runtime?.args).toEqual(
      expect.arrayContaining(['-s', '/opt/ideamexCLI/src'])
    );
  });

  it('falla de forma controlada si no hay ANALYSIS_SCRIPT_PATH', () => {
    delete process.env.ANALYSIS_SCRIPT_PATH;

    const { runtime, error } = buildAnalysisRuntimeCommand({
      inputPath: ENTRADA,
      outputDir: SALIDA,
      runParams: parametros(),
    });

    expect(runtime).toBeNull();
    expect(error).toMatch(/ANALYSIS_SCRIPT_PATH is not configured/);
  });

  it('falla si el script configurado no existe en disco', () => {
    process.env.ANALYSIS_SCRIPT_PATH = '/ruta/que/no/existe/RunMainIDEAMEX.r';

    const { runtime, error } = buildAnalysisRuntimeCommand({
      inputPath: ENTRADA,
      outputDir: SALIDA,
      runParams: parametros(),
    });

    expect(runtime).toBeNull();
    expect(error).toMatch(/Analysis script not found/);
  });

  it('un modo desconocido cae a local en vez de romper', () => {
    process.env.ANALYSIS_EXECUTION_MODE = 'kubernetes';

    const { runtime } = buildAnalysisRuntimeCommand({
      inputPath: ENTRADA,
      outputDir: SALIDA,
      runParams: parametros(),
    });

    expect(runtime?.command).toBe('Rscript');
  });
});

describe('argumentos del pipeline', () => {
  beforeEach(() => {
    process.env.ANALYSIS_EXECUTION_MODE = 'local';
    process.env.ANALYSIS_SCRIPT_PATH = __filename;
  });

  it('traduce los parametros a las banderas que espera el script de R', () => {
    const { runtime } = buildAnalysisRuntimeCommand({
      inputPath: ENTRADA,
      outputDir: SALIDA,
      runParams: parametros({ methods: '1236', logfc: 2, cpm: 1.5, padjust: 0.01 }),
    });

    const args = runtime?.args ?? [];
    const valorDe = (bandera: string) => args[args.indexOf(bandera) + 1];

    expect(valorDe('-i')).toBe(ENTRADA);
    expect(valorDe('-o')).toBe(SALIDA);
    expect(valorDe('-m')).toBe('1236');
    expect(valorDe('-l')).toBe('2');
    expect(valorDe('-f')).toBe('1.5');
    expect(valorDe('-u')).toBe('0.01');
  });

  it('convierte los booleanos al literal TRUE/FALSE de R, no a true/false', () => {
    const { runtime } = buildAnalysisRuntimeCommand({
      inputPath: ENTRADA,
      outputDir: SALIDA,
      runParams: parametros({ generateZip: true, top: false }),
    });

    const args = runtime?.args ?? [];
    expect(args[args.indexOf('-g') + 1]).toBe('TRUE');
    expect(args[args.indexOf('-t') + 1]).toBe('FALSE');
  });

  it('omite -b cuando no hay lote y lo incluye cuando lo hay', () => {
    const sinLote = buildAnalysisRuntimeCommand({
      inputPath: ENTRADA,
      outputDir: SALIDA,
      runParams: parametros({ batch: null }),
    });
    expect(sinLote.runtime?.args).not.toContain('-b');

    const conLote = buildAnalysisRuntimeCommand({
      inputPath: ENTRADA,
      outputDir: SALIDA,
      runParams: parametros({ batch: '1,1,2,2' }),
    });
    const args = conLote.runtime?.args ?? [];
    expect(args[args.indexOf('-b') + 1]).toBe('1,1,2,2');
  });

  it('pasa cada valor como argumento suelto, nunca como cadena de shell', () => {
    // Es lo que impide inyeccion de comandos: spawn recibe un arreglo y no hay
    // shell que interprete metacaracteres.
    const { runtime } = buildAnalysisRuntimeCommand({
      inputPath: ENTRADA,
      outputDir: SALIDA,
      runParams: parametros({ batch: '1; rm -rf /' }),
    });

    const args = runtime?.args ?? [];
    expect(args[args.indexOf('-b') + 1]).toBe('1; rm -rf /');
    expect(args.some((arg) => arg.includes('&&') || arg.includes('|'))).toBe(false);
  });
});

describe('modo docker', () => {
  beforeEach(() => {
    process.env.ANALYSIS_EXECUTION_MODE = 'docker';
    process.env.ANALYSIS_DOCKER_CONTAINER = 'ideamex-r';
    process.env.ANALYSIS_DOCKER_SCRIPT_PATH = '/app/ideamexCLI/src/RunMainIDEAMEX.r';
    process.env.ANALYSIS_DOCKER_HOST_PROJECTS_PATH = HOST_BASE;
    process.env.ANALYSIS_DOCKER_CONTAINER_PROJECTS_PATH = '/workspace/projects';
    delete process.env.ANALYSIS_DOCKER_SOURCES_PATH;
  });

  it('arma un docker exec contra el contenedor de R', () => {
    const { runtime, error } = buildAnalysisRuntimeCommand({
      inputPath: ENTRADA,
      outputDir: SALIDA,
      runParams: parametros(),
    });

    expect(error).toBeUndefined();
    expect(runtime?.command).toBe('docker');
    expect(runtime?.args.slice(0, 4)).toEqual([
      'exec',
      'ideamex-r',
      'Rscript',
      '/app/ideamexCLI/src/RunMainIDEAMEX.r',
    ]);
  });

  it('traduce las rutas del host a las del contenedor', () => {
    const { runtime } = buildAnalysisRuntimeCommand({
      inputPath: ENTRADA,
      outputDir: SALIDA,
      runParams: parametros(),
    });

    const args = runtime?.args ?? [];
    expect(args[args.indexOf('-i') + 1]).toBe('/workspace/projects/ulises/proyecto/tabla.csv');
    expect(args[args.indexOf('-o') + 1]).toBe('/workspace/projects/ulises/proyecto');
  });

  it('rechaza una entrada fuera del directorio de proyectos del host', () => {
    const { runtime, error } = buildAnalysisRuntimeCommand({
      inputPath: '/etc/passwd',
      outputDir: SALIDA,
      runParams: parametros(),
    });

    expect(runtime).toBeNull();
    expect(error).toMatch(/outside ANALYSIS_DOCKER_HOST_PROJECTS_PATH/);
  });

  it('rechaza una salida que escapa por path traversal', () => {
    const { runtime, error } = buildAnalysisRuntimeCommand({
      inputPath: ENTRADA,
      outputDir: path.join(HOST_BASE, '..', '..', 'etc'),
      runParams: parametros(),
    });

    expect(runtime).toBeNull();
    expect(error).toMatch(/outside ANALYSIS_DOCKER_HOST_PROJECTS_PATH/);
  });

  it('exige el nombre del contenedor', () => {
    delete process.env.ANALYSIS_DOCKER_CONTAINER;

    const { runtime, error } = buildAnalysisRuntimeCommand({
      inputPath: ENTRADA,
      outputDir: SALIDA,
      runParams: parametros(),
    });

    expect(runtime).toBeNull();
    expect(error).toMatch(/ANALYSIS_DOCKER_CONTAINER is not configured/);
  });

  it('exige la ruta del script dentro del contenedor', () => {
    delete process.env.ANALYSIS_DOCKER_SCRIPT_PATH;

    const { runtime, error } = buildAnalysisRuntimeCommand({
      inputPath: ENTRADA,
      outputDir: SALIDA,
      runParams: parametros(),
    });

    expect(runtime).toBeNull();
    expect(error).toMatch(/ANALYSIS_DOCKER_SCRIPT_PATH is not configured/);
  });

  it('usa rutas POSIX dentro del contenedor aunque el host sea Windows', () => {
    const { runtime } = buildAnalysisRuntimeCommand({
      inputPath: ENTRADA,
      outputDir: SALIDA,
      runParams: parametros(),
    });

    const args = runtime?.args ?? [];
    expect(args[args.indexOf('-i') + 1]).not.toContain('\\');
  });
});
