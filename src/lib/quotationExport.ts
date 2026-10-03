import { Quotation } from '../types/database';

/**
 * Downloads a structured official quotation docket file (.txt) in English
 */
export const downloadQuotationTextDoc = (q: Quotation) => {
  const content = `
================================================================================
                    BHUMI NIDHI POWAR SOLUTION
        Rooftop Solar & Renewable Energy Engineering Enterprise
     PM Surya Ghar: Muft Bijli Yojana Authorized Channel Partner • CSPDCL Vendor
     Head Office: Near By HDFC Bank, Jaijaipur, District: Sakti, Chhattisgarh - 495690
     Phone: 9691762929, 9131040126, 8305218826 | Email: myfun11g@gmail.com
     Constitution of Business: Proprietorship | Owner: Ghanshyam Prasad Yadav
     GSTIN: 22ADRPY7738F1ZX | State Code: 22-Chhattisgarh
================================================================================
Quotation No    : ${q.quotation_no}
Date            : ${new Date(q.created_at || Date.now()).toLocaleDateString('en-GB')}
Validity        : ${q.valid_until || '07 Days'}
Head Office     : Jaijaipur, Chhattisgarh
Prepared By     : Bhumi Nidhi Powar Solution
Status          : ${q.status || 'SENT'}

--------------------------------------------------------------------------------
1. CUSTOMER & INSTALLATION SITE DETAILS
--------------------------------------------------------------------------------
Customer Name   : ${q.customer_name}
Mobile Number   : ${q.phone}
Email Address   : ${q.email || '—'}
Site Address    : ${q.address_line || ''}, ${q.panchayat_village ? 'Gram: ' + q.panchayat_village + ', ' : ''}${q.tehsil ? 'Tehsil: ' + q.tehsil + ', ' : ''}${q.district || 'Chhattisgarh'} - ${q.pincode || '495690'}
CSPDCL BP No    : ${q.consumer_number || 'Under Net Metering Application'}
Sanctioned Load : ${q.sanctioned_load_kw || q.capacity_kw} kW

--------------------------------------------------------------------------------
2. SOLAR SYSTEM & TECHNICAL SPECIFICATIONS
--------------------------------------------------------------------------------
Plant Capacity  : ${q.capacity_kw} kW
System Type     : ${q.system_type || 'On-Grid Net Metered'}
Solar Cell Type : ${q.cell_type || 'Bifacial DCR'}
Solar Panels    : ${q.module_quantity || 6} Pcs × ${q.module_wattage_wp || 550}Wp (${q.solar_brand || 'Tata Powar Solar'})
Solar Inverter  : ${q.inverter_kw || q.capacity_kw} kW (${q.inverter_brand || 'Growatt / On-Grid'})
Mounting Frame  : ${q.structure_type || 'Standard HDG GI Flush Mount'}
BOS & Protection: ACDB/DCDB, 4 sq.mm UV DC Cable, Chemical Earthing, LA & Smart Net Meter

--------------------------------------------------------------------------------
3. PROJECT ESTIMATE & PM SURYA GHAR SUBSIDY BREAKDOWN
--------------------------------------------------------------------------------
Gross Turnkey Project Cost             : ₹${q.total_project_cost.toLocaleString('en-IN')}
(-) Central Govt PM Surya Ghar DBT      : ₹${q.central_subsidy_amount.toLocaleString('en-IN')}
(-) Chhattisgarh State Solar Incentive  : ₹${q.state_subsidy_amount.toLocaleString('en-IN')}
--------------------------------------------------------------------------------
FINAL NET PAYABLE AMOUNT BY CUSTOMER   : ₹${q.net_customer_cost.toLocaleString('en-IN')}
--------------------------------------------------------------------------------

--------------------------------------------------------------------------------
4. GENERATION RETURN & 7% BANK LOAN EMI
--------------------------------------------------------------------------------
Estimated Monthly Generation            : ~${Math.round(q.capacity_kw * 130)} Units / Month
Monthly Electricity Bill Savings        : ~₹${(q.monthly_savings_est || 0).toLocaleString('en-IN')} / Month
Annual Electricity Bill Savings         : ~₹${(q.annual_savings_est || (q.monthly_savings_est || 0) * 12).toLocaleString('en-IN')} / Year
25-Year Cumulative Savings              : ~₹${(q.lifetime_savings_est || (q.monthly_savings_est || 0) * 12 * 25).toLocaleString('en-IN')}
Concessional 7% Loan Monthly EMI        : ~₹${(q.est_monthly_emi || 1650).toLocaleString('en-IN')} / Month (5-Year Tenure)

--------------------------------------------------------------------------------
5. WARRANTY & SERVICE TERMS
--------------------------------------------------------------------------------
* Solar Modules  : 25 Years Linear Performance Warranty
* Solar Inverter : 5 Years Standard Manufacturer Warranty
* Free AMC       : 5 Years Comprehensive Maintenance Included
* Net Metering   : CSPDCL DLMS Smart Meter approval handled completely by BNPS

================================================================================
OFFICIAL BANK ACCOUNT DETAILS
Bank Name       : Punjab National Bank
Branch          : Jaijaipur / Sakti Branch
Account Number  : 7615002100002482
IFSC Code       : PUNB0761500
Account Holder  : Bhumi Nidhi Powar Solution

AUTHORIZED SIGNATORY
BHUMI NIDHI POWAR SOLUTION
Head Office: Near By HDFC Bank, Jaijaipur, District: Sakti, Chhattisgarh - 495690
GSTIN: 22ADRPY7738F1ZX | Constitution: Proprietorship | Owner: Ghanshyam Prasad Yadav
Phones: 9691762929, 9131040126, 8305218826 | Email: myfun11g@gmail.com
================================================================================
`;
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Quotation_${q.quotation_no.replace(/[^a-zA-Z0-9_-]/g, '_')}_${q.customer_name.replace(/\s+/g, '_')}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Triggers the browser's native print/PDF save flow
 */
export const triggerPrintQuotation = () => {
  window.print();
};
