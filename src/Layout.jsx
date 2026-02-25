import React, { useRef } from 'react';
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
  Bell,
  BookOpen,
  Info,
  Zap,
  HelpCircle,
  Award,
  CheckCircle2,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import NotificationBell from '@/components/NotificationBell';
import ClockWidget from '@/components/ClockWidget';
import QuizzNotificationWidget from '@/components/QuizzNotificationWidget';
import ManualPopup from '@/components/ManualPopup';
import OnlineUsersCounter from '@/components/OnlineUsersCounter';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import AbasCarrossel from '@/components/AbasCarrossel';

export default function Layout({ children }) {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [abasDialogOpen, setAbasDialogOpen] = useState(false);
  const [navScrollPosition, setNavScrollPosition] = useState(0);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [showScrollUp, setShowScrollUp] = useState(false);
  const navRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: permissoesUsuario } = useQuery({
    queryKey: ['permissoesUsuario', currentUser?.email],
    queryFn: async () => {
      if (!currentUser?.email) return null;
      const perms = await base44.entities.PermissaoUsuario.filter({ usuario_email: currentUser.email });
      return perms.length > 0 ? perms[0] : null;
    },
    enabled: !!currentUser?.email,
  });

  const { data: pendingRequests = [] } = useQuery({
    queryKey: ['pendingRequests'],
    queryFn: () => base44.entities.SolicitacaoFuncao.filter({ status: 'pendente' }),
    enabled: currentUser?.role === 'admin' || currentUser?.role === 'supervisor',
    refetchInterval: 30000,
  });

  const { data: aprovacoesPendentes = [] } = useQuery({
    queryKey: ['aprovacoesPendentes'],
    queryFn: async () => {
      const aprovacoes = await base44.entities.AprovacaoAtividade.filter({ status: 'pendente' });
      return aprovacoes;
    },
    enabled: currentUser?.role === 'admin',
    refetchInterval: 30000,
  });

  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  const checkNavScroll = () => {
    if (navRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = navRef.current;
      setNavScrollPosition(scrollTop);
      setShowScrollDown(scrollTop + clientHeight < scrollHeight);
      setShowScrollUp(scrollTop > 0);
    }
  };

  useEffect(() => {
    const navElement = navRef.current;
    if (navElement) {
      navElement.addEventListener('scroll', checkNavScroll);
      checkNavScroll();
      return () => navElement.removeEventListener('scroll', checkNavScroll);
    }
  }, []);

  const scrollNav = (direction) => {
    if (navRef.current) {
      const scrollAmount = 150;
      navRef.current.scrollBy({
        top: direction === 'down' ? scrollAmount : -scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const getNavItems = () => {
    const role = currentUser?.role;
    
    const baseItems = [
      { name: 'Dashboard', icon: LayoutDashboard, path: 'Dashboard', permKey: 'dashboard', tooltip: 'Visão geral consolidada de métricas e performance do painel de governança' },
      { name: 'Atividades', icon: ClipboardList, path: 'Atividades', permKey: 'atividades', tooltip: 'Registre e acompanhe atividades de monitorias, chamados e feedback individual' },
      { name: 'Fechamento Semanal', icon: Calendar, path: 'FechamentoSemanal', permKey: 'fechamento_semanal', tooltip: 'Consolidação semanal de resultados, backlog e observações de desempenho' },
      { name: 'Supervisores', icon: Users, path: 'Supervisores', permKey: 'supervisores', tooltip: 'Gestão de equipes supervisoras e suas informações' },
      { name: 'Analistas', icon: UserCircle, path: 'Analistas', permKey: 'analistas', tooltip: 'Cadastro e acompanhamento de analistas N1' },
      { name: 'Ranking', icon: Trophy, path: 'Ranking', permKey: 'ranking', tooltip: 'Ranking de performance com gamificação MMORPG - Pontos e Medalhas' },
      { name: 'Quizz Relâmpago', icon: Zap, path: 'QuizzRelampago', permKey: 'quizz_relampago', alwaysVisible: true, tooltip: 'Testes rápidos de conhecimento com questões sobre processos técnicos' },
      { name: 'Avaliações', icon: ClipboardList, path: 'Avaliacoes', permKey: 'avaliacoes', tooltip: 'Avaliações periódicas (AT) estruturadas com 20 questões por período' },
      { name: 'Certificados', icon: Award, path: 'Certificados', permKey: 'certificados', tooltip: 'Gerenciar certificados e cursos realizados por analistas e supervisores' },
      { name: 'War Room', icon: AlertTriangle, path: 'WarRoom', permKey: 'war_room', tooltip: 'Gerenciamento de incidentes críticos com rastreamento de atividades' },
      { name: 'Manual do Supervisor', icon: BookOpen, path: 'ManualSupervisor', permKey: 'manual_supervisor', tooltip: 'Base de conhecimento e orientações para supervisores' },
      { name: 'Aprovação', icon: CheckCircle2, path: 'Aprovacao', permKey: 'aprovacao', tooltip: 'Aprovação de atividades, avaliações e quizzes' },
      { name: 'Gestão de Usuários', icon: Settings, path: 'GestaoUsuarios', permKey: 'gestao_usuarios', tooltip: 'Convites, permissões e funções personalizadas do painel' },
      { name: 'Logs do Sistema', icon: ClipboardList, path: 'Logs', permKey: 'logs', tooltip: 'Rastreamento de todas as ações realizadas no painel' },
    ];
    
    // Admin sempre vê tudo
    if (role === 'admin') {
      return baseItems;
    }
    
    // Para todos os outros usuários (incluindo funções personalizadas), verificar permissões
    if (permissoesUsuario?.abas_visiveis) {
      return baseItems.filter(item => item.alwaysVisible || permissoesUsuario.abas_visiveis[item.permKey] === true);
    }
    
    // Se não tem permissões configuradas, mostrar apenas Ranking e Quizz Relâmpago
    return baseItems.filter(item => item.alwaysVisible || item.permKey === 'ranking');
  };

  const navItems = getNavItems();

  const handleLogout = async () => {
    try {
      if (currentUser) {
        await base44.entities.Log.create({
          usuario_email: currentUser.email,
          usuario_nome: currentUser.full_name,
          acao: 'Logout',
          entidade: 'Sistema',
          detalhes: 'Usuário fez logout do sistema',
        });
      }
    } catch (error) {
      console.error('Erro ao criar log de logout:', error);
    }
    base44.auth.logout();
  };

  const isActive = (path) => {
    return location.pathname.includes(path);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-[#0d0d0d] border-gray-800 border-b z-50 flex items-center justify-center px-4 safe-top">
        <Link 
          to={createPageUrl('Home')}
          className="hover:opacity-80 transition-opacity"
        >
          <img 
            src="https://grupoagion.com.br/wp-content/uploads/2023/03/Grupo-Agion-2-3-2048x679.png" 
            alt="Grupo Agion" 
            className="h-8 w-auto cursor-pointer"
          />
        </Link>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="text-gray-400 hover:text-white min-w-[44px] min-h-[44px] select-none absolute right-4"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </Button>
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/70 z-40 backdrop-blur-sm"
          onClick={() => setMobileMenuOpen(false)}
          style={{ top: '64px' }}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 h-full w-72 bg-[#0d0d0d] border-gray-800 border-r z-50 flex flex-col
        transform transition-transform duration-300 ease-in-out
        lg:w-64 lg:translate-x-0
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-4 border-b border-gray-800 flex-shrink-0 safe-top">
          <div className="w-full flex items-center justify-center relative">
            <Link 
              to={createPageUrl('Home')}
              onClick={() => setMobileMenuOpen(false)}
              className="hover:opacity-80 transition-opacity"
            >
              <img 
                src="https://grupoagion.com.br/wp-content/uploads/2023/03/Grupo-Agion-2-3-2048x679.png" 
                alt="Grupo Agion" 
                className="h-8 w-auto cursor-pointer"
              />
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden text-gray-400 hover:text-white min-w-[44px] min-h-[44px] absolute right-0"
            >
              <X className="w-6 h-6" />
            </Button>
          </div>
        </div>

        <nav 
          ref={navRef}
          className="flex flex-col flex-1 overflow-y-auto py-1 scrollbar-hide scroll-smooth"
          onScroll={checkNavScroll}
        >
          <TooltipProvider>
            {navItems.map((item) => (
              <Tooltip key={item.path}>
                <TooltipTrigger asChild>
                  <Link
                    to={createPageUrl(item.path)}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`
                      flex items-center gap-3 px-4 py-3 transition-all duration-200 border-l-4 relative select-none
                      ${isActive(item.path) 
                        ? 'bg-[#0a0a0a] text-[#ADF802] border-l-[#ADF802] font-semibold' 
                        : 'text-gray-400 hover:bg-[#0a0a0a] hover:text-white border-l-transparent active:bg-[#151515]'
                      }
                    `}
                  >
                    <item.icon className="w-5 h-5 flex-shrink-0" />
                    <span className="font-medium text-sm">{item.name}</span>
                    {item.path === 'Aprovacao' && aprovacoesPendentes.length > 0 && (
                      <div className="absolute right-4 w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                    )}
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-gray-900 text-gray-100 border-gray-700">
                  {item.tooltip}
                </TooltipContent>
              </Tooltip>
            ))}
          </TooltipProvider>
        </nav>

        {/* Mobile Menu Footer - Removed, moved to footer */}
      </aside>

      {/* Footer - Desktop and Mobile */}
      <footer className="fixed bottom-0 left-0 right-0 bg-[#0d0d0d] border-t border-gray-800 z-50 safe-bottom">
        <div className="flex items-center justify-start gap-6 min-h-[80px]">
          {/* Widgets */}
          <div className="flex items-center gap-4">
            <QuizzNotificationWidget />
            <div className="hidden lg:block h-8 w-px bg-gray-700"></div>
            <ClockWidget />
          </div>

          {/* User Info */}
          <div className="flex-1 flex items-center justify-center px-4">
            <Link
              to={createPageUrl('MeuPerfil')}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-[#0a0a0a] active:bg-[#151515] transition-colors select-none"
            >
              <div className="w-8 h-8 rounded-full bg-[#e74c3c]/20 flex items-center justify-center overflow-hidden flex-shrink-0">
                {currentUser?.foto_url ? (
                  <img src={currentUser.foto_url} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <UserIcon className="w-4 h-4 text-[#e74c3c]" />
                )}
              </div>
              <span className="text-sm font-medium text-white">{currentUser?.full_name}</span>
            </Link>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {(currentUser?.role === 'admin' || currentUser?.role === 'supervisor') && pendingRequests.length > 0 && (
              <div className="relative flex items-center gap-2 px-3 py-2 bg-[#0a0a0a] rounded-lg">
                <Bell className="w-4 h-4 text-[#ADF802]" />
                <span className="text-xs font-medium text-white">{pendingRequests.length}</span>
              </div>
            )}
            <Button
              onClick={() => handleLogout()}
              variant="ghost"
              className="justify-center gap-2 text-gray-400 hover:text-white hover:bg-[#0a0a0a] active:bg-[#151515] select-none h-9 px-3 text-sm"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sair</span>
            </Button>
          </div>
        </div>
      </footer>

      {/* Main Content */}
      <main className="lg:ml-64 min-h-screen pt-16 lg:pt-0 pb-28 lg:pb-24">
        <div className="p-4 lg:p-8">
          {children}
        </div>
      </main>

      {/* Manual Popup for Supervisors */}
      <ManualPopup currentUser={currentUser} />

      {/* Dialog de Abas do Sistema */}
      <Dialog open={abasDialogOpen} onOpenChange={setAbasDialogOpen}>
        <DialogContent className="bg-[#0a1628] border-[#1e3a5f] text-white max-w-5xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="w-5 h-5 text-blue-400" />
              Abas do Sistema - Funções e Boas Práticas
            </DialogTitle>
          </DialogHeader>
          <AbasCarrossel />
        </DialogContent>
      </Dialog>

      </div>
  );
}