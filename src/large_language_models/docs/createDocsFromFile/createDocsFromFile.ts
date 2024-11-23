import { VALID_FILE_TYPES } from '@/entities/doc/lib';
import { DocxLoader } from '@langchain/community/document_loaders/fs/docx';
// import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { DocumentLoader } from '@langchain/core/document_loaders/base'
import { Document } from '@langchain/core/documents'
import { TextLoader } from 'langchain/document_loaders/fs/text';

export const createDocsFromFile = async (url: string, mimetype: string) => {

    let loader: DocumentLoader
    let docs: Document<Record<string, any>>[];

    switch (mimetype) {
        case VALID_FILE_TYPES.WORD:
            loader = new DocxLoader(url)
            docs = await loader.load()
            break

        // case VALID_FILE_TYPES.PDF:
        //     loader = new PDFLoader(url)
        //     docs = await loader.load()
        //     break

        case VALID_FILE_TYPES.TXT:
            loader = new TextLoader(url)
            docs = await loader.load()
            break
            
        default:
            throw new Error('Формат файла не поддерживается');
    }

    return docs
}