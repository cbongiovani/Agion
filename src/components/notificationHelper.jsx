
import { base44 } from '@/api/base44Client';

/**
 * Envia notificações para coordenadores sobre novos registros
 */
export async function notificarCoordenadores(tipo, titulo, mensagem, link = null) {
  try {
    // Buscar todos os usuários com role 'admin' (coordenadores)
    const users = await base44.entities.User.list();
    const coordenadores = users.filter(u => u.role === 'admin');
    
    // Criar notificações para cada coordenador
    const notificacoes = coordenadores.map(coord => ({
      destinatario_id: coord.id,
      tipo,
      titulo,
      mensagem,
      link,
      lida: false,
    }));
    
    if (notificacoes.length > 0) {
      await base44.entities.Notificacao.bulkCreate(notificacoes);
    }
  } catch (error) {
    console.error('Erro ao notificar coordenadores:', error);
  }
}

/**
 * Envia notificação para um supervisor específico
 */
export async function notificarSupervisor(supervisorId, tipo, titulo, mensagem, link = null) {
  try {
    const supervisor = await base44.entities.Supervisor.filter({ id: supervisorId });
    if (supervisor.length > 0 && supervisor[0].usuario_email) {
      const users = await base44.entities.User.filter({ email: supervisor[0].usuario_email });
      if (users.length > 0) {
        await base44.entities.Notificacao.create({
          destinatario_id: users[0].id,
          tipo,
          titulo,
          mensagem,
          link,
          lida: false,
        });
      }
    }
  } catch (error) {
    console.error('Erro ao notificar supervisor:', error);
  }
}

/**
 * Alerta supervisor sobre atividade que precisa de atenção
 */
export async function alertarAtividade(atividadeId, analistaNome, supervisorId) {
  try {
    await notificarSupervisor(
      supervisorId,
      'alerta_atividade',
      '🔴 Atividade Requer Atenção',
      `Atividade do analista ${analistaNome} foi marcada para sua atenção`,
      'Atividades'
    );
  } catch (error) {
    console.error('Erro ao alertar atividade:', error);
  }
}
