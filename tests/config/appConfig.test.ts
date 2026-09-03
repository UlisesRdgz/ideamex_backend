/**
 * @file Pruebas de la validacion de configuracion obligatoria al arranque.
 *
 * `checkRequiredConfig` es lo unico que impide que el servidor levante con una
 * clave de firma insegura, asi que conviene fijar su comportamiento.
 *
 * `appConfig` lee `process.env` al importarse, por eso cada caso reimporta el
 * modulo con `jest.isolateModules` tras ajustar el entorno.
 */

const cargarConfig = (
  jwtSecret: string | undefined
): typeof import('../../src/config/appConfig') => {
  let modulo!: typeof import('../../src/config/appConfig');

  jest.isolateModules(() => {
    // Se asigna aunque sea cadena vacia: dotenv no sobrescribe claves ya
    // presentes en process.env, asi que esto neutraliza el .env del proyecto.
    process.env.JWT_SECRET = jwtSecret ?? '';
    modulo = require('../../src/config/appConfig');
  });

  return modulo;
};

describe('checkRequiredConfig', () => {
  const entornoOriginal = process.env.JWT_SECRET;

  afterEach(() => {
    process.env.JWT_SECRET = entornoOriginal;
  });

  it('aborta cuando JWT_SECRET no esta definida', () => {
    const { checkRequiredConfig } = cargarConfig(undefined);
    expect(() => checkRequiredConfig()).toThrow(/JWT_SECRET no está definida/);
  });

  it('aborta cuando JWT_SECRET solo trae espacios', () => {
    const { checkRequiredConfig } = cargarConfig('   ');
    expect(() => checkRequiredConfig()).toThrow(/JWT_SECRET no está definida/);
  });

  it("aborta con el valor historico 'defaultsecret', que estuvo publicado en el codigo", () => {
    const { checkRequiredConfig } = cargarConfig('defaultsecret');
    expect(() => checkRequiredConfig()).toThrow(/valor inseguro/);
  });

  it('acepta una clave real', () => {
    const { checkRequiredConfig, appConfig } = cargarConfig('una-clave-larga-y-aleatoria');
    expect(() => checkRequiredConfig()).not.toThrow();
    expect(appConfig.jwtSecret).toBe('una-clave-larga-y-aleatoria');
  });

  it('recorta espacios alrededor de la clave', () => {
    const { appConfig } = cargarConfig('  clave-con-espacios  ');
    expect(appConfig.jwtSecret).toBe('clave-con-espacios');
  });

  it('el mensaje de error dice donde definir la variable', () => {
    const { checkRequiredConfig } = cargarConfig(undefined);
    expect(() => checkRequiredConfig()).toThrow(/env_file del docker-compose/);
  });
});
