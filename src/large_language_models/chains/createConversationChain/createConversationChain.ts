import { ChatOpenAI } from "@langchain/openai";
import {
    ChatPromptTemplate,
    MessagesPlaceholder,
    SystemMessagePromptTemplate,
    HumanMessagePromptTemplate
} from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { 
    RunnableSequence, 
    RunnablePassthrough, 
    RunnableWithMessageHistory 
} from "@langchain/core/runnables";
import { ChatMessageHistory } from "langchain/memory";
import { IChatRequestPayload } from "@/entities/chat";
import { createBaseMessagesFromChat } from "@/large_language_models/lib/utils";
import 'dotenv/config'

export const createConversationChain = async (payload: Omit<IChatRequestPayload, 'chatId'>) => {

    const historyBaseMessages = createBaseMessagesFromChat(payload.messages)

    const prompt = ChatPromptTemplate.fromMessages([
        SystemMessagePromptTemplate.fromTemplate(payload.prompt),
        new MessagesPlaceholder('chat_history'),
        HumanMessagePromptTemplate.fromTemplate("{input}")
    ])

    const llm = new ChatOpenAI({
        apiKey: process.env.API_KEY,
        model: payload.model,
        temperature: 1,
        streaming: true
    })

    const chain = RunnableSequence.from([
        RunnablePassthrough.assign({
            input: (input: { input: string }) => input.input
        }),
        prompt,
        llm,
        new StringOutputParser()
    ])

    const chainWithHistory = new RunnableWithMessageHistory({
        runnable: chain,
        getMessageHistory: (_sessionId: string) => new ChatMessageHistory(historyBaseMessages),
        inputMessagesKey: 'input',
        historyMessagesKey: 'chat_history'
    })

    return chainWithHistory
}
