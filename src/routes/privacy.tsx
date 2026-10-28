import { createFileRoute } from "@tanstack/react-router";
export const Route=createFileRoute("/privacy")({component:Privacy});
const sections=[
["Information we collect","When you create an account or use Streamly, we may process your username, email address, profile information, watch history, preferences, and content you submit."],
["How we use information","We use account and usage information to provide the service, maintain your account, remember preferences, prevent abuse, respond to support requests, and improve reliability."],
["Storage and security","Account and application data is processed through our hosting and database providers, including Supabase and Vercel. We use access controls and security measures, but no internet service can guarantee absolute security."],
["Sharing and service providers","We do not sell your personal information. Service providers may process information necessary to operate Streamly. Third-party anime metadata and external links have their own privacy practices."],
["Cookies and local storage","We use browser storage and authentication-related technologies to keep you signed in and remember settings. You can manage browser storage using your browser controls."],
["Retention and deletion","We keep data while needed to operate your account or meet applicable obligations. Account deletion may remove related data; some records may be retained where legally required."],
["Your choices and rights","You can request access, correction, deletion, or an export of your personal information, subject to applicable law. Contact us using the Contact page."],
["Changes","We may update this policy and publish a revised date. Material changes should be communicated appropriately."]
];
function Privacy(){return <main className="mx-auto max-w-3xl px-5 pb-24 pt-28"><p className="text-xs font-bold uppercase tracking-widest text-primary">Streamly · Legal</p><h1 className="mt-3 text-4xl font-black">Privacy Policy</h1><p className="mt-3 text-sm text-muted-foreground">Draft for review · 28 October 2026. This page should be checked against actual data flows and legal obligations before production publication.</p><div className="mt-10 space-y-8">{sections.map(([title,body],i)=><section key={title}><h2 className="text-lg font-bold">{i+1}. {title}</h2><p className="mt-3 text-sm leading-7 text-muted-foreground">{body}</p></section>)}</div></main>}