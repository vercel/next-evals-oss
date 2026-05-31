import Link from 'next/link'
import { headers } from 'next/headers'

interface Post {
  userId: number
  id: number
  title: string
  body: string
}

interface HomePageProps {
  posts: Post[]
  userAgent: string
  timestamp: string
}

async function getData(): Promise<HomePageProps> {
  const headersList = await headers()
  const userAgent = headersList.get('user-agent') || ''
  const posts: Post[] = await fetch(
    'https://jsonplaceholder.typicode.com/posts?_limit=5',
    { cache: 'no-store' }
  ).then((res) => res.json())

  return {
    posts,
    userAgent,
    timestamp: new Date().toISOString(),
  }
}

export default async function HomePage() {
  const { posts, userAgent, timestamp } = await getData()

  return (
    <div>
      <h1>Welcome to My Blog</h1>
      <p>Server-side rendered at: {timestamp}</p>
      <p>Your user agent: {userAgent}</p>

      <h2>Recent Posts</h2>
      <ul>
        {posts.map((post) => (
          <li key={post.id}>
            <Link href={`/blog/${post.id}`}>{post.title}</Link>
          </li>
        ))}
      </ul>

      <Link href="/blog">
        <button>View All Posts</button>
      </Link>
    </div>
  )
}
