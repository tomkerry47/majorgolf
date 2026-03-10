import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const ruleChanges = [
  "Default player allocations now use the lowest available golfers remaining in the world top 50.",
  "Top-five scoring is now differentiated: 2nd = 20 points, 3rd = 18 points, 4th = 16 points, 5th = 14 points.",
  "Each event now includes an in-play prize.",
];

const coreRules = [
  "Pick 3 golfers for each event. You cannot reuse golfers later, so you will use 15 golfers across the 5 events: the 4 Majors plus The Players.",
  "If you miss the selection deadline, you will be allocated the 3 lowest-ranked golfers you have left inside the world top 50.",
  "Entry is £20. Prize split will be confirmed once numbers are finalised, but the current plan is 50% to the winner, 25% to the runner-up, and 25% spread across the top score in each tournament.",
];

const points = [
  { label: "Win", value: "25 points" },
  { label: "2nd", value: "20 points" },
  { label: "3rd", value: "18 points" },
  { label: "4th", value: "16 points" },
  { label: "5th", value: "14 points" },
  { label: "Top 10 finish", value: "10 points" },
  { label: "Top 20 finish", value: "5 points" },
  { label: "Top 30 finish", value: "1 point" },
  { label: "Missed cut or any withdrawal", value: "-7 points" },
  { label: "Hole in one", value: "20 points" },
];

const chipsAndBonuses = [
  "Wildcard: any selected golfer ranked outside the world top 50 scores double points.",
  "Mulligan chip: can be used once to swap out one of your picks before round 2 starts for any other player. It can be used to avoid a withdrawal or missed-cut penalty, or to bring in a round-1 leader. It cannot be combined with the captain chip. In 2025, it can still be used to bring in a wildcard for double points.",
  "Captain chip: can be used once for double points, but not in combination with the mulligan chip.",
];

const notes = [
  "Top finishes include ties.",
  "Missing the cut also includes a pre-tournament withdrawal, or a withdrawal during rounds 1 or 2.",
];

export default function Rules() {
  return (
    <div className="py-6">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 md:px-8 space-y-6">
        <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 via-white to-emerald-50 p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">Major Golf 2026</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">League Rules</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
            Welcome to the golf predictor league. Thanks for the suggestions on the rule tweaks for 2026.
          </p>
        </div>

        <Card className="border-amber-200">
          <CardHeader>
            <CardTitle>2026 Rule Changes</CardTitle>
            <CardDescription>What is different this season.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm text-slate-700">
              {ruleChanges.map((item) => (
                <li key={item} className="flex gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-amber-500" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <CardHeader>
              <CardTitle>Core Rules</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-4 text-sm leading-6 text-slate-700">
                {coreRules.map((item) => (
                  <li key={item} className="flex gap-3">
                    <span className="mt-1 h-2 w-2 rounded-full bg-slate-900" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-primary/5 shadow-sm">
            <CardHeader>
              <CardTitle className="text-primary">Quick Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-700">
              <div className="rounded-xl bg-white/80 px-4 py-3 ring-1 ring-primary/10">
                <p>5 events total: The Players plus the 4 Majors.</p>
              </div>
              <div className="rounded-xl bg-white/80 px-4 py-3 ring-1 ring-primary/10">
                <p>3 golfers per event, 15 golfers used across the full season.</p>
              </div>
              <div className="rounded-xl bg-white/80 px-4 py-3 ring-1 ring-primary/10">
                <p>Entry fee: £20.</p>
              </div>
              <div className="rounded-xl bg-white/80 px-4 py-3 ring-1 ring-primary/10">
                <p>Late picks are auto-assigned from your lowest available top-50 players.</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Points Scoring</CardTitle>
            <CardDescription>Top finishes include ties.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {points.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
                >
                  <span className="text-sm font-medium text-slate-700">{item.label}</span>
                  <span className="text-sm font-semibold text-slate-900">{item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Chips And Bonuses</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-4 text-sm leading-6 text-slate-700">
                {chipsAndBonuses.map((item) => (
                  <li key={item} className="flex gap-3">
                    <span className="mt-1 h-2 w-2 rounded-full bg-emerald-500" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-4 text-sm leading-6 text-slate-700">
                {notes.map((item) => (
                  <li key={item} className="flex gap-3">
                    <span className="mt-1 h-2 w-2 rounded-full bg-rose-500" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
