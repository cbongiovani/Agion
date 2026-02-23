import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { User, Mail, Phone, Upload, Save, Loader2, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function MeuPerfil() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [uploading, setUploading] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    telefone: '',
    foto_url: ''
  });

  const { data: user, isLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const data = await base44.auth.me();
      setFormData({
        full_name: data.full_name || '',
        telefone: data.telefone || '',
        foto_url: data.foto_url || ''
      });
      return data;
    }
  });

  const updateMutation = useMutation({
    mutationFn: (data) => base44.auth.updateMe(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
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
    setRequesting(true);
    try {
      const admins = await base44.entities.User.filter({ role: 'admin' });
      
      if (admins.length === 0) {
        toast.error('Nenhum coordenador encontrado');
        return;
      }

      for (const admin of admins) {
        await base44.integrations.Core.SendEmail({
          to: admin.email,
          subject: 'Solicitação de Alteração de Função',
          body: `
            <h2>Nova Solicitação de Alteração de Função</h2>
            <p><strong>Usuário:</strong> ${user.full_name || user.email}</p>
            <p><strong>E-mail:</strong> ${user.email}</p>
            <p><strong>Função Atual:</strong> ${getRoleLabel(user.role)}</p>
            <p><strong>Função Solicitada:</strong> Supervisor</p>
            <br>
            <p>Por favor, acesse o sistema para aprovar ou rejeitar esta solicitação.</p>
          `
        });
      }
      
      toast.success('Solicitação enviada para o coordenador!');
    } catch (error) {
      toast.error('Erro ao enviar solicitação');
    } finally {
      setRequesting(false);
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
            <h2 className="text-xl font-bold text-white">{user.full_name || 'Sem nome'}</h2>
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
            <Label htmlFor="full_name">Nome Completo</Label>
            <Input
              id="full_name"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
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
                'Solicitar Alteração'
              )}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}