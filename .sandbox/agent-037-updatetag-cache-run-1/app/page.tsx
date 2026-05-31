import { unstable_cache } from 'next/cache'
import { getPosts } from './lib/posts'
import { createPost } from './actions'

const getCachedPosts = unstable_cache(
  async () => getPosts(),
  ['posts-list'],
  { tags: ['posts'] }
)

export default async function Home() {
  const posts = await getCachedPosts()

  return (
    <main>
      <h1>Posts</h1>

      <ul>
        {posts.map((post) => (
          <li key={post.id}>
            <h2>{post.title}</h2>
            <p>{post.content}</p>
          </li>
        ))}
      </ul>

      <h2>Create a new post</h2>
      <form action={createPost}>
        <div>
          <label htmlFor="title">Title</label>
          <input id="title" name="title" type="text" required />
        </div>
        <div>
          <label htmlFor="content">Content</label>
          <textarea id="content" name="content" required />
        </div>
        <button type="submit">Create Post</button>
      </form>
    </main>
  )
}
