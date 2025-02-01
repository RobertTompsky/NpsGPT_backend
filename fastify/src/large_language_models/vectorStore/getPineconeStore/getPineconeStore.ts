import { OpenAIEmbeddings } from "@langchain/openai"
import { PineconeStore } from "@langchain/pinecone"
import { Pinecone } from "@pinecone-database/pinecone"

export const getPineconeStore = async () => {
    const pc = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY
    })

    const pcIndex = pc.Index(
        process.env.PINECONE_INDEX_NAME,
        process.env.PINECONE_INDEX_HOST
    )

    const vectorStore = await PineconeStore.fromExistingIndex(
        new OpenAIEmbeddings({
            apiKey: process.env.OPENAI_API_KEY,
            model: 'text-embedding-3-small'
        }),
        {
            pineconeIndex: pcIndex,
            maxConcurrency: 322
        }
    )

    return vectorStore
}