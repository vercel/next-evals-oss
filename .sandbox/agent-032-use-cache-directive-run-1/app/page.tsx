import { unstable_cache } from 'next/cache'
import { getPosts } from '@/lib/api'

const getCachedPosts = unstable_cache(
  async () => getPosts(),
  ['posts'],
  {
    revalidate: 3600,
    tags: ['posts'],
  }
)

export default async function Home() {
  const posts = await getCachedPosts()

  return (
    <main>
      <h1>Blog Posts</h1>
      <ul>
        {posts.map((post) => (
          <li key={post.id}>
            <h2>{post.title}</h2>
            <p>By {post.author}</p>
          </li>
        ))}
      </ul>
    </main>
  )
}
