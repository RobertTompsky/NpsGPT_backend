import { CheerioWebBaseLoader } from "@langchain/community/document_loaders/web/cheerio";

export const createDocsFromWeb = async (url: string) => {
    const loader = new CheerioWebBaseLoader(url)

    const docs = await loader.load()

    return docs
}