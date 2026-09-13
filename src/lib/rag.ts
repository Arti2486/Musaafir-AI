import type { Destination, Hotel, Place, Tip } from "@/db/schema";

export type Bundle = { destination: Destination; hotels: Hotel[]; places: Place[]; tips: Tip[] };
export type ScheduleItem = { time: string; activity: string; detail: string; cost: string };
export type ItineraryDay = { day: number; title: string; focus: string; schedule: ScheduleItem[]; meals: string[]; stay: { name: string; area: string; pricePerNight: number; tier: string }; estimatedCostPerPerson: number; };
export type BudgetLine = { label: string; amount: number; note: string };
export type ItineraryPlan = { title: string; destinationName: string; destinationSlug: string; state: string; region: string; days: number; travellers: number; pace: string; budgetPerPerson: number; bestTime: string; generatedAt: string; prompt: string; overview: string; hotel: { name: string; area: string; tier: string; pricePerNight: number; rating: number; note: string | null }; plan: ItineraryDay[]; budgetBreakdown: BudgetLine[]; totalPerPerson: number; totalForGroup: number; tips: { category: string; text: string }[]; sources: string[]; contextUsed: string; };
export type TripRequest = { prompt: string; slug: string | null; days: number; travellers: number; budgetPerPerson: number; pace: "relaxed" | "balanced" | "packed"; interests: string[] };

const STOP_WORDS = new Set(["the","a","an","and","or","of","to","in","for","is","are","i","my","me","we","you","it","on","at","from","with","please","can","could","would","how","what","which","about","do","does","want","need","plan","trip","travel","ka","ki","ke","hai","mujhe","mera","hum","kya","din","liye"]);

export function tokenize(text: string): string[] {
  if(!text) return [];
  return text.toLowerCase().replace(/[^a-z0-9\u0900-\u097F\s-]/g, " ").split(/[\s-]+/).map(t=>t.trim()).filter(t=>t.length>2 &&!STOP_WORDS.has(t));
}

export function buildChunks(bundle: Bundle) {
  const chunks: { label: string; text: string }[] = [];
  const context = bundle.destination.context || "";
  const sentences = context.split(/(?<=[.;])\s+/).filter(s=>s.length>40);
  for(const s of sentences) chunks.push({ label: `${bundle.destination.name} · context`, text: s });
  for(const p of bundle.places) chunks.push({ label: `${bundle.destination.name} · ${p.name}`, text: `${p.name} (${p.category}) needs ${p.timeNeeded}, entry ${p.entryFee}. ${p.description}` });
  for(const h of bundle.hotels) chunks.push({ label: `${bundle.destination.name} · stay · ${h.name}`, text: `Stay ${h.name} in ${h.area}, ${h.tier} tier, ${h.pricePerNight} INR/night, rated ${h.rating}. ${h.note||""}` });
  for(const t of bundle.tips) chunks.push({ label: `${bundle.destination.name} · ${t.category} tip`, text: `${t.category}: ${t.text}` });
  return chunks;
}

export function retrieve(query: string, bundles: Bundle[], limit = 6) {
  const q = query.toLowerCase().trim();
  const queryTokens = tokenize(query);
  const scored: any[] = [];
  for(const bundle of bundles){
    const name = (bundle.destination?.name || "").toLowerCase();
    const slug = (bundle.destination?.slug || "").toLowerCase();
    for(const chunk of buildChunks(bundle)){
      const text = (chunk.text || "").toLowerCase();
      const label = (chunk.label || "").toLowerCase();
      const combined = `${text} ${label} ${name} ${slug}`;
      const chunkTokens = new Set(tokenize(combined));
      let score = 0;
      if(combined.includes(q)) score += 10;
      if(name.includes(q) || q.includes(name) || slug.includes(q) || q.includes(slug)) score += 10;
      for(const t of queryTokens) if(chunkTokens.has(t)) score+=2;
      if(score>0) scored.push({...chunk, score, slug: bundle.destination.slug});
    }
  }
  return scored.sort((a,b)=>b.score-a.score).slice(0, limit);
}

