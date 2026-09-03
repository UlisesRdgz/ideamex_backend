/**
 * @file Pruebas de los helpers de payload y de deteccion de errores de MariaDB.
 */

import {
  extractUploadImageUrl,
  isDuplicateEntryError,
} from '../../src/api/analysis/controllers/analysis.shared.controller';

describe('extractUploadImageUrl', () => {
  it('devuelve la URL cuando viene con contenido', () => {
    expect(extractUploadImageUrl({ imageUrl: 'https://x.mx/a.png' })).toBe('https://x.mx/a.png');
  });

  it('recorta espacios alrededor', () => {
    expect(extractUploadImageUrl({ imageUrl: '  https://x.mx/a.png  ' })).toBe(
      'https://x.mx/a.png'
    );
  });

  it('devuelve undefined cuando falta el campo', () => {
    expect(extractUploadImageUrl({})).toBeUndefined();
  });

  it('trata una cadena vacia o en blanco como ausencia', () => {
    expect(extractUploadImageUrl({ imageUrl: '' })).toBeUndefined();
    expect(extractUploadImageUrl({ imageUrl: '    ' })).toBeUndefined();
  });

  it('ignora valores que no son cadenas', () => {
    expect(extractUploadImageUrl({ imageUrl: 42 })).toBeUndefined();
    expect(extractUploadImageUrl({ imageUrl: null })).toBeUndefined();
    expect(extractUploadImageUrl({ imageUrl: { url: 'x' } })).toBeUndefined();
  });
});

describe('isDuplicateEntryError', () => {
  it('reconoce el error por su code', () => {
    expect(isDuplicateEntryError({ code: 'ER_DUP_ENTRY' })).toBe(true);
  });

  it('reconoce el error por su errno', () => {
    expect(isDuplicateEntryError({ errno: 1062 })).toBe(true);
  });

  it('no confunde otros errores de base de datos', () => {
    expect(isDuplicateEntryError({ code: 'ER_NO_SUCH_TABLE', errno: 1146 })).toBe(false);
  });

  it('tolera valores que no son errores', () => {
    expect(isDuplicateEntryError(null)).toBe(false);
    expect(isDuplicateEntryError(undefined)).toBe(false);
    expect(isDuplicateEntryError('ER_DUP_ENTRY')).toBe(false);
    expect(isDuplicateEntryError(1062)).toBe(false);
  });
});
