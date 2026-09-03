-- Tablas retiradas del esquema de IDEAMEX en septiembre de 2026.
--
-- Se crearon el 17-nov-2025 junto con el esquema original y nunca recibieron una
-- sola fila: 0 registros y UPDATE_TIME en NULL en las cuatro. Ninguna es
-- consultada por el backend, ninguna tiene llaves foraneas apuntandole, y el FAQ
-- del frontend tiene su contenido escrito a mano (i18n), sin leer `questions`.
--
-- Parecen funciones planeadas que nunca se implementaron: un panel de
-- administracion, articulos de ayuda, secciones informativas y preguntas
-- frecuentes. Se conservan aqui sus definiciones por si alguna se retoma.
--
-- Para restaurar cualquiera de ellas basta ejecutar su bloque contra la base.

CREATE TABLE `admins` (
  `id_admin` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `username` varchar(30) NOT NULL,
  `full_name` varchar(100) NOT NULL,
  `password` varchar(100) NOT NULL,
  `edited_at` datetime NOT NULL DEFAULT current_timestamp(),
  `level` tinyint(3) unsigned NOT NULL DEFAULT 1,
  PRIMARY KEY (`id_admin`),
  UNIQUE KEY `uk_admin_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `help_articles` (
  `id_help_article` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `title_es` varchar(100) NOT NULL,
  `description_es` text NOT NULL,
  `title_en` varchar(100) NOT NULL,
  `description_en` text NOT NULL,
  `help_section` int(10) unsigned NOT NULL,
  PRIMARY KEY (`id_help_article`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `info_sections` (
  `id_info_section` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `title_en` varchar(150) NOT NULL,
  `description_en` text NOT NULL,
  `title_es` varchar(150) NOT NULL,
  `description_es` text NOT NULL,
  `section_number` int(10) unsigned NOT NULL,
  PRIMARY KEY (`id_info_section`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `questions` (
  `id_question` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `title_es` varchar(100) NOT NULL,
  `description_es` text NOT NULL,
  `title_en` varchar(100) NOT NULL,
  `description_en` text NOT NULL,
  `question_section` int(10) unsigned NOT NULL,
  PRIMARY KEY (`id_question`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
