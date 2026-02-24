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
  User as UserIcon,
  Trophy,
  Bell
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import NotificationBell from '@/components/NotificationBell';
import ClockWidget from '@/components/ClockWidget';

export default function Layout({ children }) {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  const { data: pendingRequests = [] } = useQuery({
    queryKey: ['pendingRequests'],
    queryFn: () => base44.entities.SolicitacaoFuncao.filter({ status: 'pendente' }),
    enabled: currentUser?.role === 'admin' || currentUser?.role === 'supervisor',
    refetchInterval: 30000, // Atualiza a cada 30 segundos
  });

  useEffect(() => {
    document.documentElement.classList.add('dark');
    
    // Load current user
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  const getNavItems = () => {
    const role = currentUser?.role;
    
    const baseItems = [
      { name: 'Dashboard', icon: LayoutDashboard, path: 'Dashboard', roles: ['admin', 'supervisor'] },
      { name: 'Atividades', icon: ClipboardList, path: 'Atividades', roles: ['admin', 'supervisor'] },
      { name: 'Fechamento Semanal', icon: Calendar, path: 'FechamentoSemanal', roles: ['admin', 'supervisor'] },
      { name: 'Supervisores', icon: Users, path: 'Supervisores', roles: ['admin', 'supervisor'] },
      { name: 'Analistas', icon: UserCircle, path: 'Analistas', roles: ['admin'] },
      { name: 'Ranking', icon: Trophy, path: 'Ranking', roles: ['admin', 'supervisor', 'user'] },
      { name: 'War Room', icon: AlertTriangle, path: 'WarRoom', roles: ['admin', 'supervisor'] },
      { name: 'Gestão de Usuários', icon: Settings, path: 'GestaoUsuarios', roles: ['admin'] },
      { name: 'Logs do Sistema', icon: ClipboardList, path: 'Logs', roles: ['admin'] },
    ];
    
    return baseItems.filter(item => item.roles.includes(role));
  };

  const navItems = getNavItems();

  const handleLogout = () => {
    base44.auth.logout();
  };

  const isActive = (path) => {
    return location.pathname.includes(path);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-[#0d0d0d] border-gray-800 border-b z-50 flex items-center justify-between px-4" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="flex items-center gap-3">
          <a href="https://www.grupoagion.com.br" target="_blank" rel="noopener noreferrer">
            <img 
              src="https://grupoagion.com.br/wp-content/uploads/2023/03/Grupo-Agion-2-3-2048x679.png" 
              alt="Grupo Agion" 
              className="h-8 w-auto cursor-pointer hover:opacity-80 transition-opacity"
            />
          </a>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell currentUser={currentUser} />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="text-gray-400 hover:text-white min-w-[44px] min-h-[44px] select-none"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>
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
          <div className="w-full flex items-center justify-between">
            <a href="https://www.grupoagion.com.br" target="_blank" rel="noopener noreferrer">
              <img 
                src="https://grupoagion.com.br/wp-content/uploads/2023/03/Grupo-Agion-2-3-2048x679.png" 
                alt="Grupo Agion" 
                className="h-10 w-auto cursor-pointer hover:opacity-80 transition-opacity"
              />
            </a>
            <div className="hidden lg:block">
              <NotificationBell currentUser={currentUser} />
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
          <ClockWidget />
          <Link
            to={createPageUrl('MeuPerfil')}
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-3 px-3 py-3 rounded-lg text-gray-400 hover:text-white hover:bg-[#0a0a0a] transition-colors select-none min-h-[44px]"
          >
            <div className="w-8 h-8 rounded-full bg-[#e74c3c]/20 flex items-center justify-center overflow-hidden">
              {currentUser?.foto_url ? (
                <img src={currentUser.foto_url} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <UserIcon className="w-4 h-4 text-[#e74c3c]" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm text-white truncate">{currentUser?.full_name || 'Meu Perfil'}</p>
              <p className="text-xs text-gray-500 truncate">{currentUser?.email}</p>
            </div>
            {(currentUser?.role === 'admin' || currentUser?.role === 'supervisor') && pendingRequests.length > 0 && (
              <div className="relative">
                <Bell className="w-5 h-5 text-[#ADF802]" />
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#e74c3c] rounded-full text-white text-xs flex items-center justify-center">
                  {pendingRequests.length}
                </span>
              </div>
            )}
          </Link>
          <Button
            onClick={handleLogout}
            variant="ghost"
            className="w-full justify-start gap-3 text-gray-400 hover:text-white hover:bg-[#0a0a0a] select-none min-h-[44px]"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Sair</span>
          </Button>
          <div className="rounded-xl p-3 border bg-gradient-to-r from-[#ADF802]/5 to-[#ADF802]/10 border-[#ADF802]/20">
            <p className="text-xs font-medium text-gray-500">Grupo Agion</p>
            <p className="text-sm font-bold mt-1 text-white">Painel de Governança - N1</p>
          </div>
        </div>
      </aside>

      {/* Bottom Navigation - Mobile Only */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-[#0d0d0d] border-t border-gray-800 z-50" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex items-center justify-around px-4 py-2">
            {(currentUser?.role === 'admin' || currentUser?.role === 'supervisor') && (
              <>
                <Link
                  to={createPageUrl('Dashboard')}
                  className={`flex flex-col items-center gap-1 py-2 px-3 rounded-lg transition-colors select-none min-w-[44px] min-h-[44px] justify-center ${
                    isActive('Dashboard') ? 'text-[#ADF802]' : 'text-gray-400'
                  }`}
                >
                  <LayoutDashboard className="w-5 h-5" />
                  <span className="text-xs font-medium">Dashboard</span>
                </Link>
                <Link
                  to={createPageUrl('Supervisores')}
                  className={`flex flex-col items-center gap-1 py-2 px-3 rounded-lg transition-colors select-none min-w-[44px] min-h-[44px] justify-center ${
                    isActive('Supervisores') ? 'text-[#ADF802]' : 'text-gray-400'
                  }`}
                >
                  <Users className="w-5 h-5" />
                  <span className="text-xs font-medium">Supervisores</span>
                </Link>
              </>
            )}
            <Link
              to={createPageUrl('Ranking')}
              className={`flex flex-col items-center gap-1 py-2 px-3 rounded-lg transition-colors select-none min-w-[44px] min-h-[44px] justify-center ${
                isActive('Ranking') ? 'text-[#ADF802]' : 'text-gray-400'
              }`}
            >
              <Trophy className="w-5 h-5" />
              <span className="text-xs font-medium">Ranking</span>
            </Link>
            {(currentUser?.role === 'admin' || currentUser?.role === 'supervisor') && (
              <Link
                to={createPageUrl('WarRoom')}
                className={`flex flex-col items-center gap-1 py-2 px-3 rounded-lg transition-colors select-none min-w-[44px] min-h-[44px] justify-center ${
                  isActive('WarRoom') ? 'text-[#ADF802]' : 'text-gray-400'
                }`}
              >
                <AlertTriangle className="w-5 h-5" />
                <span className="text-xs font-medium">War Room</span>
              </Link>
            )}
          </div>
      </div>

      {/* Main Content */}
      <main className="lg:ml-64 min-h-screen pt-16 lg:pt-0 pb-20 lg:pb-0">
        <div className="p-4 lg:p-8">
          {children}
        </div>
      </main>

      </div>
  );
}