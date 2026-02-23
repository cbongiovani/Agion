import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileDown, Loader2, Calendar, ArrowLeft } from 'lucide-react';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';

export default function RelatorioSemanal() {
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });

  const [semanaInicio, setSemanaInicio] = useState(format(weekStart, 'yyyy-MM-dd'));
  const [semanaFim, setSemanaFim] = useState(format(weekEnd, 'yyyy-MM-dd'));
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: fechamentos = [] } = useQuery({
    queryKey: ['fechamentos'],
    queryFn: () => base44.entities.FechamentoSemanal.list('-semana_inicio'),
  });

  const { data: atividades = [] } = useQuery({
    queryKey: ['atividades'],
    queryFn: () => base44.entities.Atividade.list('-data'),
  });

  const { data: supervisores = [] } = useQuery({
    queryKey: ['supervisores'],
    queryFn: () => base44.entities.Supervisor.list(),
  });

  const { data: analistas = [] } = useQuery({
    queryKey: ['analistas'],
    queryFn: () => base44.entities.Analista.list(),
  });

  const gerarPDF = async () => {
    setIsGenerating(true);
    
    try {
      // Filtrar fechamentos da semana selecionada
      const fechamentosSemana = fechamentos.filter(f => 
        f.semana_inicio >= semanaInicio && f.semana_inicio <= semanaFim
      );

      if (fechamentosSemana.length === 0) {
        toast.error('Não há fechamentos registrados para esta semana');
        setIsGenerating(false);
        return;
      }

      // Filtrar atividades da semana
      const atividadesSemana = atividades.filter(a => 
        a.data >= semanaInicio && a.data <= semanaFim
      );

      // Calcular totais consolidados
      const totais = fechamentosSemana.reduce((acc, f) => ({
        ligacoes: acc.ligacoes + (f.total_ligacoes_next_ip || 0),
        chamados: acc.chamados + (f.total_chamados_verdana || 0),
        monitorias: acc.monitorias + (f.total_monitorias || 0),
        oneOnOne: acc.oneOnOne + (f.total_1_1 || 0),
      }), { ligacoes: 0, chamados: 0, monitorias: 0, oneOnOne: 0 });

      // Criar PDF
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 14;
      let yPosition = 20;

      // Configurações de cores
      const primaryColor = [16, 185, 129]; // Emerald
      const darkBg = [36, 36, 36];
      const textColor = [255, 255, 255];

      // ====== PÁGINA 1: RESUMO EXECUTIVO ======
      doc.setFillColor(...darkBg);
      doc.rect(0, 0, pageWidth, 40, 'F');
      
      doc.setTextColor(...primaryColor);
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.text('RELATÓRIO SEMANAL', margin, 20);
      
      doc.setFontSize(12);
      doc.setTextColor(180, 180, 180);
      doc.text('Suporte N1 - Governança', margin, 30);

      yPosition = 50;
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      doc.text(`Período: ${format(new Date(semanaInicio), "dd/MM/yyyy")} - ${format(new Date(semanaFim), "dd/MM/yyyy")}`, margin, yPosition);
      
      yPosition += 15;
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('RESUMO EXECUTIVO', margin, yPosition);

      yPosition += 10;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');

      // Boxes de totais
      const boxWidth = (pageWidth - (margin * 2) - 10) / 2;
      const boxHeight = 20;
      let xPos = margin;
      let boxY = yPosition;

      const totaisData = [
        { label: 'Ligações Next IP', value: totais.ligacoes, color: [16, 185, 129] },
        { label: 'Chamados Verdana', value: totais.chamados, color: [59, 130, 246] },
        { label: 'Monitorias', value: totais.monitorias, color: [245, 158, 11] },
        { label: 'Reuniões 1:1', value: totais.oneOnOne, color: [139, 92, 246] },
      ];

      totaisData.forEach((item, index) => {
        if (index % 2 === 0 && index > 0) {
          boxY += boxHeight + 5;
          xPos = margin;
        } else if (index > 0) {
          xPos = margin + boxWidth + 10;
        }

        doc.setFillColor(...item.color);
        doc.roundedRect(xPos, boxY, boxWidth, boxHeight, 3, 3, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.text(item.label, xPos + 5, boxY + 7);
        
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text(item.value.toString(), xPos + 5, boxY + 16);
        doc.setFont('helvetica', 'normal');
      });

      yPosition = boxY + boxHeight + 15;

      // Visão Geral
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('VISÃO GERAL', margin, yPosition);
      
      yPosition += 8;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`• Total de Supervisores: ${fechamentosSemana.length}`, margin + 5, yPosition);
      yPosition += 6;
      doc.text(`• Total de Atividades Registradas: ${atividadesSemana.length}`, margin + 5, yPosition);
      yPosition += 6;
      doc.text(`• Média de Ligações por Supervisor: ${(totais.ligacoes / fechamentosSemana.length).toFixed(0)}`, margin + 5, yPosition);
      yPosition += 6;
      doc.text(`• Média de Chamados por Supervisor: ${(totais.chamados / fechamentosSemana.length).toFixed(0)}`, margin + 5, yPosition);

      // ====== PÁGINA 2: PERFORMANCE POR SUPERVISOR ======
      doc.addPage();
      yPosition = 20;

      doc.setFillColor(...darkBg);
      doc.rect(0, 0, pageWidth, 30, 'F');
      
      doc.setTextColor(...primaryColor);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('PERFORMANCE POR SUPERVISOR', margin, 20);

      yPosition = 40;

      const supervisoresData = fechamentosSemana.map(f => {
        const sup = supervisores.find(s => s.id === f.supervisor_id);
        const atividadesSup = atividadesSemana.filter(a => a.supervisor_id === f.supervisor_id);
        const mediaAvaliacoes = atividadesSup.length > 0 
          ? atividadesSup.reduce((sum, a) => sum + (a.nota || 0), 0) / atividadesSup.length 
          : 0;

        return [
          sup?.nome || '-',
          f.total_ligacoes_next_ip?.toString() || '0',
          f.total_chamados_verdana?.toString() || '0',
          f.total_monitorias?.toString() || '0',
          mediaAvaliacoes.toFixed(1),
          f.observacoes || '-'
        ];
      });

      doc.autoTable({
        startY: yPosition,
        head: [['Supervisor', 'Ligações', 'Chamados', 'Monitorias', 'Média', 'Observações']],
        body: supervisoresData,
        theme: 'striped',
        headStyles: { fillColor: primaryColor, textColor: 255, fontSize: 9, fontStyle: 'bold' },
        styles: { fontSize: 8, cellPadding: 3 },
        columnStyles: {
          0: { cellWidth: 35 },
          1: { cellWidth: 22, halign: 'center' },
          2: { cellWidth: 22, halign: 'center' },
          3: { cellWidth: 22, halign: 'center' },
          4: { cellWidth: 18, halign: 'center' },
          5: { cellWidth: 'auto' }
        },
      });

      // ====== PÁGINA 3: PERFORMANCE POR ANALISTA ======
      doc.addPage();
      yPosition = 20;

      doc.setFillColor(...darkBg);
      doc.rect(0, 0, pageWidth, 30, 'F');
      
      doc.setTextColor(...primaryColor);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('PERFORMANCE POR ANALISTA', margin, 20);

      yPosition = 40;

      const analistasData = analistas.map(an => {
        const atividadesAn = atividadesSemana.filter(a => a.analista_id === an.id);
        const media = atividadesAn.length > 0 
          ? atividadesAn.reduce((sum, a) => sum + (a.nota || 0), 0) / atividadesAn.length 
          : 0;
        
        let classificacao = '-';
        if (media >= 8) classificacao = 'Alta Performance';
        else if (media >= 6) classificacao = 'Adequada';
        else if (media > 0) classificacao = 'Atenção';

        return [
          an.nome,
          atividadesAn.length.toString(),
          media > 0 ? media.toFixed(1) : '-',
          classificacao
        ];
      }).filter(row => row[1] !== '0'); // Apenas analistas com atividades

      doc.autoTable({
        startY: yPosition,
        head: [['Analista', 'Total Registros', 'Média', 'Classificação']],
        body: analistasData.length > 0 ? analistasData : [['Nenhum registro', '-', '-', '-']],
        theme: 'striped',
        headStyles: { fillColor: primaryColor, textColor: 255, fontSize: 10, fontStyle: 'bold' },
        styles: { fontSize: 9, cellPadding: 4 },
        columnStyles: {
          0: { cellWidth: 60 },
          1: { cellWidth: 35, halign: 'center' },
          2: { cellWidth: 30, halign: 'center' },
          3: { cellWidth: 'auto', halign: 'center' }
        },
      });

      // ====== PÁGINA 4: OBSERVAÇÕES ESTRATÉGICAS ======
      doc.addPage();
      yPosition = 20;

      doc.setFillColor(...darkBg);
      doc.rect(0, 0, pageWidth, 30, 'F');
      
      doc.setTextColor(...primaryColor);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('OBSERVAÇÕES ESTRATÉGICAS', margin, 20);

      yPosition = 45;
      doc.setTextColor(0, 0, 0);

      // Destaques
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('DESTAQUES', margin, yPosition);
      yPosition += 8;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      
      const destaques = fechamentosSemana
        .filter(f => f.destaques)
        .map(f => `• ${supervisores.find(s => s.id === f.supervisor_id)?.nome}: ${f.destaques}`);
      
      if (destaques.length > 0) {
        destaques.forEach(d => {
          const lines = doc.splitTextToSize(d, pageWidth - (margin * 2));
          doc.text(lines, margin + 5, yPosition);
          yPosition += lines.length * 5;
        });
      } else {
        doc.text('Nenhum destaque registrado.', margin + 5, yPosition);
        yPosition += 6;
      }

      yPosition += 10;

      // Pontos Críticos
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('PONTOS CRÍTICOS', margin, yPosition);
      yPosition += 8;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      
      const pontosCriticos = fechamentosSemana
        .filter(f => f.pontos_criticos)
        .map(f => `• ${supervisores.find(s => s.id === f.supervisor_id)?.nome}: ${f.pontos_criticos}`);
      
      if (pontosCriticos.length > 0) {
        pontosCriticos.forEach(p => {
          const lines = doc.splitTextToSize(p, pageWidth - (margin * 2));
          doc.text(lines, margin + 5, yPosition);
          yPosition += lines.length * 5;
        });
      } else {
        doc.text('Nenhum ponto crítico registrado.', margin + 5, yPosition);
        yPosition += 6;
      }

      yPosition += 10;

      // Plano de Ação
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('PLANO DE AÇÃO', margin, yPosition);
      yPosition += 8;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      
      const planosAcao = fechamentosSemana
        .filter(f => f.plano_acao)
        .map(f => `• ${supervisores.find(s => s.id === f.supervisor_id)?.nome}: ${f.plano_acao}`);
      
      if (planosAcao.length > 0) {
        planosAcao.forEach(p => {
          const lines = doc.splitTextToSize(p, pageWidth - (margin * 2));
          doc.text(lines, margin + 5, yPosition);
          yPosition += lines.length * 5;
        });
      } else {
        doc.text('Nenhum plano de ação registrado.', margin + 5, yPosition);
      }

      // Footer em todas as páginas
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(
          `Página ${i} de ${pageCount} | Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`,
          margin,
          doc.internal.pageSize.getHeight() - 10
        );
      }

      // Salvar PDF
      const filename = `Relatorio_Suporte_N1_Semana_${format(new Date(semanaInicio), 'yyyy-MM-dd')}.pdf`;
      doc.save(filename);
      
      toast.success('Relatório gerado com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast.error('Erro ao gerar o relatório');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to={createPageUrl('Dashboard')}>
          <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-white">Exportar Relatório Semanal</h1>
          <p className="text-gray-400 mt-1">Gere relatórios consolidados em PDF</p>
        </div>
      </div>

      <Card className="bg-[#242424] border-gray-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-emerald-400" />
            Selecionar Período
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-300">Data Início</Label>
              <Input
                type="date"
                value={semanaInicio}
                onChange={(e) => setSemanaInicio(e.target.value)}
                className="bg-[#1a1a1a] border-gray-700 text-white mt-2"
              />
            </div>
            <div>
              <Label className="text-gray-300">Data Fim</Label>
              <Input
                type="date"
                value={semanaFim}
                onChange={(e) => setSemanaFim(e.target.value)}
                className="bg-[#1a1a1a] border-gray-700 text-white mt-2"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-gray-800">
            <Button
              onClick={gerarPDF}
              disabled={isGenerating}
              className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Gerando PDF...
                </>
              ) : (
                <>
                  <FileDown className="w-4 h-4" />
                  Gerar Relatório PDF
                </>
              )}
            </Button>
          </div>

          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
            <p className="text-sm text-blue-400 font-medium mb-2">📄 O relatório incluirá:</p>
            <ul className="text-sm text-gray-400 space-y-1 ml-4">
              <li>• Página 1: Resumo Executivo com totais consolidados</li>
              <li>• Página 2: Performance detalhada por Supervisor</li>
              <li>• Página 3: Performance e classificação por Analista</li>
              <li>• Página 4: Observações estratégicas (destaques, pontos críticos, plano de ação)</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <div className="bg-[#242424] rounded-2xl border border-gray-800 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Histórico de Fechamentos</h3>
        <div className="space-y-2">
          {fechamentos.slice(0, 10).map((f) => (
            <div
              key={f.id}
              className="flex items-center justify-between p-3 bg-[#1a1a1a] rounded-lg hover:bg-gray-800/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-white text-sm font-medium">
                    {format(new Date(f.semana_inicio), "dd/MM/yyyy")} - {format(new Date(f.semana_fim), "dd/MM/yyyy")}
                  </p>
                  <p className="text-gray-400 text-xs">
                    {supervisores.find(s => s.id === f.supervisor_id)?.nome}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSemanaInicio(f.semana_inicio);
                  setSemanaFim(f.semana_fim);
                }}
                className="text-emerald-400 hover:text-emerald-300"
              >
                Usar período
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}