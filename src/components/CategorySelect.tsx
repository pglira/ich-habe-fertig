import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Category } from "@/lib/tauri";
import { categoryColors } from "@/lib/todo";
import { cn } from "@/lib/utils";

interface Props {
  // The name of the category, or "" for no category.
  value: string;
  onChange: (name: string) => void;
  // The categories to offer.
  categories: Category[];
  disabled?: boolean;
  // A lower button, for a row of fields.
  compact?: boolean;
}

function Swatch({ c }: { c: Category | null }) {
  const colors = c ? categoryColors(c.hue, c.color) : null;
  return (
    <span
      className="size-3.5 shrink-0 border border-white/20"
      style={colors ? { backgroundColor: colors.chip } : undefined}
    />
  );
}

// A dropdown menu to choose a category, with the color of each category.
export function CategorySelect({ value, onChange, categories, disabled, compact }: Props) {
  const current = categories.find((c) => c.name === value) ?? null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          className={cn("w-full justify-start font-normal", compact && "h-7 bg-background")}
        >
          <Swatch c={current} />
          <span className={current ? "truncate" : "truncate text-muted-foreground"}>{current?.name ?? "No category"}</span>
          <ChevronDown className="ml-auto" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 w-(--radix-dropdown-menu-trigger-width) overflow-y-auto">
        <DropdownMenuRadioGroup value={value} onValueChange={onChange}>
          <DropdownMenuRadioItem value="">
            <Swatch c={null} />
            <span className="text-muted-foreground">No category</span>
          </DropdownMenuRadioItem>
          {categories.length > 0 && <DropdownMenuSeparator />}
          {categories.map((c) => (
            <DropdownMenuRadioItem key={c.name} value={c.name}>
              <Swatch c={c} />
              {c.name}
              {c.archived && <span className="ml-auto text-xs text-muted-foreground">archived</span>}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
