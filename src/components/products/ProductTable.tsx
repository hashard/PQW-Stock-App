import { useMemo, useState, useRef, useEffect } from 'react';
import {
  ChevronUp, ChevronDown, ChevronsUpDown, Edit2, Eye, AlertTriangle,
  Search, Filter, Download, Users, X, Scissors, EyeOff, Columns,
} from 'lucide-react';
import { useStore } from '../../store';
import { StatusBadge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { SkeletonRow } from '../ui/Skeleton';
import { api } from '../../api/client';
import type { Product, SortConfig } from '../../types';

const PAGE_SIZE = 50;

function SortIcon({ col, sort }: { col: keyof Product; sort: SortConfig }) {
  if (sort.key !== col) return <ChevronsUpDown className="h-3.5 w-3.5 text-slate-400" />;
  return sort.direction === 'asc'
    ? <ChevronUp   className="h-3.5 w-3.5 text-blue-500" />
    : <ChevronDown className="h-3.5 w-3.5 text-blue-500" />;
}

function timeAgo(iso: string | null) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function ProductTable() {
  const {
    products, isLoading, filters, sort, page, showHidden, hiddenColumns,
    setFilters, setSort, setPage, openAdjustModal, openDrawer,
    isBulkMode, selectedIds, toggleSelectedId, clearSelected, toggleBulkMode,
    updateProduct, setShowHidden, toggleColumn,
  } = useStore();

  const COLS = [
    { key: 'sku',                label: 'SKU' },
    { key: 'category',           label: 'Category' },
    { key: 'woo_stock',          label: 'Woo Stock' },
    { key: 'cutting_room_stock', label: 'Cutting Room' },
    { key: 'combined_stock',     label: 'Combined' },
    { key: 'status',             label: 'Status' },
    { key: 'low_stock_threshold',label: 'Threshold' },
    { key: 'updated_at',         label: 'Updated' },
  ] as const;

  const show = (key: string) => !hiddenColumns.has(key);

  const [colPickerOpen, setColPickerOpen] = useState(false);
  const colPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (colPickerRef.current && !colPickerRef.current.contains(e.target as Node)) {
        setColPickerOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const [bulkUser,   setBulkUser]   = useState('');
  const [bulkReason, setBulkReason] = useState('');
  const [bulkQty,    setBulkQty]    = useState('');
  const [bulkType,   setBulkType]   = useState<'add' | 'remove' | 'set'>('add');
  const [bulkLoading,setBulkLoading]= useState(false);

  // Derived categories for filter dropdown
  const categories = useMemo(() => {
    const set = new Set(products.map(p => p.category));
    return ['all', ...Array.from(set).sort()];
  }, [products]);

  // Filter + sort + paginate
  const filtered = useMemo(() => {
    let list = [...products];

    if (filters.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
    }
    // Filter hidden products (unless showHidden is on)
    if (!showHidden) {
      list = list.filter(p => !p.hidden);
    }

    // Handle "laser_cut" as a status filter option
    if (filters.status === 'laser_cut') {
      list = list.filter(p => p.needs_laser_cut);
    } else if (filters.status !== 'all') {
      list = list.filter(p => p.status === filters.status);
    }
    if (filters.category !== 'all') {
      list = list.filter(p => p.category === filters.category);
    }

    list.sort((a, b) => {
      const av = a[sort.key], bv = b[sort.key];
      const cmp = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av ?? '').localeCompare(String(bv ?? ''));
      return sort.direction === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [products, filters, sort]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged      = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function toggleSort(key: keyof Product) {
    setSort(
      sort.key === key && sort.direction === 'asc'
        ? { key, direction: 'desc' }
        : { key, direction: 'asc' },
    );
  }

  async function applyBulk() {
    if (!bulkQty || !bulkReason.trim() || !bulkUser.trim()) return;
    setBulkLoading(true);
    try {
      for (const id of selectedIds) {
        const res = await api.adjustments.create({
          product_id:      id,
          adjustment_type: bulkType,
          quantity:        Number(bulkQty),
          reason:          bulkReason.trim(),
          user_name:       bulkUser.trim(),
        });
        updateProduct(res.product);
        useStore.getState().addAdjustment(res.adjustment);
      }
      clearSelected();
      setBulkQty(''); setBulkReason('');
    } finally {
      setBulkLoading(false);
    }
  }

  const Th = ({ label, col, className = '' }: { label: string; col?: keyof Product; className?: string }) => (
    <th
      onClick={col ? () => toggleSort(col) : undefined}
      className={[
        'whitespace-nowrap px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400',
        col ? 'cursor-pointer select-none hover:text-slate-700 dark:hover:text-slate-200' : '',
        className,
      ].join(' ')}
    >
      <span className="inline-flex items-center gap-1">
        {label} {col && <SortIcon col={col} sort={sort} />}
      </span>
    </th>
  );

  const visibleColCount = COLS.filter(c => show(c.key)).length;
  const colSpan = visibleColCount + 2 + (isBulkMode ? 1 : 0); // +2 for Product + Actions

  return (
    <div className="flex flex-col gap-3">

      {/* ── Filter bar ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search product or SKU…"
            value={filters.search}
            onChange={e => setFilters({ search: e.target.value })}
            className="h-9 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
          />
        </div>

        {/* Status filter */}
        <div className="relative">
          <Filter className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <select
            value={filters.status}
            onChange={e => setFilters({ status: e.target.value })}
            className="h-9 rounded-lg border border-slate-300 bg-white pl-8 pr-7 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white appearance-none"
          >
            <option value="all">All statuses</option>
            <option value="in_stock">In Stock</option>
            <option value="low_stock">Low Stock</option>
            <option value="out_of_stock">Out of Stock</option>
            <option value="laser_cut">Laser Cut</option>
          </select>
        </div>

        {/* Category filter */}
        <select
          value={filters.category}
          onChange={e => setFilters({ category: e.target.value })}
          className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
        >
          {categories.map(c => (
            <option key={c} value={c}>{c === 'all' ? 'All categories' : c}</option>
          ))}
        </select>

        <Button
          size="sm"
          variant={showHidden ? 'primary' : 'secondary'}
          onClick={() => setShowHidden(!showHidden)}
          title={showHidden ? 'Hide hidden products' : 'Show hidden products'}
        >
          <EyeOff className="h-3.5 w-3.5" /> Hidden
        </Button>

        <div className="flex items-center gap-2 ml-auto">
          {/* Result count */}
          <span className="text-xs text-slate-500 whitespace-nowrap">
            {filtered.length} product{filtered.length !== 1 ? 's' : ''}
          </span>

          {/* Column picker */}
          <div className="relative" ref={colPickerRef}>
            <Button size="sm" variant={hiddenColumns.size > 0 ? 'primary' : 'secondary'} onClick={() => setColPickerOpen(v => !v)}>
              <Columns className="h-3.5 w-3.5" /> Columns{hiddenColumns.size > 0 ? ` (${COLS.length - hiddenColumns.size}/${COLS.length})` : ''}
            </Button>
            {colPickerOpen && (
              <div className="absolute right-0 top-full mt-1 z-20 w-44 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg p-2 space-y-0.5">
                {COLS.map(col => (
                  <button
                    key={col.key}
                    type="button"
                    onClick={() => toggleColumn(col.key)}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    <span className={show(col.key) ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400'}>{col.label}</span>
                    <span className={`h-4 w-4 rounded border-2 flex items-center justify-center shrink-0 ${show(col.key) ? 'border-brand-500 bg-brand-500' : 'border-slate-300 dark:border-slate-600'}`}>
                      {show(col.key) && <span className="text-white text-[10px] leading-none font-bold">✓</span>}
                    </span>
                  </button>
                ))}
                {hiddenColumns.size > 0 && (
                  <button
                    type="button"
                    onClick={() => COLS.forEach(c => hiddenColumns.has(c.key) && toggleColumn(c.key))}
                    className="w-full mt-1 rounded-lg px-3 py-1.5 text-xs text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 text-center transition-colors border-t border-slate-100 dark:border-slate-700 pt-2"
                  >
                    Show all columns
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Bulk mode toggle */}
          <Button size="sm" variant={isBulkMode ? 'primary' : 'secondary'} onClick={toggleBulkMode}>
            <Users className="h-3.5 w-3.5" /> {isBulkMode ? 'Exit Bulk' : 'Bulk Edit'}
          </Button>

          {/* Export */}
          <Button size="sm" variant="secondary" onClick={api.export.products}>
            <Download className="h-3.5 w-3.5" /> Export
          </Button>
        </div>
      </div>

      {/* ── Bulk action bar ────────────────────────────────────────────────── */}
      {isBulkMode && selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 dark:border-blue-800 dark:bg-blue-900/20">
          <span className="text-sm font-medium text-brand-700 dark:text-brand-300">{selectedIds.size} selected</span>
          <select value={bulkType} onChange={e => setBulkType(e.target.value as typeof bulkType)}
            className="h-8 rounded border border-brand-300 bg-white px-2 text-xs dark:border-brand-700 dark:bg-slate-800 dark:text-white">
            <option value="add">Add</option>
            <option value="remove">Remove</option>
            <option value="set">Set to</option>
          </select>
          <input type="number" min="0" placeholder="Qty" value={bulkQty} onChange={e => setBulkQty(e.target.value)}
            className="h-8 w-20 rounded border border-blue-300 bg-white px-2 text-xs font-mono dark:border-blue-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
          <input type="text" placeholder="Staff name" value={bulkUser} onChange={e => setBulkUser(e.target.value)}
            className="h-8 w-28 rounded border border-brand-300 bg-white px-2 text-xs dark:border-brand-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
          <input type="text" placeholder="Reason (required)" value={bulkReason} onChange={e => setBulkReason(e.target.value)}
            className="h-8 flex-1 min-w-[140px] rounded border border-brand-300 bg-white px-2 text-xs dark:border-brand-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
          <Button size="xs" variant="primary" loading={bulkLoading}
            disabled={!bulkQty || !bulkReason.trim() || !bulkUser.trim()}
            onClick={applyBulk}>Apply</Button>
          <Button size="xs" variant="ghost" onClick={clearSelected}><X className="h-3 w-3" /></Button>
        </div>
      )}

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800/80 backdrop-blur">
            <tr className="border-b border-slate-200 dark:border-slate-700">
              {isBulkMode && (
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={paged.length > 0 && paged.every(p => selectedIds.has(p.id))}
                    onChange={e => paged.forEach(p => {
                      const has = selectedIds.has(p.id);
                      if (e.target.checked && !has) toggleSelectedId(p.id);
                      if (!e.target.checked && has) toggleSelectedId(p.id);
                    })}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600"
                  />
                </th>
              )}
              <Th label="Product"        col="name"               />
              {show('sku')                && <Th label="SKU"          col="sku"                 className="w-32" />}
              {show('category')           && <Th label="Category"     col="category"            className="w-32" />}
              {show('woo_stock')          && <Th label="Woo"          col="woo_stock"           className="w-20 text-right" />}
              {show('cutting_room_stock') && <Th label="Cutting Room" col="cutting_room_stock"  className="w-28 text-right" />}
              {show('combined_stock')     && <Th label="Combined"     col="combined_stock"      className="w-24 text-right" />}
              {show('status')             && <Th label="Status"       col="status"              className="w-32" />}
              {show('low_stock_threshold')&& <Th label="Threshold"    col="low_stock_threshold" className="w-24 text-right" />}
              {show('updated_at')         && <Th label="Updated"      col="updated_at"          className="w-24" />}
              <th className="px-4 py-3 w-20" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {isLoading && products.length === 0
              ? Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
              : paged.length === 0
                ? (
                  <tr>
                    <td colSpan={colSpan} className="py-16 text-center text-sm text-slate-400">
                      {products.length === 0 ? 'No products yet — run a sync or add products.' : 'No products match your filters.'}
                    </td>
                  </tr>
                )
                : paged.map(product => (
                  <tr
                    key={product.id}
                    className={[
                      'group transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50',
                      selectedIds.has(product.id) ? 'bg-brand-50 dark:bg-brand-900/20' : '',
                      product.hidden ? 'opacity-50' : '',
                    ].join(' ')}
                  >
                    {isBulkMode && (
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(product.id)}
                          onChange={() => toggleSelectedId(product.id)}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600"
                        />
                      </td>
                    )}
                    {/* Product name */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {product.flagged && (
                          <span title="Missing or duplicate SKU — review needed">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                          </span>
                        )}
                        {product.needs_laser_cut && (
                          <span title="Needs laser cutting — cutting room stock at or below minimum">
                            <Scissors className="h-3.5 w-3.5 shrink-0 text-red-500" />
                          </span>
                        )}
                        <span className="font-medium text-slate-800 dark:text-slate-100 line-clamp-1">{product.name}</span>
                      </div>
                      {product.notes && (
                        <p className="mt-0.5 text-xs text-slate-400 truncate max-w-[220px]">{product.notes}</p>
                      )}
                    </td>

                    {/* SKU */}
                    {show('sku') && <td className="px-4 py-3 font-mono text-xs text-slate-500">{product.sku}</td>}

                    {/* Category */}
                    {show('category') && <td className="px-4 py-3 text-slate-600 dark:text-slate-400 truncate max-w-[120px]">{product.category}</td>}

                    {/* Woo stock */}
                    {show('woo_stock') && <td className="px-4 py-3 text-right font-mono text-slate-600 dark:text-slate-400">{product.woo_stock}</td>}

                    {/* Cutting room stock */}
                    {show('cutting_room_stock') && (
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => openAdjustModal(product.id)}
                          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-slate-800 dark:text-slate-100 hover:bg-brand-50 dark:hover:bg-brand-900/30 hover:text-brand-700 dark:hover:text-brand-300 transition-colors"
                          title="Click to adjust"
                        >
                          {product.cutting_room_stock}
                          <Edit2 className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-brand-400" />
                        </button>
                      </td>
                    )}

                    {/* Combined stock */}
                    {show('combined_stock') && (
                      <td className="px-4 py-3 text-right">
                        <span className="font-mono font-bold text-slate-900 dark:text-white">{product.combined_stock}</span>
                      </td>
                    )}

                    {/* Status */}
                    {show('status') && <td className="px-4 py-3"><StatusBadge status={product.status} /></td>}

                    {/* Threshold */}
                    {show('low_stock_threshold') && <td className="px-4 py-3 text-right font-mono text-slate-500">{product.low_stock_threshold}</td>}

                    {/* Updated */}
                    {show('updated_at') && <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">{timeAgo(product.updated_at)}</td>}

                    {/* Actions */}
                    <td className="px-4 py-3">
                      {product.hidden ? (
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={async () => {
                            const updated = await api.products.update(product.id, { hidden: false } as Partial<Product>);
                            updateProduct(updated);
                          }}
                          title="Unhide product"
                        >
                          <EyeOff className="h-3.5 w-3.5" /> Unhide
                        </Button>
                      ) : (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button size="xs" variant="ghost" onClick={() => openAdjustModal(product.id)} title="Adjust stock">
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="xs" variant="ghost" onClick={() => openDrawer(product.id)} title="View details">
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
            }
          </tbody>
        </table>
      </div>

      {/* ── Pagination ─────────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>
            Page {page + 1} of {totalPages} ({filtered.length} total)
          </span>
          <div className="flex gap-1">
            <Button size="xs" variant="secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>← Prev</Button>
            {Array.from({ length: Math.min(totalPages, 7) }).map((_, i) => {
              const pg = totalPages <= 7 ? i : page < 4 ? i : page > totalPages - 5 ? totalPages - 7 + i : page - 3 + i;
              return (
                <Button key={pg} size="xs" variant={pg === page ? 'primary' : 'secondary'} onClick={() => setPage(pg)}>
                  {pg + 1}
                </Button>
              );
            })}
            <Button size="xs" variant="secondary" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>Next →</Button>
          </div>
        </div>
      )}
    </div>
  );
}
