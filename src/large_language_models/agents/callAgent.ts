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

    const cryptoTool = tool(async ({ query }) => {
        const systemMessage = new SystemMessage({
            id: uuidv4(),
            content: `Extract the name of the cryptocurrency mentioned in the following message 
            and return its corresponding ticker symbol (e.g., 'Bitcoin' or any other related names 
            of Bitcoin should be converted to 'BTC'). If a cryptocurrency's ticker symbol is already 
            provided in the message (e.g., "BTC", "ETH", "SOL"), just extract and return it as is.`
        })

        const humanMessage = new HumanMessage({
            id: uuidv4(),
            content: query
        })

        const llmWithParser = llm.pipe(new StringOutputParser())

        try {
            const crypto = await llmWithParser.invoke([systemMessage, humanMessage])

            const url = `https://api.coinbase.com/v2/prices/${crypto}-USD/buy`;
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
            query: z.string().describe("The query to use in your search.")
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

        if (messages.length > 4) {
            return 'summarize_conversation'
        } else if (
            'tool_calls' in lastMessage &&
            Array.isArray(lastMessage.tool_calls) &&
            lastMessage.tool_calls?.length
        ) {
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