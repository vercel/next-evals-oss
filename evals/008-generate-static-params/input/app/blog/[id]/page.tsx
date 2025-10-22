// TODO: Implement generateStaticParams function
// Should export function generateStaticParams that returns [{ id: '1' }]
// Should NOT include getStaticPaths or 'use client'

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
