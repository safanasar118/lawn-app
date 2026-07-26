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
const VISIT_STATUSES = [
  "Scheduled",
  "In Progress",
  "Visit Completed",
  "Paid & Invoiced",
];
const PRICE_PER_VISIT = 45;

export default function App() {
  const [customers, setCustomers] = useState([]);
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [lawnSize, setLawnSize] = useState("");
  const [frequency, setFrequency] = useState("Weekly");

  const [selectedCustomer, setSelectedCustomer] = useState(null);

  async function loadData() {
    setLoading(true);
    const custSnap = await getDocs(collection(db, "customers"));
    setCustomers(custSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    const visitSnap = await getDocs(collection(db, "visits"));
    setVisits(visitSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    setLoading(false);
  }
  useEffect(() => {
    loadData();
  }, []);

  async function addCustomer() {
    if (!name || !email) return alert("Name and email are required.");
    await addDoc(collection(db, "customers"), {
      name,
      email,
      address,
      lawnSize,
      frequency,
      planStatus: "Active",
    });
    setName("");
    setEmail("");
    setAddress("");
    setLawnSize("");
    setFrequency("Weekly");
    loadData();
  }

  async function deleteCustomer(id) {
    await deleteDoc(doc(db, "customers", id));
    loadData();
  }

  async function togglePlan(cust) {
    const next = cust.planStatus === "Active" ? "Paused" : "Active";
    await updateDoc(doc(db, "customers", cust.id), { planStatus: next });
    loadData();
  }

  async function generateVisit(cust) {
    const today = new Date();
    const days =
      cust.frequency === "Weekly" ? 7 : cust.frequency === "Biweekly" ? 14 : 30;
    const next = new Date(today.getTime() + days * 86400000);
    await addDoc(collection(db, "visits"), {
      customerId: cust.id,
      customerName: cust.name,
      scheduledDate: next.toISOString().slice(0, 10),
      status: "Scheduled",
      amount: PRICE_PER_VISIT,
    });
    loadData();
  }

  async function advanceVisit(visit) {
    const idx = VISIT_STATUSES.indexOf(visit.status);
    if (idx < VISIT_STATUSES.length - 1) {
      await updateDoc(doc(db, "visits", visit.id), {
        status: VISIT_STATUSES[idx + 1],
      });
      loadData();
    }
  }

  async function deleteVisit(id) {
    await deleteDoc(doc(db, "visits", id));
    loadData();
  }

  const shownVisits = selectedCustomer
    ? visits.filter((v) => v.customerId === selectedCustomer)
    : visits;

  return (
    <div style={S.page}>
      <header style={S.header}>
        <h1 style={S.h1}>🌱 GreenBlade Lawn Care</h1>
        <p style={S.sub}>Recurring lawn mowing — customer & visit management</p>
      </header>

      {loading && <p style={S.muted}>Loading…</p>}

      <section style={S.card}>
        <h2 style={S.h2}>New Customer & Service Plan</h2>
        <div style={S.formGrid}>
          <input style={S.input} placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
          <input style={S.input} placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input style={S.input} placeholder="Address" value={address} onChange={(e) => setAddress(e.target.value)} />
          <input style={S.input} placeholder="Lawn size (e.g. Medium)" value={lawnSize} onChange={(e) => setLawnSize(e.target.value)} />
          <select style={S.input} value={frequency} onChange={(e) => setFrequency(e.target.value)}>
            {FREQUENCIES.map((f) => <option key={f}>{f}</option>)}
          </select>
          <button style={S.primaryBtn} onClick={addCustomer}>Add Customer</button>
        </div>
      </section>

      <section style={S.card}>
        <h2 style={S.h2}>Customers ({customers.length})</h2>
        {customers.length === 0 && <p style={S.muted}>No customers yet — add one above.</p>}
        {customers.map((c) => (
          <div key={c.id} style={S.row}>
            <div style={{ flex: 1 }}>
              <strong>{c.name}</strong> <span style={S.muted}>· {c.email}</span><br />
              <span style={S.muted}>{c.address} · Lawn: {c.lawnSize || "—"}</span><br />
              <span style={S.badge}>{c.frequency}</span>
              <span style={{ ...S.badge, background: c.planStatus === "Active" ? "#DCF3E4" : "#F3E4DC" }}>
                Plan: {c.planStatus}
              </span>
            </div>
            <div style={S.actions}>
              <button style={S.btn} onClick={() => generateVisit(c)}>+ Schedule Visit</button>
              <button style={S.btn} onClick={() => togglePlan(c)}>{c.planStatus === "Active" ? "Pause" : "Resume"}</button>
              <button style={S.btn} onClick={() => setSelectedCustomer(selectedCustomer === c.id ? null : c.id)}>
                {selectedCustomer === c.id ? "Show all visits" : "View visits"}
              </button>
              <button style={S.dangerBtn} onClick={() => deleteCustomer(c.id)}>Delete</button>
            </div>
          </div>
        ))}
      </section>

      <section style={S.card}>
        <h2 style={S.h2}>
          Visits ({shownVisits.length})
          {selectedCustomer && <span style={S.muted}> — filtered</span>}
        </h2>
        {shownVisits.length === 0 && <p style={S.muted}>No visits scheduled yet.</p>}
        {shownVisits.map((v) => (
          <div key={v.id} style={S.row}>
            <div style={{ flex: 1 }}>
              <strong>{v.customerName}</strong><br />
              <span style={S.muted}>Scheduled: {v.scheduledDate} · ${v.amount}</span><br />
              <span style={{ ...S.badge, background: statusColor(v.status) }}>{v.status}</span>
            </div>
            <div style={S.actions}>
              {v.status !== "Paid & Invoiced" && (
                <button style={S.primaryBtn} onClick={() => advanceVisit(v)}>
                  {nextLabel(v.status)}
                </button>
              )}
              <button style={S.dangerBtn} onClick={() => deleteVisit(v.id)}>Delete</button>
            </div>
          </div>
        ))}
      </section>

      <footer style={S.footer}>
        Throwaway prototype · MB385 System Proposal · data stored in Firebase
      </footer>
    </div>
  );
}

function nextLabel(status) {
  switch (status) {
    case "Scheduled": return "Start (In Progress)";
    case "In Progress": return "Mark Complete";
    case "Visit Completed": return "Charge via Square → Invoice";
    default: return "Advance";
  }
}
function statusColor(status) {
  switch (status) {
    case "Scheduled": return "#E4ECF3";
    case "In Progress": return "#F3EFDC";
    case "Visit Completed": return "#E9DCF3";
    case "Paid & Invoiced": return "#DCF3E4";
    default: return "#eee";
  }
}

const S = {
  page: { maxWidth: 860, margin: "0 auto", padding: "24px 16px 64px", fontFamily: "system-ui, sans-serif", color: "#1a1a1a" },
  header: { marginBottom: 20 },
  h1: { margin: 0, fontSize: 28 },
  sub: { margin: "4px 0 0", color: "#666" },
  h2: { fontSize: 18, margin: "0 0 12px" },
  card: { background: "#fff", border: "1px solid #e3e3e3", borderRadius: 12, padding: 18, marginBottom: 18, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" },
  formGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  input: { padding: "9px 11px", border: "1px solid #ccc", borderRadius: 8, fontSize: 14 },
  row: { display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderTop: "1px solid #eee" },
  actions: { display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" },
  btn: { padding: "6px 10px", border: "1px solid #ccc", background: "#f7f7f7", borderRadius: 7, cursor: "pointer", fontSize: 13 },
  primaryBtn: { padding: "8px 12px", border: "none", background: "#2e7d32", color: "#fff", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 },
  dangerBtn: { padding: "6px 10px", border: "1px solid #e0b4b4", background: "#fbeaea", color: "#a33", borderRadius: 7, cursor: "pointer", fontSize: 13 },
  badge: { display: "inline-block", padding: "2px 9px", borderRadius: 20, background: "#eee", fontSize: 12, marginRight: 6, marginTop: 4 },
  muted: { color: "#888", fontSize: 13 },
  footer: { textAlign: "center", color: "#aaa", fontSize: 12, marginTop: 24 },
};