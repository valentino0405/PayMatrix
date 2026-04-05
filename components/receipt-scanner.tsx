'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import Tesseract from 'tesseract.js';
import { GroupType, SplitType, useStore } from '@/lib/store';
import {
  CheckCircle2,
  FileImage,
  Loader2,
  Plus,
  ScanLine,
  Upload,
  X,
} from 'lucide-react';

/* ─── Types ─────────────────────────────────────────────── */
interface ParsedReceipt {
  amount: string;
  date: string;
  description: string;
  confidence: number;
  isGSTBill: boolean;
}

const GROUP_TYPES: GroupType[] = ['Trip', 'Roommates', 'Event', 'Other'];

/**
 * Intelligent OCR Normalization
 * Fixes common Tesseract misreadings based on context.
 */
function normalizeOCRText(text: string): string {
  return text
    .replace(/\bT0TAL\b/gi, 'TOTAL')
    .replace(/\b5GST\b/gi, 'SGST')
    .replace(/\bC6ST\b/gi, 'CGST')
    .replace(/\b1NR\b/gi, 'INR')
    .replace(/\bGRANO\b/gi, 'GRAND')
    .replace(/(\d)\s+([,\.])\s+(\d)/g, '$1$2$3') // Fix split decimals
    .replace(/\bO(\d)/g, '0$1') // O followed by digit -> 0
    .replace(/(\d)O\b/g, '$10'); // Digit followed by O -> 0
}

