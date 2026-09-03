/**
 * @file Pruebas de `buildBatchFromSamples`.
 *
 * Traduce los lotes que manda el frontend al parametro `-b` del pipeline de R,
 * y de paso rechaza los disenos experimentales que R no puede corregir. Es la
 * logica con mas reglas de dominio del backend: un error aqui no revienta, solo
 * produce resultados estadisticos incorrectos, que es peor.
 *
 * Los nombres de muestra siguen el formato `grupo_replica`; el grupo es la
 * condicion experimental.
 */

import { buildBatchFromSamples } from '../../src/api/analysis/controllers/analysis.shared.controller';

describe('buildBatchFromSamples', () => {
  describe('casos sin lote', () => {
    it('devuelve null cuando no hay muestras', () => {
      expect(buildBatchFromSamples([])).toEqual({ value: null });
    });

    it('devuelve null cuando todas las muestras traen batch null', () => {
      const resultado = buildBatchFromSamples([
        { name: 'control_1', batch: null },
        { name: 'control_2', batch: null },
        { name: 'tratado_1', batch: null },
      ]);

      expect(resultado).toEqual({ value: null });
    });

    it('trata la cadena vacia como ausencia de lote', () => {
      const resultado = buildBatchFromSamples([
        { name: 'control_1', batch: '' },
        { name: 'tratado_1', batch: '   ' },
      ]);

      expect(resultado).toEqual({ value: null });
    });
  });

  describe('validacion de entrada', () => {
    it('rechaza elementos que no son objetos', () => {
      const resultado = buildBatchFromSamples([null as never]);
      expect(resultado.error).toMatch(/must contain only objects/);
    });

    it('rechaza nombres que no siguen el formato grupo_replica', () => {
      const resultado = buildBatchFromSamples([{ name: 'singuionbajo', batch: '1' }]);
      expect(resultado.error).toMatch(/group_replica/);
    });

    it('rechaza nombres que no son cadenas', () => {
      const resultado = buildBatchFromSamples([{ name: 42, batch: '1' }]);
      expect(resultado.error).toMatch(/group_replica/);
    });

    it('distingue batch ausente de batch null explicito', () => {
      const resultado = buildBatchFromSamples([{ name: 'control_1' }]);
      expect(resultado.error).toMatch(/use null when not applicable/);
    });

    it('rechaza lote parcial: unas muestras con valor y otras sin el', () => {
      const resultado = buildBatchFromSamples([
        { name: 'control_1', batch: '1' },
        { name: 'control_2', batch: null },
      ]);

      expect(resultado.value).toBeNull();
      expect(resultado.error).toMatch(/partial batch is not supported/);
    });
  });

  describe('disenos validos', () => {
    it('acepta que todas las muestras compartan un solo lote', () => {
      const resultado = buildBatchFromSamples([
        { name: 'control_1', batch: '1' },
        { name: 'control_2', batch: '1' },
        { name: 'tratado_1', batch: '1' },
      ]);

      expect(resultado).toEqual({ value: '1,1,1' });
    });

    it('acepta un diseno balanceado con dos lotes cruzados con las condiciones', () => {
      const resultado = buildBatchFromSamples([
        { name: 'control_1', batch: '1' },
        { name: 'tratado_1', batch: '1' },
        { name: 'control_2', batch: '2' },
        { name: 'tratado_2', batch: '2' },
      ]);

      expect(resultado).toEqual({ value: '1,1,2,2' });
    });

    it('conserva el orden de las muestras en la cadena resultante', () => {
      const resultado = buildBatchFromSamples([
        { name: 'a_1', batch: '2' },
        { name: 'b_1', batch: '1' },
        { name: 'a_2', batch: '1' },
        { name: 'b_2', batch: '2' },
      ]);

      expect(resultado.value).toBe('2,1,1,2');
    });

    it('normaliza valores numericos y con espacios a texto', () => {
      const resultado = buildBatchFromSamples([
        { name: 'control_1', batch: 1 },
        { name: 'tratado_1', batch: ' 1 ' },
      ]);

      expect(resultado).toEqual({ value: '1,1' });
    });
  });

  describe('disenos que R no puede corregir', () => {
    it('rechaza que cada muestra tenga su propio lote', () => {
      const resultado = buildBatchFromSamples([
        { name: 'control_1', batch: '1' },
        { name: 'control_2', batch: '2' },
        { name: 'tratado_1', batch: '3' },
      ]);

      expect(resultado.value).toBeNull();
      expect(resultado.error).toMatch(/must repeat at least one batch value/);
    });

    it('rechaza el lote confundido con la condicion', () => {
      // Cada lote contiene una sola condicion: el efecto de lote y el efecto
      // biologico son indistinguibles, y corregir uno borraria el otro.
      const resultado = buildBatchFromSamples([
        { name: 'control_1', batch: '1' },
        { name: 'control_2', batch: '1' },
        { name: 'tratado_1', batch: '2' },
        { name: 'tratado_2', batch: '2' },
      ]);

      expect(resultado.value).toBeNull();
      expect(resultado.error).toMatch(/confounded with replica group/);
    });

    it('acepta el diseno en cuanto un lote cruza dos condiciones', () => {
      // Mismo caso anterior, pero moviendo una muestra: el lote 1 pasa a
      // contener control y tratado, y el diseno deja de estar confundido.
      const resultado = buildBatchFromSamples([
        { name: 'control_1', batch: '1' },
        { name: 'tratado_1', batch: '1' },
        { name: 'tratado_2', batch: '2' },
        { name: 'control_2', batch: '2' },
      ]);

      expect(resultado.error).toBeUndefined();
      expect(resultado.value).toBe('1,1,2,2');
    });
  });
});
