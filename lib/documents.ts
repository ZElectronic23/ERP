// lib/documents.ts — Document types, pricing engine, discount guard, constants

// ═══════════════════════════════════════════════════════════════
// TYPES & CONSTANTS
// ═══════════════════════════════════════════════════════════════

export type DocType = 'OF' | 'IN' | 'VR' | 'REP' | 'HO';

export interface DocTypeConfig {
  key: DocType;
  labelAr: string;
  labelEn: string;
  prefix: string;
  hasItems: boolean;
  hasPayment: boolean;
  hasWarranty: boolean;
  hasVisitFields: boolean;
  hasEquipmentFields: boolean;
  hasHandoverFields: boolean;
  employeeRole: 'Sales' | 'Technician' | 'any';
}

export const DOC_TYPES: Record<DocType, DocTypeConfig> = {
  OF: {
    key: 'OF',
    labelAr: 'عرض سعر',
    labelEn: 'Price Offer',
    prefix: 'ZE-OF',
    hasItems: true,
    hasPayment: true,
    hasWarranty: true,
    hasVisitFields: false,
    hasEquipmentFields: false,
    hasHandoverFields: false,
    employeeRole: 'Sales',
  },
  IN: {
    key: 'IN',
    labelAr: 'فاتورة',
    labelEn: 'Invoice',
    prefix: 'ZE-IN',
    hasItems: true,
    hasPayment: true,
    hasWarranty: true,
    hasVisitFields: false,
    hasEquipmentFields: false,
    hasHandoverFields: false,
    employeeRole: 'Sales',
  },
  VR: {
    key: 'VR',
    labelAr: 'تقرير زيارة فنية',
    labelEn: 'Visit Report',
    prefix: 'ZE-VR',
    hasItems: false,
    hasPayment: false,
    hasWarranty: false,
    hasVisitFields: true,
    hasEquipmentFields: false,
    hasHandoverFields: false,
    employeeRole: 'Technician',
  },
  REP: {
    key: 'REP',
    labelAr: 'تقرير فحص وصيانة',
    labelEn: 'Maintenance Report',
    prefix: 'ZE-REP',
    hasItems: true,
    hasPayment: true,
    hasWarranty: true,
    hasVisitFields: true,
    hasEquipmentFields: true,
    hasHandoverFields: false,
    employeeRole: 'Technician',
  },
  HO: {
    key: 'HO',
    labelAr: 'محضر استلام وتسليم',
    labelEn: 'Handover Certificate',
    prefix: 'ZE-HO',
    hasItems: true,
    hasPayment: false,
    hasWarranty: true,
    hasVisitFields: false,
    hasEquipmentFields: true,
    hasHandoverFields: true,
    employeeRole: 'Technician',
  },
};

export const DOC_TYPE_LIST: DocType[] = ['OF', 'IN', 'VR', 'REP', 'HO'];

// ═══════════════════════════════════════════════════════════════
// COMPANY INFO
// ═══════════════════════════════════════════════════════════════

export const COMPANY = {
  name: 'Z.Electronic',
  nameAr: 'زد إلكترونيك',
  cr: '257524',
  address: '13 AFRICA ST. OFF MOSTAFA EL NAHHAS ST., 10TH DISTRICT, NASR CITY, CAIRO, EGYPT',
  addressAr: '13 شارع أفريقيا - متفرع من شارع مصطفي النحاس - الحي العاشر - مدينة نصر - القاهرة',
  phone: '+20-100-44-963-97',
  email: 'Z.ELECTRONIC23@GMAIL.COM',
  instapay: 'Z.Electronic',
  bank: 'Mashreq Bank',
  bankAccount: '059101479018',
  policyUrl: 'https://sites.google.com/view/zelectronic/ze-client-policies',
  exchangeRate: 53.9474,
  vatRate: 0.14,
  defaultWarrantyMonths: 12,
};

export const BRAND = {
  gold: '#DBA935',
  charcoal: '#3E3B3F',
  silver: '#C0C0C0',
  fontHeading: 'Alata',
  fontBody: 'Cairo',
};

// ═══════════════════════════════════════════════════════════════
// PRICING ENGINE
// ═══════════════════════════════════════════════════════════════

export interface PricingInput {
  directCost: number;
  overheadPct?: number;  // default 0.12
  riskPct?: number;      // default 0
}

export interface PricingOutput {
  directCost: number;
  overheadPct: number;
  riskPct: number;
  loadedCost: number;
  floorPrice: number;
  targetPrice: number;
  minMargin: number;
  targetMargin: number;
  maxDiscountPct: number;
}

export function calculatePricing(input: PricingInput): PricingOutput {
  const overheadPct = input.overheadPct ?? 0.12;
  const riskPct = input.riskPct ?? 0;
  const loadedCost = input.directCost * (1 + overheadPct) * (1 + riskPct);
  const minMargin = 0.10;
  const targetMargin = 0.25;
  const floorPrice = loadedCost / (1 - minMargin);
  const targetPrice = loadedCost / (1 - targetMargin);
  const maxDiscountPct = 1 - (floorPrice / targetPrice);

  return {
    directCost: input.directCost,
    overheadPct,
    riskPct,
    loadedCost: round2(loadedCost),
    floorPrice: round2(floorPrice),
    targetPrice: round2(targetPrice),
    minMargin,
    targetMargin,
    maxDiscountPct: round4(maxDiscountPct),
  };
}

