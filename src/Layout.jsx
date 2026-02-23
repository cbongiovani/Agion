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
  Moon,
  Sun
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

export default function Layout({ children }) {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : true;
  });

  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

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

  const isActive = (path) => {
    return location.pathname.includes(path);
  };

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-[#0a0a0a] text-gray-100' : 'bg-[#f5f7fa] text-gray-900'}`}>
      {/* Mobile Header */}
      <div className={`lg:hidden fixed top-0 left-0 right-0 h-16 ${darkMode ? 'bg-[#0d0d0d] border-gray-800' : 'bg-white border-gray-200'} border-b z-50 flex items-center justify-between px-4`}>
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
        fixed top-0 left-0 h-full w-64 ${darkMode ? 'bg-[#0d0d0d] border-gray-800' : 'bg-white border-gray-300 shadow-sm'} border-r z-50
        transform transition-transform duration-300 ease-in-out
        lg:translate-x-0
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className={`p-6 border-b ${darkMode ? 'border-gray-800' : 'border-gray-200'}`}>
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
                flex items-center gap-3 px-6 py-4 transition-all duration-200 border-l-4 relative
                ${isActive(item.path) 
                  ? darkMode 
                    ? 'bg-[#0a0a0a] text-[#ADF802] border-l-[#ADF802] font-semibold' 
                    : 'bg-gradient-to-r from-[#ADF802]/10 to-transparent text-gray-900 border-l-[#ADF802] font-semibold shadow-sm'
                  : darkMode
                    ? 'text-gray-400 hover:bg-[#0a0a0a] hover:text-white border-l-transparent'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900 border-l-transparent'
                }
              `}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.name}</span>
            </Link>
          ))}
        </nav>

        <div className={`absolute bottom-0 left-0 right-0 p-4 border-t ${darkMode ? 'border-gray-800' : 'border-gray-200'} space-y-2`}>
          <Button
            onClick={() => setDarkMode(!darkMode)}
            variant="ghost"
            className={`w-full justify-start gap-3 ${darkMode ? 'text-gray-400 hover:text-white hover:bg-[#0a0a0a]' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`}
          >
            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            <span className="font-medium">{darkMode ? 'Modo Claro' : 'Modo Escuro'}</span>
          </Button>
          <Button
            onClick={handleLogout}
            variant="ghost"
            className={`w-full justify-start gap-3 ${darkMode ? 'text-gray-400 hover:text-white hover:bg-[#0a0a0a]' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`}
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Sair</span>
          </Button>
          <div className={`rounded-xl p-3 border ${darkMode ? 'bg-gradient-to-r from-[#ADF802]/5 to-[#ADF802]/10 border-[#ADF802]/20' : 'bg-gradient-to-br from-[#ADF802]/30 via-[#ADF802]/20 to-[#ADF802]/10 border-[#ADF802] shadow-md'}`}>
            <p className={`text-xs font-medium ${darkMode ? 'text-gray-500' : 'text-gray-700'}`}>Grupo Agion</p>
            <p className={`text-sm font-bold mt-1 ${darkMode ? 'text-white' : 'text-gray-900'}`}>Governança N1</p>
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