function parseReceiptText(rawText: string): ParsedReceipt {
  const text = normalizeOCRText(rawText);
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  /* ── Intelligent Amount Extraction ──────────────────────────────────── */

  const findAmountAfterLabel = (keywords: string[]): { val: number; str: string } => {
    const labelRegex = new RegExp(`(?:${keywords.join('|')})`, 'i');
    // Prefer decimals but also allow whole numbers. Increased robustness for Indian symbols.
    const amtRegex = /(?:₹|rs\.?|inr|\/-)?\s*([\d,]+\.\d{2}|[\d,]+)/gi;

    let bestVal = 0;
    let foundStr = '';

    for (let i = 0; i < lines.length; i++) {
      if (labelRegex.test(lines[i])) {
        // Line found. Search context: this line + next line
        const context = lines[i] + (i + 1 < lines.length ? ' ' + lines[i + 1] : '');
        const matches = [...context.matchAll(amtRegex)];

        for (const m of matches) {
          const val = parseFloat(m[1].replace(/,/g, ''));
          // In receipts, the "Total" we want is almost always the LARGEST value associated with the label.
          // This prevents "Total Items: 3" from beating "Total Amount: 968.00".
          if (!isNaN(val) && val > bestVal) {
            bestVal = val;
            foundStr = m[1].replace(/,/g, '');
          }
        }
      }
    }
    return { val: bestVal, str: foundStr };
  };

  // 1. Identify specific tax components to help validation
  const subtotalLine = findAmountAfterLabel(['sub[-\\s]?total', 'gross\\s*amount']);
  const cgstLine = findAmountAfterLabel(['cgst', 'central\\s*gst']);
  const sgstLine = findAmountAfterLabel(['sgst', 'state\\s*gst']);
  const igstLine = findAmountAfterLabel(['igst', 'integrated\\s*gst']);

  // 2. Identify Total Candidates
  // High confidence keywords
  const grandTotal = findAmountAfterLabel(['grand\\s*total', 'net\\s*payable', 'round\\s*off', 'net\\s*to\\s*pay', 'invoice\\s*value', 'amount\\s*payable', 'payable\\s*amount']);
  
  // Medium confidence (can be ambiguous)
  const genericTotal = findAmountAfterLabel(['total\\s*amount', 'amount\\s*due', 'bill\\s*total', '\\btotal\\b(?!\\s*items)']);

  let amount = '';
  let confidence = 0.3;
  const isGSTBill = !!(cgstLine.val || sgstLine.val || igstLine.val || /\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Zz]{1}[A-Z\d]{1}/.test(text));

  // Determine final amount with intelligence
  if (grandTotal.val > 0) {
    amount = grandTotal.str;
    confidence = 0.9;
  } else if (genericTotal.val > 0) {
    amount = genericTotal.str;
    confidence = 0.7;
  } else {
    // Fallback: Max value in the whole bill (statistically likely to be the total)
    const allMatches = [...text.matchAll(/(?:₹|rs\.?|inr|\/-)?\s*([\d,]+\.\d{2})/gi)];
    let globalMax = 0;
    let globalStr = '';
    
    allMatches.forEach(m => {
      const v = parseFloat(m[1].replace(/,/g, ''));
      if (v > globalMax) {
        globalMax = v;
        globalStr = m[1].replace(/,/g, '');
      }
    });

    if (globalMax > 0) {
      amount = globalStr;
      confidence = 0.4;
    }
  }

  // 3. Mathematical Validation (Cross-check Subtotal + Taxes)
  if (amount && (cgstLine.val || sgstLine.val || subtotalLine.val)) {
    const currentAmt = parseFloat(amount);
    const expected = subtotalLine.val + cgstLine.val + sgstLine.val + igstLine.val;
    // Boost confidence if math matches (within 2 INR for rounding)
    if (Math.abs(currentAmt - expected) < 2) {
      confidence = 1.0;
    }
  }

  /* Date Extraction (Robust for Indian Formats) */
  let date = '';
  const datePatterns = [
    // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY (very common in India)
    /\b(\d{1,2}\s*[\/\-\.]\s*\d{1,2}\s*[\/\-\.]\s*\d{2,4})\b/,
    // YYYY/MM/DD
    /\b(\d{4}\s*[\/\-\.]\s*\d{2}\s*[\/\-\.]\s*\d{2})\b/,
    // DD-MMM-YYYY (e.g. 23 - Jan - 2025 or 05-Apr-24)
    /\b(\d{1,2}\s*[\/\-\.\s]\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*[\/\-\.\s,]\s*\d{2,4})\b/i,
    // MMM DD, YYYY
    /\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*[\/\-\.\s]\s*\d{1,2}\s*,?\s*[\/\-\.\s]\s*\d{2,4})\b/i,
  ];

  // Try finding a date near a "Date" label first (highest accuracy)
  const dateLabelRegex = /(?:date|dt|dated|on)\s*[:\-\s]*\s*/i;
  for (let i = 0; i < lines.length; i++) {
    if (dateLabelRegex.test(lines[i])) {
      for (const pat of datePatterns) {
        const m = lines[i].match(pat);
        if (m) { date = m[1]; break; }
        // Also check next line if label is alone
        if (i + 1 < lines.length) {
          const m2 = lines[i + 1].match(pat);
          if (m2) { date = m2[1]; break; }
        }
      }
      if (date) break;
    }
  }

  // Global search fallback if no label matched
  if (!date) {
    for (const pat of datePatterns) {
      const m = text.match(pat);
      if (m) {
        // Filter out obvious noise (like very old dates or future dates)
        const yearPart = m[1].match(/\d{4}$|\d{2}$/);
        const year = yearPart ? parseInt(yearPart[0]) : 0;
        if (year > 20 || year > 2020) { // Assume 2020+ or 2-digit 20+
          date = m[1];
          break;
        }
      }
    }
  }

  // Clean up date string (replace . with / for consistency)
  if (date) date = date.replace(/\./g, '/').trim();

  /* Description/Merchant Name Extraction */
  const headerLines = lines.slice(0, 4).filter(l =>
    l.length > 3 &&
    !/invoice/i.test(l) &&
    !/bill/i.test(l) &&
    !/cash/i.test(l) &&
    !/order/i.test(l) &&
    !/store/i.test(l)
  );
  const description = headerLines[0] || 'Scanned Receipt';

  return { amount, date, description, confidence, isGSTBill };
}

