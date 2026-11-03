import { FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  error: string | null;
  onChoose: () => void;
}

// The screen without a data directory.
export function StartScreen({ error, onChoose }: Props) {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">ich-habe-fertig</h1>
          <p className="text-sm text-muted-foreground">
            Select the data directory. The app keeps <code className="font-mono">todos.db</code> and the{" "}
            <code className="font-mono">images</code> folder in it.
          </p>
        </div>
        {error && <p className="border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        <Button variant="outline" className="w-full justify-start" onClick={onChoose}>
          <FolderOpen />
          Select a data directory
        </Button>
      </div>
    </div>
  );
}
