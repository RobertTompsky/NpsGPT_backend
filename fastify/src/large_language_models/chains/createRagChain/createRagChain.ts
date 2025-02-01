import { ICreateChainPayload } from "@/entities/chat";
import { extractFromMessages } from "@/large_language_models/lib/utils";
import { createConversationChain } from "..";
import { getPineconeStore } from "@/large_language_models/vectorStore";
import { getOpenAIModel } from "@/large_language_models/llm";
import {
    ChatPromptTemplate,
    HumanMessagePromptTemplate,
    SystemMessagePromptTemplate
} from "@langchain/core/prompts";
import {
    RunnablePassthrough,
    RunnableSequence
} from "@langchain/core/runnables";
import { formatDocumentsAsString } from "langchain/util/document";
import { StringOutputParser } from "@langchain/core/output_parsers";

export const createRagChain = async (payload: ICreateChainPayload) => {
    const { previousMessages, currentInput } = extractFromMessages(payload.messages)

    const llm = getOpenAIModel(payload.model)

    const vectorStore = await getPineconeStore()

    const contextualizeQChain = await createConversationChain({
        messages: previousMessages,
        model: payload.model,
        prompt: `Given a chat history and the latest user question
        which might reference context in the chat history, formulate a standalone question
        which can be understood without the chat history. Do NOT answer the question,
        just reformulate it if needed and otherwise return it as is.`
    })

    const ragPrompt = ChatPromptTemplate.fromMessages([
        SystemMessagePromptTemplate.fromTemplate(`You are an assistant for question-answering tasks.
        Only use the following pieces of retrieved context to answer the question.
        If you don't know the answer, just say that you don't know.
        Context: {context}
        Additional prompt: ${payload.prompt}
        Answer: `),
        HumanMessagePromptTemplate.fromTemplate("{input}")
    ])

    const ragChain = RunnableSequence.from([
        RunnablePassthrough.assign({
            context: async () => {
                const retriever = vectorStore.asRetriever({ searchType: 'mmr' })

                if (previousMessages.length > 0) {
                    return contextualizeQChain
                        .pipe(retriever)
                        .pipe(formatDocumentsAsString)
                } else {
                    const relevantDocs = await retriever.invoke(currentInput)
                    const formattedDocs = formatDocumentsAsString(relevantDocs)
                    return formattedDocs
                }
            }
        }),
        ragPrompt,
        llm,
        new StringOutputParser()
    ])

    return ragChain

}