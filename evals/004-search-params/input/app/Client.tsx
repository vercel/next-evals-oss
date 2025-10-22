'use client';

export default function Client({ name }: { name: string }) {
  return <div data-testid="client">Client component with name: {name}</div>;
}