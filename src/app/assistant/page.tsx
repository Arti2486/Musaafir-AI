"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Mic, Send, Trash2, Sparkles, MessageSquare, Info } from "lucide-react";

type Message = { id: number; role: "user" | "assistant"; content: string; destinationSlug: string | null; createdAt: string; };
type DestinationOption = { slug: string; name: string };

const SUGGESTIONS = [
  "Kedarnath permit aur helicopter ka kitna kharcha hai?",
  "Which is better for 4 days - Manali or Leh Ladakh?",
  "Best time to visit Kerala and houseboat cost",
  "Wagah border ceremony timing and how to reach",
];

export default function AssistantPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [scope, setScope] = useState("");
  const [destinations, setDestinations] = useState<DestinationOption[]>([]);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("musaafir_token") || localStorage.getItem("musaafir_token");
      const headers: any = { "Content-Type": "application/json" };
      if(token) headers.Authorization = `Bearer ${token}`;

      const [chatRes, destRes] = await Promise.all([
        fetch("/api/chat", { headers }).then(r=>r.json()).catch(()=>({messages:[]})),
        fetch("/api/destinations").then(r=>r.json()).catch(()=>({destinations:[]}))
      ]);
      setMessages(chatRes.messages || []);
      setDestinations(destRes.destinations || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function send(text?: string) {
    const content = (text || input).trim();
    if (!content) return;
    setSending(true); setInput("");
    const tempUser: Message = { id: -Date.now(), role: "user", content, destinationSlug: scope || null, createdAt: new Date().toISOString() };
    setMessages(c => [...c, tempUser]);

    try {
      const token = localStorage.getItem("musaafir_token") || localStorage.getItem("musaafir_token");
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: token? `Bearer ${token}` : "" },
        body: JSON.stringify({ message: content, slug: scope || undefined })
      });
      const data = await res.json();
      if(!res.ok) throw new Error(data.message);
      setMessages(c => [...c.filter(r => r.id >= 0), data.userMessage, data.message]);
    } catch (e: any) {
      setMessages(c => [...c, { id: -Date.now(), role: "assistant", content: `Sorry - ${e.message}`, destinationSlug: null, createdAt: new Date().toISOString() }]);
    } finally { setSending(false); }
  }

  async function clearHistory() {
    try {
      const token = localStorage.getItem("musaafir_token") || localStorage.getItem("musaafir_token");
      await fetch("/api/chat", { method: "DELETE", headers: { Authorization: token? `Bearer ${token}` : "" } });
      setMessages([]);
    } catch {}
  }

  return (
    <div className="min-h-screen bg-[#050b11] text-white p-6">
      <div className="mx-auto max-w-7xl">
        <div className="flex justify-between items-center mb-6">
          <div><h1 className="text-2xl font-bold">Musaafir AI Assistant</h1><p className="text-sm text-white/60">Answers are retrieved from Musaafir knowledge base - grounded in PostgreSQL</p></div>
          {messages.length > 0 && <button onClick={clearHistory} className="flex gap-2 items-center px-4 py-2 rounded-xl bg-white/10 text-sm"><Trash2 size={14} /> Clear</button>}
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_18rem]">
          <section className="flex h-[calc(100vh-12rem)] min-h-[30rem] flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/5">
            <div className="flex-1 space-y-3 overflow-y-auto px-5 py-5">
              {loading? <div className="h-16 w-3/4 rounded-2xl bg-white/10 animate-pulse" /> :
               messages.length === 0? (
                <div className="grid h-full place-items-center text-center">
                  <div>
                    <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-orange-400/20 text-orange-300"><Sparkles /></span>
                    <p className="mt-4 text-lg font-semibold">Ask me anything about your trip</p>
                    <div className="mx-auto mt-5 grid max-w-md gap-2">
                      {SUGGESTIONS.map(s => <button key={s} onClick={() => send(s)} className="rounded-xl bg-white/5 px-3.5 py-2.5 text-left text-xs hover:bg-white/10">{s}</button>)}
                    </div>
                  </div>
                </div>
              ) : messages.map(m => (
                <div key={`${m.id}-${m.createdAt}`} className={`flex ${m.role==="user"? "justify-end":"justify-start"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${m.role==="user"? "bg-orange-400 text-black rounded-br-md" : "bg-white/10 rounded-bl-md"}`}>
                    <p className="whitespace-pre-line">{m.content}</p>
                    <p className="mt-1 text-[10px] opacity-60">{new Date(m.createdAt).toLocaleDateString()} {m.destinationSlug? `· ${m.destinationSlug}`:""}</p>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
            <div className="border-t border-white/10 p-4 flex gap-2">
              <textarea className="flex-1 rounded-xl bg-black/40 border border-white/10 p-3 text-sm min-h-[3rem]" placeholder="Type in Hindi or English..." value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{ if(e.key==="Enter" &&!e.shiftKey){ e.preventDefault(); send(); }}} />
              <button onClick={() => send()} disabled={sending} className="bg-orange-400 text-black px-4 rounded-xl h-12 grid place-items-center"><Send size={18} /></button>
            </div>
          </section>

          <aside className="space-y-4">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <h2 className="font-bold">Limit scope</h2>
              <select className="mt-3 w-full rounded-xl bg-[#192028] border border-white/20 p-2.5 text-sm text-white" value={scope} onChange={e=>setScope(e.target.value)}>
                <option value="">All destinations</option>
                {destinations.map((d,i) => <option key={i} value={d.slug}>{d.name}</option>)}
              </select>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <h2 className="flex gap-2 font-bold"><Info size={16} className="text-green-400" /> How it answers</h2>
              <p className="mt-2 text-xs text-white/60 leading-relaxed">Your question is scored against every CONTEXT sentence in Musaafir AI knowledge base. Top 5 chunks are returned verbatim - no invented prices.</p>
              <Link href="/planner" className="mt-4 flex w-full justify-center gap-2 rounded-xl bg-white/10 py-2.5 text-sm"><Sparkles size={14} /> Create a trip</Link>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}