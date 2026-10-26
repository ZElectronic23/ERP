'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface Client {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  company_name?: string;
  address?: string;
}

interface CustomerSelectorProps {
  selectedClient: Client | null;
  onSelect: (client: Client) => void;
  locale: string;
}

// ═══════════════════════════════════════════════════════════════
// TRANSLATIONS
// ═══════════════════════════════════════════════════════════════

const t: Record<string, Record<string, string>> = {
  ar: {
    searchPlaceholder: 'ابحث عن عميل بالاسم أو الهاتف أو البريد...',
    noResults: 'لا توجد نتائج',
    addNew: 'إضافة عميل جديد',
    change: 'تغيير',
    selected: 'العميل المحدد',
    name: 'الاسم',
    phone: 'الهاتف',
    email: 'البريد الإلكتروني',
    company: 'الشركة',
    address: 'العنوان',
    save: 'حفظ',
    cancel: 'إلغاء',
    required: 'مطلوب',
    saving: 'جاري الحفظ...',
    newClient: 'عميل جديد',
    searchOrAdd: 'البحث أو إضافة عميل',
  },
  en: {
    searchPlaceholder: 'Search by name, phone, or email...',
    noResults: 'No results found',
    addNew: 'Add new client',
    change: 'Change',
    selected: 'Selected Client',
    name: 'Name',
    phone: 'Phone',
    email: 'Email',
    company: 'Company',
    address: 'Address',
    save: 'Save',
    cancel: 'Cancel',
    required: 'Required',
    saving: 'Saving...',
    newClient: 'New Client',
    searchOrAdd: 'Search or add client',
  },
};

