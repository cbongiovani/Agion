import { base44 } from '@/api/base44Client';

/**
 * Envia notificações para coordenadores sobre novos registros
 */
export async function notificarCoordenadores(tipo, titulo, mensagem, link = null) {
  try {
    console.log('Iniciando notificação para coordenadores:', { tipo, titulo, mensagem, link });
    
    // Buscar todos os usuários com role 'admin' (coordenadores)
    const users = await base44.entities.User.list();
    console.log('Total de usuários:', users.length);
    
    const coordenadores = users.filter(u => u.role === 'admin');
    console.log('Coordenadores encontrados:', coordenadores.length, coordenadores.map(c => c.email));
    
    if (coordenadores.length === 0) {
      console.warn('Nenhum coordenador encontrado para notificar');
      return;
    }
    
    // Criar notificações para cada coordenador
    const notificacoes = coordenadores.map(coord => ({
      destinatario_id: coord.id,
      tipo,
      titulo,
      mensagem,
      link,
      lida: false,
    }));
    
    console.log('Criando notificações:', notificacoes);
    const resultado = await base44.entities.Notificacao.bulkCreate(notificacoes);
    console.log('Notificações criadas com sucesso:', resultado);
    
    return resultado;
  } catch (error) {
    console.error('Erro ao notificar coordenadores:', error);
    throw error;
  }
}

/**
 * Envia notificação para um supervisor específico
 */
export async function notificarSupervisor(supervisorId, tipo, titulo, mensagem, link = null) {
  try {
    const supervisores = await base44.entities.Supervisor.list();
    const supervisor = supervisores.find(s => s.id === supervisorId);
    
    if (supervisor && supervisor.usuario_email) {
      const users = await base44.entities.User.list();
      const usuario = users.find(u => u.email === supervisor.usuario_email);
      
      if (usuario) {
        await base44.entities.Notificacao.create({
          destinatario_id: usuario.id,
          tipo,
          titulo,
          mensagem,
          link,
          lida: false,
        });
        console.log('Notificação enviada para supervisor:', usuario.email);
      } else {
        console.warn('Usuário não encontrado para supervisor:', supervisor.usuario_email);
      }
    } else {
      console.warn('Supervisor não encontrado ou sem email vinculado:', supervisorId);
    }
  } catch (error) {
    console.error('Erro ao notificar supervisor:', error);
    throw error;
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