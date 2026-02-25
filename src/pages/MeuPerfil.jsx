import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { User, Mail, Phone, Upload, Save, Loader2, Shield, Check, X, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import OnlineUsersCounter from '@/components/OnlineUsersCounter';

export default function MeuPerfil() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [uploading, setUploading] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [requestForm, setRequestForm] = useState({
    funcao_solicitada: 'supervisor',
    justificativa: ''
  });
  const [formData, setFormData] = useState({
    nome_customizado: '',
    telefone: '',
    foto_url: ''
  });

  const { data: user, isLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const data = await base44.auth.me();
      setFormData({
        nome_customizado: data.nome_customizado || data.full_name || '',
        telefone: data.telefone || '',
        foto_url: data.foto_url || ''
      });
      return data;
    }
  });

  const { data: solicitacoes = [] } = useQuery({
    queryKey: ['solicitacoesFuncao'],
    queryFn: () => base44.entities.SolicitacaoFuncao.filter({ status: 'pendente' }),
    enabled: user?.role === 'admin' || user?.role === 'supervisor',
  });

  const updateMutation = useMutation({
    mutationFn: (data) => base44.auth.updateMe(data),
    onSuccess: (updatedUser) => {
      const newUserData = {
        ...user,
        full_name: updatedUser.nome_customizado || updatedUser.full_name || user.full_name,
        nome_customizado: updatedUser.nome_customizado || updatedUser.full_name || '',
        telefone: updatedUser.telefone || '',
        foto_url: updatedUser.foto_url || ''
      };
      queryClient.setQueryData(['currentUser'], newUserData);
      queryClient.invalidateQueries({ queryKey: ['pendingRequests'] });
      setFormData({
        nome_customizado: newUserData.nome_customizado,
        telefone: newUserData.telefone,
        foto_url: newUserData.foto_url
      });
      toast.success('Perfil atualizado com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar perfil: ' + error.message);
    }
  });

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.auth.updateMe({ foto_url: file_url });
      setFormData({ ...formData, foto_url: file_url });
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
      toast.success('Foto atualizada com sucesso!');
    } catch (error) {
      toast.error('Erro ao fazer upload da foto');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  const formatPhone = (value) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  };

  const handlePhoneChange = (e) => {
    const formatted = formatPhone(e.target.value);
    setFormData({ ...formData, telefone: formatted });
  };

  const handleRequestRoleChange = async () => {
    if (!requestForm.justificativa.trim()) {
      toast.error('Por favor, adicione uma justificativa');
      return;
    }

    setRequesting(true);
    try {
      await base44.entities.SolicitacaoFuncao.create({
        usuario_id: user.id,
        usuario_nome: user.full_name || user.email,
        usuario_email: user.email,
        funcao_atual: user.role,
        funcao_solicitada: requestForm.funcao_solicitada,
        justificativa: requestForm.justificativa,
        status: 'pendente'
      });
      
      toast.success('Solicitação enviada com sucesso!');
      setShowRequestDialog(false);
      setRequestForm({ funcao_solicitada: 'supervisor', justificativa: '' });
    } catch (error) {
      toast.error('Erro ao enviar solicitação');
    } finally {
      setRequesting(false);
    }
  };

  const handleResponseRequest = async (solicitacao, aprovada) => {
    try {
      await base44.entities.SolicitacaoFuncao.update(solicitacao.id, {
        status: aprovada ? 'aprovada' : 'rejeitada',
        data_resposta: new Date().toISOString(),
        respondido_por: user.email
      });

      if (aprovada) {
        const targetUser = await base44.entities.User.filter({ email: solicitacao.usuario_email });
        if (targetUser.length > 0) {
          await base44.entities.User.update(targetUser[0].id, {
            role: solicitacao.funcao_solicitada
          });
        }
        toast.success('Solicitação aprovada e usuário atualizado!');
      } else {
        toast.success('Solicitação rejeitada');
      }

      queryClient.invalidateQueries({ queryKey: ['solicitacoesFuncao'] });
      queryClient.invalidateQueries({ queryKey: ['pendingRequests'] });
    } catch (error) {
      toast.error('Erro ao processar solicitação');
    }
  };

  const getRoleLabel = (role) => {
    const labels = {
      admin: 'Coordenador',
      supervisor: 'Supervisor',
      user: 'Usuário',
    };
    return labels[role] || role;
  };

  const getRoleBadge = (role) => {
    const colors = {
      admin: 'bg-[#e74c3c]/20 text-[#e74c3c] border-[#e74c3c]/30',
      supervisor: 'bg-[#ADF802]/20 text-[#ADF802] border-[#ADF802]/30',
      user: 'bg-gray-700/30 text-gray-400 border-gray-600/30',
    };
    return colors[role] || colors.user;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-[#e74c3c]" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-white">Meu Perfil</h1>
        <p className="text-gray-400 mt-1">Gerencie suas informações pessoais</p>
      </div>

      <Card className="bg-[#0a1628] border-[#1e3a5f] p-6">
        <div className="flex flex-col items-center gap-6 mb-8">
          <div className="relative">
            <div className="w-32 h-32 rounded-full bg-[#e74c3c]/20 flex items-center justify-center overflow-hidden border-4 border-[#1e3a5f]">
              {formData.foto_url ? (
                <img src={formData.foto_url} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <User className="w-16 h-16 text-[#e74c3c]" />
              )}
            </div>
            <label htmlFor="photo-upload" className="absolute bottom-0 right-0 bg-[#e74c3c] hover:bg-[#c0392b] text-white p-2 rounded-full cursor-pointer">
              {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
              <input
                id="photo-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoUpload}
                disabled={uploading}
              />
            </label>
          </div>
          <div className="text-center">
            <h2 className="text-xl font-bold text-white">{user.nome_customizado || user.full_name || 'Sem nome'}</h2>
            <p className="text-gray-400 text-sm">{user.email}</p>
            {user.telefone && (
              <p className="text-gray-400 text-sm flex items-center justify-center gap-1 mt-1">
                <Phone className="w-3 h-3" />
                {user.telefone}
              </p>
            )}
            <div className="mt-2">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${getRoleBadge(user.role)}`}>
                <Shield className="w-3 h-3" />
                {getRoleLabel(user.role)}
              </span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="nome_customizado">Nome Completo</Label>
            <Input
              id="nome_customizado"
              value={formData.nome_customizado}
              onChange={(e) => setFormData({ ...formData, nome_customizado: e.target.value })}
              className="bg-[#0f1f35] border-[#1e3a5f] mt-2"
              placeholder="Seu nome completo"
            />
          </div>

          <div>
            <Label htmlFor="email">E-mail</Label>
            <div className="relative mt-2">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                id="email"
                value={user.email}
                disabled
                className="bg-[#0f1f35]/50 border-[#1e3a5f] pl-10"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">O e-mail não pode ser alterado</p>
          </div>

          <div>
            <Label htmlFor="telefone">Telefone</Label>
            <div className="relative mt-2">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                id="telefone"
                value={formData.telefone}
                onChange={handlePhoneChange}
                className="bg-[#0f1f35] border-[#1e3a5f] pl-10"
                placeholder="(00) 00000-0000"
                maxLength={15}
              />
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <Button 
              type="submit" 
              className="bg-[#e74c3c] hover:bg-[#c0392b]"
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Salvar Alterações
                </>
              )}
            </Button>
          </div>
        </form>
      </Card>

      {(user.role === 'user' || user.role === 'supervisor') && (
        <Card className="bg-[#0a1628] border-[#1e3a5f] p-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Solicitar Alteração de Função
              </h3>
              <p className="text-sm text-gray-400 mt-2">
                {user.role === 'user' 
                  ? 'Solicite permissões para registrar atividades e acessar mais funcionalidades do sistema.'
                  : 'Solicite alteração para outra função do sistema.'
                }
              </p>
            </div>
            <Button
              onClick={() => setShowRequestDialog(true)}
              className="bg-[#ADF802] hover:bg-[#9DE702] text-black"
            >
              Solicitar Alteração
            </Button>
          </div>
        </Card>
      )}

      {user.role === 'admin' && (
        <Card className="bg-[#0a1628] border-[#1e3a5f] p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Usuários Online</h3>
          <OnlineUsersCounter currentUser={user} />
        </Card>
      )}

      {(user.role === 'admin' || user.role === 'supervisor') && solicitacoes.length > 0 && (
        <Card className="bg-[#0a1628] border-[#1e3a5f] p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-[#ADF802]" />
            Solicitações Pendentes
          </h3>
          <div className="space-y-4">
            {solicitacoes.map((solicitacao) => (
              <div key={solicitacao.id} className="bg-[#0f1f35] border border-[#1e3a5f] rounded-lg p-4">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#e74c3c]/20 flex items-center justify-center">
                        <User className="w-5 h-5 text-[#e74c3c]" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-white">{solicitacao.usuario_nome}</h4>
                        <p className="text-sm text-gray-400">{solicitacao.usuario_email}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className="text-xs px-2 py-1 rounded bg-gray-700/30 text-gray-400">
                            Atual: {getRoleLabel(solicitacao.funcao_atual)}
                          </span>
                          <span className="text-xs px-2 py-1 rounded bg-[#ADF802]/20 text-[#ADF802]">
                            Solicitado: {getRoleLabel(solicitacao.funcao_solicitada)}
                          </span>
                        </div>
                        {solicitacao.justificativa && (
                          <p className="text-sm text-gray-300 mt-2 bg-[#0a1628] p-2 rounded">
                            {solicitacao.justificativa}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleResponseRequest(solicitacao, true)}
                      className="bg-[#ADF802] hover:bg-[#9DE702] text-black"
                      size="sm"
                    >
                      <Check className="w-4 h-4 mr-1" />
                      Aprovar
                    </Button>
                    <Button
                      onClick={() => handleResponseRequest(solicitacao, false)}
                      variant="outline"
                      className="border-[#e74c3c] text-[#e74c3c] hover:bg-[#e74c3c]/10"
                      size="sm"
                    >
                      <X className="w-4 h-4 mr-1" />
                      Rejeitar
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <AlertDialog open={showRequestDialog} onOpenChange={setShowRequestDialog}>
        <AlertDialogContent className="bg-[#0a1628] border-[#1e3a5f]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Solicitar Alteração de Função</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Preencha os detalhes da sua solicitação. Um coordenador irá analisar seu pedido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="funcao_solicitada" className="text-white">Função Desejada</Label>
              <Select 
                value={requestForm.funcao_solicitada} 
                onValueChange={(value) => setRequestForm({ ...requestForm, funcao_solicitada: value })}
              >
                <SelectTrigger className="bg-[#0f1f35] border-[#1e3a5f] mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="supervisor">Supervisor</SelectItem>
                  {user.role === 'supervisor' && <SelectItem value="admin">Coordenador</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="justificativa" className="text-white">Justificativa</Label>
              <Textarea
                id="justificativa"
                value={requestForm.justificativa}
                onChange={(e) => setRequestForm({ ...requestForm, justificativa: e.target.value })}
                className="bg-[#0f1f35] border-[#1e3a5f] mt-2"
                placeholder="Explique o motivo da solicitação..."
                rows={4}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-gray-600 text-gray-400">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRequestRoleChange}
              disabled={requesting}
              className="bg-[#ADF802] hover:bg-[#9DE702] text-black"
            >
              {requesting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                'Enviar Solicitação'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}