-- ---------------------------------------------------------------------------
-- Añade el idioma de la cuenta a `users`.
--
-- Lo usan los correos transaccionales (activación y recuperación de contraseña)
-- para componer asunto y cuerpo en un solo idioma.
--
-- Las cuentas que ya existían se quedan en 'es', que es el valor por defecto de
-- la columna y el idioma en el que se les había escrito hasta ahora.
--
-- Aplicar sobre una base ya creada:
--   docker exec -i ideamex-db mariadb -uideamex -pideamex ideamex \
--     < deploy/migrations/2026-09-04_add_users_language.sql
-- ---------------------------------------------------------------------------

ALTER TABLE `users`
  ADD COLUMN `language` enum('es','en','fr') NOT NULL DEFAULT 'es' AFTER `auth_provider`;
