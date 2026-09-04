/**
 * @file Idiomas admitidos por la aplicación y utilidades para resolverlos.
 * Los códigos coinciden con los que ofrece el selector del frontend (ES/EN/FR).
 *
 * @module config/i18n
 *
 * @author Ulises Rodríguez García
 */

/** Códigos de idioma que la aplicación sabe traducir. */
export const SUPPORTED_LANGUAGES = ['es', 'en', 'fr'] as const;

/** Idioma admitido, derivado de `SUPPORTED_LANGUAGES` para no duplicar la lista. */
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/**
 * Idioma de respaldo. Es el del sitio institucional, así que un correo enviado
 * sin preferencia conocida sigue siendo legible para el destinatario esperado.
 */
export const DEFAULT_LANGUAGE: SupportedLanguage = 'es';

/**
 * Indica si un valor corresponde a un idioma admitido.
 */
export const isSupportedLanguage = (value: unknown): value is SupportedLanguage =>
  typeof value === 'string' &&
  (SUPPORTED_LANGUAGES as readonly string[]).includes(value.toLowerCase());

/**
 * Normaliza una etiqueta de idioma a uno de los admitidos.
 *
 * Acepta tanto el código simple (`es`) como el regional (`es-MX`, `fr_CA`),
 * porque los navegadores envían la variante regional con mucha frecuencia.
 *
 * @param value - Etiqueta de idioma recibida.
 * @returns Idioma admitido o `null` si no se reconoce.
 */
export const normalizeLanguage = (value: unknown): SupportedLanguage | null => {
  if (typeof value !== 'string') {
    return null;
  }

  // Solo interesa la subetiqueta primaria: `es-MX` y `es` son el mismo idioma.
  const primarySubtag = value.trim().toLowerCase().split(/[-_]/)[0];

  return isSupportedLanguage(primarySubtag) ? primarySubtag : null;
};

/**
 * Extrae el primer idioma admitido de una cabecera `Accept-Language`.
 *
 * Respeta el factor de calidad (`q`) para no quedarse con el primero listado
 * cuando el navegador declara una preferencia distinta con mayor peso.
 *
 * @param header - Contenido de la cabecera `Accept-Language`.
 * @returns Idioma admitido o `null` si ninguno lo es.
 */
export const parseAcceptLanguageHeader = (header: unknown): SupportedLanguage | null => {
  if (typeof header !== 'string' || header.trim() === '') {
    return null;
  }

  const candidates = header
    .split(',')
    .map((entry) => {
      const [tag, ...parameters] = entry.trim().split(';');
      const qualityParameter = parameters.find((parameter) => parameter.trim().startsWith('q='));
      const quality = qualityParameter ? Number.parseFloat(qualityParameter.split('=')[1]) : 1;

      return {
        language: normalizeLanguage(tag),
        // Una `q` mal formada equivale a no declararla: se asume prioridad máxima.
        quality: Number.isFinite(quality) ? quality : 1,
      };
    })
    .filter((candidate) => candidate.language !== null)
    // Orden estable descendente: a igual `q`, gana el declarado antes.
    .sort((a, b) => b.quality - a.quality);

  return candidates.length > 0 ? candidates[0].language : null;
};

/**
 * Resuelve el idioma de un usuario a partir de lo que se sepa de él.
 *
 * El orden refleja qué tan explícita es cada señal: lo que el usuario eligió en
 * la interfaz manda sobre la configuración de su navegador, y esta sobre el
 * idioma por defecto.
 *
 * @param preferredLanguage - Idioma enviado explícitamente (cuerpo de la petición o BD).
 * @param acceptLanguageHeader - Cabecera `Accept-Language` de la petición.
 * @returns Idioma admitido, nunca `null`.
 */
export const resolveLanguage = (
  preferredLanguage?: unknown,
  acceptLanguageHeader?: unknown
): SupportedLanguage =>
  normalizeLanguage(preferredLanguage) ??
  parseAcceptLanguageHeader(acceptLanguageHeader) ??
  DEFAULT_LANGUAGE;
