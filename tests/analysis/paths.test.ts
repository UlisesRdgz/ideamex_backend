/**
 * @file Pruebas de resolucion de rutas y tipos de archivo de resultados.
 *
 * `resolveProjectAbsolutePath` es la barrera contra path traversal: recibe una
 * ruta que viene de la base de datos y debe garantizar que el resultado cae
 * dentro del directorio de proyectos. Si falla, se pueden servir archivos
 * arbitrarios del servidor.
 */

import path from 'path';
import {
  resolveProjectAbsolutePath,
  resolveResultDirectory,
  resolveProjectDirectoryCandidates,
  isAllowedResultFile,
  inferMimeType,
} from '../../src/api/analysis/controllers/analysis.shared.controller';

const BASE = path.resolve('/srv/ideamex/projects');

describe('resolveProjectAbsolutePath', () => {
  it('resuelve una ruta relativa normal dentro de la base', () => {
    expect(resolveProjectAbsolutePath(BASE, 'ulises/mi-proyecto/tabla.csv')).toBe(
      path.join(BASE, 'ulises', 'mi-proyecto', 'tabla.csv')
    );
  });

  it('normaliza separadores de Windows', () => {
    expect(resolveProjectAbsolutePath(BASE, 'ulises\\proyecto\\tabla.csv')).toBe(
      path.join(BASE, 'ulises', 'proyecto', 'tabla.csv')
    );
  });

  it('acepta la propia base', () => {
    expect(resolveProjectAbsolutePath(BASE, '.')).toBe(BASE);
  });

  describe('rechaza intentos de salir de la base', () => {
    it.each([
      ['padre directo', '../secreto.txt'],
      ['varios niveles', '../../../etc/passwd'],
      ['escape a media ruta', 'ulises/../../etc/passwd'],
      ['escape con separadores de Windows', 'ulises\\..\\..\\etc\\passwd'],
    ])('%s', (_caso, rutaRelativa) => {
      expect(resolveProjectAbsolutePath(BASE, rutaRelativa)).toBeNull();
    });
  });

  it('no se deja enganar por un prefijo que solo comparte texto con la base', () => {
    // /srv/ideamex/projects-secretos NO esta dentro de /srv/ideamex/projects
    expect(resolveProjectAbsolutePath(BASE, '../projects-secretos/x.txt')).toBeNull();
  });

  it('rechaza rutas vacias o en blanco', () => {
    expect(resolveProjectAbsolutePath(BASE, '')).toBeNull();
    expect(resolveProjectAbsolutePath(BASE, '   ')).toBeNull();
  });

  it('confina una ruta que parece absoluta en lugar de obedecerla', () => {
    // La barra inicial se neutraliza: '/etc/passwd' se interpreta relativo a la
    // base, no como ruta del sistema. El resultado sigue dentro del directorio
    // de proyectos, que es la propiedad que importa.
    const resuelta = resolveProjectAbsolutePath(BASE, '/etc/passwd');

    expect(resuelta).toBe(path.join(BASE, 'etc', 'passwd'));
    expect(resuelta?.startsWith(`${BASE}${path.sep}`)).toBe(true);
  });
});

describe('resolveResultDirectory', () => {
  it('devuelve el directorio del archivo de entrada, donde el pipeline escribe', () => {
    expect(resolveResultDirectory(BASE, { path: 'ulises/proyecto/tabla.csv' })).toBe(
      path.join(BASE, 'ulises', 'proyecto')
    );
  });

  it('hereda el rechazo de path traversal', () => {
    expect(resolveResultDirectory(BASE, { path: '../../etc/passwd' })).toBeNull();
  });
});

describe('resolveProjectDirectoryCandidates', () => {
  it('incluye la ruta derivada del archivo del proyecto', () => {
    const candidatos = resolveProjectDirectoryCandidates(BASE, {
      path: 'ulises/mi-proyecto/tabla.csv',
      title: 'Mi Proyecto',
    });

    expect(candidatos).toContain(path.join(BASE, 'ulises', 'mi-proyecto'));
  });

  it('agrega la variante legacy cuando la ruta trae el prefijo projects/', () => {
    const candidatos = resolveProjectDirectoryCandidates(BASE, {
      path: 'projects/ulises/mi-proyecto/tabla.csv',
      title: 'Mi Proyecto',
    });

    expect(candidatos).toContain(path.join(BASE, 'projects', 'ulises', 'mi-proyecto'));
    expect(candidatos).toContain(path.join(BASE, 'ulises', 'mi-proyecto'));
  });

  it('deriva un candidato por correo y titulo cuando se pasa el correo', () => {
    const candidatos = resolveProjectDirectoryCandidates(
      BASE,
      { path: 'otra/ruta/tabla.csv', title: 'Mi Análisis' },
      'ulises.rdgz@ciencias.unam.mx'
    );

    expect(candidatos).toContain(path.join(BASE, 'ulises.rdgz', 'mi-analisis'));
  });

  it('nunca devuelve la base misma, para no borrar todos los proyectos', () => {
    const candidatos = resolveProjectDirectoryCandidates(BASE, {
      path: 'tabla.csv',
      title: 'x',
    });

    expect(candidatos).not.toContain(BASE);
  });

  it('no repite candidatos', () => {
    const candidatos = resolveProjectDirectoryCandidates(BASE, {
      path: 'ulises/proyecto/tabla.csv',
      title: 'proyecto',
    });

    expect(new Set(candidatos).size).toBe(candidatos.length);
  });
});

describe('isAllowedResultFile', () => {
  it.each(['a.txt', 'a.log', 'a.csv', 'a.tsv', 'a.png', 'a.jpg', 'a.jpeg', 'a.svg', 'a.pdf', 'a.zip'])(
    'permite %s',
    (nombre) => {
      expect(isAllowedResultFile(nombre)).toBe(true);
    }
  );

  it('ignora mayusculas', () => {
    expect(isAllowedResultFile('GRAFICA.PNG')).toBe(true);
  });

  it.each(['script.sh', 'binario.exe', 'datos.rds', 'notas', 'config.env'])(
    'bloquea %s',
    (nombre) => {
      expect(isAllowedResultFile(nombre)).toBe(false);
    }
  );

  it('mira la ultima extension, no una intermedia', () => {
    expect(isAllowedResultFile('reporte.png.sh')).toBe(false);
  });
});

describe('inferMimeType', () => {
  it.each([
    ['tabla.csv', 'text/csv; charset=utf-8'],
    ['tabla.tsv', 'text/tab-separated-values; charset=utf-8'],
    ['salida.log', 'text/plain; charset=utf-8'],
    ['grafica.png', 'image/png'],
    ['grafica.jpeg', 'image/jpeg'],
    ['grafica.svg', 'image/svg+xml'],
    ['reporte.pdf', 'application/pdf'],
    ['todo.zip', 'application/zip'],
  ])('%s -> %s', (nombre, esperado) => {
    expect(inferMimeType(nombre)).toBe(esperado);
  });

  it('cae a octet-stream cuando la extension es desconocida', () => {
    expect(inferMimeType('archivo.desconocido')).toBe('application/octet-stream');
    expect(inferMimeType('sin-extension')).toBe('application/octet-stream');
  });
});
