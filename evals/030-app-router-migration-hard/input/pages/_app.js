import { AppProvider } from '../components/AppProvider';
import '../styles/globals.css';

export default function MyApp({ Component, pageProps }) {
  return (
    <AppProvider>
      <div className="app-container">
        <header>
          <h1>My Blog</h1>
          <nav>
            <a href="/">Home</a>
            <a href="/blog">Blog</a>
          </nav>
        </header>
        <main>
          <Component {...pageProps} />
        </main>
        <footer>
          <p>&copy; 2024 My Blog</p>
        </footer>
      </div>
    </AppProvider>
  );
}