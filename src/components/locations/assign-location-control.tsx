"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { assignMemberLocationAction } from "@/actions";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { OpLocation } from "@/types";

export function AssignLocationControl({
  memberId,
  memberName,
  teamId,
  locations,
  currentLocationId,
}: {
  memberId: string;
  memberName: string;
  teamId: string;
  locations: OpLocation[];
  currentLocationId?: string | null;
}) {
  const [locationId, setLocationId] = useState(currentLocationId ?? "");
  const [pending, startTransition] = useTransition();

  function save() {
    if (!locationId) {
      toast.error("Selecione um local de trabalho.");
      return;
    }
    startTransition(async () => {
      const result = await assignMemberLocationAction({
        member_id: memberId,
        location_id: locationId,
        team_id: teamId,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Local atribuído.");
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-white p-3 sm:flex-row sm:items-end">
      <div className="flex-1">
        <p className="mb-1 text-sm font-medium">{memberName}</p>
        <Select value={locationId} onValueChange={setLocationId}>
          <SelectTrigger>
            <SelectValue placeholder="Local de trabalho" />
          </SelectTrigger>
          <SelectContent>
            {locations.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {l.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button onClick={save} disabled={pending}>
        {pending ? "Salvando..." : "Salvar"}
      </Button>
    </div>
  );
}
