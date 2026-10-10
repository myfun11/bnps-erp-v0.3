import React, { useState } from 'react';
import { Quotation } from '../../../types/database';
import { downloadQuotationTextDoc } from '../../../lib/quotationExport';
import { numberToIndianWords } from '../../../lib/numberToWords';
import { BnpsLogo } from '../../common/BnpsLogo';
import { BnpsStamp } from '../../common/BnpsStamp';
import { 
  Printer, 
  Download, 
  Save, 
  Share2, 
  Check, 
  CheckCircle2, 
  Sparkles
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';

interface QuotationLetterheadDocProps {
  quotation: Quotation;
  onPrint: () => void;
  onShareWhatsApp: (q: Quotation) => void;
  onConvertToProject: (q: Quotation) => void;
  onBack: () => void;
}

export const QuotationLetterheadDoc: React.FC<QuotationLetterheadDocProps> = ({
  quotation,
  onPrint,
  onShareWhatsApp,
  onConvertToProject,
  onBack,
}) => {
  const { currentProfile, userRole, canConvertQuotations } = useAuth();
  const isBranchScoped = ['branch_manager', 'field_officer'].includes(userRole);
  const userBranch = currentProfile?.branch;
  const isEligibleToConvert = canConvertQuotations && (!isBranchScoped || (userBranch && quotation.branch?.toLowerCase().trim() === userBranch.toLowerCase().trim()));

  const [downloadNotice, setDownloadNotice] = useState<string | null>(null);

  const handleDownload = () => {
    downloadQuotationTextDoc(quotation);
    setDownloadNotice('Official Quotation Docket Downloaded Successfully!');
    setTimeout(() => setDownloadNotice(null), 4000);
  };

  const handleSavePdf = () => {
    onPrint();
    setDownloadNotice('Select "Save as PDF" in your printer destination to download PDF.');
    setTimeout(() => setDownloadNotice(null), 5000);
  };

  // Calculations matching the exact GST Estimate structure in the uploaded image
  const totalAmount = quotation.total_project_cost || 200000;
  
  // Item 1: Solar Modules + Inverter + Electrical Protection (HSN 8541, 5% GST)
  const item1Amount = Math.round(totalAmount * 0.85);
  const item1Taxable = Number((item1Amount / 1.05).toFixed(2));
  const item1Gst = Number((item1Amount - item1Taxable).toFixed(2));
  const item1Cgst = Number((item1Gst / 2).toFixed(2));
  const item1Sgst = Number((item1Gst / 2).toFixed(2));

  // Item 2: Installation and Commissioning with BOS Material (HSN 9954, 18% GST)
  const item2Amount = totalAmount - item1Amount;
  const item2Taxable = Number((item2Amount / 1.18).toFixed(2));
  const item2Gst = Number((item2Amount - item2Taxable).toFixed(2));
  const item2Cgst = Number((item2Gst / 2).toFixed(2));
  const item2Sgst = Number((item2Gst / 2).toFixed(2));

  const totalTaxable = Number((item1Taxable + item2Taxable).toFixed(2));
  const totalCgst = Number((item1Cgst + item2Cgst).toFixed(2));
  const totalSgst = Number((item1Sgst + item2Sgst).toFixed(2));
  const totalTax = Number((item1Gst + item2Gst).toFixed(2));

  // Formatted date and time
  const quoteDate = quotation.created_at ? new Date(quotation.created_at) : new Date();
  const formattedDate = quoteDate.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).replace(/\//g, '-');
  
  const formattedTime = quoteDate.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  const quoteNoDisplay = quotation.quotation_no.includes('/')
    ? quotation.quotation_no
    : `BNPS-${quotation.quotation_no}`;

  const amountInWords = numberToIndianWords(totalAmount);

  return (
    <div className="space-y-6 font-sans">
      {/* Toast Notification */}
      {downloadNotice && (
        <div className="fixed top-20 right-6 z-50 bg-emerald-500 text-slate-950 font-bold px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 border border-emerald-300 animate-bounce print:hidden">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span className="text-xs">{downloadNotice}</span>
        </div>
      )}

      {/* Top Action Bar */}
      <div className="bg-slate-900/90 rounded-2xl p-4 border border-slate-800 flex flex-wrap items-center justify-between gap-3 print:hidden shadow-lg">
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer"
          >
            ← Back to Register
          </button>
          <span className="text-xs font-mono text-slate-400">
            Estimate: <span className="text-amber-400 font-bold">{quotation.quotation_no}</span> ({quotation.customer_name})
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Print Button */}
          <button
            onClick={onPrint}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition cursor-pointer"
            title="Print Quotation"
          >
            <Printer className="w-4 h-4" />
            <span>Print Quotation</span>
          </button>

          {/* Save as PDF Button */}
          <button
            onClick={handleSavePdf}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-600/20 transition cursor-pointer"
            title="Save as PDF"
          >
            <Save className="w-4 h-4" />
            <span>Save as PDF</span>
          </button>

          {/* Download Text/Doc Button */}
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold text-xs border border-slate-700 transition cursor-pointer"
            title="Download Quotation Docket (.txt)"
          >
            <Download className="w-4 h-4 text-amber-400" />
            <span>Download Docket</span>
          </button>

          {/* WhatsApp Share Button */}
          <button
            onClick={() => onShareWhatsApp(quotation)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow transition cursor-pointer"
            title="Share on WhatsApp"
          >
            <Share2 className="w-4 h-4" />
            <span>WhatsApp</span>
          </button>

          {quotation.status !== 'CONVERTED' && isEligibleToConvert && (
            <button
              onClick={() => onConvertToProject(quotation)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow transition cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Convert to Project</span>
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* EXACT ESTIMATE DOCUMENT MATCHING THE USER'S PROVIDED FORMAT (IMAGE 1 & 2) */}
      {/* ========================================================================= */}
      <div 
        id="printable-estimate-document"
        className="bg-white text-slate-900 max-w-4xl mx-auto p-6 sm:p-10 shadow-2xl border border-slate-300 font-sans print:p-0 print:border-none print:shadow-none print:max-w-none"
        style={{ color: '#111827' }}
      >
        {/* Centered Document Title */}
        <div className="text-center pb-2">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Estimate
          </h1>
        </div>

        {/* MAIN BORDERED CONTAINER */}
        <div className="border border-slate-700 rounded-none overflow-hidden text-[12px] leading-tight">
          {/* 1. COMPANY HEADER BOX (LOGO + DETAILS) */}
          <div className="p-4 border-b border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white">
            {/* Left: Official BNPS Logo */}
            <div className="flex items-center gap-3">
              <BnpsLogo variant="full" size="md" />
            </div>

            {/* Right: Company Address, Contact & Tax Information */}
            <div className="text-left sm:text-right space-y-1">
              <h2 className="font-bold text-base sm:text-lg text-slate-950 uppercase tracking-tight">
                BHUMI NIDHI POWAR SOLUTION
              </h2>
              <div className="text-slate-700 text-xs font-medium">
                Head Office: Near By HDFC Bank, Jaijaipur, District: Sakti, Chhattisgarh - 495690
              </div>
              <div className="text-slate-800 font-medium">
                Phone: <span className="font-mono font-bold">9691762929, 9131040126, 8305218826</span>
              </div>
              <div className="text-slate-700">
                Email: <span className="font-mono font-medium">myfun11g@gmail.com</span>
              </div>
              <div className="flex flex-wrap sm:justify-end gap-x-3 text-slate-800 font-semibold pt-0.5">
                <div>GSTIN: <span className="font-mono">22ADRPY7738F1ZX</span></div>
                <div>State: <span className="font-mono">22-Chhattisgarh</span></div>
              </div>
              <div className="text-[11px] text-slate-600">
                Constitution: <strong>Proprietorship</strong> | Owner: <strong>Ghanshyam Prasad Yadav</strong>
              </div>
            </div>
          </div>

          {/* 2. ESTIMATE FOR & ESTIMATE DETAILS (TWO COLUMN HEADER) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 border-b border-slate-700 bg-slate-50/50">
            {/* Left: Estimate For */}
            <div className="p-3 border-b sm:border-b-0 sm:border-r border-slate-700 space-y-1">
              <div className="font-bold uppercase text-[11px] tracking-wide text-slate-700">
                Estimate For:
              </div>
              <div className="font-bold text-slate-950 text-sm">
                {quotation.customer_name}
              </div>
              <div className="text-slate-700">
                {quotation.address_line || quotation.panchayat_village || 'Near By HDFC Bank'}, {quotation.tehsil ? `${quotation.tehsil}, ` : ''}{quotation.district || 'District: Sakti'}
              </div>
              <div className="text-slate-800">
                Contact No: <span className="font-mono font-bold">{quotation.phone}</span>
              </div>
              {quotation.consumer_number && (
                <div className="text-slate-600 font-mono text-[11px]">
                  CSPDCL BP: {quotation.consumer_number}
                </div>
              )}
            </div>

            {/* Right: Estimate Details */}
            <div className="p-3 space-y-1 bg-white sm:bg-slate-50/50">
              <div className="font-bold uppercase text-[11px] tracking-wide text-slate-700">
                Estimate Details:
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-600 w-14">No:</span>
                <span className="font-mono font-bold text-slate-950">{quoteNoDisplay}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-600 w-14">Date:</span>
                <span className="font-mono text-slate-900">{formattedDate}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-600 w-14">Time:</span>
                <span className="font-mono text-slate-900">{formattedTime}</span>
              </div>
            </div>
          </div>

          {/* 3. ITEM TABLE MATCHING EXACT SCREENSHOT */}
          <div className="overflow-x-auto border-b border-slate-700">
            <table className="w-full text-left border-collapse text-[11px]">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-100/90 text-slate-800 font-bold">
                  <th className="p-2 border-r border-slate-700 w-8 text-center">#</th>
                  <th className="p-2 border-r border-slate-700 min-w-[280px]">Item Name</th>
                  <th className="p-2 border-r border-slate-700 w-20 text-center">HSN/ SAC</th>
                  <th className="p-2 border-r border-slate-700 w-16 text-center">Quantity</th>
                  <th className="p-2 border-r border-slate-700 w-28 text-right">Price/ Unit (₹)</th>
                  <th className="p-2 border-r border-slate-700 w-28 text-right">GST(₹)</th>
                  <th className="p-2 w-28 text-right">Amount(₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700 text-slate-900">
                {/* Row 1: Solar Modules & Inverter */}
                <tr className="align-top">
                  <td className="p-2.5 border-r border-slate-700 text-center font-bold">1</td>
                  <td className="p-2.5 border-r border-slate-700">
                    <div className="font-bold text-slate-950 text-xs">
                      ON GRID ROOFTOP SOLAR POWAR PLANT {quotation.capacity_kw}KWp
                    </div>
                    <div className="text-[11px] text-slate-700 mt-1 leading-relaxed pl-1 font-mono uppercase">
                      (CONFIGURATION:<br />
                      DCR SOLAR PANELS - {String(quotation.module_quantity || 6).padStart(2, '0')}nos ({quotation.solar_brand || 'Tata Powar'} {quotation.module_wattage_wp || 550}Wp {quotation.cell_type || 'Bifacial DCR'})<br />
                      On Grid INVERTER ({quotation.inverter_brand || 'Growatt'}) - 01nos ({quotation.inverter_kw || quotation.capacity_kw} kW)<br />
                      ACDB - 01NOS<br />
                      DCDB - 01NOS<br />
                      Earthing Kit - 03set<br />
                      Lighting Arastor - 01set)
                    </div>
                  </td>
                  <td className="p-2.5 border-r border-slate-700 text-center font-mono">8541</td>
                  <td className="p-2.5 border-r border-slate-700 text-center font-mono">1</td>
                  <td className="p-2.5 border-r border-slate-700 text-right font-mono font-medium">
                    ₹ {item1Taxable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="p-2.5 border-r border-slate-700 text-right font-mono">
                    ₹ {item1Gst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (5.0%)
                  </td>
                  <td className="p-2.5 text-right font-mono font-bold text-slate-950">
                    ₹ {item1Amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>

                {/* Row 2: Installation, Mounting & BOS */}
                <tr className="align-top">
                  <td className="p-2.5 border-r border-slate-700 text-center font-bold">2</td>
                  <td className="p-2.5 border-r border-slate-700">
                    <div className="font-bold text-slate-950 text-xs">
                      INSTALLATION AND COMMISSIONING WITH ALL BOS MATERIAL
                    </div>
                    <div className="text-[11px] text-slate-700 mt-1 leading-relaxed pl-1 font-mono uppercase">
                      (AC Cable - 30mtr<br />
                      DC Cable - 30mtr<br />
                      Earthing Cables - 90mtr<br />
                      Galvanized Mounting Structure - 01set ({quotation.structure_type || 'Standard HDG GI Flush Mount'})<br />
                      All Other complete BOS - 01set<br />
                      Transportation and Installation)
                    </div>
                  </td>
                  <td className="p-2.5 border-r border-slate-700 text-center font-mono">9954</td>
                  <td className="p-2.5 border-r border-slate-700 text-center font-mono">1</td>
                  <td className="p-2.5 border-r border-slate-700 text-right font-mono font-medium">
                    ₹ {item2Taxable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="p-2.5 border-r border-slate-700 text-right font-mono">
                    ₹ {item2Gst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (18.0%)
                  </td>
                  <td className="p-2.5 text-right font-mono font-bold text-slate-950">
                    ₹ {item2Amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>

                {/* Total Row */}
                <tr className="font-bold bg-slate-50 border-t-2 border-slate-700 text-slate-950">
                  <td className="p-2 border-r border-slate-700 text-center"></td>
                  <td className="p-2 border-r border-slate-700 uppercase font-black">Total</td>
                  <td className="p-2 border-r border-slate-700"></td>
                  <td className="p-2 border-r border-slate-700 text-center font-mono font-black">2</td>
                  <td className="p-2 border-r border-slate-700"></td>
                  <td className="p-2 border-r border-slate-700 text-right font-mono font-black">
                    ₹ {totalTax.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="p-2 text-right font-mono font-black text-xs">
                    ₹ {totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 4. TAX SUMMARY & SUB TOTAL / TOTAL BOX */}
          <div className="grid grid-cols-1 sm:grid-cols-12 border-b border-slate-700 bg-white">
            {/* Left 8 Columns: Tax Summary Breakdown */}
            <div className="sm:col-span-8 p-3 border-b sm:border-b-0 sm:border-r border-slate-700">
              <div className="font-bold text-slate-900 mb-1.5 uppercase text-[11px]">
                Tax Summary:
              </div>
              <div className="border border-slate-600 rounded-none overflow-hidden">
                <table className="w-full text-[10px] text-center border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-600 font-bold text-slate-800">
                      <th className="p-1 border-r border-slate-600">HSN/ SAC</th>
                      <th className="p-1 border-r border-slate-600">Taxable Amount (₹)</th>
                      <th className="p-1 border-r border-slate-600" colSpan={2}>CGST</th>
                      <th className="p-1 border-r border-slate-600" colSpan={2}>SGST</th>
                      <th className="p-1">Total Tax(₹)</th>
                    </tr>
                    <tr className="bg-slate-50 border-b border-slate-600 text-[9px] text-slate-600">
                      <th className="p-0.5 border-r border-slate-600"></th>
                      <th className="p-0.5 border-r border-slate-600"></th>
                      <th className="p-0.5 border-r border-slate-600">Rate (%)</th>
                      <th className="p-0.5 border-r border-slate-600">Amt (₹)</th>
                      <th className="p-0.5 border-r border-slate-600">Rate (%)</th>
                      <th className="p-0.5 border-r border-slate-600">Amt (₹)</th>
                      <th className="p-0.5"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-600 font-mono text-[10px]">
                    <tr>
                      <td className="p-1 border-r border-slate-600">8541</td>
                      <td className="p-1 border-r border-slate-600 text-right">{item1Taxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="p-1 border-r border-slate-600">2.5</td>
                      <td className="p-1 border-r border-slate-600 text-right">{item1Cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="p-1 border-r border-slate-600">2.5</td>
                      <td className="p-1 border-r border-slate-600 text-right">{item1Sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="p-1 text-right font-bold">{item1Gst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                    <tr>
                      <td className="p-1 border-r border-slate-600">9954</td>
                      <td className="p-1 border-r border-slate-600 text-right">{item2Taxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="p-1 border-r border-slate-600">9.0</td>
                      <td className="p-1 border-r border-slate-600 text-right">{item2Cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="p-1 border-r border-slate-600">9.0</td>
                      <td className="p-1 border-r border-slate-600 text-right">{item2Sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="p-1 text-right font-bold">{item2Gst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                    <tr className="font-bold bg-slate-100/90 text-slate-950">
                      <td className="p-1 border-r border-slate-600">TOTAL</td>
                      <td className="p-1 border-r border-slate-600 text-right">{totalTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="p-1 border-r border-slate-600"></td>
                      <td className="p-1 border-r border-slate-600 text-right">{totalCgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="p-1 border-r border-slate-600"></td>
                      <td className="p-1 border-r border-slate-600 text-right">{totalSgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="p-1 text-right font-black">{totalTax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right 4 Columns: Subtotal, Total, and Amount In Words */}
            <div className="sm:col-span-4 p-3 flex flex-col justify-between space-y-2 bg-slate-50/50">
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between items-center text-slate-800">
                  <span className="font-semibold">Sub Total</span>
                  <span className="font-mono font-bold">: ₹ {totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center text-slate-950 text-sm border-t border-slate-400 pt-1">
                  <span className="font-black uppercase">Total</span>
                  <span className="font-mono font-black text-base">: ₹ {totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-300">
                <div className="text-[10px] text-slate-500 font-semibold uppercase">
                  Estimate Amount In Words :
                </div>
                <div className="font-bold text-slate-900 text-xs mt-0.5 leading-snug">
                  {amountInWords}
                </div>
              </div>
            </div>
          </div>

          {/* 5. TERMS AND CONDITIONS BOX */}
          <div className="p-3 border-b border-slate-700 bg-white space-y-2 text-[11px] text-slate-800">
            <div className="font-bold text-slate-950 uppercase tracking-wide">
              Terms And Conditions:
            </div>
            
            <div className="space-y-1 leading-relaxed pl-1">
              <div>
                <strong>Payment Schedule:</strong><br />
                100% advance payment at the time of order confirmation (or 20% Booking, 70% Material Dispatch, 10% Net Metering).
              </div>
              
              <div>
                <strong>Warranty :</strong><br />
                Solar Panels : 25 years as per manufacturer standard warranty.<br />
                Inverter: 5 years as per manufacturer warranty terms.<br />
                Installation workmanship: 5 year
              </div>

              <div>
                <strong>Delivery& Installation:</strong> Material delivery within 7- 15 working days after advance payment (subject to ability).<br />
                Installation timeline depends on site readiness and weather conditions.
              </div>

              <div>
                <strong>Price Vadility:</strong> This quotation is valid for 07 days from the date of issue.
              </div>
            </div>
          </div>

          {/* 6. BANK DETAILS & OFFICIAL AUTHORIZED SIGNATORY */}
          <div className="grid grid-cols-1 sm:grid-cols-2 bg-white">
            {/* Left: Bank Details */}
            <div className="p-3 border-b sm:border-b-0 sm:border-r border-slate-700 space-y-1 text-[11px]">
              <div className="font-bold text-slate-950 uppercase tracking-wide text-xs">
                Bank Details:
              </div>
              <div>Name: <strong>Punjab National Bank, Jaijaipur / Sakti Branch</strong></div>
              <div>Account No.: <strong className="font-mono font-bold text-xs">7615002100002482</strong></div>
              <div>IFSC Code: <strong className="font-mono font-bold text-xs">PUNB0761500</strong></div>
              <div>Account Holder's Name: <strong>Bhumi Nidhi Powar Solution</strong></div>
            </div>

            {/* Right: Signature & Stamp Box */}
            <div className="p-3 flex flex-col justify-between items-center text-center space-y-2 min-h-[150px]">
              <div className="font-bold text-slate-950 text-xs uppercase tracking-wide">
                For BHUMI NIDHI POWAR SOLUTION:
              </div>

              {/* Official Seal / Rubber Stamp & Signature Component */}
              <div className="relative my-0.5">
                <BnpsStamp size={120} />
              </div>

              <div className="text-[11px] font-bold text-slate-900 uppercase border-t border-slate-400 pt-1 w-44">
                Authorized Signatory
              </div>
            </div>
          </div>
        </div>

        {/* 7. PM SURYA GHAR SUBSIDY BREAKDOWN ADDENDUM */}
        <div className="mt-5 p-4 rounded-xl border-2 border-emerald-600 bg-emerald-50/70 text-slate-900 text-xs space-y-2.5">
          <div className="flex items-center justify-between border-b border-emerald-300 pb-1.5">
            <div className="flex items-center gap-1.5 font-black text-emerald-950 uppercase tracking-wide text-xs">
              <Sparkles className="w-4 h-4 text-emerald-700" />
              <span>PM Surya Ghar: Muft Bijli Yojana — Government Subsidy Benefit</span>
            </div>
            <span className="font-mono font-bold text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-600 text-white">
              CSPDCL Approved
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
            <div className="p-2 bg-white rounded-lg border border-emerald-200">
              <div className="text-slate-500 text-[10px]">Gross Turnkey Project Cost</div>
              <div className="font-mono font-bold text-slate-900 text-sm mt-0.5">
                ₹ {totalAmount.toLocaleString('en-IN')}
              </div>
            </div>

            <div className="p-2 bg-white rounded-lg border border-emerald-200">
              <div className="text-emerald-700 font-semibold text-[10px]">Total Government Subsidy (DBT + State)</div>
              <div className="font-mono font-bold text-emerald-700 text-sm mt-0.5">
                - ₹ {(quotation.central_subsidy_amount + quotation.state_subsidy_amount).toLocaleString('en-IN')}
              </div>
              <div className="text-[9px] text-slate-500 font-mono mt-0.5">
                (Center: ₹{quotation.central_subsidy_amount.toLocaleString('en-IN')} + State: ₹{quotation.state_subsidy_amount.toLocaleString('en-IN')})
              </div>
            </div>

            <div className="p-2 bg-emerald-600 text-white rounded-lg shadow-sm">
              <div className="text-emerald-100 text-[10px] font-semibold uppercase">
                Net Customer Payable
              </div>
              <div className="font-mono font-black text-base mt-0.5">
                ₹ {quotation.net_customer_cost.toLocaleString('en-IN')}
              </div>
              <div className="text-[9px] text-emerald-100 mt-0.5">
                7% Bank Loan EMI: ~₹{(quotation.est_monthly_emi || 1650).toLocaleString('en-IN')}/Month
              </div>
            </div>
          </div>
        </div>

        {/* Print Only Footer note */}
        <div className="hidden print:block mt-6 pt-3 border-t border-slate-300 text-[9px] text-slate-500 text-center space-y-0.5">
          <div>
            <strong>BHUMI NIDHI POWAR SOLUTION</strong> • Head Office: Near By HDFC Bank, Jaijaipur, District: Sakti, Chhattisgarh - 495690
          </div>
          <div>
            GSTIN: 22ADRPY7738F1ZX • Constitution: Proprietorship • Phone: 9691762929, 9131040126, 8305218826 • Email: myfun11g@gmail.com • Owner: Ghanshyam Prasad Yadav
          </div>
        </div>
      </div>
    </div>
  );
};
