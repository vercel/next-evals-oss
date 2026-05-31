export type Post = {
  id: string
  title: string
  content: string
  createdAt: string
}

let posts: Post[] = [
  {
    id: '1',
    title: 'Hello World',
    content: 'This is the first post.',
    createdAt: new Date().toISOString(),
  },
]

export async function getPosts(): Promise<Post[]> {
  return posts
}

export async function addPost(post: Omit<Post, 'id' | 'createdAt'>): Promise<Post> {
  const newPost: Post = {
    id: crypto.randomUUID(),
    ...post,
    createdAt: new Date().toISOString(),
  }
  posts = [...posts, newPost]
  return newPost
}
