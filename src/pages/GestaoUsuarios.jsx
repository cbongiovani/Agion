import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus, Pencil, Settings, Loader2, Mail, Shield, Trash2, Lock, Info } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { toast } from 'sonner';
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

export default function GestaoUsuarios() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [isInviteAnalistaOpen, setIsInviteAnalistaOpen] = useState(false);
  const [isPermissionsDialogOpen, setIsPermissionsDialogOpen] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [deleteUserOpen, setDeleteUserOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [editingUser, setEditingUser] = useState(false);
  const [selectedUserForPermissions, setSelectedUserForPermissions] = useState(null);
  const [inviteData, setInviteData] = useState({ email: '', role: 'user' });
  const [inviteAnalistaData, setInviteAnalistaData] = useState({ analistaId: '', email: '' });
  const [formData, setFormData] = useState({ full_name: '', role: '' });
  const [permissionsData, setPermissionsData] = useState({
    abas_visiveis: {
      dashboard: false,
      atividades: false,
      fechamento_semanal: false,
      supervisores: false,
      analistas: false,
      ranking: true,
      war_room: false,
      manual_supervisor: false,
      gestao_usuarios: false,
      logs: false
    },
    permissoes_atividades: { visualizar: false, criar: false, editar: false, deletar: false },
    permissoes_fechamento: { visualizar: false, criar: false, editar: false, deletar: false },
    permissoes_warroom: { visualizar: false, criar: false, editar: false, deletar: false }
  });

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: analistas = [] } = useQuery({
    queryKey: ['analistas'],
    queryFn: () => base44.entities.Analista.list(),
  });

  const { data: supervisores = [] } = useQuery({
    queryKey: ['supervisores'],
    queryFn: () => base44.entities.Supervisor.list(),
  });

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: permissoes = [] } = useQuery({
    queryKey: ['permissoes'],
    queryFn: () => base44.entities.PermissaoUsuario.list(),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const result = await base44.entities.User.update(id, data);
      const user = await base44.auth.me();
      await base44.entities.Log.create({
        usuario_email: user.email,
        usuario_nome: user.full_name,
        acao: 'Atualizou',
        entidade: 'Usuário',
        detalhes: `Atualizou usuário ${data.full_name || editingUser?.email}`,
      });
      return result;
    },
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ['users'] });
      const previousUsers = queryClient.getQueryData(['users']);
      queryClient.setQueryData(['users'], (old = []) =>
        old.map((user) => (user.id === id ? { ...user, ...data } : user))
      );
      return { previousUsers };
    },
    onError: (err, variables, context) => {
      queryClient.setQueryData(['users'], context.previousUsers);
    },
    onSuccess: () => {
      toast.success('Usuário atualizado com sucesso!');
      resetForm();
    },
  });

  const inviteMutation = useMutation({
    mutationFn: async ({ email, role }) => {
      const user = await base44.auth.me();
      await base44.users.inviteUser(email, role);
      await base44.entities.Log.create({
        usuario_email: user.email,
        usuario_nome: user.full_name,
        acao: 'Convidou Usuário',
        entidade: 'Usuário',
        detalhes: `Convidou ${email} com função ${role === 'admin' ? 'Coordenador' : role === 'supervisor' ? 'Supervisor' : role === 'noc' ? 'NOC' : 'Usuário'}`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Convite enviado com sucesso!');
      setInviteData({ email: '', role: 'user' });
      setIsInviteDialogOpen(false);
    },
    onError: (error) => {
      toast.error('Erro ao enviar convite: ' + error.message);
    },
  });

  const inviteAnalistaMutation = useMutation({
    mutationFn: async ({ email, analistaId }) => {
      const user = await base44.auth.me();
      await base44.users.inviteUser(email, 'user');
      await base44.entities.Analista.update(analistaId, { usuario_email: email });
      await base44.entities.Log.create({
        usuario_email: user.email,
        usuario_nome: user.full_name,
        acao: 'Convidou Usuário',
        entidade: 'Analista',
        detalhes: `Convidou analista com e-mail ${email}`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analistas'] });
      toast.success('Analista convidado com sucesso!');
      setInviteAnalistaData({ analistaId: '', email: '' });
      setIsInviteAnalistaOpen(false);
    },
    onError: (error) => {
      toast.error('Erro ao convidar analista: ' + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (userId) => {
      const user = await base44.auth.me();
      await base44.entities.User.delete(userId);
      await base44.entities.Log.create({
        usuario_email: user.email,
        usuario_nome: user.full_name,
        acao: 'Excluiu',
        entidade: 'Usuário',
        detalhes: `Deletou usuário ${userToDelete?.full_name || userToDelete?.email}`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Usuário deletado com sucesso!');
      setDeleteUserOpen(false);
      setUserToDelete(null);
    },
    onError: (error) => {
      toast.error('Erro ao deletar usuário: ' + error.message);
    },
  });

  const savePermissionsMutation = useMutation({
    mutationFn: async ({ userEmail, data }) => {
      const existing = permissoes.find(p => p.usuario_email === userEmail);
      const user = await base44.auth.me();
      
      if (existing) {
        await base44.entities.PermissaoUsuario.update(existing.id, data);
      } else {
        await base44.entities.PermissaoUsuario.create({ usuario_email: userEmail, ...data });
      }
      
      await base44.entities.Log.create({
        usuario_email: user.email,
        usuario_nome: user.full_name,
        acao: 'Atualizou',
        entidade: 'Usuário',
        detalhes: `Atualizou permissões do usuário ${userEmail}`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permissoes'] });
      toast.success('Permissões atualizadas com sucesso!');
      setIsPermissionsDialogOpen(false);
      setSelectedUserForPermissions(null);
    },
    onError: (error) => {
      toast.error('Erro ao atualizar permissões: ' + error.message);
    },
  });

  const resetForm = () => {
    setFormData({ full_name: '', role: '' });
    setEditingUser(null);
    setIsDialogOpen(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!editingUser) return;
    updateMutation.mutate({ id: editingUser.id, data: formData });
  };

  const handleInvite = (e) => {
    e.preventDefault();
    inviteMutation.mutate(inviteData);
  };

  const handleInviteAnalista = (e) => {
    e.preventDefault();
    const analista = analistas.find(a => a.id === inviteAnalistaData.analistaId);
    if (!analista) {
      toast.error('Selecione um analista');
      return;
    }
    if (analista.usuario_email) {
      toast.error('Este analista já possui um usuário vinculado');
      return;
    }
    inviteAnalistaMutation.mutate({ 
      email: inviteAnalistaData.email,
      analistaId: analista.id
    });
  };

  const openEdit = (user) => {
    setEditingUser(user);
    setFormData({ 
      full_name: user.full_name || '',
      role: user.role || 'user'
    });
    setIsDialogOpen(true);
  };

  const getRoleBadge = (role) => {
    const colors = {
      admin: 'bg-[#e74c3c]/20 text-[#e74c3c] border-[#e74c3c]/30',
      supervisor: 'bg-[#ADF802]/20 text-[#ADF802] border-[#ADF802]/30',
      user: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      noc: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    };
    return colors[role] || colors.user;
  };

  const getRoleLabel = (role) => {
    const labels = {
      admin: 'Coordenador',
      supervisor: 'Supervisor',
      user: 'Usuário',
      noc: 'NOC',
    };
    return labels[role] || role;
  };

  const abasInfo = [
    {
      key: 'dashboard',
      nome: 'Dashboard',
      descricao: 'Painel executivo com visão consolidada de métricas, KPIs e performance geral do Suporte N1.',
      boaPratica: 'Garanta que apenas coordenadores e supervisores tenham acesso para tomada de decisões estratégicas baseadas em dados.'
    },
    {
      key: 'atividades',
      nome: 'Atividades',
      descricao: 'Registro detalhado de todas as atividades realizadas: chamados, ligações, monitorias e feedbacks individuais.',
      boaPratica: 'Permita acesso a supervisores para acompanhamento diário. Use permissões granulares para controlar quem pode criar, editar ou deletar registros.'
    },
    {
      key: 'fechamento_semanal',
      nome: 'Fechamento Semanal',
      descricao: 'Consolidação semanal de métricas por supervisor: ligações, chamados, monitorias, backlog e planos de ação.',
      boaPratica: 'Acesso restrito a supervisores e coordenadores. Essencial para planejamento semanal e identificação de gargalos operacionais.'
    },
    {
      key: 'supervisores',
      nome: 'Supervisores',
      descricao: 'Gestão completa de supervisores: cadastro, edição, visualização de equipes e análise de performance.',
      boaPratica: 'Apenas coordenadores devem ter permissão para criar/editar supervisores. Garante hierarquia organizacional consistente.'
    },
    {
      key: 'analistas',
      nome: 'Analistas',
      descricao: 'Cadastro e gerenciamento de analistas do Suporte N1, incluindo vínculo com supervisores e histórico de atividades.',
      boaPratica: 'Supervisores podem visualizar apenas seus analistas. Coordenadores têm visão global para realocação de recursos.'
    },
    {
      key: 'ranking',
      nome: 'Ranking',
      descricao: 'Gamificação e reconhecimento: ranking de analistas por pontos, medalhas e performance semanal/mensal.',
      boaPratica: 'Visível para todos os usuários. Promove engajamento, competição saudável e reconhecimento público de resultados.'
    },
    {
      key: 'avaliacoes',
      nome: 'Avaliações',
      descricao: 'Sistema de provas técnicas com IA: criação de questões, banco de conhecimento e avaliações trimestrais (AT1-AT4).',
      boaPratica: 'Acesso restrito a coordenadores e supervisores. Mantém integridade das avaliações e impede vazamento de questões.'
    },
    {
      key: 'war_room',
      nome: 'War Room',
      descricao: 'Gestão de incidentes críticos segundo ITIL v4 e ISO 20000: registro, acompanhamento e resolução de emergências.',
      boaPratica: 'Acessível para NOC, supervisores e coordenadores. Centraliza comunicação durante crises e mantém histórico de incidentes.'
    },
    {
      key: 'manual_supervisor',
      nome: 'Manual do Supervisor',
      descricao: 'Base de conhecimento com procedimentos, boas práticas e diretrizes para supervisores do Suporte N1.',
      boaPratica: 'Disponível para supervisores e coordenadores. Padroniza processos e facilita onboarding de novos líderes.'
    },
    {
      key: 'gestao_usuarios',
      nome: 'Gestão de Usuários',
      descricao: 'Controle total de usuários: convites, edição de perfis, definição de permissões granulares por aba e funcionalidade.',
      boaPratica: 'Exclusivo para coordenadores. Centraliza governança de acesso e garante segurança do sistema através do princípio do menor privilégio.'
    },
    {
      key: 'logs',
      nome: 'Logs do Sistema',
      descricao: 'Auditoria completa: registro de todas as ações realizadas no sistema (criação, edição, exclusão, login/logout).',
      boaPratica: 'Acesso exclusivo de coordenadores. Essencial para conformidade, rastreabilidade e investigação de incidentes de segurança.'
    }
  ];

  const handleDeleteAccount = async () => {
    try {
      const user = await base44.auth.me();
      await base44.entities.User.delete(user.id);
      base44.auth.logout();
    } catch (error) {
      toast.error('Erro ao deletar conta: ' + error.message);
    }
  };

  const handleDeleteUser = () => {
    if (userToDelete) {
      deleteMutation.mutate(userToDelete.id);
    }
  };

  const openDeleteDialog = (user) => {
    setUserToDelete(user);
    setDeleteUserOpen(true);
  };

  const openPermissionsDialog = (user) => {
    setSelectedUserForPermissions(user);
    const userPermissions = permissoes.find(p => p.usuario_email === user.email);
    
    if (userPermissions) {
      setPermissionsData({
        abas_visiveis: userPermissions.abas_visiveis || {
          dashboard: false,
          atividades: false,
          fechamento_semanal: false,
          supervisores: false,
          analistas: false,
          ranking: true,
          war_room: false,
          manual_supervisor: false,
          gestao_usuarios: false,
          logs: false
        },
        permissoes_atividades: userPermissions.permissoes_atividades || { visualizar: false, criar: false, editar: false, deletar: false },
        permissoes_fechamento: userPermissions.permissoes_fechamento || { visualizar: false, criar: false, editar: false, deletar: false },
        permissoes_warroom: userPermissions.permissoes_warroom || { visualizar: false, criar: false, editar: false, deletar: false }
      });
    } else {
      setPermissionsData({
        abas_visiveis: {
          dashboard: false,
          atividades: false,
          fechamento_semanal: false,
          supervisores: false,
          analistas: false,
          ranking: true,
          war_room: false,
          manual_supervisor: false,
          gestao_usuarios: false,
          logs: false
        },
        permissoes_atividades: { visualizar: false, criar: false, editar: false, deletar: false },
        permissoes_fechamento: { visualizar: false, criar: false, editar: false, deletar: false },
        permissoes_warroom: { visualizar: false, criar: false, editar: false, deletar: false }
      });
    }
    
    setIsPermissionsDialogOpen(true);
  };

  const handleSavePermissions = () => {
    if (!selectedUserForPermissions) return;
    savePermissionsMutation.mutate({
      userEmail: selectedUserForPermissions.email,
      data: permissionsData
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-[#e74c3c]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-white">Gestão de Usuários</h1>
            <p className="text-gray-400 mt-1">Gerencie acesso e permissões do sistema</p>
          </div>
        
        <div className="flex gap-2">
          <Dialog open={isInviteAnalistaOpen} onOpenChange={setIsInviteAnalistaOpen}>
            <DialogTrigger asChild>
              <Button className="bg-emerald-600 hover:bg-emerald-700 gap-2">
                <Plus className="w-4 h-4" />
                Convidar Analista
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#0a1628] border-[#1e3a5f] text-white">
              <DialogHeader>
                <DialogTitle>Convidar Analista para o Painel</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleInviteAnalista} className="space-y-4">
                <div>
                  <Label htmlFor="analista_select">Selecione o Analista</Label>
                  <Select
                    value={inviteAnalistaData.analistaId}
                    onValueChange={(value) => setInviteAnalistaData({ ...inviteAnalistaData, analistaId: value })}
                  >
                    <SelectTrigger className="bg-[#0f1f35] border-[#1e3a5f] mt-2">
                      <SelectValue placeholder="Selecione um analista" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0a1628] border-[#1e3a5f]">
                      {analistas.filter(a => !a.usuario_email).map((analista) => (
                        <SelectItem key={analista.id} value={analista.id}>
                          {analista.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="email_analista">E-mail do Analista</Label>
                  <Input
                    id="email_analista"
                    type="email"
                    value={inviteAnalistaData.email}
                    onChange={(e) => setInviteAnalistaData({ ...inviteAnalistaData, email: e.target.value })}
                    className="bg-[#0f1f35] border-[#1e3a5f] mt-2"
                    placeholder="analista@grupoavenida.com.br"
                    required
                  />
                  <p className="text-xs text-gray-400 mt-2">
                    O analista receberá permissão de "Usuário" e será vinculado automaticamente ao seu perfil.
                  </p>
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsInviteAnalistaOpen(false)} 
                    className="border-[#1e3a5f]"
                  >
                    Cancelar
                  </Button>
                  <Button 
                    type="submit" 
                    className="bg-emerald-600 hover:bg-emerald-700"
                    disabled={inviteAnalistaMutation.isPending}
                  >
                    {inviteAnalistaMutation.isPending ? 'Convidando...' : 'Convidar Analista'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#e74c3c] hover:bg-[#c0392b] gap-2">
                <Plus className="w-4 h-4" />
                Convidar Usuário
              </Button>
            </DialogTrigger>
          <DialogContent className="bg-[#0a1628] border-[#1e3a5f] text-white">
            <DialogHeader>
              <DialogTitle>Convidar Novo Usuário</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={inviteData.email}
                  onChange={(e) => setInviteData({ ...inviteData, email: e.target.value })}
                  className="bg-[#0f1f35] border-[#1e3a5f] mt-2"
                  placeholder="usuario@grupoavenida.com.br"
                  required
                />
              </div>
              <div>
                <Label htmlFor="role">Função</Label>
                <Select
                  value={inviteData.role}
                  onValueChange={(value) => setInviteData({ ...inviteData, role: value })}
                >
                  <SelectTrigger className="bg-[#0f1f35] border-[#1e3a5f] mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0a1628] border-[#1e3a5f]">
                    <SelectItem value="user">Usuário</SelectItem>
                    <SelectItem value="supervisor">Supervisor</SelectItem>
                    <SelectItem value="admin">Coordenador</SelectItem>
                    <SelectItem value="noc">NOC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsInviteDialogOpen(false)} 
                  className="border-[#1e3a5f]"
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  className="bg-[#e74c3c] hover:bg-[#c0392b]"
                  disabled={inviteMutation.isPending}
                >
                  {inviteMutation.isPending ? 'Enviando...' : 'Enviar Convite'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        </div>
        </div>

        {/* Carrossel de Abas do Sistema */}
        <div className="bg-[#0a1628] rounded-2xl border border-[#1e3a5f] p-6">
          <div className="flex items-center gap-2 mb-4">
            <Info className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-semibold text-white">Abas do Sistema - Funções e Boas Práticas</h2>
          </div>
          <Carousel className="w-full">
            <CarouselContent>
              {abasInfo.map((aba) => (
                <CarouselItem key={aba.key} className="md:basis-1/2 lg:basis-1/3">
                  <Card className="bg-[#0f1f35] border-[#1e3a5f] h-full">
                    <CardHeader>
                      <CardTitle className="text-blue-400 flex items-center gap-2">
                        <Shield className="w-5 h-5" />
                        {aba.nome}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <p className="text-xs font-semibold text-gray-400 mb-1">Descrição:</p>
                        <p className="text-sm text-gray-300">{aba.descricao}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-emerald-400 mb-1">Boa Prática:</p>
                        <p className="text-sm text-gray-300">{aba.boaPratica}</p>
                      </div>
                    </CardContent>
                  </Card>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="bg-[#1e3a5f] border-[#1e3a5f] text-white hover:bg-[#2a4a7f]" />
            <CarouselNext className="bg-[#1e3a5f] border-[#1e3a5f] text-white hover:bg-[#2a4a7f]" />
          </Carousel>
        </div>
      </div>

      <div className="bg-[#0a1628] rounded-2xl border border-[#1e3a5f] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-gray-400 text-sm border-b border-[#1e3a5f] bg-[#0f1f35]">
                <th className="px-6 py-4 font-medium">Nome</th>
                <th className="px-6 py-4 font-medium">E-mail</th>
                <th className="px-6 py-4 font-medium">Função</th>
                <th className="px-6 py-4 font-medium">Data de Criação</th>
                <th className="px-6 py-4 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-[#1e3a5f]/50 hover:bg-[#1e3a5f]/30">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#e74c3c]/20 flex items-center justify-center">
                        <span className="text-[#e74c3c] font-bold">
                          {user.full_name?.charAt(0) || user.email.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <span className="text-white font-medium">{user.full_name || '-'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-400">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      {user.email}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${getRoleBadge(user.role)}`}>
                      <Shield className="w-3 h-3" />
                      {getRoleLabel(user.role)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-400 text-sm">
                    {new Date(user.created_date).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-end gap-1">
                      {currentUser?.role === 'admin' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openPermissionsDialog(user)}
                          className="text-gray-400 hover:text-[#ADF802]"
                          title="Gerenciar Permissões"
                        >
                          <Lock className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(user)}
                        className="text-gray-400 hover:text-white"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDeleteDialog(user)}
                        className="text-gray-400 hover:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {users.length === 0 && (
        <div className="text-center py-12">
          <Settings className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">Nenhum usuário cadastrado</p>
        </div>
      )}

      {/* Gerenciar Conta */}
      <div className="bg-[#0a1628] border border-[#1e3a5f] rounded-2xl p-6">
        <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <Settings className="w-5 h-5" />
          Gerenciar Conta
        </h2>
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-red-400 flex items-center gap-2">
                <Trash2 className="w-5 h-5" />
                Zona de Perigo
              </h3>
              <p className="text-sm text-gray-400 mt-2">
                Ações irreversíveis que afetam permanentemente sua conta.
              </p>
            </div>
            <Button
              onClick={() => setDeleteAccountOpen(true)}
              variant="outline"
              className="border-red-500/50 text-red-400 hover:bg-red-500/20 hover:text-red-300 min-h-[44px]"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Deletar Minha Conta
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsDialogOpen(open); }}>
        <DialogContent className="bg-[#0a1628] border-[#1e3a5f] text-white">
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="full_name">Nome Completo</Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                className="bg-[#0f1f35] border-[#1e3a5f] mt-2"
              />
            </div>
            <div>
              <Label htmlFor="edit_role">Função</Label>
              <Select
                value={formData.role}
                onValueChange={(value) => setFormData({ ...formData, role: value })}
              >
                <SelectTrigger className="bg-[#0f1f35] border-[#1e3a5f] mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0a1628] border-[#1e3a5f]">
                  <SelectItem value="user">Usuário</SelectItem>
                  <SelectItem value="supervisor">Supervisor</SelectItem>
                  <SelectItem value="admin">Coordenador</SelectItem>
                  <SelectItem value="noc">NOC</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={resetForm} className="border-[#1e3a5f]">
                Cancelar
              </Button>
              <Button type="submit" className="bg-[#e74c3c] hover:bg-[#c0392b]">
                Atualizar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Account Confirmation Dialog */}
      <AlertDialog open={deleteAccountOpen} onOpenChange={setDeleteAccountOpen}>
        <AlertDialogContent className="bg-[#0a1628] border-[#1e3a5f]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Deletar Conta Permanentemente</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Esta ação é <strong className="text-red-400">irreversível</strong>. Todos os seus dados, configurações e histórico serão permanentemente removidos do sistema. 
              Você será desconectado imediatamente após a exclusão.
              <br /><br />
              Tem certeza que deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#1e3a5f]">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              className="bg-red-600 hover:bg-red-700"
            >
              Sim, Deletar Minha Conta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete User Confirmation Dialog */}
      <AlertDialog open={deleteUserOpen} onOpenChange={setDeleteUserOpen}>
        <AlertDialogContent className="bg-[#0a1628] border-[#1e3a5f]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Deletar Usuário</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Tem certeza que deseja deletar o usuário <strong className="text-white">{userToDelete?.full_name || userToDelete?.email}</strong>?
              <br /><br />
              Esta ação é <strong className="text-red-400">irreversível</strong> e todos os dados do usuário serão permanentemente removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#1e3a5f]">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deletando...' : 'Sim, Deletar Usuário'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Permissions Dialog */}
      <Dialog open={isPermissionsDialogOpen} onOpenChange={setIsPermissionsDialogOpen}>
        <DialogContent className="bg-[#0a1628] border-[#1e3a5f] text-white max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-[#ADF802]" />
              Gerenciar Permissões - {selectedUserForPermissions?.full_name || selectedUserForPermissions?.email}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Abas Visíveis */}
            <div className="bg-[#0f1f35] rounded-xl p-4 border border-[#1e3a5f]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Abas Visíveis no Sistema</h3>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="select_all_abas"
                    checked={Object.values(permissionsData.abas_visiveis).every(v => v === true)}
                    onCheckedChange={(checked) => {
                      const todasAbas = {};
                      Object.keys(permissionsData.abas_visiveis).forEach(key => {
                        todasAbas[key] = checked;
                      });
                      setPermissionsData({ ...permissionsData, abas_visiveis: todasAbas });
                    }}
                  />
                  <Label htmlFor="select_all_abas" className="text-sm text-[#ADF802] cursor-pointer font-medium">
                    Selecionar Todas
                  </Label>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  { key: 'dashboard', label: 'Dashboard' },
                  { key: 'atividades', label: 'Atividades' },
                  { key: 'fechamento_semanal', label: 'Fechamento Semanal' },
                  { key: 'supervisores', label: 'Supervisores' },
                  { key: 'analistas', label: 'Analistas' },
                  { key: 'ranking', label: 'Ranking' },
                  { key: 'avaliacoes', label: 'Avaliações' },
                  { key: 'war_room', label: 'War Room' },
                  { key: 'manual_supervisor', label: 'Manual do Supervisor' },
                  { key: 'gestao_usuarios', label: 'Gestão de Usuários' },
                  { key: 'logs', label: 'Logs do Sistema' }
                ].map((aba) => (
                  <div key={aba.key} className="flex items-center gap-2">
                    <Checkbox
                      id={`aba_${aba.key}`}
                      checked={permissionsData.abas_visiveis[aba.key]}
                      onCheckedChange={(checked) => 
                        setPermissionsData({
                          ...permissionsData,
                          abas_visiveis: { ...permissionsData.abas_visiveis, [aba.key]: checked }
                        })
                      }
                    />
                    <Label htmlFor={`aba_${aba.key}`} className="text-sm text-gray-300 cursor-pointer">
                      {aba.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Permissões de Atividades */}
            <div className="bg-[#0f1f35] rounded-xl p-4 border border-[#1e3a5f]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Permissões - Atividades</h3>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="select_all_atividades"
                    checked={Object.values(permissionsData.permissoes_atividades).every(v => v === true)}
                    onCheckedChange={(checked) => {
                      setPermissionsData({
                        ...permissionsData,
                        permissoes_atividades: {
                          visualizar: checked,
                          criar: checked,
                          editar: checked,
                          deletar: checked
                        }
                      });
                    }}
                  />
                  <Label htmlFor="select_all_atividades" className="text-sm text-[#ADF802] cursor-pointer font-medium">
                    Todas
                  </Label>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {['visualizar', 'criar', 'editar', 'deletar'].map((perm) => (
                  <div key={perm} className="flex items-center gap-2">
                    <Checkbox
                      id={`atividades_${perm}`}
                      checked={permissionsData.permissoes_atividades[perm]}
                      onCheckedChange={(checked) => 
                        setPermissionsData({
                          ...permissionsData,
                          permissoes_atividades: { ...permissionsData.permissoes_atividades, [perm]: checked }
                        })
                      }
                    />
                    <Label htmlFor={`atividades_${perm}`} className="text-sm text-gray-300 cursor-pointer capitalize">
                      {perm}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Permissões de Fechamento Semanal */}
            <div className="bg-[#0f1f35] rounded-xl p-4 border border-[#1e3a5f]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Permissões - Fechamento Semanal</h3>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="select_all_fechamento"
                    checked={Object.values(permissionsData.permissoes_fechamento).every(v => v === true)}
                    onCheckedChange={(checked) => {
                      setPermissionsData({
                        ...permissionsData,
                        permissoes_fechamento: {
                          visualizar: checked,
                          criar: checked,
                          editar: checked,
                          deletar: checked
                        }
                      });
                    }}
                  />
                  <Label htmlFor="select_all_fechamento" className="text-sm text-[#ADF802] cursor-pointer font-medium">
                    Todas
                  </Label>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {['visualizar', 'criar', 'editar', 'deletar'].map((perm) => (
                  <div key={perm} className="flex items-center gap-2">
                    <Checkbox
                      id={`fechamento_${perm}`}
                      checked={permissionsData.permissoes_fechamento[perm]}
                      onCheckedChange={(checked) => 
                        setPermissionsData({
                          ...permissionsData,
                          permissoes_fechamento: { ...permissionsData.permissoes_fechamento, [perm]: checked }
                        })
                      }
                    />
                    <Label htmlFor={`fechamento_${perm}`} className="text-sm text-gray-300 cursor-pointer capitalize">
                      {perm}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Permissões de War Room */}
            <div className="bg-[#0f1f35] rounded-xl p-4 border border-[#1e3a5f]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Permissões - War Room</h3>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="select_all_warroom"
                    checked={Object.values(permissionsData.permissoes_warroom).every(v => v === true)}
                    onCheckedChange={(checked) => {
                      setPermissionsData({
                        ...permissionsData,
                        permissoes_warroom: {
                          visualizar: checked,
                          criar: checked,
                          editar: checked,
                          deletar: checked
                        }
                      });
                    }}
                  />
                  <Label htmlFor="select_all_warroom" className="text-sm text-[#ADF802] cursor-pointer font-medium">
                    Todas
                  </Label>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {['visualizar', 'criar', 'editar', 'deletar'].map((perm) => (
                  <div key={perm} className="flex items-center gap-2">
                    <Checkbox
                      id={`warroom_${perm}`}
                      checked={permissionsData.permissoes_warroom[perm]}
                      onCheckedChange={(checked) => 
                        setPermissionsData({
                          ...permissionsData,
                          permissoes_warroom: { ...permissionsData.permissoes_warroom, [perm]: checked }
                        })
                      }
                    />
                    <Label htmlFor={`warroom_${perm}`} className="text-sm text-gray-300 cursor-pointer capitalize">
                      {perm}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#1e3a5f]">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setIsPermissionsDialogOpen(false)}
              className="border-[#1e3a5f]"
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleSavePermissions}
              className="bg-[#ADF802] hover:bg-[#9DE002] text-black font-bold"
              disabled={savePermissionsMutation.isPending}
            >
              {savePermissionsMutation.isPending ? 'Salvando...' : 'Salvar Permissões'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}