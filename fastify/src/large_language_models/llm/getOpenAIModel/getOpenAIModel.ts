import { ChatOpenAI } from "@langchain/openai"

export const getOpenAIModel = (model: string) => {
    const llm = new ChatOpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        model: model,
        temperature: 1,
        streaming: true
    })

    return llm
}