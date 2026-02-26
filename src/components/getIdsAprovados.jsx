import { base44 } from '@/api/base44Client';

/**
 * Busca os IDs de registros aprovados de um tipo específico.
 * Esta é a FONTE DE VERDADE para determinar qual registros contabilizam.
 * 
 * @param {string} tipo - Tipo de registro ('atividade', 'fechamento', 'warroom', etc)
 * @returns {Promise<string[]>} Array de IDs aprovados
 */
export const getIdsAprovados = async (tipo) => {
  try {
    const aprovacoes = await base44.entities.AprovacaoAtividade.filter({
      tipo: tipo,
      status: 'aprovado'
    });
    return aprovacoes.map(a => a.atividade_id).filter(Boolean);
  } catch (error) {
    console.error(`Erro ao buscar IDs aprovados para tipo ${tipo}:`, error);
    return [];
  }
};

/**
 * Filtra um array de registros para incluir apenas os aprovados.
 * 
 * @param {Object[]} registros - Array de registros
 * @param {string[]} idsAprovados - Array de IDs aprovados
 * @returns {Object[]} Registros filtrados
 */
export const filtrarPorAprovacao = (registros, idsAprovados) => {
  return registros.filter(r => idsAprovados.includes(r.id));
};

/**
 * Retorna se um registro está aprovado.
 * 
 * @param {string} registroId - ID do registro
 * @param {string[]} idsAprovados - Array de IDs aprovados (cache)
 * @returns {boolean}
 */
export const estaAprovado = (registroId, idsAprovados) => {
  return idsAprovados.includes(registroId);
};