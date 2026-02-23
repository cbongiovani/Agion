import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  LayoutDashboard, 
  ClipboardList, 
  Calendar, 
  Users, 
  UserCircle,
  Menu,
  X,
  Settings,
  LogOut,
  AlertTriangle,
  Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function Layout({ children }) {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  const navItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: 'Dashboard' },
    { name: 'Atividades', icon: ClipboardList, path: 'Atividades' },
    { name: 'Fechamento Semanal', icon: Calendar, path: 'FechamentoSemanal' },
    { name: 'Supervisores', icon: Users, path: 'Supervisores' },
    { name: 'Analistas', icon: UserCircle, path: 'Analistas' },
    { name: 'War Room', icon: AlertTriangle, path: 'WarRoom' },
    { name: 'Gestão de Usuários', icon: Settings, path: 'GestaoUsuarios' },
  ];

  const handleLogout = () => {
    base44.auth.logout();
  };

  const handleDeleteAccount = async () => {
    try {
      const user = await base44.auth.me();
      await base44.entities.User.delete(user.id);
      base44.auth.logout();
    } catch (error) {
      console.error('Error deleting account:', error);
    }
  };

  const isActive = (path) => {
    return location.pathname.includes(path);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-[#0d0d0d] border-gray-800 border-b z-50 flex items-center justify-between px-4" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="flex items-center gap-3">
          <img 
            src="https://grupoagion.com.br/wp-content/uploads/2023/03/Grupo-Agion-2-3-2048x679.png" 
            alt="Grupo Agion" 
            className="h-8 w-auto"
          />
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="text-gray-400 hover:text-white min-w-[44px] min-h-[44px] select-none"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </Button>
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 h-full w-64 bg-[#0d0d0d] border-gray-800 border-r z-50
        transform transition-transform duration-300 ease-in-out
        lg:translate-x-0
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-6 border-b border-gray-800">
          <div className="flex flex-col items-center gap-2">
            <img 
              src="https://grupoagion.com.br/wp-content/uploads/2023/03/Grupo-Agion-2-3-2048x679.png" 
              alt="Grupo Agion" 
              className="w-full h-auto"
            />
            <div className="text-center mt-2">
              <p className="text-xs text-gray-500">Governança N1 - Suporte</p>
            </div>
          </div>
        </div>

        <nav className="flex flex-col">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={createPageUrl(item.path)}
              onClick={() => setMobileMenuOpen(false)}
              className={`
                flex items-center gap-3 px-6 py-4 transition-all duration-200 border-l-4 relative select-none min-h-[44px]
                ${isActive(item.path) 
                  ? 'bg-[#0a0a0a] text-[#ADF802] border-l-[#ADF802] font-semibold' 
                  : 'text-gray-400 hover:bg-[#0a0a0a] hover:text-white border-l-transparent'
                }
              `}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.name}</span>
            </Link>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-800 space-y-2">
          <Button
            onClick={handleLogout}
            variant="ghost"
            className="w-full justify-start gap-3 text-gray-400 hover:text-white hover:bg-[#0a0a0a] select-none min-h-[44px]"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Sair</span>
          </Button>
          <Button
            onClick={() => setDeleteAccountOpen(true)}
            variant="ghost"
            className="w-full justify-start gap-3 text-red-400 hover:text-red-300 hover:bg-red-500/10 select-none min-h-[44px]"
          >
            <Trash2 className="w-5 h-5" />
            <span className="font-medium">Deletar Conta</span>
          </Button>
          <div className="rounded-xl p-3 border bg-gradient-to-r from-[#ADF802]/5 to-[#ADF802]/10 border-[#ADF802]/20">
            <p className="text-xs font-medium text-gray-500">Grupo Agion</p>
            <p className="text-sm font-bold mt-1 text-white">Governança N1</p>
          </div>
        </div>
      </aside>

      {/* Bottom Navigation - Mobile Only */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-[#0d0d0d] border-t border-gray-800 z-50" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex items-center justify-around px-4 py-2">
          <Link
            to={createPageUrl('Dashboard')}
            className={`flex flex-col items-center gap-1 py-2 px-4 rounded-lg transition-colors select-none min-w-[44px] min-h-[44px] justify-center ${
              isActive('Dashboard') ? 'text-[#ADF802]' : 'text-gray-400'
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span className="text-xs font-medium">Dashboard</span>
          </Link>
          <Link
            to={createPageUrl('Atividades')}
            className={`flex flex-col items-center gap-1 py-2 px-4 rounded-lg transition-colors select-none min-w-[44px] min-h-[44px] justify-center ${
              isActive('Atividades') ? 'text-[#ADF802]' : 'text-gray-400'
            }`}
          >
            <ClipboardList className="w-5 h-5" />
            <span className="text-xs font-medium">Atividades</span>
          </Link>
          <Link
            to={createPageUrl('WarRoom')}
            className={`flex flex-col items-center gap-1 py-2 px-4 rounded-lg transition-colors select-none min-w-[44px] min-h-[44px] justify-center ${
              isActive('WarRoom') ? 'text-[#ADF802]' : 'text-gray-400'
            }`}
          >
            <AlertTriangle className="w-5 h-5" />
            <span className="text-xs font-medium">War Room</span>
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <main className="lg:ml-64 min-h-screen pt-16 lg:pt-0 pb-20 lg:pb-0">
        <div className="p-4 lg:p-8">
          {children}
        </div>
      </main>

      {/* Delete Account Dialog */}
      <AlertDialog open={deleteAccountOpen} onOpenChange={setDeleteAccountOpen}>
        <AlertDialogContent className="bg-[#242424] border-gray-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Deletar Conta</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Esta ação é irreversível. Todos os seus dados serão permanentemente removidos. Tem certeza que deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-gray-700 select-none">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              className="bg-red-600 hover:bg-red-700 select-none"
            >
              Deletar Conta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
  );
}