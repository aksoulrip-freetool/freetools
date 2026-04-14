import React, { useState, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';
import { Upload, Trash2, Download, FilePlus, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { PdfFile, PdfPage } from '../types';
import { cn } from '../lib/utils';

// Set worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

export default function PdfEditor() {
  const [files, setFiles] = useState<PdfFile[]>([]);
  const [pages, setPages] = useState<PdfPage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = event.target.files;
    if (!uploadedFiles || uploadedFiles.length === 0) return;

    setIsProcessing(true);
    
    const newFiles: PdfFile[] = [];
    const newPages: PdfPage[] = [];

    for (let i = 0; i < uploadedFiles.length; i++) {
      const file = uploadedFiles[i];
      const fileId = crypto.randomUUID();
      
      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const numPages = pdf.numPages;
        
        newFiles.push({
          id: fileId,
          file,
          name: file.name,
          numPages,
        });

        // Generate thumbnails
        for (let j = 1; j <= numPages; j++) {
          const page = await pdf.getPage(j);
          const viewport = page.getViewport({ scale: 0.3 }); // Small scale for thumbnail
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          if (!context) continue;
          
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          
          await page.render({ canvasContext: context, viewport } as any).promise;
          
          newPages.push({
            id: crypto.randomUUID(),
            fileId,
            pageIndex: j - 1,
            thumbnailUrl: canvas.toDataURL(),
            deleted: false,
          });
        }
      } catch (error) {
        console.error(`Error processing file ${file.name}:`, error);
        alert(`Failed to process ${file.name}. It might not be a valid PDF.`);
      }
    }

    setFiles(prev => [...prev, ...newFiles]);
    setPages(prev => [...prev, ...newPages]);
    setIsProcessing(false);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDeletePage = (pageId: string) => {
    setPages(prev => prev.map(p => p.id === pageId ? { ...p, deleted: true } : p));
  };

  const handleRestorePage = (pageId: string) => {
    setPages(prev => prev.map(p => p.id === pageId ? { ...p, deleted: false } : p));
  };

  const handleRemoveFile = (fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
    setPages(prev => prev.filter(p => p.fileId !== fileId));
  };

  const handleMovePage = (index: number, direction: 'left' | 'right') => {
    setPages(prev => {
      const newPages = [...prev];
      if (direction === 'left' && index > 0) {
        [newPages[index - 1], newPages[index]] = [newPages[index], newPages[index - 1]];
      } else if (direction === 'right' && index < newPages.length - 1) {
        [newPages[index + 1], newPages[index]] = [newPages[index], newPages[index + 1]];
      }
      return newPages;
    });
  };

  const handleExport = async () => {
    if (files.length === 0) return;
    setIsProcessing(true);

    try {
      const mergedPdf = await PDFDocument.create();
      const loadedPdfs: Record<string, PDFDocument> = {};

      for (const page of pages) {
        if (page.deleted) continue;
        
        if (!loadedPdfs[page.fileId]) {
          const file = files.find(f => f.id === page.fileId);
          if (file) {
            const arrayBuffer = await file.file.arrayBuffer();
            loadedPdfs[page.fileId] = await PDFDocument.load(arrayBuffer);
          }
        }

        const pdfDoc = loadedPdfs[page.fileId];
        if (pdfDoc) {
          const [copiedPage] = await mergedPdf.copyPages(pdfDoc, [page.pageIndex]);
          mergedPdf.addPage(copiedPage);
        }
      }

      const pdfBytes = await mergedPdf.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = 'merged_edited.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Failed to export PDF.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f0f2f5] p-5 font-['Helvetica_Neue',Arial,sans-serif] text-[#1a1a1a]">
      <div className="max-w-[1200px] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_240px] lg:grid-rows-[80px_minmax(0,1fr)_180px] gap-4 min-h-[calc(100vh-40px)]">
          
          {/* Header Card */}
          <div className="lg:col-span-2 bg-white border-2 border-[#1a1a1a] rounded-2xl p-5 flex items-center justify-between">
            <div className="flex items-center gap-2 text-2xl font-extrabold">
              <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center text-white text-sm">PF</div>
              PDF Flow
            </div>
            <div className="flex gap-2.5 items-center">
              <div className="text-right">
                <div className="text-[14px] font-semibold">John Doe</div>
                <div className="text-[11px] text-[#666]">Pro Plan</div>
              </div>
              <div className="w-9 h-9 bg-[#ddd] rounded-full"></div>
            </div>
          </div>

          {/* Action Center */}
          <div className="lg:col-start-3 lg:row-start-1 lg:row-span-2 bg-[#1a1a1a] text-white border-2 border-[#1a1a1a] rounded-2xl p-5 flex flex-col relative overflow-hidden">
            <span className="text-[10px] uppercase tracking-[1px] text-[#aaa] mb-1 block">Export Settings</span>
            <h2 className="text-lg font-bold text-white mb-6">Ready to Merge</h2>
            
            <div className="text-[13px] text-[#ccc] mb-6 leading-relaxed">
              Total Pages: {pages.filter(p => !p.deleted).length}<br/>
              Files: {files.length}<br/>
              Quality: High Print
            </div>

            <div className="mb-5">
              <div className="text-[12px] mb-2">PDF Version</div>
              <div className="p-2 border border-[#444] rounded-md text-sm">1.7 (Acrobat 8.x)</div>
            </div>
            
            <div className="mb-5">
              <div className="text-[12px] mb-2">Security</div>
              <div className="p-2 border border-[#444] rounded-md text-sm">No Encryption</div>
            </div>
            
            <button
              onClick={handleExport}
              disabled={isProcessing || pages.every(p => p.deleted) || files.length === 0}
              className="mt-auto bg-[#00ff66] text-black border-none p-4 rounded-xl font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#00cc55] transition-colors w-full"
            >
              Merge & Download
            </button>
          </div>

          {/* File Queue */}
          <div className="lg:col-start-1 lg:row-start-2 lg:row-span-2 bg-white border-2 border-[#1a1a1a] rounded-2xl p-5 flex flex-col relative overflow-hidden">
            <span className="text-[10px] uppercase tracking-[1px] text-[#666] mb-1 block">Upload Queue</span>
            <h2 className="text-lg font-bold mb-4">Merged Files</h2>
            
            <div className="flex-1 overflow-y-auto space-y-2 mb-4 pr-1">
              {files.map((file, index) => (
                <div key={file.id} className="flex items-center justify-between p-3 bg-[#f8f8f8] rounded-xl border border-[#eee]">
                  <div className="text-[14px] font-medium truncate pr-2">
                    {file.name}
                    <div className="text-[11px] text-[#888] mt-0.5">{file.numPages} Pages</div>
                  </div>
                  <button onClick={() => handleRemoveFile(file.id)} className="text-gray-400 hover:text-red-600 flex-shrink-0">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div 
              className="mt-auto p-4 border-2 border-dashed border-[#ccc] rounded-xl text-center text-[#888] text-[13px] cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              + Drag & drop more files
            </div>
            <input
              type="file"
              accept="application/pdf"
              multiple
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileUpload}
            />
          </div>

          {/* Editor Preview */}
          <div className="lg:col-start-2 lg:row-start-2 bg-[#e0e0e0] border-2 border-[#1a1a1a] rounded-2xl p-5 flex flex-col relative overflow-hidden">
            {files.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-[#888]">
                Upload PDFs to see preview
              </div>
            ) : (
              <div className="overflow-y-auto h-full pr-2">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {pages.map((page, index) => (
                    <div 
                      key={page.id} 
                      className={cn(
                        "group relative aspect-[3/4] rounded-xl border-2 overflow-hidden transition-all bg-white shadow-sm",
                        page.deleted ? "border-red-400 opacity-50 grayscale" : "border-transparent hover:border-[#1a1a1a]"
                      )}
                    >
                      <img 
                        src={page.thumbnailUrl} 
                        alt={`Page ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                      
                      <div className="absolute bottom-2 right-2 text-[12px] text-[#999] bg-white/90 px-2 py-1 rounded">
                        Page {index + 1}
                      </div>

                      <div className={cn(
                        "absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-2 transition-opacity",
                        page.deleted ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                      )}>
                        {page.deleted ? (
                          <button
                            onClick={() => handleRestorePage(page.id)}
                            className="px-4 py-2 bg-white text-black rounded-lg text-sm font-bold hover:bg-gray-100"
                          >
                            Restore
                          </button>
                        ) : (
                          <>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleMovePage(index, 'left')}
                                disabled={index === 0}
                                className="p-2 bg-white text-black rounded-lg hover:bg-gray-100 disabled:opacity-50"
                              >
                                <ChevronLeft className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeletePage(page.id)}
                                className="px-4 py-2 bg-[#ff4444] text-white rounded-lg font-bold hover:bg-red-600"
                              >
                                Delete
                              </button>
                              <button
                                onClick={() => handleMovePage(index, 'right')}
                                disabled={index === pages.length - 1}
                                className="p-2 bg-white text-black rounded-lg hover:bg-gray-100 disabled:opacity-50"
                              >
                                <ChevronRight className="w-4 h-4" />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Stats Card */}
          <div className="lg:col-start-2 lg:row-start-3 bg-white border-2 border-[#1a1a1a] rounded-2xl p-5 flex flex-col relative overflow-hidden">
            <span className="text-[10px] uppercase tracking-[1px] text-[#666] mb-1 block">Visual Navigator</span>
            <h2 className="text-lg font-bold mb-4">Page Overview</h2>
            
            <div className="flex gap-3 overflow-x-auto pb-2 items-center h-full">
              {pages.map((page, index) => (
                <div 
                  key={`thumb-${page.id}`}
                  className={cn(
                    "flex-shrink-0 h-full max-h-[100px] aspect-[3/4] rounded-lg border flex items-center justify-center text-[11px] font-medium",
                    page.deleted ? "bg-red-50 border-red-200 text-red-400" : "bg-[#f0f0f0] border-[#ddd] text-[#666]"
                  )}
                >
                  P{index + 1}
                </div>
              ))}
              {pages.length === 0 && (
                <div className="text-[#888] text-sm">No pages to display</div>
              )}
            </div>
          </div>

        </div>
      </div>
      
      {isProcessing && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-8 h-8 border-4 border-[#1a1a1a] border-t-transparent rounded-full animate-spin" />
            <p className="text-[#1a1a1a] font-bold">Processing PDFs...</p>
          </div>
        </div>
      )}
    </div>
  );
}