// ═══════════════════════════════════════════════════════════════
// DISCOUNT GUARD
// ═══════════════════════════════════════════════════════════════

export interface DiscountCheck {
  allowed: boolean;
  requestedPct: number;
  maxAllowedPct: number;
  finalPrice: number;
  floorPrice: number;
  margin: number;
}

export function checkDiscount(
  targetPrice: number,
  floorPrice: number,
  requestedDiscountPct: number
): DiscountCheck {
  const maxAllowedPct = 1 - (floorPrice / targetPrice);
  const allowed = requestedDiscountPct <= maxAllowedPct + 0.0001; // tiny epsilon
  const finalPrice = targetPrice * (1 - requestedDiscountPct);
  const loadedCost = floorPrice * (1 - 0.10); // reverse min margin
  const margin = finalPrice > 0 ? 1 - (loadedCost / finalPrice) : 0;

  return {
    allowed,
    requestedPct: requestedDiscountPct,
    maxAllowedPct: round4(maxAllowedPct),
    finalPrice: round2(finalPrice),
    floorPrice,
    margin: round4(margin),
  };
}

// ═══════════════════════════════════════════════════════════════
// LINE ITEM CALCULATIONS
// ═══════════════════════════════════════════════════════════════

export interface LineItem {
  id: string;
  sortOrder: number;
  itemType: 'product' | 'service' | 'custom';
  itemId: string | null;
  itemName: string;
  itemUnit: string;
  category: string;
  quantity: number;
  unitPrice: number;
  floorPrice: number;
  targetPrice: number;
  discountPct: number;
  discountAmount: number;
  lineTotal: number;
  condition?: string;
  actionTaken?: string;
  notes?: string;
}

export function calculateLineItem(
  item: Partial<LineItem> & { quantity: number; unitPrice: number; discountPct?: number; floorPrice?: number; targetPrice?: number }
): Pick<LineItem, 'discountAmount' | 'lineTotal'> & { discountAllowed: boolean } {
  const discountPct = item.discountPct ?? 0;
  const subtotal = item.quantity * item.unitPrice;
  const discountAmount = round2(subtotal * discountPct);
  const lineTotal = round2(subtotal - discountAmount);

  // Check discount guard if pricing data available
  let discountAllowed = true;
  if (item.floorPrice && item.targetPrice && item.targetPrice > 0) {
    const maxDiscount = 1 - (item.floorPrice / item.targetPrice);
    discountAllowed = discountPct <= maxDiscount + 0.0001;
  }

  return { discountAmount, lineTotal, discountAllowed };
}

export function calculateDocumentTotals(
  items: LineItem[],
  vatEnabled: boolean,
  vatRate: number = COMPANY.vatRate
): { subtotal: number; totalDiscount: number; vatAmount: number; total: number } {
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const totalDiscount = items.reduce((sum, item) => sum + item.discountAmount, 0);
  const afterDiscount = subtotal - totalDiscount;
  const vatAmount = vatEnabled ? round2(afterDiscount * vatRate) : 0;
  const total = round2(afterDiscount + vatAmount);

  return { subtotal: round2(subtotal), totalDiscount: round2(totalDiscount), vatAmount, total };
}

// ═══════════════════════════════════════════════════════════════
// DOCUMENT STATUS OPTIONS
// ═══════════════════════════════════════════════════════════════

export const OFFER_STATUSES = [
  { value: 'draft', labelAr: 'مسودة', labelEn: 'Draft' },
  { value: 'sent', labelAr: 'مرسل', labelEn: 'Sent' },
  { value: 'accepted', labelAr: 'مقبول', labelEn: 'Accepted' },
  { value: 'rejected', labelAr: 'مرفوض', labelEn: 'Rejected' },
  { value: 'expired', labelAr: 'منتهي', labelEn: 'Expired' },
] as const;

export const PAYMENT_STATUSES = [
  { value: 'unpaid', labelAr: 'غير مدفوع', labelEn: 'Unpaid' },
  { value: 'partial', labelAr: 'مدفوع جزئياً', labelEn: 'Partially Paid' },
  { value: 'paid', labelAr: 'مدفوع', labelEn: 'Paid' },
  { value: 'overdue', labelAr: 'متأخر', labelEn: 'Overdue' },
] as const;

export const PAYMENT_METHODS = [
  { value: 'cash', labelAr: 'نقدي', labelEn: 'Cash' },
  { value: 'bank_transfer', labelAr: 'تحويل بنكي', labelEn: 'Bank Transfer' },
  { value: 'instapay', labelAr: 'انستاباي', labelEn: 'Instapay' },
  { value: 'cheque', labelAr: 'شيك', labelEn: 'Cheque' },
  { value: 'credit', labelAr: 'آجل', labelEn: 'Credit' },
] as const;

