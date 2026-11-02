import { useState } from "react";
import { createRoot } from "react-dom/client";
import { UnlockScreen } from "../src/components/vault/UnlockScreen";
import { Workspace } from "../src/components/vault/Workspace";
import { Toaster } from "../src/components/ui/sonner";
import "../src/styles.css";

function DesktopApp() {
  const [key, setKey] = useState<CryptoKey | null>(null);
  return <>
    {key ? <Workspace vaultKey={key} onLock={() => setKey(null)} /> : <UnlockScreen onUnlock={setKey} />}
    <Toaster />
  </>;
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<DesktopApp />);