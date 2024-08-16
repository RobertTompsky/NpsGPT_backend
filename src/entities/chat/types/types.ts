export interface IMessage {
    role: 'human' | 'ai' | 'system'
    content: string
}

export interface IChatRequestPayload {
    messages: IMessage[]
    chatId: string
}