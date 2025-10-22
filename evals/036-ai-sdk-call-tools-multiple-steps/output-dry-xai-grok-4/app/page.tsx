'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useState } from 'react';
import type { ChatMessage } from './api/chat/route';

export default function Page() {
  const [input, setInput] = useState('');

  const { messages, sendMessage } = useChat<ChatMessage>({
    transport: new DefaultChatTransport({
      api: '/api/chat',
    }),
  });

  return (
    <div>
      <input
        className="border"
        value={input}
        onChange={event => {
          setInput(event.target.value);
        }}
        onKeyDown={async event => {
          if (event.key === 'Enter') {
            sendMessage({
              text: input,
            });
            setInput('');
          }
        }}
      />

      {messages.map((message, index) => (
        <div key={index}>
          {message.parts.map(part => {
            switch (part.type) {
              case 'text':
                return <div key={`${message.id}-text`}>{part.text}</div>;
              case 'tool-getWeather':
                return (
                  <div key={`${message.id}-weather`}>
                    {JSON.stringify(part, null, 2)}
                  </div>
                );
            }
          })}
        </div>
      ))}
    </div>
  );
}