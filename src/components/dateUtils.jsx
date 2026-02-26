// Funções para corrigir o problema de timezone
// Timezone do sistema: America/Cuiaba (UTC-4)

export function formatDateToInput(date) {
  // Converte uma data para o formato 'yyyy-MM-dd' correto, respeitando o timezone local
  if (!date) return '';
  
  const d = new Date(date);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const year = d.getFullYear();
  
  return `${year}-${month}-${day}`;
}

export function getLocalDateString(date) {
  // Retorna a data como string no formato dd/MM/yyyy respeitando o timezone local
  if (!date) return '';
  
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  
  return `${day}/${month}/${year}`;
}

export function ensureCorrectDate(dateString) {
  // Garante que a data enviada ao backend seja sempre 'yyyy-MM-dd' sem conversão de timezone
  // Isso previne que 25/02 seja salvo como 24/02 devido ao offset de timezone
  if (!dateString) return '';
  
  // Se já estiver no formato correto (yyyy-MM-dd), retorna como está
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return dateString;
  }
  
  // Se for uma string de data ISO ou datetime-local input
  // Extrai apenas a parte da data sem fazer parsing (evita conversão de timezone)
  if (typeof dateString === 'string' && dateString.includes('-')) {
    return dateString.split('T')[0];
  }
  
  // Último recurso: cria a data mantendo o timezone local
  const d = new Date(dateString);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const year = d.getFullYear();
  
  return `${year}-${month}-${day}`;
}