/* ─── Component ───────────────────────────────────────────── */
export default function ReceiptScanner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { groups, addExpense, addGroup } = useStore();
  const inputRef = useRef<HTMLInputElement>(null);

  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [rawText, setRawText] = useState('');
  const [parsed, setParsed] = useState<ParsedReceipt | null>(null);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [selectedPayerId, setSelectedPayerId] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [splitType, setSplitType] = useState<SplitType>('equal');
  const [splitInputs, setSplitInputs] = useState<Record<string, string>>({});
  const [amountInput, setAmountInput] = useState('');
  const [descriptionInput, setDescriptionInput] = useState('');
  const [savingExpense, setSavingExpense] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupType, setNewGroupType] = useState<GroupType>('Other');
  const [newMembers, setNewMembers] = useState([{ name: '' }, { name: '' }]);

  const groupIdFromQuery = searchParams.get('groupId') ?? '';
  const forcedGroup = groupIdFromQuery ? groups.find((g) => g.id === groupIdFromQuery) : undefined;
  const isGroupLocked = Boolean(forcedGroup);

  const selectedGroup = groups.find((g) => g.id === selectedGroupId);

  const getDefaultSplitInputs = (memberIds: string[], mode: SplitType, amount: number) => {
    const next: Record<string, string> = {};
    if (memberIds.length === 0 || mode === 'equal') return next;
    if (mode === 'percentage') {
      const eachPct = (100 / memberIds.length).toFixed(2);
      memberIds.forEach((id) => { next[id] = eachPct; });
      return next;
    }
    const eachAmt = (amount / memberIds.length).toFixed(2);
    memberIds.forEach((id) => { next[id] = eachAmt; });
    return next;
  };

  /* ── file handling ── */
  const loadFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file (JPEG, PNG, WEBP, etc.).');
      return;
    }
    setError('');
    setRawText('');
    setParsed(null);
    setProgress(0);
    setProgressLabel('');
    setFileName(file.name);
    const url = URL.createObjectURL(file);
    setPreview(url);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadFile(file);
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) loadFile(file);
  }, []);

  /* ── scan ── */
  const handleScan = async () => {
    if (!preview) return;
    setScanning(true);
    setError('');
    setProgress(0);
    setProgressLabel('Initialising…');

    try {
      const result = await Tesseract.recognize(preview, 'eng', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setProgress(Math.round((m.progress ?? 0) * 100));
            setProgressLabel(`Recognising text… ${Math.round((m.progress ?? 0) * 100)}%`);
          } else {
            setProgressLabel(m.status ?? '');
          }
        },
      });
      const text = result.data.text;
      const parsedResult = parseReceiptText(text);
      setRawText(text);
      setParsed(parsedResult);
      setAmountInput(parsedResult.amount);
      setDescriptionInput(parsedResult.description);
      setProgress(100);
      setProgressLabel('Done!');
    } catch (err) {
      setError(`OCR failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setScanning(false);
    }
  };

  /* ── choose group and setup default split ── */
  const handleGroupChange = (groupId: string) => {
    setSelectedGroupId(groupId);
    const nextGroup = groups.find((g) => g.id === groupId);
    if (!nextGroup || nextGroup.members.length === 0) {
      setSelectedPayerId('');
      setSelectedMemberIds([]);
      setSplitInputs({});
      return;
    }
    const memberIds = nextGroup.members.map((m) => m.id);
    const parsedAmount = Number.parseFloat(amountInput) || 0;
    setSelectedPayerId(nextGroup.members[0].id);
    setSelectedMemberIds(memberIds);
    setSplitInputs(getDefaultSplitInputs(memberIds, splitType, parsedAmount));
  };

  const handleSplitTypeChange = (mode: SplitType) => {
    const activeMemberIds = selectedMemberIds.length > 0
      ? selectedMemberIds
      : (selectedGroup?.members.map((m) => m.id) ?? []);
    if (activeMemberIds.length > 0 && selectedMemberIds.length === 0) {
      setSelectedMemberIds(activeMemberIds);
    }
    setSplitType(mode);
    const parsedAmount = Number.parseFloat(amountInput) || 0;
    setSplitInputs(getDefaultSplitInputs(activeMemberIds, mode, parsedAmount));
  };

  const handleCreateGroupFromScan = async () => {
    if (isGroupLocked) return;
    const validMembers = newMembers.map((m) => ({ name: m.name.trim() })).filter((m) => m.name);
    if (!newGroupName.trim()) {
      setError('Enter a name for the new group.');
      return;
    }
    if (validMembers.length < 2) {
      setError('Add at least 2 members to create a group from scan.');
      return;
    }
    setCreatingGroup(true);
    setError('');
    try {
      const created = await addGroup({
        name: newGroupName.trim(),
        type: newGroupType,
        members: validMembers,
        createdViaScan: true,
      });
      setShowCreateGroup(false);
      setNewGroupName('');
      setNewGroupType('Other');
      setNewMembers([{ name: '' }, { name: '' }]);
      const memberIds = created.members.map((m) => m.id);
      const parsedAmount = Number.parseFloat(amountInput) || 0;
      setSelectedGroupId(created.id);
      setSelectedPayerId(created.members[0]?.id ?? '');
      setSelectedMemberIds(memberIds);
      setSplitInputs(getDefaultSplitInputs(memberIds, splitType, parsedAmount));
    } catch {
      setError('Failed to create group from scan.');
    } finally {
      setCreatingGroup(false);
    }
  };

  /* ── save scanned expense directly to selected group ── */
  const handleUseData = async () => {
    if (!parsed) return;

    const amount = Number.parseFloat(amountInput);
    const finalDescription = descriptionInput.trim();

    if (!selectedGroupId) {
      setError('Select a group to add this expense.');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Enter a valid amount before saving.');
      return;
    }
    if (!finalDescription) {
      setError('Description is required.');
      return;
    }
    if (!selectedPayerId) {
      setError('Select who paid.');
      return;
    }
    const activeMemberIds = selectedMemberIds.length > 0
      ? selectedMemberIds
      : (selectedGroup?.members.map((m) => m.id) ?? []);

    if (activeMemberIds.length === 0) {
      setError('Select at least one member to split with.');
      return;
    }

    let splits: { memberId: string; amount: number }[] = [];

    if (splitType === 'equal') {
      const perPerson = Math.round((amount / activeMemberIds.length) * 100) / 100;
      splits = activeMemberIds.map((memberId, index) => {
        if (index === activeMemberIds.length - 1) {
          const assigned = Math.round((perPerson * (activeMemberIds.length - 1)) * 100) / 100;
          return { memberId, amount: Math.round((amount - assigned) * 100) / 100 };
        }
        return { memberId, amount: perPerson };
      });
    } else if (splitType === 'percentage') {
      const pctValues = activeMemberIds.map((id) => Number.parseFloat(splitInputs[id] || '0'));
      const pctSum = pctValues.reduce((s, v) => s + v, 0);
      if (!pctValues.every((v) => Number.isFinite(v) && v >= 0)) {
        setError('Enter valid percentage values for selected members.');
        return;
      }
      if (Math.abs(pctSum - 100) > 0.5) {
        setError(`Percentage split must add to 100% (currently ${pctSum.toFixed(1)}%).`);
        return;
      }
      splits = activeMemberIds.map((memberId, index) => {
        if (index === activeMemberIds.length - 1) {
          const assigned = activeMemberIds.slice(0, -1).reduce((s, id) => {
            const pct = Number.parseFloat(splitInputs[id] || '0');
            return s + (pct / 100) * amount;
          }, 0);
          return { memberId, amount: Math.round((amount - assigned) * 100) / 100 };
        }
        const pct = Number.parseFloat(splitInputs[memberId] || '0');
        return { memberId, amount: Math.round(((pct / 100) * amount) * 100) / 100 };
      });
    } else {
      const values = activeMemberIds.map((id) => Number.parseFloat(splitInputs[id] || '0'));
      const sum = values.reduce((s, v) => s + v, 0);
      if (!values.every((v) => Number.isFinite(v) && v >= 0)) {
        setError('Enter valid unequal split amounts.');
        return;
      }
      if (Math.abs(sum - amount) > 0.5) {
        setError(`Unequal split must add to ₹${amount.toFixed(2)} (currently ₹${sum.toFixed(2)}).`);
        return;
      }
      splits = activeMemberIds.map((memberId) => ({
        memberId,
        amount: Math.round((Number.parseFloat(splitInputs[memberId] || '0')) * 100) / 100,
      }));
    }

    setSavingExpense(true);
    setError('');
    try {
      await addExpense({
        groupId: selectedGroupId,
        description: finalDescription,
        amount,
        paidBy: selectedPayerId,
        splitType,
        splits,
        category: 'Other',
      });
      router.push(`/groups/${selectedGroupId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save expense');
    } finally {
      setSavingExpense(false);
    }
  };

  /* ── clear ── */
  const handleClear = () => {
    setPreview(null);
    setFileName('');
    setRawText('');
    setParsed(null);
    setProgress(0);
    setProgressLabel('');
    setError('');
    setAmountInput('');
    setDescriptionInput('');
    setSelectedGroupId('');
    setSelectedPayerId('');
    setSelectedMemberIds([]);
    setSplitType('equal');
    setSplitInputs({});
    setShowCreateGroup(false);
    setCreatingGroup(false);
    setNewGroupName('');
    setNewGroupType('Other');
    setNewMembers([{ name: '' }, { name: '' }]);
    if (inputRef.current) inputRef.current.value = '';

    if (forcedGroup) {
      const memberIds = forcedGroup.members.map((m) => m.id);
      setSelectedGroupId(forcedGroup.id);
      setSelectedPayerId(forcedGroup.members[0]?.id ?? '');
      setSelectedMemberIds(memberIds);
    }
  };

  // If scan is opened from a group page, preselect and lock that group.
  useEffect(() => {
    if (!forcedGroup) return;
    if (selectedGroupId === forcedGroup.id && selectedMemberIds.length > 0) return;
    const memberIds = forcedGroup.members.map((m) => m.id);
    const parsedAmount = Number.parseFloat(amountInput) || 0;
    setSelectedGroupId(forcedGroup.id);
    setSelectedPayerId(forcedGroup.members[0]?.id ?? '');
    setSelectedMemberIds(memberIds);
    setSplitInputs(getDefaultSplitInputs(memberIds, splitType, parsedAmount));
  }, [forcedGroup, selectedGroupId, selectedMemberIds.length, amountInput, splitType]);

  /* ─── Render ─────────────────────────────────────────── */
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">

      {/* ── Drop Zone ── */}
      <div
        id="receipt-dropzone"
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={[
          'relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-10 transition-colors',
          dragging
            ? 'border-indigo-500/60 bg-indigo-500/10'
            : 'border-white/15 bg-white/3 hover:border-indigo-500/50 hover:bg-white/6',
        ].join(' ')}
      >
        <input
          ref={inputRef}
          id="receipt-file-input"
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
        {preview ? (
          <>
            {/* preview thumbnail */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="Receipt preview"
              className="max-h-56 rounded-xl object-contain shadow-md"
            />
            <p className="flex items-center gap-1.5 text-sm text-slate-500">
              <FileImage className="h-4 w-4 text-indigo-400" />
              {fileName}
            </p>
            <button
              id="receipt-clear-btn"
              type="button"
              onClick={(e) => { e.stopPropagation(); handleClear(); }}
              className="absolute right-3 top-3 rounded-full bg-white/10 p-1 text-slate-300 hover:bg-rose-500/20 hover:text-rose-400"
              aria-label="Remove image"
            >
              <X className="h-4 w-4" />
            </button>
          </>
        ) : (
          <>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/15 text-indigo-300">
              <Upload className="h-6 w-6" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-white">
                Drag &amp; drop a receipt image here
              </p>
              <p className="mt-1 text-xs text-slate-500">
                or click to browse — JPEG, PNG, WEBP supported
              </p>
            </div>
          </>
        )}
      </div>

      {/* ── Scan Button ── */}
      {preview && !scanning && !parsed && (
        <button
          id="receipt-scan-btn"
          type="button"
          onClick={handleScan}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 active:scale-[0.98]"
        >
          <ScanLine className="h-4 w-4" />
          Scan Receipt
        </button>
      )}

      {/* ── Progress ── */}
      {scanning && (
        <div id="receipt-progress" className="space-y-2 rounded-2xl border border-white/10 bg-white/4 p-5">
          <div className="flex items-center gap-2 text-sm font-medium text-white">
            <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
            {progressLabel || 'Processing…'}
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-indigo-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <p id="receipt-error" className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </p>
      )}

      {/* ── Results ── */}
      {parsed && (
        <div id="receipt-results" className="space-y-5 rounded-2xl border border-white/10 bg-white/4 p-6 shadow-sm">
          <div className="flex items-center gap-2 text-emerald-400">
            <CheckCircle2 className="h-5 w-5" />
            <h2 className="font-semibold">Receipt Scanned Successfully</h2>
          </div>

          {/* Parsed fields */}
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { label: 'Amount', value: amountInput, id: 'result-amount' },
              { label: 'Date', value: parsed.date, id: 'result-date' },
              { label: 'Description', value: descriptionInput, id: 'result-description' },
            ].map(({ label, value, id }) => (
              <div key={label} className="rounded-xl border border-white/10 bg-white/3 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</p>
                <p id={id} className="mt-1 truncate text-sm font-semibold text-white">
                  {value || <span className="font-normal italic text-slate-500">Not detected</span>}
                </p>
              </div>
            ))}
          </div>

          {/* Editable fields + group binding */}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Amount (INR)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/60"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Group</span>
              <select
                value={selectedGroupId}
                onChange={(e) => handleGroupChange(e.target.value)}
                disabled={isGroupLocked}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/60 disabled:opacity-70"
              >
                <option value="">Select a group</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>{group.name}</option>
                ))}
              </select>
              {isGroupLocked && (
                <p className="text-[11px] text-indigo-500">Group is preselected from the group page.</p>
              )}
            </label>
          </div>

          {!isGroupLocked && (
          <div className="rounded-xl border border-white/10 bg-white/3 p-3">
            <button
              type="button"
              onClick={() => setShowCreateGroup((v) => !v)}
              className="text-sm font-semibold text-indigo-300 hover:text-indigo-200"
            >
              {showCreateGroup ? 'Hide quick create group' : 'No matching group? Create one from Scan'}
            </button>

            {showCreateGroup && (
              <div className="mt-3 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Group name</span>
                    <input
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/60"
                      placeholder="e.g. Office Lunch"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Type</span>
                    <select
                      value={newGroupType}
                      onChange={(e) => setNewGroupType(e.target.value as GroupType)}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/60"
                    >
                      {GROUP_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </label>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Members (min 2)</p>
                  {newMembers.map((m, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        value={m.name}
                        onChange={(e) => setNewMembers((prev) => prev.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x))}
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/60"
                        placeholder={`Member ${i + 1} name`}
                      />
                      {newMembers.length > 2 && (
                        <button
                          type="button"
                          onClick={() => setNewMembers((prev) => prev.filter((_, idx) => idx !== i))}
                          className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-400 hover:text-rose-400"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setNewMembers((prev) => [...prev, { name: '' }])}
                    className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add member
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleCreateGroupFromScan()}
                    disabled={creatingGroup}
                    className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-500 disabled:opacity-70"
                  >
                    {creatingGroup ? 'Creating...' : 'Create Group & Select'}
                  </button>
                </div>
              </div>
            )}
          </div>
          )}

          <label className="space-y-1 block">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Description</span>
            <input
              type="text"
              value={descriptionInput}
              onChange={(e) => setDescriptionInput(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/60"
            />
          </label>

          {selectedGroup && (
            <div className="space-y-3 rounded-xl border border-white/10 bg-white/3 p-4">
              <label className="space-y-1 block">
                <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Paid by</span>
                <select
                  value={selectedPayerId}
                  onChange={(e) => setSelectedPayerId(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/60"
                >
                  {selectedGroup.members.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </label>

              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Split mode</p>
                <div className="grid grid-cols-3 gap-2">
                  {(['equal', 'unequal', 'percentage'] as SplitType[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => handleSplitTypeChange(mode)}
                      className={`rounded-lg border px-2 py-2 text-xs font-semibold capitalize transition-all ${splitType === mode ? 'border-indigo-500/60 bg-indigo-500/20 text-indigo-300' : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'}`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Split members</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {selectedGroup.members.map((m) => {
                    const checked = selectedMemberIds.includes(m.id);
                    return (
                      <label key={m.id} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedMemberIds((prev) => {
                                const next = [...prev, m.id];
                                const parsedAmount = Number.parseFloat(amountInput) || 0;
                                if (splitType !== 'equal') {
                                  setSplitInputs(getDefaultSplitInputs(next, splitType, parsedAmount));
                                }
                                return next;
                              });
                            } else {
                              setSelectedMemberIds((prev) => {
                                const next = prev.filter((id) => id !== m.id);
                                const parsedAmount = Number.parseFloat(amountInput) || 0;
                                if (splitType !== 'equal') {
                                  setSplitInputs(getDefaultSplitInputs(next, splitType, parsedAmount));
                                }
                                return next;
                              });
                            }
                          }}
                        />
                        <span>{m.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {splitType !== 'equal' && selectedMemberIds.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                    {splitType === 'percentage' ? 'Percentage per member' : 'Amount per member'}
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {selectedGroup.members.filter((m) => selectedMemberIds.includes(m.id)).map((m) => (
                      <label key={m.id} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200">
                        <span className="min-w-0 flex-1 truncate">{m.name}</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={splitInputs[m.id] ?? ''}
                          onChange={(e) => setSplitInputs((prev) => ({ ...prev, [m.id]: e.target.value }))}
                          className="w-24 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-right text-xs text-white outline-none focus:border-indigo-500/60"
                        />
                        <span className="text-xs text-slate-500">{splitType === 'percentage' ? '%' : 'INR'}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Raw text collapsible */}
          <details className="text-sm">
            <summary className="cursor-pointer select-none text-slate-400 hover:text-slate-300">
              Show raw extracted text
            </summary>
            <pre className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg border border-white/10 bg-white/3 p-3 text-xs leading-relaxed text-slate-300">
              {rawText}
            </pre>
          </details>

          {/* Actions */}
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              id="receipt-use-data-btn"
              type="button"
              onClick={handleUseData}
              disabled={savingExpense}
              className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {savingExpense ? 'Saving...' : 'Use This Data → Add Expense'}
            </button>
            <button
              id="receipt-rescan-btn"
              type="button"
              onClick={handleClear}
              className="rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/10"
            >
              Scan Another
            </button>
            <Link
              id="receipt-home-btn"
              href="/"
              className="flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/10"
            >
              🏠 Back to Home
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
