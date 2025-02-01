import { Document } from '@langchain/core/documents'
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'

export const createChunks = async (docs: Document<Record<string, any>>[]) => {
    const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 2000,
        chunkOverlap: 50
    })

    const chunks = await splitter.splitDocuments(docs)

    return chunks
}