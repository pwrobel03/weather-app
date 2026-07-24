import { CloudLightning } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-background text-foreground">
      <CloudLightning className="size-10 text-primary" />
      <p className="text-muted-foreground">Weather App</p>
      <Button>Sprawdź prognozę</Button>
    </div>
  );
}
