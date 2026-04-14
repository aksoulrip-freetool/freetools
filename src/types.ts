export interface PdfFile {
  id: string;
  file: File;
  name: string;
  numPages: number;
}

export interface PdfPage {
  id: string;
  fileId: string;
  pageIndex: number;
  thumbnailUrl: string;
  deleted: boolean;
}
