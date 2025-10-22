'use client';

import type { ModelMessage } from 'ai';
import { useState } from 'react';

export default function Page() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ModelMessage[]>([]);

  return (
    <div>
      <input
        value={input}
        onChange={event => {
          setInput(event.target.value);
        }}
        onKeyDown={async event => {
          if (event.key === 'Enter') {
            setMessages(currentMessages => [
              ...currentMessages,
              { role: 'user', content: input },
            ]);

            const response = await fetch('/api/chat', {
              method: 'POST',
              body: JSON.stringify({
                messages: [...messages, { role: 'user', content: input }],
              }),
            });

            const { messages: newMessages } = await response.json();

            setMessages(currentMessages => [
              ...currentMessages,
              ...newMessages,
            ]);
          }
        }}
      />

      {messages.map((message, index) => (
        <div key={`${message.role}-${index}`}>
          {typeof message.content === 'string'
            ? message.content
            : message.content
                .filter(part => part.type === 'text')
                .map((part, partIndex) => (
                  <div key={partIndex}>{part.text}</div>
                ))}
        </div>
      ))}
    </div>
  );
}