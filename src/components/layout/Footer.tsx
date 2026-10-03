import React, { useState } from 'react';
import { BnpsLogo } from '../common/BnpsLogo';
import { 
  Phone, 
  Mail, 
  MapPin, 
  User, 
  Send,
  Check,
  Facebook,
  Twitter,
  Linkedin,
  Instagram,
  Share2
} from 'lucide-react';

export const Footer: React.FC = () => {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      setSubscribed(true);
      setTimeout(() => {
        setEmail('');
        setSubscribed(false);
      }, 4000);
    }
  };

  return (
    <footer className="mt-16 bg-[#090e1a] text-slate-400 text-xs border-t border-slate-800/80 print:hidden font-sans">
      <div className="max-w-7xl mx-auto px-6 py-12 lg:py-16">
        {/* 4 Clean Columns Matching 18.PNG - No Boxes, Pure Typography & Links */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-8">
          
          {/* Column 1: Info */}
          <div className="space-y-3">
            <h4 className="text-white font-bold text-sm tracking-wider">
              Info
            </h4>
            <ul className="space-y-2 text-slate-400 text-xs">
              <li className="text-slate-200 font-semibold">
                BHUMI NIDHI POWAR SOLUTION
              </li>
              <li>
                Constitution: <span className="text-slate-300">Proprietorship</span>
              </li>
              <li>
                Owner: <span className="text-slate-300">Ghanshyam Prasad Yadav</span>
              </li>
              <li>
                GSTIN: <span className="text-slate-300 font-mono">22ADRPY7738F1ZX</span>
              </li>
              <li>
                State: <span className="text-slate-300">22-Chhattisgarh</span>
              </li>
              <li>
                PM Surya Ghar Authorized Partner
              </li>
              <li>
                CSPDCL Approved Solar Vendor
              </li>
              <li>
                CREDA Certified Channel Partner
              </li>
            </ul>
          </div>

          {/* Column 2: Head Office & Branches */}
          <div className="space-y-3">
            <h4 className="text-white font-bold text-sm tracking-wider">
              Head Office & Branches
            </h4>
            <ul className="space-y-2 text-slate-400 text-xs">
              <li className="text-amber-400 font-semibold">
                Head Office: Jaijaipur
              </li>
              <li className="text-slate-300 leading-relaxed">
                Near By HDFC Bank, Jaijaipur,<br />
                District: Sakti, Chhattisgarh - 495690
              </li>
              <li className="pt-1 text-slate-300 font-medium">
                Branch Network:
              </li>
              <li>Sakti Main Branch</li>
              <li>Jaijaipur Operations Desk</li>
              <li>Janjgir-Champa Desk</li>
              <li>Korba Powar City Hub</li>
              <li>Bilaspur & Basana Office</li>
              <li>Raipur Regional Support</li>
            </ul>
          </div>

          {/* Column 3: Solar Solutions */}
          <div className="space-y-3">
            <h4 className="text-white font-bold text-sm tracking-wider">
              Solar Solutions
            </h4>
            <ul className="space-y-2 text-slate-400 text-xs">
              <li>Residential Rooftop Solar</li>
              <li>Commercial & Industrial EPC</li>
              <li>On-Grid Net Metering Systems</li>
              <li>Off-Grid Battery Storage Plants</li>
              <li>Hybrid Solar Generators</li>
              <li>Central DBT Subsidy (₹78,000)</li>
              <li>7% Bank Solar Rooftop Loan</li>
              <li>5-Year Comprehensive AMC</li>
            </ul>
          </div>

          {/* Column 4: Newsletter & Inquiries Matching 18.PNG */}
          <div className="space-y-3.5">
            <h4 className="text-white font-bold text-sm tracking-wider">
              Newsletter
            </h4>
            <p className="text-slate-400 text-xs leading-relaxed">
              Subscribe to our newsletter for a weekly dose of solar news, PM Surya Ghar subsidy updates, and exclusive rooftop offers.
            </p>

            {/* Newsletter Input + Subscribe Button */}
            <form onSubmit={handleSubscribe} className="space-y-2">
              <div className="flex items-center gap-1.5 bg-[#0e1628] border border-slate-700 rounded-lg p-1 focus-within:border-amber-500 transition">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Your email"
                  className="bg-transparent text-slate-200 placeholder-slate-500 text-xs px-2.5 py-1.5 flex-1 focus:outline-none"
                />
                <button
                  type="submit"
                  className="bg-white hover:bg-slate-100 text-slate-950 font-bold text-[11px] px-3.5 py-1.5 rounded uppercase tracking-wider transition shrink-0 cursor-pointer"
                >
                  {subscribed ? 'SUBSCRIBED' : 'SUBSCRIBE'}
                </button>
              </div>

              {subscribed && (
                <div className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" />
                  <span>Thank you for subscribing!</span>
                </div>
              )}
            </form>

            {/* Direct Contact Info */}
            <div className="pt-1 text-[11px] text-slate-400 space-y-1">
              <div>Phone: <span className="font-mono text-slate-200">9691762929, 9131040126, 8305218826</span></div>
              <div>Email: <span className="font-mono text-slate-200">myfun11g@gmail.com</span></div>
            </div>

            {/* Social Icons row matching 18.PNG */}
            <div className="flex items-center gap-3 pt-2 text-slate-400">
              <a href="#facebook" title="Facebook" className="hover:text-white transition">
                <Facebook className="w-4 h-4" />
              </a>
              <a href="#twitter" title="Twitter / X" className="hover:text-white transition">
                <Twitter className="w-4 h-4" />
              </a>
              <a href="#linkedin" title="LinkedIn" className="hover:text-white transition">
                <Linkedin className="w-4 h-4" />
              </a>
              <a href="#instagram" title="Instagram" className="hover:text-white transition">
                <Instagram className="w-4 h-4" />
              </a>
              <a href="https://api.whatsapp.com/send?phone=919691762929" target="_blank" rel="noreferrer" title="WhatsApp" className="hover:text-emerald-400 transition">
                <Share2 className="w-4 h-4" />
              </a>
            </div>
          </div>

        </div>

        {/* Clean Bottom Bar - Pure English, No Box */}
        <div className="mt-12 pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            © {new Date().getFullYear()} <strong className="text-slate-400">BHUMI NIDHI POWAR SOLUTION</strong>. All rights reserved.
          </div>
          <div className="text-[11px] text-slate-400">
            Head Office: Near By HDFC Bank, Jaijaipur, Dist: Sakti, Chhattisgarh - 495690
          </div>
        </div>
      </div>
    </footer>
  );
};
