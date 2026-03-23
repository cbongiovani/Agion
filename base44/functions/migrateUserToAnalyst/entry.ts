import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  return Response.json({
    success: true,
    message: 'Migração de "user" para "analyst" concluída automaticamente no frontend!',
    note: 'Novos usuários serão criados como "analyst" por padrão.'
  });
});