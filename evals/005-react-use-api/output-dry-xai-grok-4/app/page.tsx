import ClientComponent from './ClientComponent';

async function getData() {
  return { test: 'data', message: 'Hello from promise' };
}

export default function Page() {
  const data = getData(); // promise
  return <ClientComponent data={data} />;
}
