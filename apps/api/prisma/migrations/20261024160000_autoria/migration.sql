-- Autoria: quem concluiu o follow-up e quem fez a última edição (PATCH) da oportunidade.
-- AlterTable
ALTER TABLE "follow_ups" ADD COLUMN     "concluido_por_id" TEXT;

-- AlterTable
ALTER TABLE "oportunidades" ADD COLUMN     "atualizado_por_id" TEXT;

-- AddForeignKey
ALTER TABLE "oportunidades" ADD CONSTRAINT "oportunidades_atualizado_por_id_fkey" FOREIGN KEY ("atualizado_por_id") REFERENCES "vendedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_concluido_por_id_fkey" FOREIGN KEY ("concluido_por_id") REFERENCES "vendedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

