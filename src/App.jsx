import { useState, useEffect } from "react";
import { db } from "./firebase";
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";

const FREQUENCIES = ["Weekly", "Biweekly", "Monthly"];
const VISIT_STATUSES = ["Scheduled", "In Progress", "Visit Completed", "Paid & Invoiced"];
const PRICE_PER_VISIT = 45;

export default function App() {
  const [customers, setCustomers] = useState([]);
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [tab, setTab] = useState("customers");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [lawnSize, setLawnSize] = useState("");
  const [instructions, setInstructions] = useState("");
  const [frequency, setFrequency] = useState("Weekly");

  const [selectedCustomer, setSelectedCustomer] = useState(null);

  function notify(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 3200);
  }

  async function loadData() {
    setLoading(true);
    const custSnap = await getDocs(collection(db, "customers"));
    setCustomers(custSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    const visitSnap = await getDocs(collection(db, "visits"));
    setVisits(visitSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    setLoading(false);
  }
  useEffect(() => { loadData(); }, []);

  async function addCustomer() {
    if (!name || !email) return notify("⚠ Name and email are required");
    await addDoc(collection(db, "customers"), {
      name, email, phone, address, lawnSize, instructions, frequency, planStatus: "Active",
    });
    setName(""); setEmail(""); setPhone(""); setAddress("");
    setLawnSize(""); setInstructions(""); setFrequency("Weekly");
    notify("✓ Account created");
    loadData();
  }
  async function deleteCustomer(id) { await deleteDoc(doc(db, "customers", id)); loadData(); }
  async function togglePlan(cust) {
    const next = cust.planStatus === "Active" ? "Paused" : "Active";
    await updateDoc(doc(db, "customers", cust.id), { planStatus: next });
    notify(`Plan ${next.toLowerCase()} for ${cust.name}`); loadData();
  }
  async function cyclePlan(cust) {
    const idx = FREQUENCIES.indexOf(cust.frequency);
    const nextFreq = FREQUENCIES[(idx + 1) % FREQUENCIES.length];
    await updateDoc(doc(db, "customers", cust.id), { frequency: nextFreq });
    notify(`Plan changed to ${nextFreq}`); loadData();
  }
  async function generateVisit(cust) {
    const today = new Date();
    const days = cust.frequency === "Weekly" ? 7 : cust.frequency === "Biweekly" ? 14 : 30;
    const next = new Date(today.getTime() + days * 86400000);
    await addDoc(collection(db, "visits"), {
      customerId: cust.id, customerName: cust.name,
      scheduledDate: next.toISOString().slice(0, 10),
      status: "Scheduled", amount: PRICE_PER_VISIT,
    });
    notify("✓ Visit scheduled · reminder sent to customer"); loadData();
  }
  async function advanceVisit(visit) {
    const idx = VISIT_STATUSES.indexOf(visit.status);
    if (idx < VISIT_STATUSES.length - 1) {
      const nextStatus = VISIT_STATUSES[idx + 1];
      await updateDoc(doc(db, "visits", visit.id), { status: nextStatus });
      if (nextStatus === "Visit Completed") notify("✓ Confirmation sent to customer");
      if (nextStatus === "Paid & Invoiced") notify("✓ Charged via Square · invoice generated");
      loadData();
    }
  }
  async function rescheduleVisit(visit) {
    const input = prompt("New date (YYYY-MM-DD):", visit.scheduledDate);
    if (!input) return;
    const hoursAway = (new Date(input) - new Date()) / 3600000;
    if (hoursAway < 24) { notify("✗ Rejected — must reschedule at least 24 hours in advance"); return; }
    await updateDoc(doc(db, "visits", visit.id), { scheduledDate: input, status: "Scheduled" });
    notify("✓ Visit rescheduled · customer notified"); loadData();
  }
  async function skipVisit(visit) {
    await updateDoc(doc(db, "visits", visit.id), { status: "Skipped" });
    notify("Visit skipped · customer notified"); loadData();
  }
  async function failPayment(visit) {
    await updateDoc(doc(db, "visits", visit.id), { status: "Payment Failed" });
    notify("✗ Payment failed · customer notified to retry"); loadData();
  }
  async function retryPayment(visit) {
    await updateDoc(doc(db, "visits", visit.id), { status: "Paid & Invoiced" });
    notify("✓ Payment retried via Square"); loadData();
  }
  async function deleteVisit(id) { await deleteDoc(doc(db, "visits", id)); loadData(); }

  const shownVisits = selectedCustomer ? visits.filter((v) => v.customerId === selectedCustomer) : visits;
  const activeCount = customers.filter((c) => c.planStatus === "Active").length;
  const upcomingCount = visits.filter((v) => v.status === "Scheduled").length;
  const completedCount = visits.filter((v) => v.status === "Visit Completed" || v.status === "Paid & Invoiced").length;
  const invoiceCount = visits.filter((v) => v.status === "Paid & Invoiced").length;

  return (
    <div style={S.app}>
      {toast && <div style={S.toast}>{toast}</div>}

      <div style={S.topbar}>
        <div style={S.brand}>
          <span style={S.logo}>🌿</span>
          <div>
            <div style={S.brandName}>GreenBlade Lawn Care</div>
            <div style={S.brandSub}>Recurring Lawn Care Management System</div>
          </div>
        </div>
      </div>

      <div style={S.container}>
        <div style={S.statRow}>
          <Stat label="Customers" value={customers.length} accent="#2e7d32" />
          <Stat label="Active Plans" value={activeCount} accent="#1565c0" />
          <Stat label="Completed Visits" value={completedCount} accent="#e65100" />
          <Stat label="Invoices" value={invoiceCount} accent="#6a1b9a" />
        </div>

        <div style={S.tabs}>
          <button style={tab === "customers" ? S.tabActive : S.tab} onClick={() => setTab("customers")}>Customers</button>
          <button style={tab === "visits" ? S.tabActive : S.tab} onClick={() => setTab("visits")}>Visits</button>
        </div>

        {loading && <p style={S.muted}>Loading…</p>}

        {tab === "customers" && (
          <>
            <div style={S.card}>
              <h2 style={S.h2}>New Customer &amp; Service Plan</h2>
              <div style={S.formGrid}>
                <Field label="Full name"><input style={S.input} value={name} onChange={(e) => setName(e.target.value)} /></Field>
                <Field label="Email"><input style={S.input} value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
                <Field label="Phone"><input style={S.input} value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
                <Field label="Address"><input style={S.input} value={address} onChange={(e) => setAddress(e.target.value)} /></Field>
                <Field label="Lawn size"><input style={S.input} value={lawnSize} onChange={(e) => setLawnSize(e.target.value)} placeholder="e.g. Medium" /></Field>
                <Field label="Special instructions"><input style={S.input} value={instructions} onChange={(e) => setInstructions(e.target.value)} /></Field>
                <Field label="Service frequency">
                  <select style={S.input} value={frequency} onChange={(e) => setFrequency(e.target.value)}>
                    {FREQUENCIES.map((f) => <option key={f}>{f}</option>)}
                  </select>
                </Field>
                <div style={{ display: "flex", alignItems: "flex-end" }}>
                  <button style={S.primaryBtn} onClick={addCustomer}>+ Add Customer</button>
                </div>
              </div>
            </div>

            <div style={S.card}>
              <h2 style={S.h2}>Customers <span style={S.count}>{customers.length}</span></h2>
              {customers.length === 0 && <p style={S.muted}>No customers yet — add one above.</p>}
              {customers.map((c) => (
                <div key={c.id} style={S.listItem}>
                  <div style={S.avatar}>{(c.name || "?").charAt(0).toUpperCase()}</div>
                  <div style={{ flex: 1 }}>
                    <div style={S.itemTitle}>{c.name}
                      <span style={{ ...S.pill, ...(c.planStatus === "Active" ? S.pillGreen : S.pillGray) }}>{c.planStatus}</span>
                      <span style={{ ...S.pill, ...S.pillBlue }}>{c.frequency}</span>
                    </div>
                    <div style={S.itemSub}>{c.email}{c.phone ? ` · ${c.phone}` : ""}</div>
                    <div style={S.itemSub}>{c.address}{c.lawnSize ? ` · Lawn: ${c.lawnSize}` : ""}{c.instructions ? ` · “${c.instructions}”` : ""}</div>
                  </div>
                  <div style={S.actions}>
                    <button style={S.primaryBtn} onClick={() => generateVisit(c)}>Schedule Visit</button>
                    <button style={S.btn} onClick={() => cyclePlan(c)}>Change Plan</button>
                    <button style={S.btn} onClick={() => togglePlan(c)}>{c.planStatus === "Active" ? "Pause" : "Resume"}</button>
                    <button style={S.btn} onClick={() => { setSelectedCustomer(c.id); setTab("visits"); }}>Visits</button>
                    <button style={S.iconBtn} onClick={() => deleteCustomer(c.id)}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === "visits" && (
          <div style={S.card}>
            <h2 style={S.h2}>
              Visits <span style={S.count}>{shownVisits.length}</span>
              {selectedCustomer && <button style={{ ...S.btn, marginLeft: 10 }} onClick={() => setSelectedCustomer(null)}>Show all</button>}
            </h2>
            {shownVisits.length === 0 && <p style={S.muted}>No visits scheduled yet.</p>}
            {shownVisits.map((v) => (
              <div key={v.id} style={S.listItem}>
                <div style={{ ...S.statusDot, background: statusColor(v.status) }} />
                <div style={{ flex: 1 }}>
                  <div style={S.itemTitle}>{v.customerName}
                    <span style={{ ...S.pill, background: statusColor(v.status), color: "#333" }}>{v.status}</span>
                  </div>
                  <div style={S.itemSub}>Scheduled {v.scheduledDate} · ${v.amount}</div>
                </div>
                <div style={S.actions}>
                  {v.status !== "Paid & Invoiced" && v.status !== "Skipped" && v.status !== "Payment Failed" && (
                    <button style={S.primaryBtn} onClick={() => advanceVisit(v)}>{nextLabel(v.status)}</button>
                  )}
                  {v.status === "Scheduled" && (<>
                    <button style={S.btn} onClick={() => rescheduleVisit(v)}>Reschedule</button>
                    <button style={S.btn} onClick={() => skipVisit(v)}>Skip</button>
                  </>)}
                  {v.status === "Visit Completed" && <button style={S.btn} onClick={() => failPayment(v)}>Simulate Fail</button>}
                  {v.status === "Payment Failed" && <button style={S.primaryBtn} onClick={() => retryPayment(v)}>Retry Payment</button>}
                  <button style={S.iconBtn} onClick={() => deleteVisit(v.id)}>✕</button>
                </div>
              </div>
            ))}
          </div>
        )}

        <footer style={S.footer}>GreenBlade Lawn Care · Throwaway Prototype · MB385 System Proposal</footer>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div style={S.stat}>
      <div style={{ ...S.statValue, color: accent }}>{value}</div>
      <div style={S.statLabel}>{label}</div>
    </div>
  );
}
function Field({ label, children }) {
  return (<label style={S.field}><span style={S.fieldLabel}>{label}</span>{children}</label>);
}
function nextLabel(status) {
  switch (status) {
    case "Scheduled": return "Start Visit";
    case "In Progress": return "Mark Complete";
    case "Visit Completed": return "Charge via Square";
    default: return "Advance";
  }
}
function statusColor(status) {
  switch (status) {
    case "Scheduled": return "#cfe3f7";
    case "In Progress": return "#fae6b8";
    case "Visit Completed": return "#e0cdf5";
    case "Paid & Invoiced": return "#c3eccf";
    case "Skipped": return "#e2e2e2";
    case "Payment Failed": return "#f5c6c6";
    default: return "#eee";
  }
}

const green = "#2e7d32";
const S = {
  app: { minHeight: "100vh", background: "#f4f6f4", fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif", color: "#1f2421" },
  topbar: { background: `linear-gradient(90deg, ${green}, #43a047)`, padding: "18px 0", boxShadow: "0 2px 12px rgba(0,0,0,0.12)" },
  brand: { maxWidth: 960, margin: "0 auto", padding: "0 20px", display: "flex", alignItems: "center", gap: 14 },
  logo: { fontSize: 34 },
  brandName: { color: "#fff", fontSize: 22, fontWeight: 700, letterSpacing: 0.3 },
  brandSub: { color: "rgba(255,255,255,0.85)", fontSize: 13 },
  container: { maxWidth: 960, margin: "0 auto", padding: "24px 20px 64px" },
  statRow: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 22 },
  stat: { background: "#fff", borderRadius: 14, padding: "16px 18px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", borderTop: "3px solid #eee" },
  statValue: { fontSize: 26, fontWeight: 700 },
  statLabel: { fontSize: 12.5, color: "#6b7269", marginTop: 2, textTransform: "uppercase", letterSpacing: 0.5 },
  tabs: { display: "flex", gap: 6, marginBottom: 16 },
  tab: { padding: "9px 20px", border: "none", background: "transparent", color: "#5a615a", borderRadius: 10, cursor: "pointer", fontSize: 14.5, fontWeight: 600 },
  tabActive: { padding: "9px 20px", border: "none", background: "#fff", color: green, borderRadius: 10, cursor: "pointer", fontSize: 14.5, fontWeight: 700, boxShadow: "0 1px 4px rgba(0,0,0,0.08)" },
  card: { background: "#fff", borderRadius: 16, padding: 22, marginBottom: 18, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" },
  h2: { fontSize: 17, margin: "0 0 16px", fontWeight: 700, display: "flex", alignItems: "center" },
  count: { display: "inline-block", background: "#eef3ee", color: green, borderRadius: 20, fontSize: 13, padding: "1px 10px", marginLeft: 8, fontWeight: 700 },
  formGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 },
  field: { display: "flex", flexDirection: "column", gap: 5 },
  fieldLabel: { fontSize: 12.5, color: "#6b7269", fontWeight: 600 },
  input: { padding: "10px 12px", border: "1px solid #d5dbd5", borderRadius: 9, fontSize: 14, background: "#fbfcfb", outline: "none" },
  listItem: { display: "flex", alignItems: "center", gap: 14, padding: "14px 0", borderTop: "1px solid #eef1ee" },
  avatar: { width: 40, height: 40, borderRadius: "50%", background: `linear-gradient(135deg, ${green}, #66bb6a)`, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 17, flexShrink: 0 },
  statusDot: { width: 12, height: 12, borderRadius: "50%", flexShrink: 0 },
  itemTitle: { fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6 },
  itemSub: { fontSize: 13, color: "#6b7269", marginTop: 2 },
  actions: { display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end", alignItems: "center" },
  btn: { padding: "7px 12px", border: "1px solid #d5dbd5", background: "#fff", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#3a413a" },
  primaryBtn: { padding: "7px 14px", border: "none", background: green, color: "#fff", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 700 },
  iconBtn: { padding: "6px 9px", border: "1px solid #f0d5d5", background: "#fdf4f4", color: "#c0392b", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 700 },
  pill: { display: "inline-block", padding: "2px 10px", borderRadius: 20, fontSize: 11.5, fontWeight: 700, marginLeft: 4 },
  pillGreen: { background: "#dcf3e4", color: "#1b5e20" },
  pillGray: { background: "#eceff0", color: "#607d8b" },
  pillBlue: { background: "#e3f0fb", color: "#1565c0" },
  muted: { color: "#8a918a", fontSize: 14 },
  footer: { textAlign: "center", color: "#a5aca5", fontSize: 12.5, marginTop: 30 },
  toast: { position: "fixed", top: 18, right: 18, background: "#1f2421", color: "#fff", padding: "12px 18px", borderRadius: 10, fontSize: 14, fontWeight: 600, boxShadow: "0 4px 16px rgba(0,0,0,0.25)", zIndex: 100 },
};