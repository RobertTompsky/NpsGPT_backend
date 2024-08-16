export const STREAM_HEADERS: { key: string, value: string }[] = [
    { key: 'Content-Type', value: 'text/event-stream' },
    { key: 'Cache-Control', value: 'no-cache' },
    { key: 'Connection', value: 'keep-alive' },
    { key: 'Access-Control-Allow-Origin', value: '*' }, // Добавляем заголовок для CORS
];