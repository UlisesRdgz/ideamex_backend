/**
 * @file Configuracion de Jest para las pruebas unitarias del backend.
 *
 * Las pruebas viven en `tests/`, fuera de `src/`, para que no acaben en `dist/`:
 * el tsconfig.json compila solo `src/**` y el Dockerfile publica ese compilado.
 * La compilacion de los tests usa `tsconfig.test.json`, que agrega los globales
 * de Jest sin tocar la configuracion de produccion.
 */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }],
  },
  clearMocks: true,
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/**/*.docs.ts'],
};
