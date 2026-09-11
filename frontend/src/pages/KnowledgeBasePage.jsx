import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { CategoryBadge } from '../components/Badges.jsx';

export default function KnowledgeBasePage() {
    const [articles, setArticles] = useState([]);
    const [searchDraft, setSearchDraft] = useState('');
    const [activeSearch, setActiveSearch] = useState('');
    const [expandedId, setExpandedId] = useState(null);
    const [errorMessage, setErrorMessage] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        setIsLoading(true);

        api.listArticles(activeSearch)
            .then((payload) => {
                if (!cancelled) {
                    setArticles(payload.articles);
                    setErrorMessage(null);
                }
            })
            .catch((error) => {
                if (!cancelled) {
                    setErrorMessage(error.message);
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setIsLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [activeSearch]);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-xl font-semibold tracking-tight text-slate-900">Knowledge base</h1>
                <p className="mt-1 text-sm text-slate-500">
                    These articles are the only source the assistant is allowed to draw facts from.
                </p>
            </div>

            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    setActiveSearch(searchDraft.trim());
                }}
                className="flex gap-2"
            >
                <input
                    type="search"
                    value={searchDraft}
                    onChange={(event) => setSearchDraft(event.target.value)}
                    placeholder="Search the same way the assistant does"
                    className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                />
                <button
                    type="submit"
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                    Search
                </button>
            </form>

            {errorMessage && (
                <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</p>
            )}

            {isLoading && <p className="text-sm text-slate-500">Loading articles</p>}

            {!isLoading && articles.length === 0 && (
                <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
                    No articles matched. The assistant would decline to answer rather than invent one.
                </p>
            )}

            <div className="space-y-3">
                {articles.map((article) => {
                    const isExpanded = expandedId === article.id;

                    return (
                        <article key={article.id} className="rounded-xl border border-slate-200 bg-white">
                            <button
                                type="button"
                                onClick={() => setExpandedId(isExpanded ? null : article.id)}
                                className="flex w-full flex-wrap items-center justify-between gap-3 px-5 py-4 text-left"
                            >
                                <span className="font-medium text-slate-900">{article.title}</span>
                                <span className="flex items-center gap-2">
                                    <CategoryBadge category={article.category} />
                                    {article.relevance !== undefined && (
                                        <span className="text-xs text-slate-400">
                                            score {Number(article.relevance).toFixed(3)}
                                        </span>
                                    )}
                                    <span className="text-xs text-slate-400">
                                        {isExpanded ? 'Hide' : 'Read'}
                                    </span>
                                </span>
                            </button>

                            {isExpanded && (
                                <div className="border-t border-slate-100 px-5 py-4">
                                    <p className="text-sm whitespace-pre-wrap text-slate-700">
                                        {article.content}
                                    </p>
                                </div>
                            )}
                        </article>
                    );
                })}
            </div>
        </div>
    );
}