export const DESTINATION_ALIASES: Record<string, string[]> = {
  manali: ["मनाली", "manali", "kullu"],
  goa: ["गोवा", "goa"],
  jaipur: ["जयपुर", "jaipur"],
  varanasi: ["वाराणसी", "varanasi", "banaras", "kashi"],
  "leh-ladakh": ["लद्दाख", "ladakh", "leh"],
  kerala: ["केरल", "kerala", "munnar", "alleppey"],
  amritsar: ["अमृतसर", "amritsar", "golden temple"],
};

function findDestinationSlug(prompt: string, bundles: Bundle[]): string | null {
  const text = ` ${prompt.toLowerCase()} `;
  let best: any = null;
  for(const b of bundles){
    const candidates = [b.destination.name, b.destination.slug, b.destination.state,...(DESTINATION_ALIASES[b.destination.slug]||[])].map(c=>c.toLowerCase());
    let score = 0; for(const c of candidates) if(text.includes(c)) score+=c.length;
    if(score>0 && (!best || score>best.score)) best={ slug: b.destination.slug, score };
  }
  return best?.slug || null;
}

export function parseTripRequest(input: any, bundles: Bundle[]): TripRequest {
  const prompt = (input.prompt||"").trim();
  const lower = prompt.toLowerCase();
  const slug = input.slug?.trim() || findDestinationSlug(lower, bundles) || null;
  let days = Number(input.days)||0;
  if(!days){ const m=lower.match(/(\d{1,2})\s*(?:days?|din|दिन)/); if(m) days=Number(m[1]); }
  if(!days) days=3; days=Math.min(Math.max(days,1),10);
  let travellers = Number(input.travellers)||2;
  const tm=lower.match(/(\d{1,2})\s*(?:people|log|लोग)/); if(tm) travellers=Number(tm[1]);
  if(/couple|honeymoon/.test(lower)) travellers=2; if(/solo/.test(lower)) travellers=1;
  let budget = Number(input.budgetPerPerson)||0;
  if(!budget){ const m=lower.match(/(\d{3,6})\s*(?:budget|rs|₹|rupees)/) || lower.match(/(\d{4,6})/); if(m) budget=Number(m[1]); }
  if(!budget) budget=bundles.find(b=>b.destination.slug===slug)?.destination.budgetPerPerson||12000;
  let pace: any = input.pace || "balanced";
  if(/relaxed|chill/.test(lower)) pace="relaxed"; if(/packed|fast/.test(lower)) pace="packed";
  const interests = ["food","beach","temple","adventure","heritage"].filter(k=>lower.includes(k));
  return { prompt, slug, days, travellers, budgetPerPerson: Math.round(budget), pace, interests };
}

function pickHotel(bundle: Bundle, budgetPerPerson: number): Hotel {
  const sorted = [...bundle.hotels].sort((a,b)=>a.pricePerNight-b.pricePerNight);
  if(!sorted.length) return { id:0, destinationId:0, name: `${bundle.destination.name} guesthouse`, area: bundle.destination.state, tier:"budget", pricePerNight: Math.round(budgetPerPerson/6), rating: bundle.destination.rating, note:null } as Hotel;
  const affordable = sorted.filter(h=>h.pricePerNight <= budgetPerPerson/5);
  return affordable.length? affordable[affordable.length-1] : sorted[0];
}

function timeSlots(pace: string){ if(pace==="packed") return ["06:30","09:00","11:30","15:00","17:30","20:00"]; if(pace==="relaxed") return ["08:30","11:00","13:30","16:00","18:30"]; return ["07:30","10:00","13:00","15:30","18:00"]; }
function splitIntoDays(places: Place[], days: number){ const buckets: Place[][] = Array.from({length:days},()=>[]); [...places].sort((a,b)=>a.sortOrder-b.sortOrder).forEach((p,i)=>{ buckets[i%days].push(p); }); return buckets; }

