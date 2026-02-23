import React from 'react';
import { Link } from 'react-router-dom';
import { Home, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '@/utils';

export default function PageNotFound() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100 flex items-center justify-center p-4">
      <div className="text-center">
        <AlertTriangle className="w-20 h-20 text-[#ADF802] mx-auto mb-6" />
        <h1 className="text-4xl font-bold text-white mb-2">404</h1>
        <p className="text-xl text-gray-400 mb-6">Página não encontrada</p>
        <Link to={createPageUrl('Dashboard')}>
          <Button className="bg-[#ADF802] hover:bg-[#9DE002] text-[#0a0a0a] font-bold gap-2">
            <Home className="w-4 h-4" />
            Voltar ao Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}