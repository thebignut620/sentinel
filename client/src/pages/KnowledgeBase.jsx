import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import SearchInput from '../components/SearchInput.jsx';
import sentinelLogo from '../assets/sentinel_logo.png';
import api from '../api/client.js';

const CATEGORY_ICONS = { hardware:'🖥', software:'💾', network:'🌐', access:'🔑', account:'👤' };
const CATEGORIES = ['all', 'hardware', 'software', 'network', 'access', 'account'];

function ArticleCard({ article, onSelect }) {
  const steps = article.steps ? (typeof article.steps === 'string' ? JSON.parse(article.steps) : article.steps) : [];
  return (
    <button
      onClick={() => onSelect(article)}
      className="card p-5 text-left hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/40 hover:border-gray-700 transition-all duration-200 group w-full"
    >
      <div className="flex items-start gap-3 mb-3">
        <span className="text-xl shrink-0">{CATEGORY_ICONS[article.category] || '📄'}</span>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-200 group-hover:text-white transition-colors leading-snug">
            {article.title}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] text-gray-600 capitalize">{article.category}</span>
            <span className="text-gray-700">·</span>
            <span className="text-[10px] text-gray-600">{article.views} view{article.views !== 1 ? 's' : ''}</span>
            {steps.length > 0 && (
              <>
                <span className="text-gray-700">·</span>
                <span className="text-[10px] text-gray-600">{steps.length} steps</span>
              </>
            )}
          </div>
        </div>
      </div>
      <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">{article.problem}</p>
    </button>
  );
}

function ArticleModal({ article, onClose }) {
  const [full, setFull] = useState(null);

  useEffect(() => {
    api.get(`/knowledge-base/${article.id}`).then(r => setFull(r.data)).catch(() => setFull(article));
  }, [article.id]);

  const data = full || article;
  const steps = data.steps
    ? (typeof data.steps === 'string' ? JSON.parse(data.steps) : data.steps)
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="card w-full max-w-2xl max-h-[85vh] overflow-y-auto animate-fadeInScale">
        {/* Pine accent */}
        <div className="h-0.5 bg-gradient-to-r from-transparent via-pine-500 to-transparent" />

        <div className="p-6">
          {/* Header */}
          <div className="flex items-start gap-3 mb-5">
            <span className="text-2xl shrink-0">{CATEGORY_ICONS[data.category] || '📄'}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-pine-900/60 text-pine-300 border border-pine-800/50 uppercase tracking-wider font-medium">
                  ATLAS KB
                </span>
                <span className="text-[10px] text-gray-600 capitalize">{data.category}</span>
              </div>
              <h2 className="text-lg font-bold text-white leading-snug">{data.title}</h2>
            </div>
            <button onClick={onClose} className="text-gray-600 hover:text-gray-300 transition-colors text-lg shrink-0">✕</button>
          </div>

          {/* Problem */}
          <div className="mb-5">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">The Problem</h3>
            <p className="text-sm text-gray-300 leading-relaxed">{data.problem}</p>
          </div>

          {/* Solution */}
          <div className="mb-5">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Solution</h3>
            <p className="text-sm text-gray-300 leading-relaxed">{data.solution}</p>
          </div>

          {/* Steps */}
          {steps.length > 0 && (
            <div className="mb-5">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Steps</h3>
              <ol className="space-y-2">
                {steps.map((step, i) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <span className="h-5 w-5 rounded-full bg-pine-900/60 border border-pine-800/50 text-pine-400 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <span className="text-gray-300 leading-relaxed">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-800">
            <span className="text-xs text-gray-600">
              Generated by ATLAS · {data.views} view{data.views !== 1 ? 's' : ''}
              {data.ticket_id && (
                <> · <Link to={`/tickets/${data.ticket_id}`} className="text-pine-500 hover:text-pine-400" onClick={onClose}>Source ticket #{data.ticket_id}</Link></>
              )}
            </span>
            <div className="flex gap-2">
              <button onClick={onClose} className="btn-secondary px-4 py-2 text-xs">Close</button>
              <Link to="/help" className="btn-primary px-4 py-2 text-xs" onClick={onClose}>Still need help →</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function KnowledgeBase() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [category, setCategory] = useState('all');
  const [selected, setSelected] = useState(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('q', search.trim());
      if (category !== 'all') params.set('category', category);
      const res = await api.get(`/knowledge-base?${params}`);
      setArticles(res.data);
    } catch {}
    setLoading(false);
  }, [search, category]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(fetch, 300);
    return () => clearTimeout(t);
  }, [fetch]);

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <h1 className="text-2xl font-bold text-white">Knowledge Base</h1>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-pine-900/60 text-pine-300 border border-pine-800/50 font-medium uppercase tracking-wider">
              ATLAS
            </span>
          </div>
          <p className="text-sm text-gray-500">AI-generated resolutions from past tickets. Search before submitting.</p>
        </div>
        <Link to="/help" className="btn-primary px-4 py-2 text-sm">
          + New Issue
        </Link>
      </div>

      {/* Search + filter */}
      <div className="card p-3 flex flex-wrap gap-3 items-center">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search KB articles…"
          className="flex-1 min-w-52"
        />
        <div className="flex gap-1 flex-wrap">
          {CATEGORIES.map(c => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all active:scale-95 ${
                category === c
                  ? 'bg-pine-700 text-white'
                  : 'bg-gray-800 border border-gray-700 text-gray-400 hover:text-gray-200'
              }`}
            >
              {c === 'all' ? 'All' : `${CATEGORY_ICONS[c]} ${c}`}
            </button>
          ))}
        </div>
        <span className="text-xs text-gray-600">{articles.length} article{articles.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Articles */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[1,2,3,4].map(i => <div key={i} className="skeleton h-28 rounded-xl" />)}
        </div>
      ) : articles.length === 0 ? (
        <div className="card py-16 text-center animate-fadeIn">
          <div className="flex flex-col items-center gap-4">
            <img src={sentinelLogo} alt="Sentinel" className="h-12 w-auto opacity-20" />
            <div>
              <p className="text-gray-400 font-medium">
                {search || category !== 'all' ? 'Nothing found for that search.' : 'The knowledge base is empty right now.'}
              </p>
              <p className="text-gray-600 text-sm mt-1">
                {search || category !== 'all'
                  ? 'Try different keywords or browse all categories.'
                  : 'ATLAS builds articles automatically as tickets get resolved — check back soon.'}
              </p>
            </div>
            {(search || category !== 'all') && (
              <button onClick={() => { setSearch(''); setCategory('all'); }} className="btn-secondary px-4 py-2 text-sm">
                Clear filters
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {articles.map(a => (
            <ArticleCard key={a.id} article={a} onSelect={setSelected} />
          ))}
        </div>
      )}

      {selected && <ArticleModal article={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
