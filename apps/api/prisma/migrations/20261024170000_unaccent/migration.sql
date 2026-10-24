-- Busca sem acento: "clinica" encontra "Clínica". A extensão vem no contrib do PostgreSQL
-- (incluída na imagem oficial); criá-la exige um usuário com permissão (dono do banco ou superusuário).
CREATE EXTENSION IF NOT EXISTS unaccent;
