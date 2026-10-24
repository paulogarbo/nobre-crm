-- Numeração do código OPP-{n} por SEQUENCE: atômica e sem depender do índice único para resolver
-- corrida entre criações simultâneas (antes: MAX(n) + 1 com nova tentativa em caso de colisão).
-- OWNED BY: a sequência é removida com a coluna e reiniciada por TRUNCATE ... RESTART IDENTITY.
CREATE SEQUENCE "oportunidades_codigo_seq" AS INTEGER MINVALUE 2000 START WITH 2001 OWNED BY "oportunidades"."codigo";

-- Bancos que já têm oportunidades continuam do maior código existente.
SELECT setval(
  'oportunidades_codigo_seq',
  GREATEST(2000, COALESCE((SELECT MAX(CAST(SUBSTRING("codigo" FROM 5) AS INTEGER)) FROM "oportunidades" WHERE "codigo" ~ '^OPP-[0-9]+$'), 2000))
);
