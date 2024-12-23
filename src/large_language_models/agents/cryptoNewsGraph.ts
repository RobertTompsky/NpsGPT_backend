import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { Annotation, START, StateGraph } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { v4 as uuidv4 } from "uuid";
import { cryptoTool, tavilyTool } from "./tools";

export interface ITokenDetails {
    name: string
    ticker: string
    quantity: number
}

export interface IWebSearchToolArgs {
    queries: string[],
    token?: ITokenDetails
}

const cryptoNewsGraphState = Annotation.Root({
    initialQuery: Annotation<string>,
    retrievedNews: Annotation<string[]>,
    toolCallArgs: Annotation<IWebSearchToolArgs>,
    aiResponseMessage: Annotation<AIMessage>
})

export type ICryptoNewsGraphState = typeof cryptoNewsGraphState.State

const llm = new ChatOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4o-mini',
    temperature: 1
})

const retrieveNews = async (state: ICryptoNewsGraphState):
    Promise<Partial<ICryptoNewsGraphState>> => {
    const {
        toolCallArgs: {
            queries
        }
    } = state

    const formattedDate = new Date().toLocaleDateString('ru-RU')

    const formattedQueries = queries.map(query => `${query} ${formattedDate}`)

    const results: string[] = await Promise.all(
        formattedQueries.map(query => tavilyTool.invoke({
            input: query
        }))
    )

    return {
        retrievedNews: results
    }
}

const hasToken = (state: ICryptoNewsGraphState):
    'summarize_token_news' | 'summarize_crypto_news' => {

    const {
        toolCallArgs: {
            token
        }
    } = state

    if (token) {
        return 'summarize_token_news'
    }

    return 'summarize_crypto_news'
}

const summarizeTokenNews = async (state: ICryptoNewsGraphState):
    Promise<Partial<ICryptoNewsGraphState>> => {
    const {
        initialQuery,
        toolCallArgs: {
            token
        },
        retrievedNews
    } = state

    const receivedMarketInfo: string = await cryptoTool.invoke({
        ticker: token.ticker,
        name: token.name,
        quantity: 1
    })

    const answer = await llm.invoke([
        new SystemMessage({
            id: uuidv4(),
            content: `News sources:
                ${retrievedNews.join('\n')}

                Token info:
                ${receivedMarketInfo}

                Your task:
                1. Summarize the most relevant news articles for the token.
                2. Do **not** include any links to the original articles. Only provide a concise summary of the news.
                3. Provide a brief analysis of the token's market info based on provided indicators.`
        }),
        new HumanMessage({
            id: uuidv4(),
            content: initialQuery
        })
    ])

    return {
        aiResponseMessage: answer
    }
}

const summarizeCryptoNews = async (state: ICryptoNewsGraphState):
    Promise<Partial<ICryptoNewsGraphState>> => {

    const { initialQuery, retrievedNews } = state

    const fagIndexUrl = 'https://api.alternative.me/fng/'

    const { data: [{ value: fagIndexValue, value_classification }] }: {
        data: [
            {
                value: string,
                value_classification: string
            }
        ]
    } = await fetch(fagIndexUrl).then(data => data.json())

    const answer = await llm.invoke([
        new SystemMessage({
            id: uuidv4(),
            content: `News sources:
                ${retrievedNews.join('\n')}

                Crypto Fear and Greed Index info:
                - Index value - ${fagIndexValue}
                - Value classification - ${value_classification}

                Your task:
                1. Summarize the most relevant news articles about crypto based on the provided sources. 
                2. Do **not** include any links to the original articles. Only provide a concise summary of the news.
                3. Return the Fear and Greed Index info to the user, including both the value and classification.`
        }),
        new HumanMessage({
            id: uuidv4(),
            content: initialQuery
        })
    ])

    return {
        aiResponseMessage: answer
    }
}

export const cryptoNewsGraph = new StateGraph(cryptoNewsGraphState)
    .addNode('retrieve_news', retrieveNews)
    .addNode('summarize_token_news', summarizeTokenNews)
    .addNode('summarize_crypto_news', summarizeCryptoNews)
    .addEdge(START, 'retrieve_news')
    .addConditionalEdges('retrieve_news', hasToken, [
        'summarize_token_news',
        'summarize_crypto_news'
    ])
    .compile()