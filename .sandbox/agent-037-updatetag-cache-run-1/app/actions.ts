'use server'

import { revalidateTag } from 'next/cache'
import { addPost } from './lib/posts'

export async function createPost(formData: FormData) {
  const title = formData.get('title')
  const content = formData.get('content')

  if (typeof title !== 'string' || typeof content !== 'string') {
    throw new Error('Invalid form data')
  }

  await addPost({ title, content })

  revalidateTag('posts', 'default')
}
