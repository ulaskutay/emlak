import { PanelTitle } from "@/components/panel/ui";
import { AgentsManager } from "./AgentsManager";

export const metadata = { title: "Emlakçılar · Arsa Video" };

export default function AgentsPage() {
  return (
    <>
      <PanelTitle sub="Videonun sonundaki kapanış kartında görünen emlakçılar. Bir kez ekleyin, her videoda şablon formundan seçin.">
        Emlakçılar
      </PanelTitle>
      <AgentsManager />
    </>
  );
}
