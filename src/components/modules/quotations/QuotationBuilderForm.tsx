import React, { useState, useEffect } from 'react';
import { 
  SOLAR_BRANDS, 
  INVERTER_BRANDS, 
  SOLAR_KW_OPTIONS, 
  SOLAR_SYSTEM_TYPES, 
  CELL_TYPES 
} from '../../../lib/solarPricingData';
import { CHHATTISGARH_DISTRICTS } from '../../../services/mockData';
import { Quotation, QuotationEquipmentItem, BranchLocation } from '../../../types/database';
import { useAuth } from '../../../context/AuthContext';
import { 
  Calculator, 
  CheckCircle2, 
  Plus, 
  Trash2, 
  Edit3, 
  IndianRupee, 
  Sparkles, 
  ShieldCheck, 
  Truck, 
  Wrench, 
  Cpu, 
  Sun,
  X 
} from 'lucide-react';

interface QuotationBuilderFormProps {
  onSave: (quotation: Quotation) => void;
  onCancel: () => void;
}

export const QuotationBuilderForm: React.FC<QuotationBuilderFormProps> = ({ onSave, onCancel }) => {
  const { currentProfile } = useAuth();

  // 1. Customer & Address
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [branch, setBranch] = useState<BranchLocation>('Sakti');
  const [state] = useState('Chhattisgarh');
  const [district, setDistrict] = useState('Sakti');
  const [tehsil, setTehsil] = useState('Sakti');
  const [block, setBlock] = useState('Sakti');
  const [panchayatVillage, setPanchayatVillage] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [pincode, setPincode] = useState('495689');
  const [consumerNumber, setConsumerNumber] = useState('');
  const [sanctionedLoad, setSanctionedLoad] = useState(4.0);

  // 2. Solar System Core
  const [solarKw, setSolarKw] = useState<number>(3.3);
  const [systemType, setSystemType] = useState<'ON_GRID' | 'OFF_GRID' | 'HYBRID'>('ON_GRID');
  const [cellType, setCellType] = useState<string>('Bifacial (Dual Glass DCR)');

  // 3. Solar Panels Brand & Pieces & Price Edit
  const [selectedBrandId, setSelectedBrandId] = useState<string>('tata');
  const [panelWattage, setPanelWattage] = useState<number>(550);
  const [panelPieces, setPanelPieces] = useState<number>(6);
  const [panelUnitPrice, setPanelUnitPrice] = useState<number>(13475); // ~24.5/W * 550W

  // 4. Inverter Brand, kW & Price Edit
  const [selectedInverterId, setSelectedInverterId] = useState<string>('growatt');
  const [inverterKw, setInverterKw] = useState<number>(3.3);
  const [inverterPhase, setInverterPhase] = useState<'1-Phase' | '3-Phase'>('1-Phase');
  const [inverterPrice, setInverterPrice] = useState<number>(24750);

  // 5. Structure & Mounting
  const [structureType, setStructureType] = useState('Standard HDG GI Flush Mount');
  const [structurePrice, setStructurePrice] = useState<number>(12000);

  // 6. Installation & Other / Freight Charges (Editable)
  const [installationCharge, setInstallationCharge] = useState<number>(15000);
  const [transportOtherCharge, setTransportOtherCharge] = useState<number>(6500); // Freight + Transport

  // 7. Balance of Equipment Items (Editable List)
  const [equipmentList, setEquipmentList] = useState<QuotationEquipmentItem[]>([
    { id: 'eq-acdb-dcdb', name: 'ACDB & DCDB Protection Box (SPD, MCB, Fuses)', category: 'ELECTRICAL', quantity: 1, unit: 'Set', unit_price: 7500, total_price: 7500, is_editable: true },
    { id: 'eq-dc-cable', name: 'Solar DC Cable 4 sq.mm UV Double Insulated (Polycab)', category: 'ELECTRICAL', spec: '40 Mtr', quantity: 40, unit: 'Mtr', unit_price: 75, total_price: 3000, is_editable: true },
    { id: 'eq-ac-cable', name: 'AC Armoured Heavy Copper Cable', category: 'ELECTRICAL', spec: '20 Mtr', quantity: 20, unit: 'Mtr', unit_price: 130, total_price: 2600, is_editable: true },
    { id: 'eq-earthing', name: 'Chemical Earthing Electrodes with BFC Compound', category: 'SAFETY', spec: 'Dual Set', quantity: 2, unit: 'Set', unit_price: 3200, total_price: 6400, is_editable: true },
    { id: 'eq-la', name: 'Copper Coated Lightning Arrester with Mast', category: 'SAFETY', spec: 'Class-A', quantity: 1, unit: 'Set', unit_price: 2800, total_price: 2800, is_editable: true },
    { id: 'eq-net-meter', name: 'CSPDCL DLMS Smart Net Meter & Modem Kit', category: 'OTHER', spec: 'Discom Approved', quantity: 1, unit: 'Set', unit_price: 6500, total_price: 6500, is_editable: true },
  ]);

  // Recalculate panel quantity when kW or wattage changes
  useEffect(() => {
    const brand = SOLAR_BRANDS.find(b => b.id === selectedBrandId);
    const totalWatts = solarKw * 1000;
    const pieces = Math.ceil(totalWatts / panelWattage);
    setPanelPieces(pieces);

    const ratePerWatt = brand ? brand.approxRatePerWatt : 24.0;
    const unitP = Math.round(panelWattage * ratePerWatt);
    setPanelUnitPrice(unitP);
  }, [solarKw, panelWattage, selectedBrandId]);

  // Recalculate inverter price when inverter brand or kW changes
  useEffect(() => {
    const inv = INVERTER_BRANDS.find(i => i.id === selectedInverterId);
    setInverterKw(solarKw <= 3.3 ? solarKw : Math.ceil(solarKw));
    const ratePerKw = inv ? inv.approxRatePerKw : 7500;
    setInverterPrice(Math.round(solarKw * ratePerKw));
  }, [solarKw, selectedInverterId]);

  // Handle Equipment row editing
  const handleUpdateEquipment = (id: string, field: 'quantity' | 'unit_price', val: number) => {
    setEquipmentList(prev => prev.map(item => {
      if (item.id === id) {
        const qty = field === 'quantity' ? val : item.quantity;
        const price = field === 'unit_price' ? val : item.unit_price;
        return { ...item, quantity: qty, unit_price: price, total_price: qty * price };
      }
      return item;
    }));
  };

  const handleRemoveEquipment = (id: string) => {
    setEquipmentList(prev => prev.filter(item => item.id !== id));
  };

  const handleAddEquipment = () => {
    const newItem: QuotationEquipmentItem = {
      id: `custom-eq-${Date.now()}`,
      name: 'Custom Equipment / Spare',
      category: 'OTHER',
      quantity: 1,
      unit: 'Set',
      unit_price: 1500,
      total_price: 1500,
      is_editable: true,
    };
    setEquipmentList([...equipmentList, newItem]);
  };

  // Comprehensive Estimate Calculations
  const totalPanelsCost = panelPieces * panelUnitPrice;
  const totalOtherEquipmentCost = equipmentList.reduce((acc, it) => acc + it.total_price, 0);
  const subtotalBeforeTax = totalPanelsCost + inverterPrice + structurePrice + totalOtherEquipmentCost + installationCharge + transportOtherCharge;
  const gstAmount = Math.round(subtotalBeforeTax * 0.138); // 13.8% composite solar GST
  const grossTotalCost = subtotalBeforeTax + gstAmount;

  // Central Subsidy PM Surya Ghar DBT
  let centralSubsidy = 0;
  if (solarKw <= 1.0) centralSubsidy = 30000;
  else if (solarKw <= 2.0) centralSubsidy = 60000;
  else centralSubsidy = 78000;

  // Chhattisgarh State Subsidy
  let stateSubsidy = 0;
  if (solarKw >= 5.0) stateSubsidy = 25000;
  else if (solarKw >= 3.0) stateSubsidy = 15000;
  else stateSubsidy = 5000;

  const netCustomerCost = Math.max(grossTotalCost - centralSubsidy - stateSubsidy, 10000);

  // Monthly savings & loan
  const monthlyUnits = Math.round(solarKw * 4.3 * 30);
  const monthlySavings = Math.round(monthlyUnits * 6.8);
  const loanEligible = Math.round(grossTotalCost * 0.90);
  const monthlyRate = 0.07 / 12;
  const n = 60;
  const estMonthlyEmi = Math.round((loanEligible * monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1));

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !phone) return;

    const brandObj = SOLAR_BRANDS.find(b => b.id === selectedBrandId);
    const invObj = INVERTER_BRANDS.find(i => i.id === selectedInverterId);

    const now = new Date();
    const count = Date.now().toString().slice(-3);
    const qtnNo = `BNPS/QTN/${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}/${count}`;

    const newQuotation: Quotation = {
      id: `quot-${Date.now()}`,
      quotation_no: qtnNo,
      customer_name: customerName,
      phone,
      email: email || undefined,
      address_line: addressLine || undefined,
      state: 'Chhattisgarh',
      district,
      tehsil,
      block,
      panchayat_village: panchayatVillage || undefined,
      pincode,
      branch,
      consumer_number: consumerNumber || `CSPDCL-${Date.now().toString().slice(-8)}`,
      sanctioned_load_kw: sanctionedLoad,
      discom_name: `CSPDCL (${district} Circle)`,
      roof_type: structureType,
      system_type: systemType,
      cell_type: cellType,
      solar_brand: brandObj ? brandObj.name : selectedBrandId,
      module_type: `${panelWattage}Wp ${brandObj?.name || ''} ${cellType}`,
      module_quantity: panelPieces,
      module_wattage_wp: panelWattage,
      panel_unit_price: panelUnitPrice,
      panel_total_price: totalPanelsCost,
      inverter_brand: invObj ? invObj.name : selectedInverterId,
      inverter_kw: inverterKw,
      inverter_model: `${invObj?.name || 'On-Grid Inverter'} (${inverterKw} kW, ${inverterPhase})`,
      inverter_price: inverterPrice,
      structure_type: structureType,
      structure_price: structurePrice,
      installation_charge: installationCharge,
      transport_other_charge: transportOtherCharge,
      equipment_items: equipmentList,
      capacity_kw: solarKw,
      rate_per_kw: Math.round(grossTotalCost / solarKw),
      subtotal_cost: subtotalBeforeTax,
      gst_amount: gstAmount,
      total_project_cost: grossTotalCost,
      central_subsidy_amount: centralSubsidy,
      state_subsidy_amount: stateSubsidy,
      net_customer_cost: netCustomerCost,
      monthly_savings_est: monthlySavings,
      annual_savings_est: monthlySavings * 12,
      payback_period_years: Number((netCustomerCost / (monthlySavings * 12)).toFixed(1)),
      lifetime_savings_est: monthlySavings * 12 * 25,
      loan_eligible_amount: loanEligible,
      est_monthly_emi: estMonthlyEmi,
      status: 'SENT',
      valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      prepared_by: `${currentProfile.full_name} (${branch} Branch)`,
      created_at: new Date().toISOString(),
    };

    onSave(newQuotation);
  };

  return (
    <form onSubmit={handleFormSubmit} className="space-y-6">
      {/* 1. Customer Name & Address */}
      <div className="bg-slate-900/90 rounded-2xl p-5 border border-slate-800 space-y-4 shadow-md">
        <h4 className="text-sm font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
          <span>1. Customer & Location Details</span>
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-1">
            <label className="block text-xs font-semibold text-slate-300 mb-1">Customer Name *</label>
            <input
              type="text"
              required
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="e.g. Rameshwar Sahu"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Mobile Number *</label>
            <input
              type="tel"
              required
              maxLength={10}
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
              placeholder="10 Digits"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Branch Office *</label>
            <select
              value={branch}
              onChange={(e) => setBranch(e.target.value as BranchLocation)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
            >
              <option value="Sakti">Sakti</option>
              <option value="Jaijaipur">Jaijaipur</option>
              <option value="Korba">Korba</option>
              <option value="Bilaspur">Bilaspur</option>
              <option value="Janjgir-Champa">Janjgir-Champa</option>
              <option value="Raigarh">Raigarh</option>
              <option value="Raipur">Raipur</option>
            </select>
          </div>
        </div>

        {/* Address Hierarchy */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">District *</label>
            <select
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
            >
              {CHHATTISGARH_DISTRICTS.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Tehsil *</label>
            <input
              type="text"
              value={tehsil}
              onChange={(e) => setTehsil(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Block *</label>
            <input
              type="text"
              value={block}
              onChange={(e) => setBlock(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Gram Panchayat / Village</label>
            <input
              type="text"
              value={panchayatVillage}
              onChange={(e) => setPanchayatVillage(e.target.value)}
              placeholder="e.g. Baradwar"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-300 mb-1">House / Street Address</label>
            <input
              type="text"
              value={addressLine}
              onChange={(e) => setAddressLine(e.target.value)}
              placeholder="e.g. Ward No. 5, Near Shiv Mandir"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">CSPDCL Consumer No (BP)</label>
            <input
              type="text"
              value={consumerNumber}
              onChange={(e) => setConsumerNumber(e.target.value)}
              placeholder="10 Digits"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>
      </div>

      {/* 2. Solar Capacity & System Type Selection */}
      <div className="bg-slate-900/90 rounded-2xl p-5 border border-slate-800 space-y-4 shadow-md">
        <h4 className="text-sm font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
          <span>2. Solar Capacity & Type</span>
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Solar Plant Capacity (kW) *</label>
            <select
              value={solarKw}
              onChange={(e) => setSolarKw(Number(e.target.value))}
              className="w-full bg-slate-950 border border-amber-500/40 rounded-lg px-3 py-2 text-xs font-mono font-bold text-amber-300 focus:outline-none"
            >
              {SOLAR_KW_OPTIONS.map(kw => (
                <option key={kw} value={kw}>{kw} kW Plant</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Type of Solar *</label>
            <select
              value={systemType}
              onChange={(e) => setSystemType(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none"
            >
              <option value="ON_GRID">On-Grid (Net Metered - PM Surya Ghar Subsidy)</option>
              <option value="OFF_GRID">Off-Grid (Battery Storage)</option>
              <option value="HYBRID">Hybrid (Grid Tied + Battery Backup)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Cell Type *</label>
            <select
              value={cellType}
              onChange={(e) => setCellType(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none"
            >
              {CELL_TYPES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 3. Solar Panel Brand, Wattage, Pieces & Editable Price */}
      <div className="bg-slate-900/90 rounded-2xl p-5 border border-slate-800 space-y-4 shadow-md">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
            <Sun className="w-4 h-4" />
            <span>3. Solar Panels: Brand, Pieces & Price Edit</span>
          </h4>
          <span className="text-xs font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
            Total Panel Cost: ₹{totalPanelsCost.toLocaleString('en-IN')}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Solar Brand *</label>
            <select
              value={selectedBrandId}
              onChange={(e) => setSelectedBrandId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none"
            >
              {SOLAR_BRANDS.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.tier})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Module Wattage (Wp) *</label>
            <select
              value={panelWattage}
              onChange={(e) => setPanelWattage(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none"
            >
              <option value={550}>550 Wp</option>
              <option value={575}>575 Wp (TopCon)</option>
              <option value={540}>540 Wp</option>
              <option value={450}>450 Wp</option>
              <option value={330}>330 Wp</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Number of Pieces (Panel Qty) *
            </label>
            <input
              type="number"
              min={1}
              value={panelPieces}
              onChange={(e) => setPanelPieces(Number(e.target.value))}
              className="w-full bg-slate-950 border border-amber-500/50 rounded-lg px-3 py-2 text-xs font-mono font-bold text-amber-300 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
              <span>Unit Price / Panel (₹) *</span>
              <span className="text-[10px] text-amber-400 flex items-center gap-0.5"><Edit3 className="w-2.5 h-2.5" /> Editable</span>
            </label>
            <input
              type="number"
              value={panelUnitPrice}
              onChange={(e) => setPanelUnitPrice(Number(e.target.value))}
              className="w-full bg-slate-950 border border-amber-500/50 rounded-lg px-3 py-2 text-xs font-mono font-bold text-amber-300 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* 4. Solar Inverter: Brand, kW & Editable Price */}
      <div className="bg-slate-900/90 rounded-2xl p-5 border border-slate-800 space-y-4 shadow-md">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
            <Cpu className="w-4 h-4" />
            <span>4. Solar Inverter: Brand, KW & Price Edit</span>
          </h4>
          <span className="text-xs font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
            Inverter Cost: ₹{inverterPrice.toLocaleString('en-IN')}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Inverter Brand *</label>
            <select
              value={selectedInverterId}
              onChange={(e) => setSelectedInverterId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none"
            >
              {INVERTER_BRANDS.map(i => (
                <option key={i.id} value={i.id}>{i.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Inverter Rating (kW) *</label>
            <select
              value={inverterKw}
              onChange={(e) => setInverterKw(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none"
            >
              {SOLAR_KW_OPTIONS.map(kw => (
                <option key={kw} value={kw}>{kw} kW</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Phase *</label>
            <select
              value={inverterPhase}
              onChange={(e) => setInverterPhase(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none"
            >
              <option value="1-Phase">1-Phase (Single Phase)</option>
              <option value="3-Phase">3-Phase (Three Phase)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
              <span>Inverter Price (₹) *</span>
              <span className="text-[10px] text-amber-400 flex items-center gap-0.5"><Edit3 className="w-2.5 h-2.5" /> Editable</span>
            </label>
            <input
              type="number"
              value={inverterPrice}
              onChange={(e) => setInverterPrice(Number(e.target.value))}
              className="w-full bg-slate-950 border border-amber-500/50 rounded-lg px-3 py-2 text-xs font-mono font-bold text-amber-300 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* 5. Complete Equipment List with Prices & Edit Option */}
      <div className="bg-slate-900/90 rounded-2xl p-5 border border-slate-800 space-y-4 shadow-md">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-amber-400 uppercase tracking-wider">
              5. All Equipment List (BOS & Protection)
            </h4>
            <p className="text-xs text-slate-400">Module Mounting Structure (MMS), ACDB/DCDB, UV DC Cables, Chemical Earthing, Lightning Arrester & Smart Net Meter</p>
          </div>
          <button
            type="button"
            onClick={handleAddEquipment}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Add Equipment</span>
          </button>
        </div>

        {/* Structure Row */}
        <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-300 mb-1">Module Mounting Structure (MMS) *</label>
            <select
              value={structureType}
              onChange={(e) => setStructureType(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200"
            >
              <option value="Standard HDG GI Flush Mount">Standard HDG GI Flush Roof Mount</option>
              <option value="Elevated Superstructure (7-8 ft high)">Elevated Superstructure (7-8 ft high for roof usage)</option>
              <option value="Heavy Duty Tin Shed Clamps">Tin Shed Aluminum Clamps</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
              <span>Structure Price (₹)</span>
              <span className="text-[10px] text-amber-400">Editable</span>
            </label>
            <input
              type="number"
              value={structurePrice}
              onChange={(e) => setStructurePrice(Number(e.target.value))}
              className="w-full bg-slate-900 border border-amber-500/40 rounded px-2.5 py-1.5 text-xs font-mono font-bold text-amber-300"
            />
          </div>
        </div>

        {/* Dynamic Equipment Table */}
        <div className="overflow-x-auto border border-slate-800 rounded-xl">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 text-[11px]">
              <tr>
                <th className="p-2.5">Item Name / Description</th>
                <th className="p-2.5 w-24">Qty</th>
                <th className="p-2.5 w-20">Unit</th>
                <th className="p-2.5 w-32">Unit Price (₹)</th>
                <th className="p-2.5 w-32 text-right">Total Price (₹)</th>
                <th className="p-2.5 w-12 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-200">
              {equipmentList.map(eq => (
                <tr key={eq.id} className="hover:bg-slate-800/40">
                  <td className="p-2.5 font-medium">
                    <input
                      type="text"
                      value={eq.name}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEquipmentList(prev => prev.map(it => it.id === eq.id ? { ...it, name: val } : it));
                      }}
                      className="w-full bg-transparent border-b border-transparent hover:border-slate-700 focus:border-amber-500 text-xs text-slate-200 focus:outline-none"
                    />
                  </td>
                  <td className="p-2.5">
                    <input
                      type="number"
                      min={1}
                      value={eq.quantity}
                      onChange={(e) => handleUpdateEquipment(eq.id, 'quantity', Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs font-mono text-center focus:outline-none focus:border-amber-500"
                    />
                  </td>
                  <td className="p-2.5 text-slate-400">{eq.unit}</td>
                  <td className="p-2.5">
                    <input
                      type="number"
                      value={eq.unit_price}
                      onChange={(e) => handleUpdateEquipment(eq.id, 'unit_price', Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs font-mono text-right focus:outline-none focus:border-amber-500"
                    />
                  </td>
                  <td className="p-2.5 text-right font-mono font-bold text-amber-300">
                    ₹{eq.total_price.toLocaleString('en-IN')}
                  </td>
                  <td className="p-2.5 text-center">
                    <button
                      type="button"
                      onClick={() => handleRemoveEquipment(eq.id)}
                      className="p-1 rounded text-red-400 hover:bg-red-500/20"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. Installation Charge & Other / Transport Charge */}
      <div className="bg-slate-900/90 rounded-2xl p-5 border border-slate-800 space-y-4 shadow-md">
        <h4 className="text-sm font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
          <span>6. Installation & Other Charges / Freight</span>
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
            <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1.5"><Wrench className="w-3.5 h-3.5 text-amber-400" /> Installation & Civil Labor Charge (₹) *</span>
              <span className="text-[10px] text-amber-400">Editable</span>
            </label>
            <input
              type="number"
              value={installationCharge}
              onChange={(e) => setInstallationCharge(Number(e.target.value))}
              className="w-full bg-slate-900 border border-amber-500/40 rounded-lg px-3 py-2 text-xs font-mono font-bold text-amber-300 focus:outline-none"
            />
            <p className="text-[10px] text-slate-500 mt-1">Includes: Module mounting, cabling, earthing pit excavation & testing</p>
          </div>

          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
            <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1.5"><Truck className="w-3.5 h-3.5 text-amber-400" /> Other Charge / Freight & Transport (₹) *</span>
              <span className="text-[10px] text-amber-400">Editable</span>
            </label>
            <input
              type="number"
              value={transportOtherCharge}
              onChange={(e) => setTransportOtherCharge(Number(e.target.value))}
              className="w-full bg-slate-900 border border-amber-500/40 rounded-lg px-3 py-2 text-xs font-mono font-bold text-amber-300 focus:outline-none"
            />
            <p className="text-[10px] text-slate-500 mt-1">Includes: Vehicle transport, freight, loading/unloading & CSPDCL net meter liaisoning</p>
          </div>
        </div>
      </div>

      {/* 7. Comprehensive Live Estimate Summary Box */}
      <div className="bg-gradient-to-br from-amber-500/20 via-slate-900 to-slate-950 rounded-2xl p-6 border-2 border-amber-500 shadow-2xl space-y-5">
        <div className="flex items-center justify-between border-b border-amber-500/40 pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-amber-400" />
            <div>
              <h3 className="text-base font-bold text-slate-100">Live Solar Estimate Summary</h3>
              <p className="text-xs text-slate-400">Auto-calculated estimate for all selected and customized components</p>
            </div>
          </div>
          <span className="text-sm font-mono font-bold px-3 py-1 rounded-full bg-amber-500 text-slate-950">
            {solarKw} kW Plant
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Breakdown List */}
          <div className="space-y-2 text-xs text-slate-300">
            <div className="flex justify-between">
              <span>Solar Panels ({panelPieces} × {panelWattage}Wp {SOLAR_BRANDS.find(b=>b.id===selectedBrandId)?.name}):</span>
              <span className="font-mono font-semibold">₹{totalPanelsCost.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between">
              <span>Solar Inverter ({inverterKw} kW {INVERTER_BRANDS.find(i=>i.id===selectedInverterId)?.name}):</span>
              <span className="font-mono font-semibold">₹{inverterPrice.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between">
              <span>Mounting Structure:</span>
              <span className="font-mono font-semibold">₹{structurePrice.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between">
              <span>BOS & Protection Equipment:</span>
              <span className="font-mono font-semibold">₹{totalOtherEquipmentCost.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between">
              <span>Installation & Civil Charges:</span>
              <span className="font-mono font-semibold">₹{installationCharge.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between">
              <span>Other Charges / Freight & Transport:</span>
              <span className="font-mono font-semibold">₹{transportOtherCharge.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between pt-1 border-t border-slate-800 text-slate-400">
              <span>Subtotal (Before Tax):</span>
              <span className="font-mono">₹{subtotalBeforeTax.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>GST @ 13.8%:</span>
              <span className="font-mono">₹{gstAmount.toLocaleString('en-IN')}</span>
            </div>
          </div>

          {/* Subsidies & Net Payable Highlights */}
          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex flex-col justify-between space-y-3">
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-300">
                <span>Gross Project Cost:</span>
                <span className="font-mono font-bold text-slate-100">₹{grossTotalCost.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-emerald-400 font-semibold">
                <span>Central PM Surya Ghar DBT Subsidy:</span>
                <span className="font-mono font-bold">- ₹{centralSubsidy.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-emerald-400 font-semibold">
                <span>State Solar Subsidy (CG):</span>
                <span className="font-mono font-bold">- ₹{stateSubsidy.toLocaleString('en-IN')}</span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800 text-center space-y-1">
              <div className="text-[11px] text-amber-300 font-bold uppercase tracking-wider">
                FINAL NET PAYABLE AMOUNT BY CUSTOMER
              </div>
              <div className="text-3xl font-black font-mono text-amber-400">
                ₹{netCustomerCost.toLocaleString('en-IN')}
              </div>
              <div className="text-[10px] text-slate-400">
                Monthly Savings: ₹{monthlySavings.toLocaleString('en-IN')}/mo | 7% Loan EMI: ~₹{estMonthlyEmi.toLocaleString('en-IN')}/mo
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-4 border-t border-amber-500/40 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-xl shadow-amber-500/30 transition transform hover:-translate-y-0.5 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Generate Official Quotation & Estimate Letterhead</span>
          </button>
        </div>
      </div>
    </form>
  );
};
