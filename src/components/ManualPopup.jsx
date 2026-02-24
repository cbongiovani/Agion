import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function ManualPopup({ currentUser }) {
  const [showPopup, setShowPopup] = useState(false);

  useEffect(() => {
    // Mostrar popup sempre que um supervisor fizer login
    if (currentUser?.role === 'supervisor' && currentUser?.email) {
      setShowPopup(true);
    }
  }, [currentUser?.email, currentUser?.role]);

  const handleClose = () => {
    setShowPopup(false);
  };

  return (
    <Dialog open={showPopup} onOpenChange={setShowPopup}>
      <DialogContent className="bg-[#0a1628] border-[#1e3a5f] text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-xl">
            <div className="w-12 h-12 rounded-xl bg-[#ADF802]/20 flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-[#ADF802]" />
            </div>
            <span>Manual do Supervisor</span>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <p className="text-gray-300 leading-relaxed">
            Olá! Não se esqueça de consultar o <strong className="text-[#ADF802]">Manual do Supervisor</strong> para garantir que você está seguindo todos os processos e prazos corretamente.
          </p>
          <div className="bg-[#ADF802]/10 border border-[#ADF802]/30 rounded-lg p-4">
            <p className="text-sm text-gray-300">
              📋 O manual contém informações importantes sobre:
            </p>
            <ul className="text-sm text-gray-300 mt-2 space-y-1 ml-4 list-disc">
              <li>Registro de Atividades</li>
              <li>Fechamento Semanal</li>
              <li>War Room</li>
            </ul>
          </div>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={handleClose}
            variant="outline"
            className="flex-1 border-[#1e3a5f] text-gray-300"
          >
            Fechar
          </Button>
          <Link to={createPageUrl('ManualSupervisor')} className="flex-1">
            <Button
              onClick={handleClose}
              className="w-full bg-[#ADF802] hover:bg-[#9DE002] text-black"
            >
              Abrir Manual
            </Button>
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}