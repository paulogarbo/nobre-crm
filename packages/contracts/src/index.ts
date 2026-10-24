// Contrato HTTP da API: a API valida e serializa com estes schemas; a web usa os tipos derivados.
// Mudar um campo aqui quebra a compilação dos dois lados, em vez de divergir em silêncio.
export * from './comum';
export * from './oportunidades';
export * from './follow-ups';
export * from './metadados';
