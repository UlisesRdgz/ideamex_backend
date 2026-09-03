/**
 * @file Preparacion comun de las pruebas unitarias.
 *
 * Los helpers de `analysis.shared.controller` importan, de forma transitiva,
 * `config/db`, que crea un pool de MariaDB al cargarse. El pool no conecta solo,
 * pero deja handles abiertos que impiden que Jest cierre sus workers.
 *
 * Estas pruebas son de funciones puras y no tocan la base de datos, asi que se
 * sustituye el driver por un doble sin recursos. Si algun dia se agregan pruebas
 * de integracion, deberan usar su propia configuracion de Jest.
 */
jest.mock('mariadb', () => ({
  __esModule: true,
  default: {
    createPool: () => ({
      getConnection: jest.fn(),
      query: jest.fn(),
      end: jest.fn(),
    }),
  },
}));
