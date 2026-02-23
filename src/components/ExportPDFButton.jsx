import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileDown, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { toast } from 'sonner';

export default function ExportPDFButton({ 
  data, 
  fileName = 'Relatorio_Governanca_N1.pdf',
  buttonText = 'Exportar PDF',
  className = '',
  variant = 'default'
}) {
  const [isGenerating, setIsGenerating] = useState(false);

  const addHeader = (doc, title) => {
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;

    // Fundo do header - Verde Agion
    doc.setFillColor(173, 248, 2);
    doc.rect(0, 0, pageWidth, 40, 'F');

    // Logo Agion (ajustada para o fundo verde)
    doc.setFontSize(20);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text('GRUPO AGION', margin, 15);

    // Subtítulo
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    doc.text('Governança N1 - Suporte', margin, 25);

    // Linha decorativa
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.line(margin, 30, pageWidth - margin, 30);

    // Título da seção (abaixo do header)
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text(title, margin, 50);

    return 60;
  };

  const addFooter = (doc) => {
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(
        `Página ${i} de ${pageCount} | Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`,
        14,
        doc.internal.pageSize.getHeight() - 10
      );
      
      // Linha decorativa no footer
      doc.setDrawColor(173, 248, 2);
      doc.setLineWidth(0.5);
      doc.line(14, doc.internal.pageSize.getHeight() - 15, doc.internal.pageSize.getWidth() - 14, doc.internal.pageSize.getHeight() - 15);
    }
  };

  const generatePDF = async () => {
    setIsGenerating(true);
    
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 14;

      // Chamar a função de geração personalizada
      if (data && data.generateContent) {
        await data.generateContent(doc, addHeader, pageWidth, margin);
      }

      // Adicionar footer em todas as páginas
      addFooter(doc);

      // Salvar PDF
      doc.save(fileName);
      
      toast.success('PDF exportado com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast.error('Erro ao exportar PDF');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Button
      onClick={generatePDF}
      disabled={isGenerating}
      variant={variant}
      className={className}
    >
      {isGenerating ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Gerando...
        </>
      ) : (
        <>
          <FileDown className="w-4 h-4 mr-2" />
          {buttonText}
        </>
      )}
    </Button>
  );
}