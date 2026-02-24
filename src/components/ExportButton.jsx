import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FileDown, Loader2, FileJson } from 'lucide-react';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { toast } from 'sonner';

export default function ExportButton({ 
  data, 
  fileName = 'Relatorio',
  className = '',
  variant = 'default'
}) {
  const [isGenerating, setIsGenerating] = useState(false);

  const addHeader = (doc, title) => {
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;

    doc.setFillColor(10, 10, 10);
    doc.rect(0, 0, pageWidth, 40, 'F');

    doc.setFontSize(20);
    doc.setTextColor(173, 248, 2);
    doc.setFont('helvetica', 'bold');
    doc.text('GRUPO AGION', margin, 15);

    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'normal');
    doc.text('Governança N1 - Suporte', margin, 25);

    doc.setDrawColor(173, 248, 2);
    doc.setLineWidth(0.5);
    doc.line(margin, 30, pageWidth - margin, 30);

    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
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
      
      doc.setDrawColor(173, 248, 2);
      doc.setLineWidth(1);
      doc.line(14, doc.internal.pageSize.getHeight() - 15, doc.internal.pageSize.getWidth() - 14, doc.internal.pageSize.getHeight() - 15);
    }
  };

  const generatePDF = async () => {
    setIsGenerating(true);
    
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 14;

      doc.setFillColor(20, 20, 20);
      doc.rect(0, 0, pageWidth, doc.internal.pageSize.getHeight(), 'F');

      if (data && data.generateContent) {
        await data.generateContent(doc, addHeader, pageWidth, margin);
      }

      addFooter(doc);
      doc.save(`${fileName}.pdf`);
      
      toast.success('PDF exportado com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast.error('Erro ao exportar PDF');
    } finally {
      setIsGenerating(false);
    }
  };

  const generateCSV = async () => {
    setIsGenerating(true);
    
    try {
      if (data && data.generateCSV) {
        const csv = await data.generateCSV();
        const BOM = '\uFEFF';
        const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `${fileName}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        toast.success('CSV exportado com sucesso!');
      } else {
        toast.error('Exportação em CSV não disponível');
      }
    } catch (error) {
      console.error('Erro ao gerar CSV:', error);
      toast.error('Erro ao exportar CSV');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          disabled={isGenerating}
          variant={variant}
          className={className}
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Exportando...
            </>
          ) : (
            <>
              <FileDown className="w-4 h-4 mr-2" />
              Exportar
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-[#0a1628] border-[#1e3a5f]">
        <DropdownMenuItem
          onClick={generatePDF}
          disabled={isGenerating}
          className="text-white cursor-pointer"
        >
          📄 Exportar PDF
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={generateCSV}
          disabled={isGenerating}
          className="text-white cursor-pointer"
        >
          📊 Exportar CSV
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}