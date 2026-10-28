#!/usr/bin/env node
// Streamly staging-only, bounded HTTP resilience smoke test.
// Usage: STREAMLY_STAGING_URL=https://your-preview.vercel.app node scripts/staging-resilience.mjs
// Does not generate flood traffic; max 5 concurrent requests, 20 total.
const raw = process.env.STREAMLY_STAGING_URL;
if (!raw) throw new Error("Set STREAMLY_STAGING_URL to an isolated staging deployment.");
const base = new URL(raw);
if (base.protocol !== "https:" || base.hostname === "streamlyio.vercel.app" || !base.hostname.endsWith(".vercel.app")) {
  throw new Error("Only a separate HTTPS Vercel preview URL is permitted.");
}
const scenarios = [
  {name:"homepage",path:"/"},
  {name:"search input",path:"/browse?search="+encodeURIComponent("' OR 1=1 --")},
  {name:"malformed API",path:"/api/public/age-rating/not-an-id"},
  {name:"missing proxy target",path:"/api/public/proxy"},
];
const results=[];
for (const concurrency of [1,2,5]) {
  const tasks=Array.from({length:Math.min(5,concurrency*2)},(_,i)=>scenarios[i%scenarios.length]);
  for(let offset=0;offset<tasks.length;offset+=concurrency) {
    await Promise.all(tasks.slice(offset,offset+concurrency).map(async task=>{
      const start=performance.now();
      try {
        const res=await fetch(new URL(task.path,base),{redirect:"manual",signal:AbortSignal.timeout(8000),headers:{"User-Agent":"Streamly-Staging-Resilience-Smoke-Test/1.0"}});
        results.push({concurrency,name:task.name,status:res.status,ms:Math.round(performance.now()-start)});
        await res.body?.cancel();
      } catch(error) {results.push({concurrency,name:task.name,error:String(error),ms:Math.round(performance.now()-start)});}
    }));
    await new Promise(resolve=>setTimeout(resolve,500));
  }
}
console.table(results);
const failures=results.filter(r=>r.error || r.status>=500);
console.log(`Requests: ${results.length}; server/network failures: ${failures.length}`);
if(failures.length)process.exitCode=1;
