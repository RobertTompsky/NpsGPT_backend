import { BaseMessage, HumanMessage, RemoveMessage, SystemMessage } from "@langchain/core/messages";
import { Annotation, END, Messages, messagesStateReducer, START, StateGraph } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { v4 as uuidv4 } from "uuid";
import { SqliteSaver } from "@langchain/langgraph-checkpoint-sqlite";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { IterableReadableStream } from "@langchain/core/utils/stream";

export const callAgent = async () => {
    const AgentState = Annotation.Root({
        messages: Annotation<BaseMessage[], Messages>({
            reducer: messagesStateReducer,
            default: (): BaseMessage[] => []
        }),
        summary: Annotation<string>({
            reducer: (_current, update) => update,
            default: () => ''
        })
    })

    type IState = typeof AgentState.State

    const llm = new ChatOpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        model: 'gpt-4o-mini',
        temperature: 1
    })

    const cryptoTool = tool(async ({ ticker }) => {
        try {
            const url = `https://api.coinbase.com/v2/prices/${ticker}-USD/buy`;
            const response = await fetch(url)

            interface ApiResponse {
                data: {
                    amount: string
                    currency: string
                }
            }

            const {
                data: {
                    amount,
                    currency
                }
            }: ApiResponse = await response.json()

            return `${crypto}'s price is ${amount} ${currency}`
        } catch {
            return `Can't find price`
        }
    }, {
        name: 'cryptocurrency',
        description: "Call to get the current price of a cryptocurrency.",
        schema: z.object({
            ticker: z
                .string()
                .describe("The official ticker symbol of the cryptocurrency, a short, uppercase code " + 
                "used on exchanges and in APIs (e.g., 'BTC' for Bitcoin, 'ETH' for Ethereum, 'SOL' for Solana).")
        })
    })

    const tools = [cryptoTool]

    const toolNode = new ToolNode(tools)

    const callModel = async (state: IState): Promise<Partial<IState>> => {
        const { summary } = state
        let { messages } = state

        if (summary) {
            const systemMessage = new SystemMessage({
                id: uuidv4(),
                content: `Summary of conversation earlier: ${summary}`
            })
            messages = [systemMessage, ...messages]
        }

        const llmWithTools = llm.bindTools(tools)
        const response = await llmWithTools.invoke(messages)

        const update = {
            messages: [response]
        }

        return update
    }

    const summarizeConversation = async (state: IState): Promise<Partial<IState>> => {
        const { summary, messages } = state;
        let summaryMessage: string;

        if (summary) {
            summaryMessage = `This is summary of the conversation to date: ${summary}\n\n` +
                "Extend the summary by taking into account the new messages above:";
        } else {
            summaryMessage = "Create a summary of the conversation above:";
        }

        const allMessages = [...messages, new HumanMessage({
            id: uuidv4(),
            content: summaryMessage
        })]
        const response = await llm.invoke(allMessages)

        const deleteMessages = messages
            .slice(0, -1)
            .map(m => new RemoveMessage({ id: m.id }))

        if (typeof response.content !== "string") {
            throw new Error("Expected a string response from the model");
        }

        return {
            summary: response.content,
            messages: deleteMessages
        }
    }

    const shouldContinue = (state: IState):
        'summarize_conversation' | 'tools' | typeof END => {
        const messages = state.messages
        const lastMessage = messages[messages.length - 1]
        const hasToolCalls = 'tool_calls' in lastMessage &&
            Array.isArray(lastMessage.tool_calls) &&
            lastMessage.tool_calls?.length > 0

        if (messages.length > 4 && !hasToolCalls) {
            return 'summarize_conversation'
        }

        if (hasToolCalls) {
            return 'tools'
        }

        return END
    }

    const workflow = new StateGraph(AgentState)
        .addNode('model', callModel)
        .addNode('summarize_conversation', summarizeConversation)
        .addNode('tools', toolNode)
        .addEdge(START, 'model')
        .addConditionalEdges('model', shouldContinue, [
            'summarize_conversation',
            'tools',
            END
        ])
        .addEdge('tools', 'model')
        .addEdge('summarize_conversation', END)

    const memory = SqliteSaver.fromConnString('checkpoints.db')

    const app = workflow.compile({
        checkpointer: memory
    })

    const config = {
        configurable: {
            thread_id: '322'
        },
        streamMode: 'updates' as const
    }

    const printUpdate = (update: Record<string, any>) => {
        Object.keys(update).forEach((key) => {
            const value = update[key]

            if ('messages' in value && Array.isArray(value.messages)) {
                (value.messages as Array<BaseMessage>).forEach((msg) => {
                    console.log(`\n [${msg.getType().toUpperCase()}]: ${msg.content}`)
                })
            }

            if ('summary' in value && value.summary) {
                console.log(`\n [SUMMARY]: ${value.summary}`)
            }
        })
    }

    const result: IterableReadableStream<IState> = await app.stream(
        {
            messages: [
                new HumanMessage({
                    id: uuidv4(),
                    content: 'Как-то так'
                })
            ]
        },
        config
    )

    for await (const event of result) {
        printUpdate(event)
    }

}