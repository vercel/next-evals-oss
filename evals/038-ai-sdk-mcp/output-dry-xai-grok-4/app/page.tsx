'use client';

import { useCompletion } from '@ai-sdk/react';

export default function Page() {
  const { completion, complete } = useCompletion({
    api: '/api/completion',
  });

  return (
    <div>
      <div
        onClick={async () => {
          await complete(
            'Please schedule a call with Sonny and Robby for tomorrow at 10am ET for me!',
          );
        }}
      >
        Schedule a call
      </div>

      {completion}
    </div>
  );
}