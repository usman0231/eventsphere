import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import dayjs from 'dayjs';

const categories = ['All', 'Technology', 'Health', 'Education', 'Business', 'Art', 'Science', 'Food', 'Fashion'];

const statusColors = {
  draft: 'badge-gray',
  published: 'badge-purple',
  ongoing: 'badge-green',
  completed: 'badge-cyan',
  cancelled: 'badge-red'
};

export default function ExposPage() {
  const navigate = useNavigate();
  const { isOrganizer } = useAuth();
  const [expos, setExpos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('date');
  const [dateRange, setDateRange] = useState('');
  const [priceRange, setPriceRange] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [topRated, setTopRated] = useState([]);

  useEffect(() => {
    api.get('/api/reviews/top-rated?limit=3&minReviews=1')
      .then(r => setTopRated(r.data?.data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchExpos(); }, [debouncedSearch, category, status, sort, dateRange, priceRange, page]);

  const fetchExpos = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 9 };
      if (debouncedSearch) params.search = debouncedSearch;
      if (category !== 'All') params.category = category;
      if (status) params.status = status;
      if (sort && sort !== 'date') params.sort = sort;
      if (dateRange) params.dateRange = dateRange;
      if (priceRange) params.priceRange = priceRange;
      const { data } = await api.get('/api/expos', { params });
      setExpos(data.data);
      setTotalPages(data.pages);
      setTotal(data.total || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const hasFilters = !!(debouncedSearch || category !== 'All' || status || dateRange || priceRange || sort !== 'date');
  const clearFilters = () => {
    setSearch(''); setDebouncedSearch('');
    setCategory('All'); setStatus(''); setSort('date');
    setDateRange(''); setPriceRange(''); setPage(1);
  };

  return (
    <div className="expos-page">
      <div className="expos-bg">
        <div className="expos-orb-1"></div>
        <div className="expos-orb-2"></div>
      </div>
      <div className="expos-container">
        {/* Header */}
        <div className="expos-header">
          <div>
            <p className="section-label">Discover Events</p>
            <h1 className="expos-title">Explore Expos</h1>
            <p className="expos-subtitle">Find and join world-class exhibitions and trade shows</p>
          </div>
          {isOrganizer && (
            <button className="btn-primary" onClick={() => navigate('/expos/create')}>
              + Create Expo
            </button>
          )}
        </div>

        {/* Search & Filter */}
        <div className="expos-filters">
          <div className="search-box">
            <span className="search-icon">🔍</span>
            <input
              className="search-input"
              placeholder="Search title, description, city, venue, tags…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && <button className="search-clear" onClick={() => setSearch('')} aria-label="Clear search">✕</button>}
          </div>
          <select className="filter-select" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All Status</option>
            <option value="published">Published</option>
            <option value="ongoing">Ongoing</option>
            <option value="completed">Completed</option>
          </select>
          <select className="filter-select" value={sort} onChange={e => { setSort(e.target.value); setPage(1); }}>
            <option value="date">📅 Date (soonest)</option>
            <option value="date-desc">📅 Date (latest)</option>
            <option value="popular">🔥 Most Popular</option>
            <option value="recent">✨ Recently Added</option>
            <option value="name">🔤 Name (A–Z)</option>
          </select>
        </div>

        {/* Quick filter chips */}
        <div className="expos-chips">
          <span className="chips-label">When:</span>
          {[['', 'Anytime'], ['upcoming', 'Upcoming'], ['month', 'This Month'], ['past', 'Past']].map(([v, l]) => (
            <button key={v||'any'} className={`chip ${dateRange === v ? 'chip-active' : ''}`} onClick={() => { setDateRange(v); setPage(1); }}>{l}</button>
          ))}
          <span className="chips-label" style={{ marginLeft: 12 }}>Price:</span>
          {[['', 'Any'], ['free', 'Free'], ['paid', 'Paid']].map(([v, l]) => (
            <button key={v||'any'} className={`chip ${priceRange === v ? 'chip-active' : ''}`} onClick={() => { setPriceRange(v); setPage(1); }}>{l}</button>
          ))}
          {hasFilters && (
            <button className="chip chip-clear" onClick={clearFilters}>✕ Clear all</button>
          )}
        </div>

        {/* Categories */}
        <div className="categories-bar">
          {categories.map(cat => (
            <button
              key={cat}
              className={`category-btn ${category === cat ? 'active' : ''}`}
              onClick={() => { setCategory(cat); setPage(1); }}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Top Rated strip */}
        {topRated.length > 0 && !hasFilters && (
          <div className="expos-top-rated">
            <span className="expos-top-rated-label">⭐ Top Rated:</span>
            {topRated.map(t => (
              <button key={t._id} className="expos-top-rated-chip" onClick={() => navigate(`/expos/${t._id}`)}>
                <span className="expos-tr-stars">★ {t.avg}</span>
                <span className="expos-tr-name">{t.title}</span>
                <span className="expos-tr-count">({t.count})</span>
              </button>
            ))}
          </div>
        )}

        {/* Results count */}
        {!loading && (
          <div className="expos-count">
            {total === 0 ? 'No expos found' : `Showing ${expos.length} of ${total} expo${total !== 1 ? 's' : ''}`}
            {hasFilters && total > 0 && <span className="expos-count-filter"> · filtered</span>}
          </div>
        )}

        {/* Expo Grid */}
        {loading ? (
          <div className="expos-grid">
            {Array(6).fill(0).map((_, i) => (
              <div key={i} className="expo-card-skeleton glass-card">
                <div className="skeleton-img"></div>
                <div className="skeleton-content">
                  <div className="skeleton-line w-60"></div>
                  <div className="skeleton-line w-90"></div>
                  <div className="skeleton-line w-40"></div>
                </div>
              </div>
            ))}
          </div>
        ) : expos.length === 0 ? (
          <div className="expos-empty">
            <span className="empty-icon">🎪</span>
            <h3>No expos found</h3>
            <p>Try adjusting your search or filters</p>
            {isOrganizer && (
              <button className="btn-primary" style={{ marginTop: 24 }} onClick={() => navigate('/expos/create')}>
                Create First Expo
              </button>
            )}
          </div>
        ) : (
          <div className="expos-grid">
            {expos.map(expo => (
              <div
                key={expo._id}
                className="expo-card glass-card"
                onClick={() => navigate(`/expos/${expo._id}`)}
              >
                <div className="expo-card-img" style={{ backgroundImage: `url(https://picsum.photos/seed/${expo._id}/600/300)` }}>
                  <div className="expo-card-overlay">
                    <span className={`badge ${statusColors[expo.status] || 'badge-gray'}`}>{expo.status}</span>
                    {expo.category && <span className="badge badge-purple">{expo.category}</span>}
                  </div>
                </div>
                <div className="expo-card-body">
                  <h3 className="expo-card-title">{expo.title}</h3>
                  <p className="expo-card-desc">{expo.description}</p>
                  <div className="expo-card-meta">
                    <span className="expo-meta-item">📅 {dayjs(expo.startDate).format('MMM D, YYYY')}</span>
                    <span className="expo-meta-item">📍 {expo.location?.city || expo.location?.venue}</span>
                  </div>
                  <button className="expo-card-btn">View Details →</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="pagination">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button
                key={p}
                className={`page-btn ${page === p ? 'active' : ''}`}
                onClick={() => setPage(p)}
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}