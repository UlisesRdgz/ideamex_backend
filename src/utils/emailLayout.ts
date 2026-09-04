/**
 * @file Plantilla común de los correos que envía la aplicación.
 *
 * Centraliza el armazón HTML, el logotipo y el remitente para que todos los
 * mensajes —activación, recuperación de contraseña y aviso de contacto— se vean
 * igual y se corrijan en un solo sitio.
 *
 * @module utils/emailLayout
 *
 * @author Ulises Rodríguez García
 */

import { SupportedLanguage } from '../config/i18n';
import {
  IDEAMEX_LOGO_BASE64,
  IDEAMEX_LOGO_CID,
  IDEAMEX_LOGO_FILENAME,
} from '../assets/logo';

/** Paleta institucional, replicada aquí porque el correo no carga hojas de estilo. */
export const COLORS = {
  brand: '#03355a',
  pageBackground: '#f6f7f9',
  cardBackground: '#ffffff',
  bodyText: '#333333',
  mutedText: '#6b7280',
  border: '#e5e7eb',
};

/** Firma que cierra todos los correos. */
export const EMAIL_FOOTER = 'IDEAMEX v2.0 · UNAM';

/**
 * Escapa los caracteres con significado en HTML.
 *
 * Es una implementación propia y no el paquete `escape-html`: ese no figura en
 * `dependencies` y hoy solo se resuelve porque Express lo arrastra, así que
 * depender de él dejaría el envío de correo a merced del árbol de terceros.
 */
export const escapeHTML = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/**
 * Adjunto en línea del logotipo, referenciado desde el HTML por su `cid`.
 *
 * Va incrustado y no como URL externa: los clientes de correo bloquean o no
 * resuelven imágenes remotas, y el host que se usaba antes dejó de servir el
 * archivo.
 */
export const buildLogoAttachment = () => ({
  filename: IDEAMEX_LOGO_FILENAME,
  content: Buffer.from(IDEAMEX_LOGO_BASE64, 'base64'),
  cid: IDEAMEX_LOGO_CID,
  contentType: 'image/png',
});

/**
 * Remitente configurado por entorno.
 */
export const buildSender = (): string =>
  `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM_EMAIL}>`;

/**
 * Envuelve el contenido de un correo en la tarjeta con encabezado y pie.
 *
 * La maquetación es con tablas y estilos en línea a propósito: los clientes de
 * correo ignoran hojas de estilo externas y varios no soportan flexbox, que era
 * justo lo que descuadraba el encabezado anterior.
 *
 * @param params.language - Idioma del documento, para el atributo `lang`.
 * @param params.title - Título del documento; suele coincidir con el asunto.
 * @param params.preheader - Resumen que algunos clientes muestran junto al asunto.
 * @param params.contentHTML - Contenido ya compuesto, sin encabezado ni pie.
 * @returns HTML completo listo para enviar.
 */
export const buildEmailShell = (params: {
  language: SupportedLanguage;
  title: string;
  preheader: string;
  contentHTML: string;
}): string => `<!DOCTYPE html>
<html lang="${params.language}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <title>${escapeHTML(params.title)}</title>
</head>
<body style="margin:0;padding:0;background-color:${COLORS.pageBackground};font-family:Tahoma,Geneva,Verdana,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHTML(params.preheader)}</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${COLORS.pageBackground};">
    <tr>
      <td align="center" style="padding:32px 12px;">

        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:${COLORS.cardBackground};border:1px solid ${COLORS.border};border-radius:12px;overflow:hidden;">

          <!-- Filete de marca. Sobre blanco el logotipo conserva su contraste, cosa
               que no ocurre cuando se coloca dentro de una barra azul completa. -->
          <tr>
            <td style="background-color:${COLORS.brand};height:6px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <tr>
            <td align="left" style="padding:32px 40px 0 40px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding-right:10px;" valign="middle">
                    <img src="cid:${IDEAMEX_LOGO_CID}" width="34" height="34" alt="IDEAMEX"
                         style="display:block;width:34px;height:34px;border:0;" />
                  </td>
                  <td valign="middle">
                    <span style="font-size:17px;font-weight:bold;color:${COLORS.brand};letter-spacing:1.5px;">IDEAMEX</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td>
${params.contentHTML}
            </td>
          </tr>

        </table>

        <!-- La firma va fuera de la tarjeta: es metadato del remitente, no contenido. -->
        <p style="margin:16px 0 0 0;font-size:12px;color:${COLORS.mutedText};">${EMAIL_FOOTER}</p>

      </td>
    </tr>
  </table>
</body>
</html>`;
