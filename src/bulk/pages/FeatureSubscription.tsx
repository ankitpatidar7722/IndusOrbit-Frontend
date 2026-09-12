import React, { useState, useEffect, useCallback } from 'react';
import {
    getClientDropdown,
    getCompanyFeatureState, getCompanyClientUsers, assignFeature, setFeatureStatus,
    type FeatureCode, type BillingCycle,
    type ClientDropdownItem, type ClientUserDto, type FeatureSubscriptionDto,
} from '../services/api';

/* ════════════════════════════════════════════════════════════════════════
   Sahay & Email Feature Subscriptions (Internal App, indus admins)

   TENANT-LOCAL design (Option A): no plan catalog. Pick a company, then for
   each feature type the plan inline (name / cycle / price / dates) and assign.
   Sahay shows a per-user seat picker with live price; Email is company-wide.

   Backend: FeatureSubscriptionController (writes into the company's own DB).
   ════════════════════════════════════════════════════════════════════════ */

const today = () => new Date().toISOString().slice(0, 10);
const addDays = (d: string, days: number) => {
    const dt = new Date(d); dt.setDate(dt.getDate() + days); return dt.toISOString().slice(0, 10);
};
const inr = (n: number) => `₹${(n || 0).toLocaleString('en-IN')}`;

const card = 'bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm';
const label = 'text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400';
const input = 'w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 focus:outline-none focus:border-blue-500';
const btn = 'px-4 py-2 text-sm font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed';

const CYCLES: BillingCycle[] = ['MONTHLY', 'ANNUAL'];

const FeatureSubscription: React.FC = () => {
    const [clients, setClients] = useState<ClientDropdownItem[]>([]);
    const [companyUserID, setCompanyUserID] = useState('');
    const [state, setState] = useState<{ sahay?: FeatureSubscriptionDto; email?: FeatureSubscriptionDto }>({});

    useEffect(() => {
        getClientDropdown().then((r) => { if (r.success) setClients(r.data); }).catch(() => {});
    }, []);

    const loadState = useCallback(async (cid: string) => {
        if (!cid) { setState({}); return; }
        try { const r = await getCompanyFeatureState(cid); if (r.success) setState({ sahay: r.sahay, email: r.email }); }
        catch { setState({}); }
    }, []);
    useEffect(() => { loadState(companyUserID); }, [companyUserID, loadState]);

    return (
        <div className="p-4 md:p-6 max-w-5xl mx-auto">
            <h1 className="text-xl md:text-2xl font-bold text-gray-800 dark:text-gray-100 mb-1">
                Sahay &amp; Email Subscriptions
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Pick a company, then assign Sahay (per-user) or Email (company-wide). Plan details are entered per company.
            </p>

            <div className={`${card} p-4 mb-5`}>
                <div className={label}>Company</div>
                <select className={`${input} mt-1`} value={companyUserID} onChange={(e) => setCompanyUserID(e.target.value)}>
                    <option value="">— Select a company —</option>
                    {clients.map((c) => (
                        <option key={c.companyUserID} value={c.companyUserID}>
                            {c.companyName} ({c.companyUserID})
                        </option>
                    ))}
                </select>
            </div>

            {companyUserID && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    <FeaturePanel feature="Sahay" companyUserID={companyUserID}
                        current={state.sahay} onChanged={() => loadState(companyUserID)} />
                    <FeaturePanel feature="Email" companyUserID={companyUserID}
                        current={state.email} onChanged={() => loadState(companyUserID)} />
                </div>
            )}
        </div>
    );
};

