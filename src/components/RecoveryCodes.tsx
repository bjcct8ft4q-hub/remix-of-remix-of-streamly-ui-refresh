import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RecoveryCodes({ codes }: { codes: string[] }) {
  const download = () => {
    const url = URL.createObjectURL(new Blob([`Streamly password recovery codes\nKeep these private. Each code works once. These do not replace your authenticator.\n\n${codes.join("\n")}`], { type: "text/plain" }));
    const a = document.createElement("a"); a.href = url; a.download = "streamly-recovery-codes.txt"; a.click(); URL.revokeObjectURL(url);
  };
  return <div className="space-y-4">
    <p className="text-sm text-muted-foreground">Keep these codes somewhere safe. Each resets your password once. You still need your authenticator if enabled.</p>
    <div className="grid gap-2 font-mono text-xs">{codes.map((code) => <code key={code} className="break-all rounded border border-border bg-muted p-2">{code}</code>)}</div>
    <Button variant="outline" onClick={download}><Download />Save recovery codes</Button>
  </div>;
}