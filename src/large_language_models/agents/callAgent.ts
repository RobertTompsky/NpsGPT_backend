import { AIMessage, BaseMessage, HumanMessage, RemoveMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import { Annotation, END, messagesStateReducer, START, StateGraph } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { v4 as uuidv4 } from "uuid";
import { SqliteSaver } from "@langchain/langgraph-checkpoint-sqlite";
import { z } from "zod";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { IterableReadableStream } from "@langchain/core/utils/stream";
import { cryptoTool, webSearchTool } from "./tools";
import { cryptoNewsGraph, ICryptoNewsGraphState, IWebSearchToolArgs } from "./cryptoNewsGraph";

export const callAgent = async () => {
    const AgentState = Annotation.Root({
        messages: Annotation<BaseMessage[]>({
            reducer: messagesStateReducer,
            default: (): BaseMessage[] => []
        }),
        summary: Annotation<string[]>({
            reducer: (current?, update?) => update ?? current ?? [],
            default: (): string[] => [],
        })
    })

    type IState = typeof AgentState.State

    const llm = new ChatOpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        model: 'gpt-4o-mini',
        temperature: 1
    })

    const tools = [cryptoTool]

    const toolNode = new ToolNode(tools)

    const callModel = async (state: IState): Promise<Partial<IState>> => {
        const { summary } = state
        let { messages } = state

        if (summary.length > 0) {
            const systemMessage = new SystemMessage({
                id: uuidv4(),
                content: `Summary of conversation earlier:\n\n` +
                    `${summary.join("\n")}`
            })
            messages = [systemMessage, ...messages]
        }

        const llmWithTools = llm.bindTools([cryptoTool, webSearchTool])
        const response = await llmWithTools.invoke(messages)

        const update = {
            messages: [response]
        }

        return update
    }

    const summarizeConversation = async (state: IState): Promise<Partial<IState>> => {
        const { summary } = state;
        let { messages } = state
        let summaryMessage: string;

        if (summary.length > 0) {
            messages = messages.slice(1)
            summaryMessage = `This is summary of the conversation to date:\n\n` +
                `${summary.join('\n')}\n\n` +
                "Extend the summary by taking into account the new messages above. \n" +
                "Return only the summary of the new provided messages, without repeating the old summary."
        } else {
            summaryMessage = "Create a summary of the conversation above:";
        }

        const allMessages = [...messages, new HumanMessage({
            id: uuidv4(),
            content: summaryMessage
        })]

        const outputSchema = z.object({
            points: z
                .array(z.string())
                .describe(
                    "Key points of each interaction, where each point summarizes a single message, either " +
                    "from the user or the LLM, in a concise form and in sequential order.\n" +
                    "Each element should represent the essence of one message (user's or LLM's), not the full interaction.\n\n" +
                    "Example format:\n" +
                    "User says [sample text] (replace with actual user message).\n" +
                    "LLM responds [sample text] (replace with actual LLM response).\n" +
                    "User asks for the price of Ethereum (ETH).\n" +
                    "LLM states that the price is 3598.04 USD."
                )
        })

        const { points } = await llm.withStructuredOutput(outputSchema).invoke(allMessages)

        if (!Array.isArray(points)) {
            throw new Error("Expected an array response from the model");
        }

        const interactions = points.reduce((acc: string[], point, index) => {
            if (index % 2 === 0 && points[index + 1]) {
                acc.push(`${point} ${points[index + 1]}`);
            }
            return acc;
        }, []);

        let updatedSummary = [...summary, ...interactions]

        updatedSummary = updatedSummary.length > 5
            ? updatedSummary.slice(-3)
            : updatedSummary

        const deleteMessages = messages
            .slice(0, -1)
            .map(m => new RemoveMessage({ id: m.id }))

        return {
            summary: updatedSummary,
            messages: deleteMessages
        }
    }

    const isAiMessageWithToolCalls = (message: BaseMessage): message is AIMessage => {
        const messageType = message.getType()

        const hasToolCalls = 'tool_calls' in message &&
            Array.isArray(message.tool_calls) &&
            message.tool_calls.length > 0

        return (
            messageType === 'ai' &&
            hasToolCalls
        )
    }

    const shouldContinue = (state: IState):
        'summarize_conversation' | ("tools" | 'crypto_news_node')[] | typeof END => {
        const messages = state.messages
        const lastMessage = messages[messages.length - 1]

        if (messages.length > 4 && !isAiMessageWithToolCalls(lastMessage)) {
            return 'summarize_conversation'
        }

        if (isAiMessageWithToolCalls(lastMessage)) {
            const { tool_calls } = lastMessage

            const toolCallResult = tool_calls.map((tc) => {
                if (tc.name === 'web_search_crypto') {
                    return 'crypto_news_node'
                } else {
                    return 'tools'
                }
            })

            return toolCallResult
        }

        return END
    }

    const cryptoNewsNode = async (state: IState): Promise<Partial<IState>> => {
        const { messages } = state

        const userMessages = messages.filter(m => m.getType() === 'human') as HumanMessage[]
        const lastUserQuery = userMessages[userMessages.length - 1].content as string

        const lastMessage = messages[messages.length - 1]

        if (isAiMessageWithToolCalls(lastMessage)) {
            const webSearchTool = lastMessage.tool_calls.find((tc) => tc.name === 'web_search_crypto')

            const { queries, token } = webSearchTool.args as IWebSearchToolArgs

            const { aiResponseMessage }: ICryptoNewsGraphState = await cryptoNewsGraph.invoke({
                initialQuery: lastUserQuery,
                toolCallArgs: {
                    queries,
                    token
                }
            })

            return {
                messages: [
                    new ToolMessage({
                        id: uuidv4(),
                        content: `News retrieved. Queries used: ${queries.join(', ')}`,
                        tool_call_id: webSearchTool.id
                    }),
                    aiResponseMessage
                ]
            }

        } else {
            throw new Error('Exprected AIMessage')
        }
    }

    const workflow = new StateGraph(AgentState)
        .addNode('model', callModel)
        .addNode('summarize_conversation', summarizeConversation)
        .addNode('crypto_news_node', cryptoNewsNode)
        .addNode('tools', toolNode)
        .addEdge(START, 'model')
        .addConditionalEdges('model', shouldContinue, [
            'summarize_conversation',
            'crypto_news_node',
            'tools',
            END
        ])
        .addEdge('tools', 'model')

    const memory = SqliteSaver.fromConnString('checkpoints.db')

    const app = workflow.compile({
        checkpointer: memory
    })

    const config = {
        configurable: {
            thread_id: '3m3gmbbsgn'
        },
        streamMode: 'updates' as const,
        subgraphs: true
    }

    const printUpdate = (update: Record<string, any>) => {
        Object.keys(update).forEach((key) => {
            const value = update[key] as IState

            console.log(value)

            // if ('messages' in value && Array.isArray(value.messages)) {
            //     value.messages.forEach((msg) => {
            //         console.log(`\n [${msg.getType().toUpperCase()}]: ${msg.content}`)
            //     })
            // }

            // if ('summary' in value && value.summary) {
            //     console.log(`\n [SUMMARY]: ${value.summary}`)
            // }
        })
    }

    const result: IterableReadableStream<IState> = await app.stream(
        {
            messages: [
                new HumanMessage({
                    id: uuidv4(),
                    content: 'Да не, норм, ты только это, предупреждай брат '
                })
            ]
        },
        config
    )

    for await (const event of result) {
        printUpdate(event)
    }

}