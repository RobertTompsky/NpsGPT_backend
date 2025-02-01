import { IMessage } from "@/entities/chat"
import { BaseMessage, HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages"

export const createBaseMessagesFromChat = (messages: IMessage[]): BaseMessage[] => {
    return messages.map((message) => {
        switch (message.role) {
            case 'human':
                return new HumanMessage(message.content)
            case "ai":
                return new AIMessage(message.content)
            case "system":
                return new SystemMessage(message.content)
            default:
                throw new Error('Role must be defined for generic messages')
        }
    })
}