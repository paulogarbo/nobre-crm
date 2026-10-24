-- Invariante do motor de follow-up: no máximo UMA ação aberta por oportunidade.
-- Índice único parcial (o Prisma não expressa WHERE em @@unique, por isso o SQL manual).
CREATE UNIQUE INDEX "follow_ups_um_aberto_por_oportunidade" ON "follow_ups" ("oportunidade_id") WHERE "status" = 'ABERTO';
