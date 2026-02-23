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
  LogOut
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { base44 } from '@/api/base44Client';

export default function Layout({ children }) {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: 'Dashboard' },
    { name: 'Atividades', icon: ClipboardList, path: 'Atividades' },
    { name: 'Fechamento Semanal', icon: Calendar, path: 'FechamentoSemanal' },
    { name: 'Supervisores', icon: Users, path: 'Supervisores' },
    { name: 'Analistas', icon: UserCircle, path: 'Analistas' },
    { name: 'Gestão de Usuários', icon: Settings, path: 'GestaoUsuarios' },
  ];

  const handleLogout = () => {
    base44.auth.logout();
  };

  const isActive = (path) => {
    return location.pathname.includes(path);
  };

  return (
    <div className="min-h-screen bg-[#0f1f35] text-gray-100">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-[#0a1628] border-b border-[#1e3a5f] z-50 flex items-center justify-between px-4">
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
          className="text-gray-400 hover:text-white"
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
        fixed top-0 left-0 h-full w-64 bg-[#0a1628] border-r border-[#1e3a5f] z-50
        transform transition-transform duration-300 ease-in-out
        lg:translate-x-0
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-6 border-b border-[#1e3a5f]">
          <div className="flex flex-col items-center gap-2">
            <img 
              src="https://grupoagion.com.br/wp-content/uploads/2023/03/Grupo-Agion-2-3-2048x679.png" 
              alt="Grupo Agion" 
              className="w-full h-auto"
            />
            <div className="text-center mt-2">
              <p className="text-xs text-gray-400">Governança N1 - Suporte</p>
            </div>
          </div>
        </div>

        <nav className="p-4 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={createPageUrl(item.path)}
              onClick={() => setMobileMenuOpen(false)}
              className={`
                flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200
                ${isActive(item.path) 
                  ? 'bg-[#e74c3c]/10 text-[#e74c3c] border border-[#e74c3c]/20' 
                  : 'text-gray-400 hover:bg-[#1e3a5f]/50 hover:text-white'
                }
              `}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.name}</span>
            </Link>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-[#1e3a5f] space-y-2">
          <Button
            onClick={handleLogout}
            variant="ghost"
            className="w-full justify-start gap-3 text-gray-400 hover:text-white hover:bg-[#1e3a5f]/50"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Sair</span>
          </Button>
          <div className="bg-gradient-to-r from-[#e74c3c]/10 to-[#3498db]/10 rounded-xl p-3 border border-[#e74c3c]/20">
            <p className="text-xs text-gray-400">Grupo Agion</p>
            <p className="text-sm font-medium text-white mt-1">Governança N1</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64 min-h-screen pt-16 lg:pt-0">
        <div className="p-4 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}