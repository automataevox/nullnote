import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { UnlockScreen } from "@/components/vault/UnlockScreen";
import { Workspace } from "@/components/vault/Workspace";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "nullnote — private, encrypted, peer-to-peer notes" },
      { name: "description", content: "Zero-knowledge notebook and vault. Encrypted on your device, shared live peer-to-peer. No cloud." },
      { property: "og:title", content: "nullnote — private peer-to-peer notes" },
      { property: "og:description", content: "Zero-knowledge notebook and vault with live P2P collaboration. No cloud." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: App,
});

function App() {
  const [key, setKey] = useState<CryptoKey | null>(null);
  return (
    <>
      {key ? <Workspace vaultKey={key} onLock={() => setKey(null)} /> : <UnlockScreen onUnlock={setKey} />}
      <Toaster />
    </>
  );
}
