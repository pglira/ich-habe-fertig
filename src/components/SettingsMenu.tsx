import { Settings as SettingsIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NOTES_FONTS, notesFont } from "@/lib/fonts";
import { useSettings } from "@/lib/settings";

// The title bar of a group of settings.
const GROUP_TITLE = "border-b border-border bg-muted px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-foreground";

// The settings of the app, as a menu below a gear button.
export function SettingsMenu() {
  const { settings, setNotesFont, hideCompleted, setHideCompleted } = useSettings();
  const current = notesFont(settings.notes_font).id;
  const groups = [
    { label: "Monospace", fonts: NOTES_FONTS.filter((f) => f.monospace) },
    { label: "Proportional", fonts: NOTES_FONTS.filter((f) => !f.monospace) },
  ];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-xs" aria-label="Settings" title="Settings">
          <SettingsIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <div className="m-1 border border-border">
          <div className={GROUP_TITLE}>List</div>
          <DropdownMenuCheckboxItem
            checked={hideCompleted}
            onCheckedChange={setHideCompleted}
            onSelect={(e) => e.preventDefault()}
          >
            Hide completed todos
            <span className="ml-auto pl-3 text-xs text-muted-foreground">Ctrl H</span>
          </DropdownMenuCheckboxItem>
        </div>
        <div className="m-1 mt-2 border border-border">
          <div className={GROUP_TITLE}>Notes</div>
          <DropdownMenuRadioGroup value={current} onValueChange={setNotesFont}>
            {groups.map((g, i) => (
              <div key={g.label}>
                {i > 0 && <DropdownMenuSeparator className="mx-0" />}
                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Font · {g.label}</DropdownMenuLabel>
                {g.fonts.map((f) => (
                  <DropdownMenuRadioItem
                    key={f.id}
                    value={f.id}
                    style={{ fontFamily: f.family }}
                    onSelect={(e) => e.preventDefault()}
                  >
                    {f.name}
                  </DropdownMenuRadioItem>
                ))}
              </div>
            ))}
          </DropdownMenuRadioGroup>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
