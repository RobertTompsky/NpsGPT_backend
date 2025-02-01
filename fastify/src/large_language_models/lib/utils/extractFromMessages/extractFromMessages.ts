import { IMessage } from "@/entities/chat"

export const extractFromMessages = (messages: IMessage[]) => {
    const currentInput = messages.length > 0 ?
        messages[messages.length - 1].content : ''

    const previousMessages = messages.slice(0, messages.length - 1)

    return {
        currentInput,
        previousMessages
    }
}