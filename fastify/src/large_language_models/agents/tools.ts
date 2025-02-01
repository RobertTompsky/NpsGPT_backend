import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import { StructuredToolParams, tool } from "@langchain/core/tools";
import z from "zod";
import 'dotenv/config'

export const tokenSchema = z.object({
    ticker: z
        .string()
        .describe(
            "The official ticker symbol of the cryptocurrency, a short, uppercase code used" +
            "on exchanges and in APIs (e.g., 'BTC' for Bitcoin, 'ETH' for Ethereum, 'SOL' for Solana)."
        ),
    name: z
        .string()
        .describe(
            "The official name of the cryptocurrency used on exchanges and in APIs" +
            "(e.g., 'bitcoin', 'ethereum', 'dogecoin')."
        ),
    quantity: z
        .number()
        .positive()
        .describe(
            'The amount of cryptocurrency. Defaults to 1 if not specified'
        ),
})

export const webSearchTool: StructuredToolParams = {
    name: 'web_search_crypto',
    description: "This tool searches for the latest cryptocurrency news. " +
        "It can be used to query general cryptocurrency news or to retrieve news related to a specific cryptocurrency token." +
        "**DO NOT USE IT** when you are asked about token price or market metrics, such as: " +
        "- price, volume, market capitalization, percent changes (24h, 7d, 30d, 1y), all-time high (ATH) price, or any other financial data. " +
        "These metrics should be queried using a different tool designed for that purpose.",
    schema: z.object({
        queries: z
            .array(z.string())
            .length(2)
            .describe(
                `Variations of the initial user's query to enhance search relevance and effectiveness.`
            ),
        token: tokenSchema
            .optional()
            .describe(
                `An optional object with details about a specific cryptocurrency, such as its ticker symbol, name, and quantity.` +
                `It is included only if the user's query refers to a specific cryptocurrency.`
            )
    })
}

export const cryptoTool = tool(async ({ ticker, name, quantity }) => {
    try {
        const id = `${ticker.toLowerCase()}-${name.toLowerCase()}`;
        const url = `https://api.coinpaprika.com/v1/tickers/${id}`

        interface IApiResponse {
            rank: number;
            total_supply: number;
            beta_value: number;
            quotes: {
                USD: {
                    price: number;
                    volume_24h: number;
                    volume_24h_change_24h: number;
                    market_cap: number;
                    percent_change_24h: number;
                    percent_change_7d: number;
                    percent_change_30d: number;
                    percent_change_1y: number;
                    ath_price: number;
                    ath_date: string;
                    percent_from_price_ath: number;
                };
            }
        }

        const {
            rank,
            total_supply,
            beta_value,
            quotes: {
                USD: {
                    price,
                    volume_24h,
                    market_cap,
                    percent_change_24h,
                    percent_change_7d,
                    percent_change_30d,
                    percent_change_1y,
                    ath_price,
                    ath_date,
                    percent_from_price_ath
                }
            }
        }: IApiResponse = await fetch(url).then(data => data.json())

        const totalPrice = quantity !== 1 ? price * quantity : price;

        const formatCurrency = (value: number) => `$${value.toFixed(2)}`;
        const formatPercent = (value: number) => `${value.toFixed(2)}%`;

        const priceText = quantity === 1
            ? `Current price: ${formatCurrency(price)}`
            : `Total price for ${quantity} ${ticker}: ${formatCurrency(totalPrice)}`;

        const statsText = [
            `Rank: ${rank}`,
            `Market Cap: ${formatCurrency(market_cap)}`,
            `24h Volume: ${formatCurrency(volume_24h)}`,
            `Price change in the last 24h: ${formatPercent(percent_change_24h)}`,
            `Price change in the last 7d: ${formatPercent(percent_change_7d)}`,
            `Price change in the last 30d: ${formatPercent(percent_change_30d)}`,
            `Price change in the last 1y: ${formatPercent(percent_change_1y)}`,
            `All-Time High: ${formatCurrency(ath_price)} on ${new Date(ath_date).toLocaleDateString()}`,
            `Currently ${formatPercent(percent_from_price_ath)} from ATH`,
            `Total Supply: ${total_supply.toLocaleString()}`,
            `Beta value: ${beta_value.toFixed(2)}`
        ];

        return `
            ${name.toUpperCase()} (${ticker})
            ${priceText}
            ${statsText.join('\n')}
        `.trim();

    } catch {
        return `Can't find price`
    }
}, {
    name: "cryptocurrency_market_metrics",
    description:
        "Call to get the current price and market metrics of a specific cryptocurrency. " +
        "Use this tool when you need financial information about a cryptocurrency, such as its current price, " +
        "24h trading volume, market capitalization, percentage changes (24h, 7d, 30d, 1y), all-time high price, and more. " +
        "**DO NOT USE** this tool for retrieving current news related to the token. ",
    schema: tokenSchema
})

export const tavilyTool = new TavilySearchResults({
    apiKey: process.env.TAVILY_API_KEY,
    maxResults: 1
})
