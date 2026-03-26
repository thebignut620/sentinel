import { useState, useEffect } from 'react';
import api from '../api/client.js';

const CATEGORIES = ['all', 'hardware', 'software', 'network', 'access', 'account'];
const CAT_ICONS = { hardware: '🖥️', software: '💻', network: '🌐', access: '🔑', account: '👤', all: '📚' };

function ArticleCard({ article, onClick }) {
  return (
    <button onClick={() => onClick(article)} className="w-full text-left bg-white/5 hover:bg-white/10 border border-white/10 hover:border-green-700/50 rounded-xl p-5 transition-all group">
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-white font-semibold group-hover:text-green-400 transition-colors leading-snug">{article.title}</h3>
        <span className="shrink-0 text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full capitalize">{article.category}</span>
      </div>
      <p className="text-gray-400 text-sm line-clamp-2 leading-relaxed">{article.problem}</p>
      <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
        <span>{article.views || 0} views</span>
        <span>{new Date(article.created_at).toLocaleDateString()}</span>
      </div>
    </button>
  );
}

function ArticleDetail({ article, onBack }) {
  return (
    <div className="max-w-3xl mx-auto">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-400 mb-6">
        <button onClick={onBack} className="hover:text-white transition-colors">Help Center</button>
        <span>›</span>
        <span className="capitalize text-gray-300">{article.category}</span>
        <span>›</span>
        <span className="text-white truncate">{article.title}</span>
      </nav>

      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-8">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full capitalize">{article.category}</span>
          <span className="text-gray-500 text-xs">·</span>
          <span className="text-gray-500 text-xs">{article.views || 0} views</span>
        </div>

        <h1 className="text-2xl font-bold text-white mb-4 leading-tight">{article.title}</h1>

        <div className="border-t border-gray-700 pt-6 space-y-6">
          <div>
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">The Problem</h2>
            <p className="text-gray-200 leading-relaxed">{article.problem}</p>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">The Solution</h2>
            <p className="text-gray-200 leading-relaxed">{article.solution}</p>
          </div>
          {article.steps?.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Step by Step</h2>
              <ol className="space-y-3">
                {article.steps.map((step, i) => (
                  <li key={i} className="flex gap-4">
                    <span className="shrink-0 w-7 h-7 rounded-full bg-green-900/50 border border-green-700/50 text-green-400 text-sm font-bold flex items-center justify-center">{i + 1}</span>
                    <span className="text-gray-200 text-sm leading-relaxed pt-0.5">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>

        <div className="mt-8 pt-6 border-t border-gray-700 text-center">
          <p className="text-gray-400 text-sm mb-3">Was this article helpful?</p>
          <div className="flex gap-3 justify-center">
            <button className="px-4 py-2 bg-green-900/40 hover:bg-green-900/60 border border-green-700/50 text-green-400 rounded-lg text-sm transition-colors">Yes, it helped</button>
            <button onClick={onBack} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 rounded-lg text-sm transition-colors">See more articles</button>
          </div>
          <p className="text-gray-500 text-xs mt-4">Still stuck? <a href="/login" className="text-green-400 hover:underline">Sign in to create a support ticket →</a></p>
        </div>
      </div>
    </div>
  );
}

export default function PublicKnowledgeBase() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    fetchArticles();
  }, [search, category]);

  async function fetchArticles() {
    try {
      const params = {};
      if (search) params.q = search;
      if (category !== 'all') params.category = category;
      const { data } = await api.get('/knowledge-base/public', { params });
      setArticles(data);
    } catch {}
    setLoading(false);
  }

  function openArticle(article) {
    setSelected(article);
    window.scrollTo(0, 0);
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="bg-gradient-to-b from-gray-900 to-gray-950 border-b border-gray-800 px-4 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-green-700 rounded-lg flex items-center justify-center text-sm font-bold text-white">S</div>
            <span className="font-bold text-white">Sentinel</span>
            <span className="text-gray-600 text-sm ml-1">Help Center</span>
          </div>
          <a href="/login" className="text-sm text-green-400 hover:underline">Sign in →</a>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-10">
        {selected ? (
          <ArticleDetail article={selected} onBack={() => setSelected(null)} />
        ) : (
          <>
            {/* Hero search */}
            <div className="text-center mb-10">
              <h1 className="text-3xl font-bold text-white mb-2">How can we help?</h1>
              <p className="text-gray-400 mb-6">Search our knowledge base for instant answers</p>
              <div className="max-w-xl mx-auto relative">
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search for solutions..."
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-5 py-3 pl-11 outline-none focus:border-green-600 text-sm"
                />
                <svg className="absolute left-4 top-3.5 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            {/* Category filter */}
            <div className="flex flex-wrap gap-2 justify-center mb-8">
              {CATEGORIES.map(c => (
                <button key={c} onClick={() => setCategory(c)} className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${category === c ? 'bg-green-700 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>
                  {CAT_ICONS[c]} {c === 'all' ? 'All Articles' : c.charAt(0).toUpperCase() + c.slice(1)}
                </button>
              ))}
            </div>

            {/* Articles */}
            {loading ? (
              <div className="text-center text-gray-500 py-12">Loading articles...</div>
            ) : articles.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-4xl mb-3">🔍</div>
                <h3 className="text-white font-semibold mb-1">No articles found</h3>
                <p className="text-gray-400 text-sm">Try a different search term or <a href="/login" className="text-green-400 hover:underline">create a ticket</a></p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {articles.map(a => <ArticleCard key={a.id} article={a} onClick={openArticle} />)}
              </div>
            )}

            {/* Footer CTA */}
            <div className="mt-12 bg-gray-800/50 border border-gray-700 rounded-2xl p-8 text-center">
              <h3 className="text-white font-semibold mb-2">Can't find what you're looking for?</h3>
              <p className="text-gray-400 text-sm mb-4">Sign in to chat with ATLAS or create a support ticket</p>
              <a href="/login" className="inline-block bg-green-700 hover:bg-green-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-colors">Sign in for support →</a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