// ═══════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function CustomerSelector({
  selectedClient,
  onSelect,
  locale,
}: CustomerSelectorProps) {
  const lang = locale === 'ar' ? 'ar' : 'en';
  const dict = t[lang];
  const isRtl = lang === 'ar';

  // ── State ──
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newClient, setNewClient] = useState({ name: '', phone: '', email: '', company_name: '', address: '' });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // ── Close dropdown on outside click ──
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── Search ──
  const search = useCallback(
    async (term: string) => {
      if (term.length < 2) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(`/api/clients?search=${encodeURIComponent(term)}&limit=8`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        // API may return { clients: [] } or { data: [] } — handle both
        setResults(data.clients || data.data || data || []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setShowDropdown(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(value), 300);
  };

  // ── Select client ──
  const handleSelect = (client: Client) => {
    onSelect(client);
    setQuery('');
    setResults([]);
    setShowDropdown(false);
  };

  // ── Create new client ──
  const handleCreateClient = async () => {
    const errs: Record<string, boolean> = {};
    if (!newClient.name.trim()) errs.name = true;
    if (!newClient.phone.trim()) errs.phone = true;
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSaving(true);
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newClient.name.trim(),
          phone: newClient.phone.trim(),
          email: newClient.email.trim() || null,
          company_name: newClient.company_name.trim() || null,
          address: newClient.address.trim() || null,
        }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const created = data.client || data.data || data;
      handleSelect(created);
      setShowNewForm(false);
      setNewClient({ name: '', phone: '', email: '', company_name: '', address: '' });
      setErrors({});
    } catch {
      // silent — form stays open
    } finally {
      setSaving(false);
    }
  };

  // ═════════════════════════════════════════════════════════════
  // RENDER — Selected client card
  // ═════════════════════════════════════════════════════════════
  if (selectedClient && !showDropdown && !showNewForm) {
    return (
      <div dir={isRtl ? 'rtl' : 'ltr'}>
        <label className="block text-sm text-silver/80 mb-1.5 font-medium">
          {dict.selected}
        </label>
        <div className="bg-black/20 backdrop-blur-sm rounded-xl border border-gold/30 p-3 flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm truncate">
              {selectedClient.name}
              {selectedClient.company_name && (
                <span className="text-silver/70 font-normal ms-2">
                  — {selectedClient.company_name}
                </span>
              )}
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs text-silver/60">
              {selectedClient.phone && (
                <span dir="ltr" className="inline-flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                  {selectedClient.phone}
                </span>
              )}
              {selectedClient.email && (
                <span className="inline-flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                  {selectedClient.email}
                </span>
              )}
            </div>
            {selectedClient.address && (
              <p className="text-xs text-silver/50 mt-0.5 truncate">{selectedClient.address}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => { setShowDropdown(true); setQuery(''); }}
            className="shrink-0 text-xs text-gold border border-gold/30 rounded-lg px-3 py-1.5 hover:bg-gold/10 transition"
          >
            {dict.change}
          </button>
        </div>
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════
  // RENDER — New client form
  // ═════════════════════════════════════════════════════════════
  if (showNewForm) {
    return (
      <div dir={isRtl ? 'rtl' : 'ltr'} ref={wrapperRef}>
        <label className="block text-sm text-silver/80 mb-1.5 font-medium">
          {dict.newClient}
        </label>
        <div className="bg-black/20 backdrop-blur-sm rounded-xl border border-gold/30 p-4 space-y-3">
          {/* Name */}
          <div>
            <label className="block text-xs text-silver/60 mb-1">
              {dict.name} <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={newClient.name}
              onChange={(e) => { setNewClient(p => ({ ...p, name: e.target.value })); setErrors(p => ({ ...p, name: false })); }}
              className={`w-full bg-black/30 border ${errors.name ? 'border-red-500' : 'border-gold/20'} rounded-lg px-3 py-2 text-white text-sm placeholder:text-silver/40 focus:border-gold/50 focus:outline-none transition`}
              placeholder={dict.name}
              autoFocus
            />
            {errors.name && <p className="text-xs text-red-400 mt-0.5">{dict.required}</p>}
          </div>
          {/* Phone */}
          <div>
            <label className="block text-xs text-silver/60 mb-1">
              {dict.phone} <span className="text-red-400">*</span>
            </label>
            <input
              type="tel"
              dir="ltr"
              value={newClient.phone}
              onChange={(e) => { setNewClient(p => ({ ...p, phone: e.target.value })); setErrors(p => ({ ...p, phone: false })); }}
              className={`w-full bg-black/30 border ${errors.phone ? 'border-red-500' : 'border-gold/20'} rounded-lg px-3 py-2 text-white text-sm placeholder:text-silver/40 focus:border-gold/50 focus:outline-none transition`}
              placeholder="+20-xxx-xxx-xxxx"
            />
            {errors.phone && <p className="text-xs text-red-400 mt-0.5">{dict.required}</p>}
          </div>
          {/* Email */}
          <div>
            <label className="block text-xs text-silver/60 mb-1">{dict.email}</label>
            <input
              type="email"
              dir="ltr"
              value={newClient.email}
              onChange={(e) => setNewClient(p => ({ ...p, email: e.target.value }))}
              className="w-full bg-black/30 border border-gold/20 rounded-lg px-3 py-2 text-white text-sm placeholder:text-silver/40 focus:border-gold/50 focus:outline-none transition"
              placeholder="email@example.com"
            />
          </div>
          {/* Company */}
          <div>
            <label className="block text-xs text-silver/60 mb-1">{dict.company}</label>
            <input
              type="text"
              value={newClient.company_name}
              onChange={(e) => setNewClient(p => ({ ...p, company_name: e.target.value }))}
              className="w-full bg-black/30 border border-gold/20 rounded-lg px-3 py-2 text-white text-sm placeholder:text-silver/40 focus:border-gold/50 focus:outline-none transition"
              placeholder={dict.company}
            />
          </div>
          {/* Address */}
          <div>
            <label className="block text-xs text-silver/60 mb-1">{dict.address}</label>
            <input
              type="text"
              value={newClient.address}
              onChange={(e) => setNewClient(p => ({ ...p, address: e.target.value }))}
              className="w-full bg-black/30 border border-gold/20 rounded-lg px-3 py-2 text-white text-sm placeholder:text-silver/40 focus:border-gold/50 focus:outline-none transition"
              placeholder={dict.address}
            />
          </div>
          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={handleCreateClient}
              disabled={saving}
              className="flex-1 bg-gold/90 hover:bg-gold text-charcoal font-semibold text-sm py-2 rounded-lg transition disabled:opacity-50"
            >
              {saving ? dict.saving : dict.save}
            </button>
            <button
              type="button"
              onClick={() => { setShowNewForm(false); setErrors({}); }}
              className="flex-1 border border-silver/30 text-silver hover:border-silver/50 text-sm py-2 rounded-lg transition"
            >
              {dict.cancel}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════
  // RENDER — Search input + dropdown
  // ═════════════════════════════════════════════════════════════
  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} ref={wrapperRef} className="relative">
      <label className="block text-sm text-silver/80 mb-1.5 font-medium">
        {dict.searchOrAdd}
      </label>
      <div className="relative">
        <svg className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-silver/40 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onFocus={() => { if (query.length >= 2) setShowDropdown(true); }}
          className="w-full bg-black/20 backdrop-blur-sm border border-gold/20 rounded-xl ps-9 pe-3 py-2.5 text-white text-sm placeholder:text-silver/40 focus:border-gold/50 focus:outline-none transition"
          placeholder={dict.searchPlaceholder}
          autoComplete="off"
        />
        {loading && (
          <div className="absolute end-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && (query.length >= 2 || results.length > 0) && (
        <div className="absolute z-50 w-full mt-1 bg-[#2a2829] backdrop-blur-md border border-gold/20 rounded-xl shadow-2xl overflow-hidden max-h-72 overflow-y-auto">
          {results.length > 0 ? (
            results.map((client) => (
              <button
                key={client.id}
                type="button"
                onClick={() => handleSelect(client)}
                className="w-full text-start px-4 py-2.5 hover:bg-gold/10 transition border-b border-white/5 last:border-0"
              >
                <p className="text-sm text-white font-medium truncate">
                  {client.name}
                  {client.company_name && (
                    <span className="text-silver/60 font-normal ms-2 text-xs">
                      {client.company_name}
                    </span>
                  )}
                </p>
                <div className="flex gap-4 text-xs text-silver/50 mt-0.5">
                  {client.phone && <span dir="ltr">{client.phone}</span>}
                  {client.email && <span>{client.email}</span>}
                </div>
              </button>
            ))
          ) : !loading && query.length >= 2 ? (
            <div className="px-4 py-3 text-sm text-silver/50 text-center">
              {dict.noResults}
            </div>
          ) : null}

          {/* Add new client button */}
          <button
            type="button"
            onClick={() => {
              setShowNewForm(true);
              setShowDropdown(false);
              setNewClient(prev => ({ ...prev, name: query }));
            }}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-gold hover:bg-gold/10 transition border-t border-gold/10"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-sm font-medium">{dict.addNew}</span>
          </button>
        </div>
      )}
    </div>
  );
}
