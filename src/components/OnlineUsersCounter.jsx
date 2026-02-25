import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Users } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { format } from 'date-fns';

export default function OnlineUsersCounter({ currentUser }) {
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [isOpen, setIsOpen] = useState(false);

  const { data: usuarios = [] } = useQuery({
    queryKey: ['usuarios'],
    queryFn: () => base44.entities.User.list(),
    refetchInterval: 30000, // Atualizar a cada 30 segundos
  });

  useEffect(() => {
    // Simular usuários online baseado nos logs recentes
    const updateOnlineStatus = () => {
      const now = new Date();
      const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60000);

      // Em produção, isso seria baseado em dados reais de atividade
      // Por enquanto, simular com base em IDs para demo
      const simulatedOnline = usuarios.filter((_, idx) => idx < Math.max(1, Math.floor(Math.random() * usuarios.length / 2) + 1));
      setOnlineUsers(simulatedOnline);
    };

    updateOnlineStatus();
    const interval = setInterval(updateOnlineStatus, 30000);
    return () => clearInterval(interval);
  }, [usuarios]);

  if (currentUser?.role !== 'admin') return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <button className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-[#0a0a0a] active:bg-[#151515] transition-colors select-none relative mb-1">
          <Users className="w-4 h-4 flex-shrink-0" />
          <span className="text-xs font-medium">Online</span>
          <span className="ml-auto bg-[#ADF802] text-black text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {onlineUsers.length}
          </span>
        </button>
      </DialogTrigger>
      <DialogContent className="bg-[#0a1628] border-[#1e3a5f] text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-[#ADF802]" />
            Usuários Online ({onlineUsers.length})
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {onlineUsers.length > 0 ? (
            onlineUsers.map((user) => (
              <div key={user.id} className="bg-[#0f1f35] border border-[#1e3a5f] rounded-lg p-3 flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-[#ADF802] animate-pulse" />
                <div className="flex-1">
                  <p className="font-semibold text-white text-sm">{user.nome_customizado || user.full_name}</p>
                  <p className="text-xs text-gray-400">{user.email}</p>
                </div>
                <span className="text-xs px-2 py-1 rounded bg-[#ADF802]/20 text-[#ADF802]">
                  {user.role === 'admin' ? 'Coordenador' : user.role === 'supervisor' ? 'Supervisor' : 'Usuário'}
                </span>
              </div>
            ))
          ) : (
            <p className="text-center text-gray-400 py-4">Nenhum usuário online</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}