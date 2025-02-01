export interface IMessage {
    role: 'human' | 'ai' | 'system'
    content: string
}

export interface IChatRequestPayload {
    type: 'chatbot' | 'qa'
    messages: IMessage[]
    prompt: string
    model: string
    chatId: string
}

export type ICreateChainPayload = Omit<IChatRequestPayload, 'type' | 'chatId'>
