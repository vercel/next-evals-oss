import Dashboard from './Dashboard';

// Good example: parallel data fetching
async function getParallelData() {
  const [users, posts, stats] = await Promise.all([
    fetch('https://api.example.com/users').then(r => r.json()),
    fetch('https://api.example.com/posts').then(r => r.json()),
    fetch('https://api.example.com/stats').then(r => r.json())
  ]);
  
  return { users, posts, stats };
}

export default async function Page() {
  const { users, posts, stats } = await getParallelData();
  
  return (
    <div>
      <h1>Dashboard</h1>
      <p>Users: {users.length}</p>
      <p>Posts: {posts.length}</p>
      <p>Total views: {stats.views}</p>
      
      <Dashboard />
    </div>
  );
}
