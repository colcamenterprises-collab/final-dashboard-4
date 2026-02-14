import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";

type DrinksApiRow = { name: string };
type LatestSubmission = { submitted_at?: string };
type LatestResponse = { drinks: LatestSubmission | null; meat: LatestSubmission | null; rolls: LatestSubmission | null };

export default function HomeStockRegistration() {
  const queryClient = useQueryClient();
  const [drinksStaffName, setDrinksStaffName] = useState("");
  const [drinksNotes, setDrinksNotes] = useState("");
  const [drinkCounts, setDrinkCounts] = useState<Record<string, string>>({});
  const [drinksSaved, setDrinksSaved] = useState(false);

  const [meatStaffName, setMeatStaffName] = useState("");
  const [meatPurchasedTodayKg, setMeatPurchasedTodayKg] = useState("");
  const [meatEndShiftRemainingGrams, setMeatEndShiftRemainingGrams] = useState("");
  const [meatNotes, setMeatNotes] = useState("");
  const [meatSaved, setMeatSaved] = useState(false);

  const [rollsStaffName, setRollsStaffName] = useState("");
  const [rollsPurchasedCount, setRollsPurchasedCount] = useState("");
  const [rollsEndShiftRemainingCount, setRollsEndShiftRemainingCount] = useState("");
  const [rollsNotes, setRollsNotes] = useState("");
  const [rollsSaved, setRollsSaved] = useState(false);

  const { data: drinks = [] } = useQuery<DrinksApiRow[]>({
    queryKey: ["/api/stock-register/drinks"],
  });

  const drinksNames = useMemo(() => drinks.map(item => item.name), [drinks]);

  const latestQuery = useQuery<LatestResponse>({
    queryKey: ["/api/stock-register/latest"],
  });

  const drinksMutation = useMutation({
    mutationFn: (payload: any) => apiRequest("/api/stock-register/drinks", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => {
      setDrinksSaved(true);
      setDrinksNotes("");
      setDrinkCounts(Object.fromEntries(drinksNames.map(name => [name, ""])));
      queryClient.invalidateQueries({ queryKey: ["/api/stock-register/latest"] });
    },
  });

  const meatMutation = useMutation({
    mutationFn: (payload: any) => apiRequest("/api/stock-register/meat", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => {
      setMeatSaved(true);
      setMeatPurchasedTodayKg("");
      setMeatEndShiftRemainingGrams("");
      setMeatNotes("");
      queryClient.invalidateQueries({ queryKey: ["/api/stock-register/latest"] });
    },
  });

  const rollsMutation = useMutation({
    mutationFn: (payload: any) => apiRequest("/api/stock-register/rolls", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => {
      setRollsSaved(true);
      setRollsPurchasedCount("");
      setRollsEndShiftRemainingCount("");
      setRollsNotes("");
      queryClient.invalidateQueries({ queryKey: ["/api/stock-register/latest"] });
    },
  });

  const drinksMissingEntries = drinksNames.some(name => drinkCounts[name] === undefined || drinkCounts[name] === "");
  const drinksSubmitDisabled = !drinksStaffName.trim() || drinksNames.length === 0 || drinksMissingEntries || drinksMutation.isPending;
  const meatSubmitDisabled = !meatStaffName.trim() || meatPurchasedTodayKg === "" || meatEndShiftRemainingGrams === "" || meatMutation.isPending;
  const rollsSubmitDisabled = !rollsStaffName.trim() || rollsPurchasedCount === "" || rollsEndShiftRemainingCount === "" || rollsMutation.isPending;

  return (
    <section className="mb-8">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Stock Registration (End of Shift)</h2>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Drinks Register</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Staff Name"
              value={drinksStaffName}
              onChange={(event) => {
                setDrinksStaffName(event.target.value);
                setDrinksSaved(false);
              }}
            />

            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-3 py-2">Drink</th>
                    <th className="text-left px-3 py-2">End Count</th>
                  </tr>
                </thead>
                <tbody>
                  {drinksNames.map(name => (
                    <tr key={name} className="border-t">
                      <td className="px-3 py-2">{name}</td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          value={drinkCounts[name] ?? ""}
                          onChange={(event) => {
                            setDrinksSaved(false);
                            setDrinkCounts(prev => ({ ...prev, [name]: event.target.value }));
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Textarea
              placeholder="Notes (optional)"
              value={drinksNotes}
              onChange={(event) => {
                setDrinksNotes(event.target.value);
                setDrinksSaved(false);
              }}
            />

            <Button
              className="w-full"
              disabled={drinksSubmitDisabled}
              onClick={() => {
                drinksMutation.mutate({
                  staffName: drinksStaffName,
                  notes: drinksNotes,
                  counts: drinksNames.map(drinkName => ({
                    drinkName,
                    endCount: Number(drinkCounts[drinkName]),
                  })),
                });
              }}
            >
              {drinksMutation.isPending ? "Saving..." : "Submit"}
            </Button>
            {drinksSaved && <p className="text-sm text-green-700">Saved</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Meat Register</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Staff Name"
              value={meatStaffName}
              onChange={(event) => {
                setMeatStaffName(event.target.value);
                setMeatSaved(false);
              }}
            />
            <Input
              type="number"
              min={0}
              step="0.001"
              placeholder="Purchased today (kg)"
              value={meatPurchasedTodayKg}
              onChange={(event) => {
                setMeatPurchasedTodayKg(event.target.value);
                setMeatSaved(false);
              }}
            />
            <Input
              type="number"
              min={0}
              step="0.001"
              placeholder="End-of-shift meat remaining (grams)"
              value={meatEndShiftRemainingGrams}
              onChange={(event) => {
                setMeatEndShiftRemainingGrams(event.target.value);
                setMeatSaved(false);
              }}
            />
            <Textarea
              placeholder="Notes (optional)"
              value={meatNotes}
              onChange={(event) => {
                setMeatNotes(event.target.value);
                setMeatSaved(false);
              }}
            />
            <Button
              className="w-full"
              disabled={meatSubmitDisabled}
              onClick={() => {
                meatMutation.mutate({
                  staffName: meatStaffName,
                  purchasedTodayKg: Number(meatPurchasedTodayKg),
                  endShiftRemainingGrams: Number(meatEndShiftRemainingGrams),
                  notes: meatNotes,
                });
              }}
            >
              {meatMutation.isPending ? "Saving..." : "Submit"}
            </Button>
            {meatSaved && <p className="text-sm text-green-700">Saved</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rolls Register</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Staff Name"
              value={rollsStaffName}
              onChange={(event) => {
                setRollsStaffName(event.target.value);
                setRollsSaved(false);
              }}
            />
            <Input
              type="number"
              min={0}
              step={1}
              placeholder="Rolls Purchased (count)"
              value={rollsPurchasedCount}
              onChange={(event) => {
                setRollsPurchasedCount(event.target.value);
                setRollsSaved(false);
              }}
            />
            <Input
              type="number"
              min={0}
              step={1}
              placeholder="End-of-shift Rolls Remaining (count)"
              value={rollsEndShiftRemainingCount}
              onChange={(event) => {
                setRollsEndShiftRemainingCount(event.target.value);
                setRollsSaved(false);
              }}
            />
            <Textarea
              placeholder="Notes (optional)"
              value={rollsNotes}
              onChange={(event) => {
                setRollsNotes(event.target.value);
                setRollsSaved(false);
              }}
            />
            <Button
              className="w-full"
              disabled={rollsSubmitDisabled}
              onClick={() => {
                rollsMutation.mutate({
                  staffName: rollsStaffName,
                  rollsPurchasedCount: Number(rollsPurchasedCount),
                  endShiftRemainingCount: Number(rollsEndShiftRemainingCount),
                  notes: rollsNotes,
                });
              }}
            >
              {rollsMutation.isPending ? "Saving..." : "Submit"}
            </Button>
            {rollsSaved && <p className="text-sm text-green-700">Saved</p>}
          </CardContent>
        </Card>
      </div>

      {latestQuery.data && (
        <p className="text-xs text-gray-600 mt-3">
          Last submitted: Drinks {latestQuery.data.drinks?.submitted_at ? new Date(latestQuery.data.drinks.submitted_at).toLocaleString() : "-"} | Meat {latestQuery.data.meat?.submitted_at ? new Date(latestQuery.data.meat.submitted_at).toLocaleString() : "-"} | Rolls {latestQuery.data.rolls?.submitted_at ? new Date(latestQuery.data.rolls.submitted_at).toLocaleString() : "-"}
        </p>
      )}
    </section>
  );
}