export const DOC_STATUSES = [
  { value: 'draft', labelAr: 'مسودة', labelEn: 'Draft' },
  { value: 'active', labelAr: 'نشط', labelEn: 'Active' },
  { value: 'completed', labelAr: 'مكتمل', labelEn: 'Completed' },
  { value: 'cancelled', labelAr: 'ملغي', labelEn: 'Cancelled' },
] as const;

export const EQUIPMENT_STATUSES = [
  { value: 'working', labelAr: 'يعمل', labelEn: 'Working' },
  { value: 'needs_repair', labelAr: 'يحتاج إصلاح', labelEn: 'Needs Repair' },
  { value: 'not_working', labelAr: 'لا يعمل', labelEn: 'Not Working' },
  { value: 'replaced', labelAr: 'تم الاستبدال', labelEn: 'Replaced' },
] as const;

// ═══════════════════════════════════════════════════════════════
// DOCUMENT INTERFACE
// ═══════════════════════════════════════════════════════════════

export interface DocumentData {
  id?: string;
  doc_number?: string;
  doc_type: DocType;
  doc_date: string;
  client_id: string | null;
  project_id: string | null;
  created_by: string | null;
  assigned_employee: string | null;
  subtotal: number;
  discount_pct: number;
  discount_amount: number;
  vat_enabled: boolean;
  vat_pct: number;
  vat_amount: number;
  total: number;
  currency: string;
  exchange_rate: number;
  valid_until: string | null;
  offer_status: string | null;
  payment_status: string | null;
  payment_method: string | null;
  due_date: string | null;
  paid_amount: number;
  visit_date: string | null;
  visit_location: string | null;
  findings: string | null;
  recommendations: string | null;
  equipment_status: string | null;
  handover_from: string | null;
  handover_to: string | null;
  warranty_months: number;
  warranty_start: string | null;
  warranty_end: string | null;
  parent_doc_id: string | null;
  linked_doc_ids: string[];
  notes: string | null;
  internal_notes: string | null;
  terms: string | null;
  status: string;
  items: LineItem[];
}

export function createEmptyDocument(docType: DocType): DocumentData {
  const today = new Date().toISOString().slice(0, 10);
  const config = DOC_TYPES[docType];
  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + 30);

  return {
    doc_type: docType,
    doc_date: today,
    client_id: null,
    project_id: null,
    created_by: null,
    assigned_employee: null,
    subtotal: 0,
    discount_pct: 0,
    discount_amount: 0,
    vat_enabled: false,
    vat_pct: COMPANY.vatRate,
    vat_amount: 0,
    total: 0,
    currency: 'EGP',
    exchange_rate: COMPANY.exchangeRate,
    valid_until: config.key === 'OF' ? validUntil.toISOString().slice(0, 10) : null,
    offer_status: config.key === 'OF' ? 'draft' : null,
    payment_status: config.hasPayment ? 'unpaid' : null,
    payment_method: null,
    due_date: null,
    paid_amount: 0,
    visit_date: config.hasVisitFields ? today : null,
    visit_location: null,
    findings: null,
    recommendations: null,
    equipment_status: config.hasEquipmentFields ? 'working' : null,
    handover_from: null,
    handover_to: null,
    warranty_months: COMPANY.defaultWarrantyMonths,
    warranty_start: config.hasWarranty ? today : null,
    warranty_end: config.hasWarranty
      ? new Date(new Date().setMonth(new Date().getMonth() + COMPANY.defaultWarrantyMonths)).toISOString().slice(0, 10)
      : null,
    parent_doc_id: null,
    linked_doc_ids: [],
    notes: null,
    internal_notes: null,
    terms: getDefaultTerms(docType),
    status: 'draft',
    items: [],
  };
}

function getDefaultTerms(docType: DocType): string {
  switch (docType) {
    case 'OF':
      return 'العرض ساري لمدة 30 يوم من تاريخ الإصدار\nالأسعار لا تشمل ضريبة القيمة المضافة إلا إذا تم تفعيلها\nالضمان يبدأ من تاريخ التسليم والتركيب\nسياسة Z.Electronic للعملاء تنطبق على هذا العرض';
    case 'IN':
      return 'يرجى السداد خلال المدة المحددة\nسياسة Z.Electronic للعملاء تنطبق على هذه الفاتورة';
    case 'VR':
      return 'هذا التقرير يوثق الزيارة الفنية والملاحظات والتوصيات';
    case 'REP':
      return 'هذا التقرير يوثق عملية الفحص والصيانة\nالضمان على الأعمال المنفذة حسب البنود المذكورة';
    case 'HO':
      return 'تم التسليم والاستلام بالحالة الموضحة أعلاه\nالضمان يبدأ من تاريخ التوقيع على هذا المحضر';
    default:
      return '';
  }
}

// ═══════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

export function formatCurrency(amount: number, locale: string = 'ar'): string {
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function getDocTypeLabel(docType: DocType, locale: string): string {
  const config = DOC_TYPES[docType];
  return locale === 'ar' ? config.labelAr : config.labelEn;
}
