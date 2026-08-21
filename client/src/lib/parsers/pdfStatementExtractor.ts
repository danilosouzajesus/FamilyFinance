import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import pdfWorker from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { parseBankStatementText, ParsedBankStatementResult } from '@ff/shared';

// Configura o worker do PDF.js para processamento no navegador
if (typeof window !== 'undefined') {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
  } catch {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version || '4.10.38'}/legacy/build/pdf.worker.min.mjs`;
  }
}

/**
 * Extrai o texto contido em um arquivo PDF estruturando linhas por coordenadas visuais
 */
export async function extractTextFromPdf(data: ArrayBuffer | Uint8Array): Promise<string> {
  if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker || `https://unpkg.com/pdfjs-dist@${pdfjsLib.version || '4.10.38'}/legacy/build/pdf.worker.min.mjs`;
  }

  const loadingTask = pdfjsLib.getDocument({
    data,
  });

  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;
  const pageTexts: string[] = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    
    const items = textContent.items as Array<{ str: string; transform: number[] }>;
    
    // Agrupa itens pela coordenada Y (linhas no documento)
    const linesMap = new Map<number, Array<{ x: number; str: string }>>();
    
    for (const item of items) {
      if (!item.str || !item.str.trim()) continue;
      const y = Math.round(item.transform[5]);
      const x = item.transform[4];
      
      // Procura linha existente com tolerância de 3px
      let matchedY: number | null = null;
      for (const existingY of linesMap.keys()) {
        if (Math.abs(existingY - y) <= 3) {
          matchedY = existingY;
          break;
        }
      }
      
      if (matchedY !== null) {
        linesMap.get(matchedY)!.push({ x, str: item.str });
      } else {
        linesMap.set(y, [{ x, str: item.str }]);
      }
    }
    
    // Ordena as linhas do topo para o rodapé (Y decrescente no PDF)
    const sortedY = Array.from(linesMap.keys()).sort((a, b) => b - a);
    
    const pageLines = sortedY.map(y => {
      const lineItems = linesMap.get(y)!;
      // Ordena da esquerda para a direita (X crescente)
      lineItems.sort((a, b) => a.x - b.x);
      return lineItems.map(item => item.str.trim()).filter(Boolean).join(' ');
    });

    pageTexts.push(pageLines.join('\n'));
  }

  return pageTexts.join('\n\n');
}

/**
 * Lê e analisa o arquivo de extrato bancário em formato PDF
 */
export async function parsePdfBankStatement(file: File | ArrayBuffer | Uint8Array): Promise<ParsedBankStatementResult> {
  let buffer: ArrayBuffer;
  if (file instanceof File) {
    buffer = await file.arrayBuffer();
  } else if (file instanceof Uint8Array) {
    buffer = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer;
  } else {
    buffer = file;
  }

  const rawText = await extractTextFromPdf(buffer);
  const result = parseBankStatementText(rawText);

  return result;
}
