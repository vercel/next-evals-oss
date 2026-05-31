import Link from 'next/link'

interface Post {
  userId: number
  id: number
  title: string
  body: string
}

async function getPosts(): Promise<Post[]> {
  const posts: Post[] = await fetch(
    'https://jsonplaceholder.typicode.com/posts',
    { next: { revalidate: 60 } }
  ).then((res) => res.json())

  return posts
}

export default async function BlogIndexPage() {
  const posts = await getPosts()

  return (
    <div>
      <h1>All Blog Posts</h1>

      <div className="posts-grid">
        {posts.map((post) => (
          <div key={post.id} className="post-card">
            <h2>
              <Link href={`/blog/${post.id}`}>{post.title}</Link>
            </h2>
            <p>{post.body.substring(0, 100)}...</p>
            <Link href={`/blog/${post.id}`}>
              <button>Read More</button>
            </Link>
          </div>
        ))}
      </div>
    </div>
  )
}
