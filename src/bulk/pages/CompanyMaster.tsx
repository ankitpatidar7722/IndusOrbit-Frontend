import React, { useState, useEffect } from 'react';
import { 
    Building2, Save, Edit2, Loader2, X, Info, Factory, Receipt, 
    Calculator, Settings2, CheckCircle2, Wrench, Cpu, RefreshCw, 
    MessageSquare, Megaphone, Printer, Tag, MapPin, Phone, 
    ShieldCheck, Settings, BarChart3, Monitor, Zap, Layers
} from 'lucide-react';
import { getCompany, updateCompany, CompanyDto } from '../services/api';
import { useMessageModal } from '../components/MessageModal';

// ─── Reusable UI Components ──────────────────────────────────────────────────

function Toggle({ name, checked, onChange }: { name: string; checked: boolean; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }) {
    return (
        <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" name={name} checked={checked} onChange={onChange} className="sr-only peer" />
            <div className="w-10 h-5 bg-gray-300 dark:bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-400 rounded-full peer peer-checked:after:translate-x-5 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600 transition-colors" />
        </label>
    );
}

function StatusBadge({ value }: { value: boolean }) {
    return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full ${value ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>
            {value ? '✓ Enabled' : '✕ Disabled'}
        </span>
    );
}

interface FormFieldProps {
    label: string;
    name: keyof CompanyDto;
    type?: 'text' | 'email' | 'number' | 'textarea' | 'password';
    required?: boolean;
    formData: CompanyDto;
    company: CompanyDto;
    isEditing: boolean;
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

const FormField: React.FC<FormFieldProps> = ({ label, name, type = 'text', required = false, formData, company, isEditing, onChange }) => {
    const val = formData[name];
    const dispVal = company[name];
    return (
        <div className="space-y-2">
            <label className="flex items-center gap-1.5 text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                {label}
                {required && <span className="text-red-500">*</span>}
            </label>
            {isEditing ? (
                type === 'textarea' ? (
                    <textarea
                        name={name}
                        value={val as string || ''}
                        onChange={onChange}
                        rows={3}
                        placeholder={`Enter ${label.toLowerCase()}`}
                        className="w-full px-4 py-3 text-sm bg-blue-50/30 dark:bg-white/5 border border-blue-100 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 dark:text-white placeholder-gray-400 transition-all resize-none shadow-inner"
                    />
                ) : (
                    <input
                        type={type}
                        name={name}
                        value={val as string || ''}
                        onChange={onChange}
                        placeholder={`Enter ${label.toLowerCase()}`}
                        className="w-full h-11 px-4 text-sm bg-blue-50/30 dark:bg-white/5 border border-blue-100 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 dark:text-white placeholder-gray-400 transition-all shadow-inner"
                    />
                )
            ) : (
                <div className="text-[14px] font-semibold w-full text-gray-800 dark:text-gray-200 bg-gray-50/80 dark:bg-white/5 px-4 py-3 rounded-xl border border-gray-100 dark:border-white/5 min-h-[46px] flex items-center shadow-sm">
                    {dispVal ? (
                        name === 'applicationConfiguration' ? (
                            <span className="text-emerald-700 dark:text-emerald-400 font-bold text-[13px] tracking-wide flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/50 animate-pulse"></span> Configuration Active
                            </span>
                        ) : type === 'password' ? (
                            <span className="tracking-widest opacity-40">••••••••</span>
                        ) : (
                            <span className={`w-full ${type === 'textarea' ? 'line-clamp-3 break-words' : 'truncate'}`} title={String(dispVal)}>
                                {String(dispVal)}
                            </span>
                        )
                    ) : <span className="text-gray-400 italic text-xs font-medium">Not configured</span>}
                </div>
            )}
        </div>
    );
};

interface ToggleFieldProps {
    label: string;
    name: keyof CompanyDto;
    formData: CompanyDto;
    company: CompanyDto;
    isEditing: boolean;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const ToggleField: React.FC<ToggleFieldProps> = ({ label, name, formData, company, isEditing, onChange }) => {
    const val = formData[name];
    const dispVal = company[name];
    return (
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-[#1e293b] border border-gray-200 dark:border-gray-700 rounded-xl hover:border-blue-200 dark:hover:border-blue-800 transition-all group">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">{label}</span>
            {isEditing
                ? <Toggle name={name} checked={!!val} onChange={onChange} />
                : <StatusBadge value={!!dispVal} />
            }
        </div>
    );
};

const Section: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode; cols?: 1 | 2 | 3 }> = ({ title, icon, children, cols = 2 }) => (
    <div className="bg-white dark:bg-[#0f172a] rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden group/section">
        <div className="flex items-center gap-3.5 px-6 py-4 bg-gradient-to-r from-gray-50/80 to-transparent dark:from-blue-900/10 dark:to-transparent border-b border-gray-100 dark:border-gray-800">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover/section:scale-110 transition-transform duration-300">
                {icon}
            </div>
            <h4 className="text-[15px] font-black text-gray-800 dark:text-white uppercase tracking-tight">{title}</h4>
        </div>
        <div className={`p-6 grid grid-cols-1 ${cols === 2 ? 'md:grid-cols-2' : cols === 3 ? 'md:grid-cols-3' : ''} gap-6`}>
            {children}
        </div>
    </div>
);

const ToggleGrid: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
    <div className="bg-white dark:bg-[#0f172a] rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden group/section">
        <div className="flex items-center gap-3.5 px-6 py-4 bg-gradient-to-r from-gray-50/80 to-transparent dark:from-orange-900/10 dark:to-transparent border-b border-gray-100 dark:border-gray-800">
            <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center text-orange-600 dark:text-orange-400 group-hover/section:scale-110 transition-transform duration-300">
                {icon}
            </div>
            <h4 className="text-[15px] font-black text-gray-800 dark:text-white uppercase tracking-tight">{title}</h4>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-3">
            {children}
        </div>
    </div>
);

// ─── Main Component ─────────────────────────────────────────────────────────

const CompanyMaster: React.FC = () => {
    const { showMessage, ModalRenderer } = useMessageModal();
    const [company, setCompany] = useState<CompanyDto | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [formData, setFormData] = useState<CompanyDto | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [activeTab, setActiveTab] = useState(0);

    useEffect(() => { fetchCompany(); }, []);

    const fetchCompany = async () => {
        try {
            const data = await getCompany();
            setCompany(data);
            setFormData(data);
        } catch (error) {
            console.error(error);
            showMessage('error', 'Load Error', 'Failed to load company details. Please try refreshing the page.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleEdit = () => { setIsEditing(true); setFormData({ ...company! }); };
    const handleCancel = () => { setIsEditing(false); setFormData({ ...company! }); };

    const handleSave = async () => {
        if (!formData) return;
        setIsSaving(true);
        try {
            await updateCompany(formData);
            setCompany(formData);
            setIsEditing(false);
            showMessage('success', 'Saved Successfully', 'Company details have been updated successfully.');
        } catch (error) {
            console.error(error);
            showMessage('error', 'Save Failed', 'Failed to save company changes. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => {
            if (!prev) return null;
            let finalValue: any = value;
            if (type === 'checkbox') finalValue = (e.target as HTMLInputElement).checked;
            else if (type === 'number') finalValue = value === '' ? null : parseFloat(value);
            return { ...prev, [name]: finalValue };
        });
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-[#020617]">
                <div className="text-center space-y-3">
                    <Loader2 className="w-10 h-10 animate-spin text-blue-500 mx-auto" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">Loading company details...</p>
                </div>
            </div>
        );
    }

    if (!company || !formData) return null;

    // ── Tab Definitions ───────────────────────────────────────────────
    const tabs = [
        { id: 0,  label: 'Company Info',        icon: <Info className="w-4 h-4" /> },
        { id: 1,  label: 'Production Unit',     icon: <Factory className="w-4 h-4" /> },
        { id: 2,  label: 'Tax Config',          icon: <Receipt className="w-4 h-4" /> },
        { id: 3,  label: 'Estimation',          icon: <Calculator className="w-4 h-4" /> },
        { id: 4,  label: 'Domain Features',     icon: <Settings2 className="w-4 h-4" />  },
        { id: 5,  label: 'Approvals',           icon: <CheckCircle2 className="w-4 h-4" /> },
        { id: 6,  label: 'Production Settings', icon: <Wrench className="w-4 h-4" /> },
        { id: 7,  label: 'System Config',       icon: <Cpu className="w-4 h-4" /> },
        { id: 8,  label: 'Workflow',            icon: <RefreshCw className="w-4 h-4" /> },
        { id: 9,  label: 'Communication',       icon: <MessageSquare className="w-4 h-4" /> },
        { id: 10, label: 'Client Comm.',        icon: <Megaphone className="w-4 h-4" /> },
        { id: 11, label: 'Printing & Docs',     icon: <Printer className="w-4 h-4" /> },
        { id: 12, label: 'Prefixes',            icon: <Tag className="w-4 h-4" /> },
    ];

    // Helper functions for concise rendering with props
    const F = (label: string, name: keyof CompanyDto, type: any = 'text', required = false) => (
        <FormField
            label={label}
            name={name}
            type={type}
            required={required}
            formData={formData}
            company={company}
            isEditing={isEditing}
            onChange={handleChange}
        />
    );

    const T = (label: string, name: keyof CompanyDto) => (
        <ToggleField
            label={label}
            name={name}
            formData={formData}
            company={company}
            isEditing={isEditing}
            onChange={handleChange}
        />
    );

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-[#020617]">
            {ModalRenderer}

            {/* ── Sticky Header ─────────────────────────────────────── */}
            <div className="sticky top-0 z-30 bg-white dark:bg-[#0f172a] border-b border-gray-200 dark:border-gray-800 shadow-sm">
                <div className="px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-md">
                            <Building2 className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">Company Configuration</h1>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{company.companyName}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {isEditing && (
                            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded-full animate-pulse">
                                <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                                Editing Mode
                            </span>
                        )}
                        {!isEditing ? (
                            <button onClick={handleEdit} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm hover:shadow-md transition-all">
                                <Edit2 className="w-4 h-4" />
                                Edit Details
                            </button>
                        ) : (
                            <div className="flex gap-2">
                                <button onClick={handleCancel} disabled={isSaving} className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-all">
                                    <X className="w-4 h-4" /> Cancel
                                </button>
                                <button onClick={handleSave} disabled={isSaving} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm hover:shadow-md transition-all disabled:opacity-50">
                                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    {isSaving ? 'Saving…' : 'Save Changes'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Tabs Row */}
                <div className="px-6 py-2 bg-gray-50/50 dark:bg-[#020617]/50 overflow-x-auto custom-scrollbar-thin">
                    <div className="flex gap-2 min-w-max">
                        {tabs.map(tab => {
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`
                                        group flex items-center gap-3 px-4 py-2 rounded-xl text-[13px] font-bold transition-all duration-300
                                        ${isActive 
                                            ? 'bg-white dark:bg-blue-600 text-blue-600 dark:text-white shadow-lg shadow-blue-500/10 dark:shadow-blue-500/20 scale-[1.02]' 
                                            : 'text-gray-500 dark:text-gray-400 hover:bg-white/50 dark:hover:bg-gray-800 hover:text-gray-800 dark:hover:text-gray-200'
                                        }
                                    `}
                                >
                                    <div className={`
                                        flex items-center justify-center w-8 h-8 rounded-lg transition-colors
                                        ${isActive 
                                            ? 'bg-blue-50 dark:bg-white/20 text-blue-600 dark:text-white' 
                                            : 'bg-gray-100 dark:bg-gray-800 text-gray-400 group-hover:bg-white dark:group-hover:bg-gray-700'
                                        }
                                    `}>
                                        {tab.icon}
                                    </div>
                                    <span className="whitespace-nowrap tracking-tight">{tab.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* ── Tab Content ───────────────────────────────────────── */}
            <div className="px-6 py-6 max-w-7xl mx-auto">
                <div className="space-y-5">

                    {/* Tab 0: Company Information */}
                    {activeTab === 0 && (
                        <>
                            <Section title="Identity" icon={<Building2 className="w-5 h-5" />} cols={3}>
                                {F('Company Name', 'companyName', 'text', true)}
                                {F('Production Unit Name', 'productionUnitName')}
                                {F('Tally Company Name', 'tallyCompanyName')}
                            </Section>
                            <Section title="Address" icon={<MapPin className="w-5 h-5" />} cols={2}>
                                {F('Address Line 1', 'address1')}
                                {F('Address Line 2', 'address2')}
                                {F('Address Line 3', 'address3')}
                                {F('City', 'city')}
                                {F('State', 'state')}
                                {F('Country', 'country')}
                                {F('Pincode', 'pincode')}
                            </Section>
                            <Section title="Contact" icon={<Phone className="w-5 h-5" />} cols={2}>
                                {F('Mobile Number', 'mobileNO')}
                                {F('Email', 'email', 'email')}
                            </Section>
                            <Section title="Statutory Numbers" icon={<Receipt className="w-5 h-5" />} cols={2}>
                                {F('PAN', 'pan')}
                                {F('CIN Number', 'cinNo')}
                                {F('GSTIN', 'gstin')}
                                {F('State TIN No', 'stateTinNo')}
                            </Section>
                            <ToggleGrid title="Status" icon={<Zap className="w-5 h-5" />}>
                                {T('Is Active', 'isActive')}
                            </ToggleGrid>
                        </>
                    )}

                    {/* Tab 1: Production Unit */}
                    {activeTab === 1 && (
                        <>
                            <Section title="Production Unit Details" icon={<Factory className="w-5 h-5" />} cols={2}>
                                {F('Production Unit Address', 'productionUnitAddress', 'textarea')}
                                {F('Production Entry Back Day', 'productionEntryBackDay', 'text')}
                            </Section>
                            <ToggleGrid title="Production Unit Settings" icon={<Settings className="w-5 h-5" />}>
                                {T('Manual Production Entry Time', 'manualProductionEntryTime')}
                                {T('Job Schedule Release Required', 'jobScheduleReleaseRequired')}
                                {T('Generate Voucher No By Production Unit', 'generateVoucherNoByProductionUnit')}
                                {T('Bypass Inventory For Production', 'byPassInventoryForProduction')}
                                {T('Is Production Slip Generated', 'isProductionSlipGenerated')}
                            </ToggleGrid>
                        </>
                    )}

                    {/* Tab 2: Tax Configuration */}
                    {activeTab === 2 && (
                        <>
                            <Section title="Purchase Tolerance" icon={<ShieldCheck className="w-5 h-5" />} cols={2}>
                                {F('Purchase Tolerance (%)', 'purchaseTolerance', 'number')}
                            </Section>
                            <ToggleGrid title="Tax Settings" icon={<Receipt className="w-5 h-5" />}>
                                {T('Sales Tax', 'isSalesTax')}
                                {T('GST Applicable', 'isGstApplicable')}
                                {T('VAT Applicable', 'isVatApplicable')}
                                {T('E-Invoice Applicable', 'isEinvoiceApplicable')}
                                {T('Tax Applicable Branch Wise', 'taxApplicableBranchWise')}
                            </ToggleGrid>
                        </>
                    )}

                    {/* Tab 3: Estimation & Calculation */}
                    {activeTab === 3 && (
                        <>
                            <Section title="Decimal Place Settings" icon={<Calculator className="w-5 h-5" />} cols={3}>
                                {F('Estimation RoundOff Decimal Place', 'estimationRoundOffDecimalPlace', 'number')}
                                {F('Purchase RoundOff Decimal Place', 'purchaseRoundOffDecimalPlace', 'number')}
                                {F('Invoice RoundOff Decimal Place', 'invoiceRoundOffDecimalPlace', 'number')}
                                {F('Estimation Per Unit Cost Decimal Place', 'estimationPerUnitCostDecimalPlace', 'number')}
                                {F('RoundOff Impression Value', 'roundOffImpressionValue', 'number')}
                                {F('Wt. Calculate On Estimation', 'wtCalculateOnEstimation', 'text')}
                            </Section>
                            <ToggleGrid title="Calculation Flags" icon={<Settings className="w-5 h-5" />}>
                                {T('Auto RoundOff Not Applicable', 'autoRoundOffNotApplicable')}
                            </ToggleGrid>
                            <Section title="Estimation Settings" icon={<BarChart3 className="w-5 h-5" />} cols={2}>
                                {F('Show Plan Upto Wastage %', 'showPlanUptoWastagePerc', 'number')}
                            </Section>
                        </>
                    )}

                    {/* Tab 4: Domain Features */}
                    {activeTab === 4 && (
                        <>
                            <ToggleGrid title="Domain Modules" icon={<Layers className="w-5 h-5" />}>
                                {T('Flexo Domain Enable', 'flexoDomainEnable')}
                                {T('Offset Domain Enable', 'offsetDomainEnable')}
                                {T('Corrugation Domain Enable', 'corrugationDomainEnable')}
                                {T('Roto Domain Enable', 'rotoDomainEnable')}
                            </ToggleGrid>
                            <ToggleGrid title="Planning Features" icon={<BarChart3 className="w-5 h-5" />}>
                                {T('Book Planning Feature Enable', 'bookPlanningFeatureEnable')}
                                {T('Rigid Box Planning Feature Enable', 'rigidBoxPlanningFeatureEnable')}
                                {T('Shipper Planning Feature Enable', 'shipperPlanningFeatureEnable')}
                            </ToggleGrid>
                        </>
                    )}

                    {/* Tab 5: Approval Settings */}
                    {activeTab === 5 && (
                        <ToggleGrid title="Approval Workflows" icon={<CheckCircle2 className="w-5 h-5" />}>
                            {T('Internal Approval Required', 'isInternalApprovalRequired')}
                            {T('Requisition Approval', 'isRequisitionApproval')}
                            {T('PO Approval Required', 'isPOApprovalRequired')}
                            {T('Invoice Approval Required', 'isInvoiceApprovalRequired')}
                            {T('Sales Order Approval Required', 'isSalesOrderApprovalRequired')}
                            {T('Job Release Feature Required', 'isJobReleaseFeatureRequired')}
                            {T('Bypass Cost Approval', 'byPassCostApproval')}
                        </ToggleGrid>
                    )}

                    {/* Tab 6: Production Settings */}
                    {activeTab === 6 && (
                        <ToggleGrid title="Production Settings" icon={<Wrench className="w-5 h-5" />}>
                            {T('Wastage Add In Printing Rate', 'isWastageAddInPrintingRate')}
                            {T('Material Consumption Details Flag', 'materialConsumptionDetailsFlage')}
                            {T('Production Process Wise Tolerance Required', 'productionProcessWiseToleranceRequired')}
                        </ToggleGrid>
                    )}

                    {/* Tab 7: System Configuration */}
                    {activeTab === 7 && (
                        <>
                            <Section title="Application Config" icon={<Monitor className="w-5 h-5" />} cols={2}>
                                {F('Application Configuration', 'applicationConfiguration', 'textarea')}
                                {F('API Basic Auth Username', 'apiBasicAuthUserName')}
                                {F('API Basic Auth Password', 'apiBasicAuthPassword', 'password')}
                                {F('OTP Verification Excluded Devices', 'otpVerificationExcludedDevices', 'textarea')}
                            </Section>
                            <ToggleGrid title="System Flags" icon={<Cpu className="w-5 h-5" />}>
                                {T('OTP Verification Feature Enabled', 'otpVerificationFeatureEnabled')}
                                {T('Multiple FYear Not Required', 'multipleFYearNotRequired')}
                                {T('Is Product Catalog Created', 'isProductCatalogCreated')}
                            </ToggleGrid>
                        </>
                    )}

                    {/* Tab 8: Workflow Automation */}
                    {activeTab === 8 && (
                        <>
                            <Section title="Automation Data" icon={<Monitor className="w-5 h-5" />} cols={2}>
                                {F('Auto Requisition Creation', 'isAutoRequisitionCreation', 'number')}
                            </Section>
                            <ToggleGrid title="Workflow Automation" icon={<RefreshCw className="w-5 h-5" />}>
                                {T('Auto Indent Feature Required', 'autoIndentFeatureRequired')}
                                {T('Picklist Feature Required', 'isPicklistFeatureRequired')}
                                {T('Supplier Item Allocation Required', 'isSupplierItemAllocationRequired')}
                            </ToggleGrid>
                        </>
                    )}

                    {/* Tab 9: Communication & CRM */}
                    {activeTab === 9 && (
                        <ToggleGrid title="Communication & CRM" icon={<MessageSquare className="w-5 h-5" />}>
                            {T('CRM Activated', 'isCrmActivated')}
                            {T('WhatsApp Activated', 'isWhatsAppActivated')}
                            {T('Email Activated', 'isEmailActivated')}
                            {T('Notification Enabled', 'isNotificationEnabled')}
                        </ToggleGrid>
                    )}

                    {/* Tab 10: Client Communication */}
                    {activeTab === 10 && (
                        <ToggleGrid title="Client Notifications" icon={<Megaphone className="w-5 h-5" />}>
                            {T('Job Scheduled → Send To Client', 'isJobScheduled_SendToClient')}
                            {T('Order Ready (QC & Packing) → Send To Client', 'isOrderReady_QcAndPacking_SendToClient')}
                            {T('Invoice Ready → Send To Client', 'isInvoice_Ready_SendToClient')}
                            {T('Sales Order Approve → By Client', 'isSales_Order_Approve_ByClient')}
                        </ToggleGrid>
                    )}

                    {/* Tab 11: Printing & Documents */}
                    {activeTab === 11 && (
                        <ToggleGrid title="Printing & Document Settings" icon={<Printer className="w-5 h-5" />}>
                            {T('Invoice Print Product Wise', 'isInvoicePrintProductWise')}
                            {T('Invoice Block Feature Required', 'isInvoiceBlockFeatureRequired')}
                            {T('Quotation Visible After SO', 'isQuotationVisibleAfterSO')}
                            {T('Unitwise Printout Setting', 'unitwisePrintoutSetting')}
                        </ToggleGrid>
                    )}

                    {/* Tab 12: Prefix Settings */}
                    {activeTab === 12 && (
                        <Section title="Document Prefixes" icon={<Tag className="w-5 h-5" />} cols={2}>
                            {F('Product Catalog Prefix', 'productCatlogPrefix')}
                            {F('Job Card Prefix', 'jobCardPrefix')}
                        </Section>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CompanyMaster;
