import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Award, Plus, Loader2, Trash2, Download, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function Certificados() {
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    nome_curso: '',
    analista_id: '',
    supervisor_id: '',
    data_conclusao: '',
    certificado_url: ''
  });

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: certificados = [] } = useQuery({
    queryKey: ['certificados'],
    queryFn: () => base44.entities.Certificado.list('-created_date'),
  });

  const { data: analistas = [] } = useQuery({
    queryKey: ['analistas'],
    queryFn: () => base44.entities.Analista.list(),
  });

  const { data: supervisores = [] } = useQuery({
    queryKey: ['supervisores'],
    queryFn: () => base44.entities.Supervisor.list(),
  });

  const createCertificadoMutation = useMutation({
    mutationFn: (data) => base44.entities.Certificado.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['certificados'] });
      toast.success('Certificado registrado com sucesso!');
      resetForm();
      setIsCreateDialogOpen(false);
    },
    onError: (error) => {
      toast.error('Erro ao registrar certificado: ' + error.message);
    },
  });

  const deleteCertificadoMutation = useMutation({
    mutationFn: (id) => base44.entities.Certificado.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['certificados'] });
      toast.success('Certificado removido!');
    },
    onError: (error) => {
      toast.error('Erro ao remover certificado');
    },
  });

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFormData({ ...formData, certificado_url: file_url });
      toast.success('Arquivo enviado com sucesso!');
    } catch (error) {
      toast.error('Erro ao fazer upload do arquivo');
    } finally {
      setUploading(false);
    }
  };

  const handleAnalistaChange = (analistaId) => {
    const analista = analistas.find(a => a.id === analistaId);
    const supervisor = supervisores.find(s => s.id === analista?.supervisor_id);
    
    setFormData({
      ...formData,
      analista_id: analistaId,
      supervisor_id: analista?.supervisor_id || '',
    });
  };

  const handleSubmit = () => {
    if (!formData.nome_curso || !formData.analista_id || !formData.data_conclusao || !formData.certificado_url) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    if (!currentUser?.email) {
      toast.error('Erro: usuário não autenticado');
      return;
    }

    const analista = analistas.find(a => a.id === formData.analista_id);
    const supervisor = supervisores.find(s => s.id === formData.supervisor_id);

    createCertificadoMutation.mutate({
      nome_curso: formData.nome_curso,
      analista_id: formData.analista_id,
      analista_nome: analista?.nome || '',
      supervisor_id: formData.supervisor_id,
      supervisor_nome: supervisor?.nome || '',
      data_conclusao: formData.data_conclusao,
      certificado_url: formData.certificado_url,
      registrado_por: currentUser.email,
    });
  };

  const resetForm = () => {
    setFormData({
      nome_curso: '',
      analista_id: '',
      supervisor_id: '',
      data_conclusao: '',
      certificado_url: ''
    });
  };

  const isCoord = currentUser?.role === 'admin';

  const getAnalistaInfo = (id) => {
    return analistas.find(a => a.id === id);
  };

  const getSupervisorInfo = (id) => {
    return supervisores.find(s => s.id === id);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-white flex items-center gap-3">
            <Award className="w-8 h-8 text-yellow-400" />
            Certificados e Certificações
          </h1>
          <p className="text-gray-400 mt-1">Gerencie certificados e cursos realizados</p>
        </div>
        {isCoord && (
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-yellow-600 hover:bg-yellow-700 gap-2">
                <Plus className="w-4 h-4" />
                Registrar Certificado
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#242424] border-gray-800 text-white max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Registrar Novo Certificado</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Analista</Label>
                  <Select value={formData.analista_id} onValueChange={handleAnalistaChange}>
                    <SelectTrigger className="bg-[#1a1a1a] border-gray-700 mt-2">
                      <SelectValue placeholder="Selecione um analista" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#242424] border-gray-700">
                      {analistas.map((analista) => (
                        <SelectItem key={analista.id} value={analista.id}>
                          {analista.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {formData.supervisor_id && (
                  <div>
                    <Label>Supervisor</Label>
                    <div className="bg-[#1a1a1a] border border-gray-700 rounded-md p-3 mt-2">
                      <p className="text-white">{getSupervisorInfo(formData.supervisor_id)?.nome || 'Carregando...'}</p>
                    </div>
                  </div>
                )}

                <div>
                  <Label>Nome do Curso</Label>
                  <Input
                    value={formData.nome_curso}
                    onChange={(e) => setFormData({ ...formData, nome_curso: e.target.value })}
                    className="bg-[#1a1a1a] border-gray-700 mt-2"
                    placeholder="Ex: Certificação em JavaScript Avançado"
                  />
                </div>

                <div>
                  <Label>Data de Conclusão</Label>
                  <Input
                    type="date"
                    value={formData.data_conclusao}
                    onChange={(e) => setFormData({ ...formData, data_conclusao: e.target.value })}
                    className="bg-[#1a1a1a] border-gray-700 mt-2"
                  />
                </div>

                <div>
                  <Label>Certificado (PDF ou Imagem)</Label>
                  <div className="mt-2">
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="file-upload"
                      disabled={uploading}
                    />
                    <label htmlFor="file-upload">
                      <Button type="button" variant="outline" className="border-gray-700 w-full" asChild disabled={uploading}>
                        <span className="cursor-pointer">
                          {uploading ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Enviando...
                            </>
                          ) : (
                            <>
                              <Download className="w-4 h-4 mr-2" />
                              Selecionar Arquivo
                            </>
                          )}
                        </span>
                      </Button>
                    </label>
                  </div>
                  {formData.certificado_url && (
                    <p className="text-xs text-green-400 mt-2">✓ Arquivo enviado com sucesso</p>
                  )}
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button variant="outline" onClick={() => { setIsCreateDialogOpen(false); resetForm(); }} className="border-gray-700">
                    Cancelar
                  </Button>
                  <Button onClick={handleSubmit} className="bg-yellow-600 hover:bg-yellow-700" disabled={createCertificadoMutation.isPending}>
                    {createCertificadoMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Registrando...
                      </>
                    ) : (
                      'Registrar Certificado'
                    )}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Contador de Certificados */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-[#242424] border-gray-800 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Total de Certificados</p>
              <p className="text-3xl font-bold text-yellow-400 mt-2">{certificados.length}</p>
            </div>
            <Award className="w-10 h-10 text-yellow-400/30" />
          </div>
        </Card>
      </div>

      {/* Lista de Certificados */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {certificados.length > 0 ? (
          certificados.map((cert) => (
            <Card key={cert.id} className="bg-[#242424] border-gray-800 p-6 flex flex-col">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-white">{cert.nome_curso}</h3>
                  <p className="text-xs text-gray-400 mt-1">{cert.analista_nome}</p>
                </div>
                {isCoord && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteCertificadoMutation.mutate(cert.id)}
                    className="text-red-400 hover:text-red-300 -mr-2 -mt-2"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>

              <div className="space-y-2 text-sm mb-4 flex-1">
                <div className="flex items-center gap-2 text-gray-400">
                  <span className="text-xs text-gray-500">Supervisor:</span>
                  <span className="text-white">{cert.supervisor_nome}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-400">
                  <Calendar className="w-4 h-4" />
                  <span>{format(new Date(cert.data_conclusao), 'dd/MM/yyyy', { locale: ptBR })}</span>
                </div>
              </div>

              <Button 
                variant="outline" 
                className="border-gray-700 w-full gap-2"
                onClick={() => window.open(cert.certificado_url, '_blank')}
              >
                <Download className="w-4 h-4" />
                Ver Certificado
              </Button>
            </Card>
          ))
        ) : (
          <div className="col-span-full text-center py-12">
            <Award className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">Nenhum certificado registrado ainda</p>
          </div>
        )}
      </div>
    </div>
  );
}