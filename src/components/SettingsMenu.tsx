import { PartyPopper, Settings as SettingsIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NOTES_FONTS, notesFont } from "@/lib/fonts";
import { CELEBRATION_STYLES, INTENSITIES } from "@/lib/celebration";
import { useSettings } from "@/lib/settings";

// The title bar of a group of settings.
const GROUP_TITLE = "border-b border-border bg-muted px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-foreground";

// The settings of the app, as a menu below a gear button. `onPreview` shows
// the celebration.
export function SettingsMenu({ onPreview }: { onPreview: () => void }) {
  const { settings, setNotesFont, hideCompleted, setHideCompleted, celebration, setCelebration } = useSettings();
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
      <DropdownMenuContent align="end" className="max-h-(--radix-dropdown-menu-content-available-height) w-72 overflow-y-auto">
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
          <div className={GROUP_TITLE}>Celebration</div>
          <DropdownMenuCheckboxItem
            checked={celebration.enabled}
            onCheckedChange={(v) => setCelebration({ celebration: v })}
            onSelect={(e) => e.preventDefault()}
          >
            Celebrate completed items
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator className="mx-0" />
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Style</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={celebration.style} onValueChange={(v) => setCelebration({ celebration_style: v })}>
            {CELEBRATION_STYLES.map((c) => (
              <DropdownMenuRadioItem key={c.id} value={c.id} disabled={!celebration.enabled} onSelect={(e) => e.preventDefault()}>
                {c.name}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator className="mx-0" />
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Intensity</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={celebration.intensity}
            onValueChange={(v) => setCelebration({ celebration_intensity: v })}
          >
            {INTENSITIES.map((i) => (
              <DropdownMenuRadioItem key={i.id} value={i.id} disabled={!celebration.enabled} onSelect={(e) => e.preventDefault()}>
                {i.name}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator className="mx-0" />
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              onPreview();
            }}
          >
            <PartyPopper />
            Preview
          </DropdownMenuItem>
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
