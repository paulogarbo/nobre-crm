'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input, Select, Textarea } from '@/components/ui/primitivos';
import { CampoForm } from './formulario/CampoForm';
import { CamposItens } from './formulario/CamposItens';
import { useFormOportunidade } from './formulario/useFormOportunidade';
import type { ModoFormulario } from './formulario/valores';

export type { ModoFormulario } from './formulario/valores';
export { errosDoServidorPorCampo, lerValor } from './formulario/valores';

export function FormOportunidade({
  modo,
  onFechar,
  onCriada,
}: {
  modo: ModoFormulario | null;
  onFechar: () => void;
  onCriada: (codigo: string) => void;
}) {
  const {
    hoje,
    vendedores,
    valores,
    somenteObservacoes,
    enviando,
    desabilitado,
    id,
    erroDe,
    atualizar,
    atualizarItem,
    enviar,
  } = useFormOportunidade({ modo, onFechar, onCriada });

  return (
    <Dialog open={modo !== null} onOpenChange={(aberto) => !aberto && onFechar()}>
      <DialogContent className="max-w-2xl">
        {modo && valores && (
          <form
            noValidate
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void enviar();
            }}
          >
            <DialogHeader>
              <DialogTitle>
                {modo.tipo === 'criar' ? 'Nova oportunidade' : `Editar ${modo.op.codigo}`}
              </DialogTitle>
              <DialogDescription>
                {modo.tipo === 'criar'
                  ? 'A oportunidade nasce em Primeiro Contato. Para apresentar orçamento ela vai precisar de valor estimado, ao menos um item e validade da proposta.'
                  : somenteObservacoes
                    ? 'Oportunidade finalizada: apenas as observações podem ser editadas.'
                    : 'Altere os dados. A lista de itens enviada substitui a anterior.'}
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <CampoForm
                id={id('empresa')}
                rotulo="Empresa *"
                erro={erroDe('empresa')}
                className="sm:col-span-2"
              >
                <Input
                  id={id('empresa')}
                  value={valores.empresa}
                  disabled={desabilitado}
                  onChange={(e) => atualizar('empresa', e.target.value)}
                  aria-invalid={Boolean(erroDe('empresa'))}
                  autoFocus={!somenteObservacoes}
                />
              </CampoForm>
              <CampoForm id={id('vendedorId')} rotulo="Vendedor responsável" erro={erroDe('vendedorId')}>
                <Select
                  id={id('vendedorId')}
                  value={valores.vendedorId}
                  disabled={desabilitado}
                  onChange={(e) => atualizar('vendedorId', e.target.value)}
                >
                  {vendedores.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.nome}
                    </option>
                  ))}
                </Select>
              </CampoForm>
              <CampoForm id={id('valorEstimado')} rotulo="Valor estimado (R$)" erro={erroDe('valorEstimado')}>
                <Input
                  id={id('valorEstimado')}
                  inputMode="decimal"
                  placeholder="4.500,00"
                  value={valores.valorEstimado}
                  disabled={desabilitado}
                  onChange={(e) => atualizar('valorEstimado', e.target.value.replace(/[^\d.,]/g, ''))}
                  aria-invalid={Boolean(erroDe('valorEstimado'))}
                />
              </CampoForm>
              <CampoForm id={id('ultimoContato')} rotulo="Último contato" erro={erroDe('ultimoContato')}>
                <Input
                  id={id('ultimoContato')}
                  type="date"
                  max={hoje}
                  value={valores.ultimoContato}
                  disabled={desabilitado}
                  onChange={(e) => atualizar('ultimoContato', e.target.value)}
                  aria-invalid={Boolean(erroDe('ultimoContato'))}
                />
              </CampoForm>
              <CampoForm
                id={id('validadeProposta')}
                rotulo="Validade da proposta"
                erro={erroDe('validadeProposta')}
                ajuda="Obrigatória para apresentar orçamento."
              >
                <Input
                  id={id('validadeProposta')}
                  type="date"
                  value={valores.validadeProposta}
                  disabled={desabilitado}
                  onChange={(e) => atualizar('validadeProposta', e.target.value)}
                />
              </CampoForm>
              <CampoForm id={id('eventoCliente')} rotulo="Evento do cliente" erro={erroDe('eventoCliente')}>
                <Input
                  id={id('eventoCliente')}
                  type="date"
                  value={valores.eventoCliente}
                  disabled={desabilitado}
                  onChange={(e) => atualizar('eventoCliente', e.target.value)}
                />
              </CampoForm>
              <CampoForm id={id('cnpj')} rotulo="CNPJ" erro={erroDe('cnpj')}>
                <Input
                  id={id('cnpj')}
                  value={valores.cnpj}
                  disabled={desabilitado}
                  onChange={(e) => atualizar('cnpj', e.target.value)}
                />
              </CampoForm>
              <CampoForm id={id('contatoNome')} rotulo="Contato (nome)" erro={erroDe('contatoNome')}>
                <Input
                  id={id('contatoNome')}
                  value={valores.contatoNome}
                  disabled={desabilitado}
                  onChange={(e) => atualizar('contatoNome', e.target.value)}
                />
              </CampoForm>
              <CampoForm id={id('contatoEmail')} rotulo="E-mail do contato" erro={erroDe('contatoEmail')}>
                <Input
                  id={id('contatoEmail')}
                  type="email"
                  value={valores.contatoEmail}
                  disabled={desabilitado}
                  onChange={(e) => atualizar('contatoEmail', e.target.value)}
                  aria-invalid={Boolean(erroDe('contatoEmail'))}
                />
              </CampoForm>
              <CampoForm
                id={id('contatoTelefone')}
                rotulo="Telefone do contato"
                erro={erroDe('contatoTelefone')}
              >
                <Input
                  id={id('contatoTelefone')}
                  type="tel"
                  value={valores.contatoTelefone}
                  disabled={desabilitado}
                  onChange={(e) => atualizar('contatoTelefone', e.target.value)}
                />
              </CampoForm>
              <CampoForm
                id={id('observacoes')}
                rotulo="Observações"
                erro={erroDe('observacoes')}
                className="sm:col-span-2"
              >
                <Textarea
                  id={id('observacoes')}
                  value={valores.observacoes}
                  disabled={enviando}
                  onChange={(e) => atualizar('observacoes', e.target.value)}
                  autoFocus={somenteObservacoes}
                />
              </CampoForm>
            </div>

            {!somenteObservacoes && (
              <CamposItens
                valores={valores}
                enviando={enviando}
                erroDe={erroDe}
                atualizar={atualizar}
                atualizarItem={atualizarItem}
              />
            )}

            <DialogFooter>
              <Button variant="outline" onClick={onFechar}>
                Cancelar
              </Button>
              <Button type="submit" disabled={enviando}>
                {enviando ? 'Salvando…' : modo.tipo === 'criar' ? 'Criar oportunidade' : 'Salvar'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
