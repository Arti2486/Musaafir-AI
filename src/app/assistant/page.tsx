"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Send, Trash2, Sparkles, Info } from "lucide-react";

type Message = { id: number; role: "user" | "assistant"; content: string; destinationSlug: string | null; createdAt: string; };
type Destination = { slug: string; name: string };

const SUGGESTIONS = [
  "Kedarnath permit aur helicopter ka kitna kharcha hai?",
  "Which is better for 4 days - Manali or Leh Ladakh?",
  "Best time to visit Kerala and houseboat cost",
  "Wagah border ceremony timing and how to reach",
];

// Normalizes messages coming from the API regardless of naming convention
// (content/text/message, createdAt/created_at, destinationSlug/destination_slug)
// so the UI never shows "Invalid Date" or empty bubbles.
function normalizeMessage(raw: any): Message {
  return {
    id: raw.id ?? Date.now(),
    role: raw.role,
    content: raw.content ?? raw.text ?? raw.message ?? "",
    destinationSlug: raw.destinationSlug ?? raw.destination_slug ?? null,
    createdAt: raw.createdAt ?? raw.created_at ?? new Date().toISOString(),
  };
}

export default function AssistantPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [scope, setScope] = useState("");
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  const getAuthHeader = () => {
    const token = localStorage.getItem("musaafir_token");
    return token? `Bearer ${token}` : "";
  };

  const loadHistory = useCallback(async () => {
    try {
      const headers = { "Content-Type": "application/json", Authorization: getAuthHeader() };
      const [chat, dest] = await Promise.all([
        fetch("/api/chat", { headers }).then(r => r.json()).catch(() => ({ messages: [] })),
        fetch("/api/destinations").then(r => r.json()).catch(() => ({ destinations: [] }))
      ]);
      setMessages((chat.messages || []).map(normalizeMessage));
      setDestinations(dest.destinations || []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function send(text?: string) {
    const content = (text || input).trim();
    if (!content || sending) return;
    setSending(true);
    setInput("");
    setMessages(c => [...c, { id: -Date.now(), role: "user", content, destinationSlug: scope || null, createdAt: new Date().toISOString() }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: getAuthHeader() },
        body: JSON.stringify({ message: content, slug: scope || undefined })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessages(c => [
        ...c.filter(m => m.id > 0),
        normalizeMessage(data.userMessage),
        normalizeMessage(data.message),
      ]);
    } catch (e: any) {
      setMessages(c => [...c, { id: Date.now(), role: "assistant", content: `Error: ${e.message}`, destinationSlug: null, createdAt: new Date().toISOString() }]);
    } finally { setSending(false); }
  }

  async function clearHistory() {
    await fetch("/api/chat", { method: "DELETE", headers: { Authorization: getAuthHeader() } });
    setMessages([]);
  }

  return (
    <div className="min-h-screen bg-[#050b11] text-white p-6">
      <div className="mx-auto max-w-7xl">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">Musaafir AI Assistant</h1>
            <p className="text-sm text-white/60">{destinations.length} destinations loaded</p>
          </div>
          {messages.length > 0 && <button onClick={clearHistory} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 text-sm"><Trash2 size={14}/> Clear</button>}
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_18rem]">
          <section className="flex h-[calc(100vh-12rem)] flex-col rounded-3xl border border-white/10 bg-white/5 overflow-hidden">
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-3">
              {loading? <div className="h-16 w-3/4 rounded-2xl bg-white/10 animate-pulse" />
              : messages.length === 0? (
                <div className="grid h-full place-items-center text-center">
                  <div>
                    <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-orange-400/20 text-orange-300"><Sparkles/></span>
                    <p className="mt-4 font-semibold">Ask me anything about your trip</p>
                    <div className="mt-5 grid gap-2 max-w-md">{SUGGESTIONS.map(s => <button key={s} onClick={() => send(s)} className="rounded-xl bg-white/5 px-3.5 py-2.5 text-left text-xs hover:bg-white/10">{s}</button>)}</div>
                  </div>
                </div>
              ) : messages.map(m => (
                <div key={`${m.id}-${m.createdAt}`} className={`flex ${m.role==="user"? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${m.role==="user"? "bg-orange-400 text-black" : "bg-white/10"}`}>
                    <p className="whitespace-pre-line">{m.content}</p>
                    <p className="mt-1 text-[10px] opacity-60">{new Date(m.createdAt).toLocaleTimeString()}</p>
                  </div>
                </div>
              ))}
              <div ref={bottomRef}/>
            </div>
            <div className="border-t border-white/10 p-4 flex gap-2">
              <textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{ if(e.key==="Enter" &&!e.shiftKey){ e.preventDefault(); send(); }}} placeholder="Type in Hindi or English..." className="flex-1 rounded-xl bg-black/40 border border-white/10 p-3 text-sm outline-none focus:border-orange-400/50 min-h-[48px]"/>
              <button onClick={()=>send()} disabled={sending} className="bg-orange-400 text-black px-5 rounded-xl h-12 grid place-items-center disabled:opacity-50"><Send size={18}/></button>
            </div>
          </section>

          <aside className="space-y-4">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <h2 className="font-bold">Limit scope</h2>
              <select value={scope} onChange={e=>setScope(e.target.value)} className="mt-3 w-full rounded-xl bg-[#192028] border border-white/20 p-2.5 text-sm outline-none">
                <option value="">All destinations</option>
                {destinations.map(d => <option key={d.slug} value={d.slug}>{d.name}</option>)}
              </select>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <h2 className="flex gap-2 font-bold"><Info size={16} className="text-green-400"/> How it answers</h2>
              <p className="mt-2 text-xs text-white/60 leading-relaxed">Top 5 chunks from PostgreSQL knowledge base - no invented prices.</p>
              <Link href="/planner" className="mt-4 flex justify-center gap-2 rounded-xl bg-white/10 py-2.5 text-sm"><Sparkles size={14}/> Create a trip</Link>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
