import type { ChatMessage } from '../types';

export function ChatThread({
  messages,
  emptyMessage,
}: {
  messages: ChatMessage[];
  emptyMessage: string;
}) {
  if (!messages.length) {
    return <div className="panel"><p className="muted">{emptyMessage}</p></div>;
  }

  return (
    <div className="chat-thread">
      {messages.map((message, index) => (
        <article
          className={`chat-bubble ${message.role === 'assistant' ? 'chat-assistant' : 'chat-user'}`}
          key={`${message.role}-${message.createdAt}-${index}`}
        >
          <p>{message.text}</p>
          <time>{new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
        </article>
      ))}
    </div>
  );
}