export function generateItinerary(bundle: Bundle, request: TripRequest): ItineraryPlan {
  const hotel = pickHotel(bundle, request.budgetPerPerson);
  const slots = timeSlots(request.pace);
  const dayBuckets = splitIntoDays(bundle.places, request.days);
  const plan: ItineraryDay[] = dayBuckets.map((acts, idx)=>{
    const dayNumber = idx+1;
    const schedule: ScheduleItem[] = [];
    let si=0; const nextTime=()=>slots[Math.min(si++, slots.length-1)];
    schedule.push({ time: nextTime(), activity: `Arrive in ${bundle.destination.name}`, detail: `Check into ${hotel.name} (${hotel.area}). Best time: ${bundle.destination.bestTime}.`, cost: "Transfer" });
    acts.forEach(a=>{ schedule.push({ time: nextTime(), activity: a.name, detail: `${a.description} (allow ${a.timeNeeded}).`, cost: a.entryFee }); });
    schedule.push({ time: slots[slots.length-1], activity: idx===dayBuckets.length-1? "Check out and depart" : "Evening", detail: "Relaxed evening around stay.", cost: "Food budget" });
    return { day: dayNumber, title: `Day ${dayNumber} - ${acts.map(a=>a.name).slice(0,2).join(" and ") || bundle.destination.name}`, focus: bundle.destination.category, schedule, meals: ["Breakfast", "Lunch", "Dinner"], stay: { name: hotel.name, area: hotel.area, pricePerNight: hotel.pricePerNight, tier: hotel.tier }, estimatedCostPerPerson: hotel.pricePerNight + 1000 };
  });
  const nights = Math.max(request.days-1,1);
  const stayCost = hotel.pricePerNight * nights; const foodCost = 900*request.days; const activitiesCost=1000*request.days; const travelCost=600*request.days;
  const budgetBreakdown = [{label:`Stay at ${hotel.name}`, amount:stayCost, note:`${nights} nights`}, {label:"Food", amount:foodCost, note:`${request.days} days`}, {label:"Activities", amount:activitiesCost, note:"Entry fees"}, {label:"Local travel", amount:travelCost, note:"Taxis"}];
  const totalPerPerson = budgetBreakdown.reduce((s,l)=>s+l.amount,0);
  return {
    title: `${request.days} days in ${bundle.destination.name}`,
    destinationName: bundle.destination.name,
    destinationSlug: bundle.destination.slug,
    state: bundle.destination.state,
    region: bundle.destination.region,
    days: request.days,
    travellers: request.travellers,
    pace: request.pace,
    budgetPerPerson: request.budgetPerPerson,
    bestTime: bundle.destination.bestTime,
    generatedAt: new Date().toISOString(),
    prompt: request.prompt,
    overview: `${bundle.destination.description} ${request.days} days at ${request.pace} pace. Base at ${hotel.name}.`,
    hotel: { name: hotel.name, area: hotel.area, tier: hotel.tier, pricePerNight: hotel.pricePerNight, rating: hotel.rating, note: hotel.note },
    plan,
    budgetBreakdown,
    totalPerPerson,
    totalForGroup: totalPerPerson*request.travellers,
    tips: bundle.tips.map(t=>({category:t.category, text:t.text})),
    sources: [`destinations.context (${bundle.destination.slug})`],
    contextUsed: bundle.destination.context || ""
  };
}

export function answerFromContext(query: string, bundles: Bundle[], limit=5){
  const chunks = retrieve(query, bundles, limit);
  if(!chunks.length) return { answer: "I could not find that in Musaafir AI knowledge base. Ask about Manali, Goa, Jaipur, Varanasi, Ladakh etc.", sources: [] };
  return { answer: `From Musaafir AI knowledge base:\n${chunks.map(c=>`- ${c.text}`).join("\n")}`, sources: [...new Set(chunks.map(c=>c.label))] };
}