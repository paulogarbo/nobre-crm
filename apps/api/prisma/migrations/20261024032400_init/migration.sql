-- CreateEnum
CREATE TYPE "Etapa" AS ENUM ('PRIMEIRO_CONTATO', 'APRESENTACAO_ORCAMENTO', 'FOLLOW_UP', 'FORECAST', 'FECHAMENTO', 'PERDIDA');

-- CreateEnum
CREATE TYPE "TipoFollowUp" AS ENUM ('PRIMEIRO_CONTATO_SLA', 'CONFIRMAR_PRAZO_EVENTO', 'REVISAR_PROPOSTA_VENCIDA', 'RENEGOCIAR_VALIDADE', 'CONFIRMAR_RECEBIMENTO_PROPOSTA', 'RETOMAR_NEGOCIACAO', 'CONFIRMAR_FECHAMENTO');

-- CreateEnum
CREATE TYPE "PrioridadeFollowUp" AS ENUM ('CRITICA', 'ALTA', 'MEDIA');

-- CreateEnum
CREATE TYPE "StatusFollowUp" AS ENUM ('ABERTO', 'CONCLUIDO', 'RESOLVIDO', 'SUBSTITUIDO');

-- CreateTable
CREATE TABLE "vendedores" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendedores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oportunidades" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "empresa" TEXT NOT NULL,
    "cnpj" TEXT,
    "contato_nome" TEXT,
    "contato_email" TEXT,
    "contato_telefone" TEXT,
    "vendedor_id" TEXT NOT NULL,
    "etapa" "Etapa" NOT NULL DEFAULT 'PRIMEIRO_CONTATO',
    "valor_estimado" DECIMAL(12,2),
    "ultimo_contato" DATE,
    "validade_proposta" DATE,
    "evento_cliente" DATE,
    "motivo_perda" TEXT,
    "observacoes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "oportunidades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "itens_brinde" (
    "id" TEXT NOT NULL,
    "oportunidade_id" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "valor_unitario" DECIMAL(12,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "itens_brinde_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transicoes_etapa" (
    "id" TEXT NOT NULL,
    "oportunidade_id" TEXT NOT NULL,
    "de_etapa" "Etapa",
    "para_etapa" "Etapa" NOT NULL,
    "motivo" TEXT,
    "vendedor_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transicoes_etapa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "follow_ups" (
    "id" TEXT NOT NULL,
    "oportunidade_id" TEXT NOT NULL,
    "tipo" "TipoFollowUp" NOT NULL,
    "prioridade" "PrioridadeFollowUp" NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "vence_em" DATE NOT NULL,
    "status" "StatusFollowUp" NOT NULL DEFAULT 'ABERTO',
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "encerrado_em" TIMESTAMP(3),

    CONSTRAINT "follow_ups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vendedores_email_key" ON "vendedores"("email");

-- CreateIndex
CREATE UNIQUE INDEX "oportunidades_codigo_key" ON "oportunidades"("codigo");

-- CreateIndex
CREATE INDEX "oportunidades_etapa_idx" ON "oportunidades"("etapa");

-- CreateIndex
CREATE INDEX "oportunidades_vendedor_id_idx" ON "oportunidades"("vendedor_id");

-- CreateIndex
CREATE INDEX "oportunidades_validade_proposta_idx" ON "oportunidades"("validade_proposta");

-- CreateIndex
CREATE INDEX "oportunidades_evento_cliente_idx" ON "oportunidades"("evento_cliente");

-- CreateIndex
CREATE INDEX "itens_brinde_oportunidade_id_idx" ON "itens_brinde"("oportunidade_id");

-- CreateIndex
CREATE INDEX "transicoes_etapa_oportunidade_id_created_at_idx" ON "transicoes_etapa"("oportunidade_id", "created_at");

-- CreateIndex
CREATE INDEX "follow_ups_oportunidade_id_status_idx" ON "follow_ups"("oportunidade_id", "status");

-- CreateIndex
CREATE INDEX "follow_ups_status_vence_em_idx" ON "follow_ups"("status", "vence_em");

-- AddForeignKey
ALTER TABLE "oportunidades" ADD CONSTRAINT "oportunidades_vendedor_id_fkey" FOREIGN KEY ("vendedor_id") REFERENCES "vendedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_brinde" ADD CONSTRAINT "itens_brinde_oportunidade_id_fkey" FOREIGN KEY ("oportunidade_id") REFERENCES "oportunidades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transicoes_etapa" ADD CONSTRAINT "transicoes_etapa_oportunidade_id_fkey" FOREIGN KEY ("oportunidade_id") REFERENCES "oportunidades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transicoes_etapa" ADD CONSTRAINT "transicoes_etapa_vendedor_id_fkey" FOREIGN KEY ("vendedor_id") REFERENCES "vendedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_oportunidade_id_fkey" FOREIGN KEY ("oportunidade_id") REFERENCES "oportunidades"("id") ON DELETE CASCADE ON UPDATE CASCADE;
