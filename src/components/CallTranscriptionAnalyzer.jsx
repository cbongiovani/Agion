import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Upload, Loader2, CheckCircle2, AlertTriangle, Clock, Users } from 'lucide-react';
import { toast } from 'sonner';

export default function CallTranscriptionAnalyzer({ incidentId, onActivitiesExtracted, isDark = true }) {
  const [isOpen, setIsOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [confirmingActivities, setConfirmingActivities] = useState(false);

  const analyzeMutation = useMutation({
    mutationFn: async (formData) => {
      setUploading(true);
      const response = await base44.functions.invoke('analyzeCallTranscription', formData);
      setUploading(false);
      return response.data;
    },
    onSuccess: (data) => {
      setAnalysis(data.analysis);
      toast.success(data.message);
    },
    onError: (error) => {
      toast.error(`Erro na análise: ${error.message}`);
      setUploading(false);
    },
  });

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.includes('text') && file.name.split('.').pop() !== 'txt') {
      toast.error('Por favor, selecione um arquivo de texto (.txt ou similar)');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('incidentId', incidentId);

    analyzeMutation.mutate(formData);
  };

  const handleConfirmActivities = () => {
    if (analysis?.activities?.length > 0) {
      onActivitiesExtracted(analysis.activities);
      setConfirmingActivities(false);
      setAnalysis(null);
      setIsOpen(false);
      toast.success('Atividades adicionadas à timeline!');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`gap-2 ${isDark ? 'border-gray-700 text-gray-400 hover:text-white' : 'border-gray-300'}`}
          title="Fazer upload de transcrição de call para análise de RCA"
        >
          <Upload className="w-4 h-4" />
          Analisar Call
        </Button>
      </DialogTrigger>

      <DialogContent className={`${isDark ? 'bg-[#242424] border-gray-800 text-white' : 'bg-white border-gray-300'} max-w-3xl max-h-[80vh] overflow-y-auto`}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Analisar Transcrição de Call - RCA
          </DialogTitle>
        </DialogHeader>

        {!analysis ? (
          <div className="space-y-4">
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Faça upload de uma transcrição de call para que a IA extraia automaticamente os pontos de ação, timeline de eventos e análise RCA baseada em metodologia padrão para TI em alta disponibilidade.
            </p>

            <div className={`border-2 border-dashed rounded-lg p-8 text-center ${isDark ? 'border-gray-700 bg-[#1a1a1a]' : 'border-gray-300 bg-gray-50'}`}>
              <input
                type="file"
                accept=".txt,.md"
                onChange={handleFileUpload}
                className="hidden"
                id="transcription-upload"
                disabled={uploading}
              />
              <label htmlFor="transcription-upload" className="cursor-pointer block">
                {uploading ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                    <p className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Analisando transcrição...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className={`w-8 h-8 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                    <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      Clique para selecionar ou arraste um arquivo
                    </p>
                    <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      Formato: .txt ou .md (Transcrição da call)
                    </p>
                  </div>
                )}
              </label>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Resumo RCA */}
            <div className={`p-4 rounded-lg border ${isDark ? 'bg-[#1a1a1a] border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
              <p className={`text-xs font-semibold mb-2 ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                RESUMO RCA
              </p>
              <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                {analysis.rca_summary}
              </p>
            </div>

            {/* Causas Raiz */}
            {analysis.root_causes?.length > 0 && (
              <div className={`p-4 rounded-lg border ${isDark ? 'bg-[#1a1a1a] border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                <p className={`text-xs font-semibold mb-2 ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                  CAUSAS RAIZ IDENTIFICADAS
                </p>
                <ul className="space-y-1">
                  {analysis.root_causes.map((cause, idx) => (
                    <li key={idx} className={`text-sm flex gap-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      <span className="text-red-400">•</span>
                      {cause}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Ações Preventivas */}
            {analysis.prevention_actions?.length > 0 && (
              <div className={`p-4 rounded-lg border ${isDark ? 'bg-[#1a1a1a] border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                <p className={`text-xs font-semibold mb-2 ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                  AÇÕES PREVENTIVAS RECOMENDADAS
                </p>
                <ul className="space-y-1">
                  {analysis.prevention_actions.map((action, idx) => (
                    <li key={idx} className={`text-sm flex gap-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      <span className="text-green-400">•</span>
                      {action}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Timeline de Atividades */}
            <div>
              <p className={`text-xs font-semibold mb-3 ${isDark ? 'text-[#ADF802]' : 'text-green-700'}`}>
                TIMELINE DE ATIVIDADES EXTRAÍDAS ({analysis.activities?.length || 0})
              </p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {analysis.activities?.map((activity, idx) => (
                  <div key={idx} className={`flex items-start gap-3 p-3 rounded border ${isDark ? 'bg-[#1a1a1a] border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                    <Clock className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-400" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`font-mono text-sm font-bold ${isDark ? 'text-[#ADF802]' : 'text-green-600'}`}>
                          {activity.hora}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-800'}`}>
                          {activity.setor}
                        </span>
                        {activity.relevant_to_rca && (
                          <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                        )}
                      </div>
                      <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        {activity.acao}
                      </p>
                      <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                        {activity.relevance_reason}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
              <Button
                variant="outline"
                onClick={() => setAnalysis(null)}
                className={isDark ? 'border-gray-700' : 'border-gray-300'}
              >
                Analisar Outro
              </Button>
              <Button
                onClick={() => setConfirmingActivities(true)}
                className={isDark ? 'bg-[#ADF802] hover:bg-[#9DE002] text-black font-bold' : 'bg-green-600 hover:bg-green-700 text-white'}
              >
                Adicionar Atividades
              </Button>
            </div>
          </div>
        )}
      </DialogContent>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmingActivities} onOpenChange={setConfirmingActivities}>
        <AlertDialogContent className={isDark ? 'bg-[#242424] border-gray-800' : 'bg-white border-gray-300'}>
          <AlertDialogHeader>
            <AlertDialogTitle className={isDark ? 'text-white' : 'text-gray-900'}>
              Confirmar Adição de Atividades
            </AlertDialogTitle>
            <AlertDialogDescription className={isDark ? 'text-gray-400' : 'text-gray-600'}>
              Deseja adicionar {analysis?.activities?.length || 0} atividades à timeline do incidente? Elas seguirão a sequência cronológica extraída da transcrição.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className={isDark ? 'border-gray-700' : 'border-gray-300'}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmActivities}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Adicionar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}