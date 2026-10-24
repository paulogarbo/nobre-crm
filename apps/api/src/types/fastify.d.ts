import 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    /** Vendedor identificado pelo header `x-vendedor-id` (stand-in de autenticação). */
    vendedor: { id: string; nome: string } | null;
  }
}