/* One feature's assign panel — plan typed inline. Sahay shows the seat picker. */
const FeaturePanel: React.FC<{
    feature: FeatureCode; companyUserID: string;
    current?: FeatureSubscriptionDto; onChanged: () => void;
}> = ({ feature, companyUserID, current, onChanged }) => {
    const isSahay = feature === 'Sahay';
    const [planName, setPlanName] = useState('');
    const [billingCycle, setBillingCycle] = useState<BillingCycle>('MONTHLY');
    const [unitPrice, setUnitPrice] = useState<string>('');
    const [startDate, setStartDate] = useState(today());
    const [endDate, setEndDate] = useState(addDays(today(), 30));
    const [users, setUsers] = useState<ClientUserDto[]>([]);
    const [seatIds, setSeatIds] = useState<number[]>([]);
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState('');

    // Seat picker (Sahay only) — load the company's users, pre-check current seats.
    useEffect(() => {
        if (!isSahay) return;
        getCompanyClientUsers(companyUserID).then((r) => {
            if (r.success) {
                setUsers(r.data);
                setSeatIds(r.data.filter((u) => u.isSahayActive).map((u) => u.userID));
            }
        }).catch(() => {});
    }, [isSahay, companyUserID]);

    // Pre-fill from the existing subscription.
    useEffect(() => {
        if (current) {
            setPlanName(current.planName || '');
            setBillingCycle((current.billingCycle as BillingCycle) || 'MONTHLY');
            setUnitPrice(current.unitPrice != null ? String(current.unitPrice) : '');
            setStartDate(current.startDate?.slice(0, 10) || today());
            setEndDate(current.endDate?.slice(0, 10) || addDays(today(), 30));
            if (isSahay && current.seats?.length) setSeatIds(current.seats.map((s) => s.userID));
        }
    }, [current, isSahay]);

    const price = Number(unitPrice) || 0;
    const seatCount = isSahay ? seatIds.length : 0;
    const total = price * (isSahay ? seatCount : 1);

    const toggleSeat = (uid: number) =>
        setSeatIds((s) => (s.includes(uid) ? s.filter((x) => x !== uid) : [...s, uid]));

    const assign = async () => {
        if (!planName.trim()) { setMsg('Enter a plan name.'); return; }
        if (price <= 0) { setMsg('Enter a price.'); return; }
        if (isSahay && seatIds.length === 0) { setMsg('Select at least one user.'); return; }
        setBusy(true); setMsg('');
        try {
            const r = await assignFeature({
                companyUserID, featureCode: feature, planName: planName.trim(),
                billingCycle, unitPrice: price, startDate, endDate,
                seatUserIds: isSahay ? seatIds : [],
            });
            setMsg(r.success ? 'Assigned.' : (r.message || 'Failed.'));
            if (r.success) onChanged();
        } catch (e: any) { setMsg(e?.message || 'Failed.'); }
        finally { setBusy(false); }
    };

    const toggleStatus = async () => {
        if (!current) return;
        const active = current.status !== 'ACTIVE';
        setBusy(true);
        try { const r = await setFeatureStatus(companyUserID, feature, active); setMsg(r.message); if (r.success) onChanged(); }
        catch (e: any) { setMsg(e?.message || 'Failed.'); }
        finally { setBusy(false); }
    };

    return (
        <div className={`${card} p-4`}>
            <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-bold text-gray-800 dark:text-gray-100">{feature}</h2>
                {current && (
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${current.status === 'ACTIVE'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                        : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>
                        {current.status}
                    </span>
                )}
            </div>

            <div className="space-y-3">
                <div>
                    <div className={label}>Plan Name</div>
                    <input className={input} value={planName} onChange={(e) => setPlanName(e.target.value)}
                        placeholder={isSahay ? 'e.g. Sahay Standard' : 'e.g. Email Standard'} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <div className={label}>Billing Cycle</div>
                        <select className={input} value={billingCycle} onChange={(e) => setBillingCycle(e.target.value as BillingCycle)}>
                            {CYCLES.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div>
                        <div className={label}>{isSahay ? 'Price / seat' : 'Price'}</div>
                        <input type="number" className={input} value={unitPrice}
                            onChange={(e) => setUnitPrice(e.target.value)} placeholder="0" />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <div className={label}>Start</div>
                        <input type="date" className={input} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                    </div>
                    <div>
                        <div className={label}>End</div>
                        <input type="date" className={input} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                    </div>
                </div>

                {/* Sahay: multi-select user seats. Email: 'not applicable'. */}
                {isSahay ? (
                    <div>
                        <div className={label}>Users (seats) — {seatCount} selected</div>
                        <div className="mt-1 max-h-44 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-700">
                            {users.map((u) => (
                                <label key={u.userID} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                    <input type="checkbox" checked={seatIds.includes(u.userID)} onChange={() => toggleSeat(u.userID)} />
                                    <span className="text-gray-700 dark:text-gray-200">{u.userName}</span>
                                </label>
                            ))}
                            {users.length === 0 && <div className="px-3 py-3 text-xs text-gray-400">No users found for this company.</div>}
                        </div>
                    </div>
                ) : (
                    <div className="text-xs text-gray-400 italic">Per-user selection not applicable — Email is company-wide.</div>
                )}

                <div className="flex items-center justify-between pt-1">
                    <div className="text-sm text-gray-600 dark:text-gray-300">
                        Total: <span className="font-bold text-gray-900 dark:text-gray-100">{inr(total)}</span>
                        {isSahay && <span className="text-xs text-gray-400"> ({inr(price)} × {seatCount})</span>}
                    </div>
                </div>

                {msg && <div className="text-xs text-blue-600 dark:text-blue-400">{msg}</div>}

                <div className="flex gap-2">
                    <button className={`${btn} bg-blue-600 text-white flex-1`} disabled={busy} onClick={assign}>
                        {busy ? 'Saving…' : current ? 'Update' : 'Assign'}
                    </button>
                    {current && (
                        <button className={`${btn} ${current.status === 'ACTIVE' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' : 'bg-green-100 text-green-700'}`}
                            disabled={busy} onClick={toggleStatus}>
                            {current.status === 'ACTIVE' ? 'Suspend' : 'Resume'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default FeatureSubscription;
