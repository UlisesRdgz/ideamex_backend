/**
 * @file Pruebas de la validacion tecnica de la tabla de conteos.
 *
 * Es la unica barrera entre lo que sube el usuario y el pipeline de R. R no
 * rechaza estos errores: los absorbe renombrando columnas o desalineando
 * renglones, de modo que un fallo aqui produce un analisis que termina "bien"
 * sobre datos que no son los del usuario.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { validateCountTableFile } from '../../src/utils/countTable';

let carpeta: string;

beforeAll(() => {
  carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'ideamex-tabla-'));
});

afterAll(() => {
  fs.rmSync(carpeta, { recursive: true, force: true });
});

/** Escribe un archivo temporal y devuelve su ruta. */
const archivoCon = (nombre: string, contenido: string | Buffer): string => {
  const ruta = path.join(carpeta, nombre);
  fs.writeFileSync(ruta, contenido);
  return ruta;
};

describe('tablas validas', () => {
  it('acepta una tabla separada por tabuladores', async () => {
    const ruta = archivoCon(
      'valida.txt',
      ['\tctrl_1\tctrl_2\ttrat_1', 'gen1\t10\t20\t30', 'gen2\t1\t2\t3'].join('\n')
    );
    await expect(validateCountTableFile(ruta)).resolves.toEqual({ ok: true });
  });

  it('acepta separacion por comas', async () => {
    const ruta = archivoCon(
      'valida.csv',
      ['id,ctrl_1,trat_1', 'gen1,10,30', 'gen2,1,3'].join('\n')
    );
    await expect(validateCountTableFile(ruta)).resolves.toEqual({ ok: true });
  });

  it('acepta el encabezado sin la columna de identificadores, como escribe R', async () => {
    // Convencion `row.names`: el encabezado nombra solo las muestras y tiene un
    // campo menos que los renglones de datos.
    const ruta = archivoCon(
      'rownames.txt',
      ['ctrl_1\tctrl_2', 'gen1\t10\t20', 'gen2\t1\t2'].join('\n')
    );
    await expect(validateCountTableFile(ruta)).resolves.toEqual({ ok: true });
  });

  it('tolera lineas en blanco intercaladas y al final', async () => {
    const ruta = archivoCon(
      'blancos.txt',
      ['\tctrl_1\ttrat_1', 'gen1\t10\t30', '', 'gen2\t1\t3', ''].join('\n')
    );
    await expect(validateCountTableFile(ruta)).resolves.toEqual({ ok: true });
  });

  it('tolera finales de linea de Windows', async () => {
    const ruta = archivoCon(
      'crlf.txt',
      ['\tctrl_1\ttrat_1', 'gen1\t10\t30', 'gen2\t1\t3'].join('\r\n')
    );
    await expect(validateCountTableFile(ruta)).resolves.toEqual({ ok: true });
  });
});

describe('numero inconsistente de campos', () => {
  it('rechaza un renglon con campos de menos', async () => {
    const ruta = archivoCon(
      'desigual.txt',
      ['\tctrl_1\tctrl_2\ttrat_1', 'gen1\t10\t20\t30', 'gen2\t1\t2'].join('\n')
    );
    const resultado = await validateCountTableFile(ruta);
    expect(resultado.ok).toBe(false);
    expect((resultado as { error: string }).error).toMatch(/inconsistent number of fields/i);
  });

  it('senala el numero de renglon donde aparece el problema', async () => {
    const ruta = archivoCon(
      'desigual-tarde.txt',
      ['\ta\tb', 'gen1\t1\t2', 'gen2\t1\t2', 'gen3\t1'].join('\n')
    );
    const resultado = await validateCountTableFile(ruta);
    expect((resultado as { error: string }).error).toContain('row 4');
  });
});

describe('nombres de columna con espacios', () => {
  it('rechaza espacios en los nombres de muestra', async () => {
    const ruta = archivoCon(
      'espacios.txt',
      ['\tvidrio ctrl 1\tvidrio DL1 1', 'gen1\t10\t30'].join('\n')
    );
    const resultado = await validateCountTableFile(ruta);
    expect(resultado.ok).toBe(false);
    expect((resultado as { error: string }).error).toMatch(/Invalid column names/i);
  });

  it('rechaza espacios tambien en la columna de identificadores', async () => {
    const ruta = archivoCon(
      'espacios-id.txt',
      ['locus tag\tctrl_1', 'gen1\t10'].join('\n')
    );
    const resultado = await validateCountTableFile(ruta);
    expect(resultado.ok).toBe(false);
  });
});

describe('archivos que no son tablas', () => {
  it('rechaza contenido binario aunque la extension sea .txt', async () => {
    // Firma de un PNG: la extension no dice nada del contenido.
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00]);
    const ruta = archivoCon('imagen.txt', png);
    const resultado = await validateCountTableFile(ruta);
    expect(resultado.ok).toBe(false);
    expect((resultado as { error: string }).error).toMatch(/not plain text/i);
  });

  it('rechaza un archivo vacio', async () => {
    const ruta = archivoCon('vacio.txt', '');
    const resultado = await validateCountTableFile(ruta);
    expect(resultado.ok).toBe(false);
    expect((resultado as { error: string }).error).toMatch(/empty/i);
  });

  it('rechaza un encabezado sin separadores', async () => {
    const ruta = archivoCon('sin-separador.txt', 'solo_una_columna\ngen1\n');
    const resultado = await validateCountTableFile(ruta);
    expect(resultado.ok).toBe(false);
    expect((resultado as { error: string }).error).toMatch(/no column separator/i);
  });

  it('rechaza una tabla sin renglones de datos', async () => {
    const ruta = archivoCon('solo-encabezado.txt', '\tctrl_1\ttrat_1\n');
    const resultado = await validateCountTableFile(ruta);
    expect(resultado.ok).toBe(false);
    expect((resultado as { error: string }).error).toMatch(/no data rows/i);
  });

  it('rechaza una ruta inexistente', async () => {
    const resultado = await validateCountTableFile(path.join(carpeta, 'no-existe.txt'));
    expect(resultado.ok).toBe(false);
  });
});
