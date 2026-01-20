export default async function BlogPost({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div>
      <h1>Blog Post {id}</h1>
    </div>
  );
}
