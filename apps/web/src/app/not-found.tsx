import { redirect } from 'next/navigation';

// Qualquer rota inválida volta para o Kanban.
export default function NaoEncontrado() {
  redirect('/');
}
