import React, { useEffect, useState } from 'react';
import { refundPolicyApi, RefundPolicy, RefundPolicyScreen } from '../../api/refundPolicy.api';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { useToast } from '../../context/ToastContext';
import { Undo2, Save, RotateCcw, AlertTriangle, Info } from 'lucide-react';

const money = (value: number) => `₹${Number(value || 0).toLocaleString('en-IN')}`;

/** A ₹1,000 test, read through each stage's rule, so the figures mean something. */
const SAMPLE_LINE = 1000;

/**
 * The centre's return policy.
 *
 * A patient who changes their mind on the way to the draw room and a patient
 * who asks after the report has been signed are not owed the same thing - the
 * first cost the centre nothing, the second cost it a vial, a reagent and a
 * pathologist's time. This is where the Admin writes what each of those is
 * worth back, once, so the counter is not deciding it at the window.
 */
export const RefundPolicyPage: React.FC = () => {
  const { showToast } = useToast();

  const [screen, setScreen] = useState<RefundPolicyScreen | null>(null);
  const [form, setForm] = useState<RefundPolicy | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const load = async () => {
    try {
      setIsLoading(true);
      const data: RefundPolicyScreen = await refundPolicyApi.get();
      setScreen(data);
      setForm(JSON.parse(JSON.stringify(data.policy)));
    } catch {
      showToast('Could not load the refund policy', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setStage = (stage: string, patch: Partial<{ allowed: boolean; refundPercent: number }>) => {
    setForm((prev) =>
      prev
        ? {
            ...prev,
            stages: { ...prev.stages, [stage]: { ...prev.stages[stage], ...patch } },
          }
        : prev
    );
  };

  const handleSave = async () => {
    if (!form) return;
    try {
      setIsSaving(true);
      await refundPolicyApi.update({
        enabled: form.enabled,
        stages: form.stages,
        cancellationFee: Number(form.cancellationFee) || 0,
        refundWindowDays: Number(form.refundWindowDays) || 0,
        fullRefundOnLabRejection: form.fullRefundOnLabRejection,
        allowAdminOverride: form.allowAdminOverride,
        policyNote: form.policyNote,
      });
      showToast('Refund policy saved - the counter works off it from now on', 'success');
      load();
    } catch (error: any) {
      showToast(error?.message || 'Could not save the refund policy', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const restoreDefaults = () => {
    if (!screen) return;
    setForm(JSON.parse(JSON.stringify(screen.defaults)));
    showToast('Defaults loaded - nothing is saved until you press Save Policy', 'info');
  };

  if (isLoading || !form || !screen) {
    return (
      <div className="flex items-center justify-center p-16 text-xs text-muted-foreground">
        <div className="mr-2 h-5 w-5 animate-spin rounded-full border-2 border-violet-600 border-t-transparent" />
        Loading the refund policy...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
            <Undo2 className="h-6 w-6 text-amber-600" />
            <span>Refund / Return Policy</span>
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            What a patient gets back when they decide against a test they have already been billed for. The
            counter cancels the test against these rules - it never decides the amount at the window.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={restoreDefaults} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            <span>Restore Defaults</span>
          </Button>
          <Button onClick={handleSave} isLoading={isSaving} className="gap-2">
            <Save className="h-4 w-4" />
            <span>Save Policy</span>
          </Button>
        </div>
      </div>

      {/* The master switch */}
      <Card className={form.enabled ? '' : 'border-red-300'}>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <input
              id="refund-enabled"
              type="checkbox"
              className="mt-0.5 h-4 w-4"
              checked={form.enabled}
              onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
            />
            <label htmlFor="refund-enabled" className="cursor-pointer text-xs">
              <span className="block font-bold text-foreground">
                Refund a cancelled test back to the patient
              </span>
              <span className="block text-muted-foreground">
                Switched off, no test can be cancelled for a refund from the counter at all - bills are
                settled by hand instead.
              </span>
            </label>
          </div>
          <Badge variant={form.enabled ? 'success' : 'destructive'}>
            {form.enabled ? 'Refunds allowed' : 'Refunds off'}
          </Badge>
        </CardContent>
      </Card>

      {/* Stage by stage - the heart of the policy */}
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-base font-bold">How much comes back, by how far the work got</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            The stage is read off the patient's own sample, not typed in - so a test already on the bench
            cannot be refunded as though it had never been drawn.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="border-b bg-muted/50 font-semibold text-muted-foreground">
                <tr>
                  <th className="p-3">Stage of the work</th>
                  <th className="p-3">Cancellation allowed</th>
                  <th className="p-3">Refund share</th>
                  <th className="p-3">On a {money(SAMPLE_LINE)} test</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {screen.stageOrder.map((stage) => {
                  const rule = form.stages[stage] || { allowed: false, refundPercent: 0 };
                  const label = screen.stageLabels[stage];
                  const back = rule.allowed
                    ? Math.max(0, Math.round((SAMPLE_LINE * rule.refundPercent) / 100) - (Number(form.cancellationFee) || 0))
                    : 0;

                  return (
                    <tr key={stage} className="align-top transition-colors hover:bg-muted/30">
                      <td className="p-3">
                        <div className="font-bold text-foreground">{label?.label || stage}</div>
                        <div className="mt-0.5 max-w-md text-[11px] text-muted-foreground">
                          {label?.description}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <input
                            id={`allowed-${stage}`}
                            type="checkbox"
                            className="h-3.5 w-3.5"
                            checked={rule.allowed}
                            onChange={(e) => setStage(stage, { allowed: e.target.checked })}
                          />
                          <label htmlFor={`allowed-${stage}`} className="cursor-pointer">
                            {rule.allowed ? 'Allowed' : 'Not allowed'}
                          </label>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            className="w-24"
                            value={rule.refundPercent}
                            disabled={!rule.allowed}
                            onChange={(e) => setStage(stage, { refundPercent: Number(e.target.value) })}
                          />
                          <span className="text-muted-foreground">%</span>
                        </div>
                      </td>
                      <td className="p-3">
                        {rule.allowed ? (
                          <span className="font-mono font-bold text-emerald-600">{money(back)} back</span>
                        ) : (
                          <span className="text-muted-foreground">Nothing back</span>
                        )}
                        {rule.allowed && Number(form.cancellationFee) > 0 && (
                          <div className="text-[11px] text-muted-foreground">
                            after the {money(Number(form.cancellationFee))} cancellation fee
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* The rest of the rules */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="text-base font-bold">Charges and limits</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-4 text-xs">
            <div>
              <label className="mb-1 block font-semibold">Cancellation fee per test (₹)</label>
              <Input
                type="number"
                min={0}
                value={form.cancellationFee}
                onChange={(e) => setForm({ ...form, cancellationFee: Number(e.target.value) })}
              />
              <span className="mt-1 block text-[11px] text-muted-foreground">
                A flat amount the centre keeps on every cancelled test, on top of the stage share above.
                Leave at 0 and only the stage share applies.
              </span>
            </div>

            <div>
              <label className="mb-1 block font-semibold">Cancellation window (days)</label>
              <Input
                type="number"
                min={0}
                value={form.refundWindowDays}
                onChange={(e) => setForm({ ...form, refundWindowDays: Number(e.target.value) })}
              />
              <span className="mt-1 block text-[11px] text-muted-foreground">
                How long after the bill a cancellation is still entertained. 0 means no time limit at all.
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle className="text-base font-bold">Exceptions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-4 text-xs">
            <div className="flex items-start gap-3">
              <input
                id="lab-rejection"
                type="checkbox"
                className="mt-0.5 h-3.5 w-3.5"
                checked={form.fullRefundOnLabRejection}
                onChange={(e) => setForm({ ...form, fullRefundOnLabRejection: e.target.checked })}
              />
              <label htmlFor="lab-rejection" className="cursor-pointer">
                <span className="block font-semibold">Full refund when the lab rejected the sample</span>
                <span className="block text-[11px] text-muted-foreground">
                  A haemolysed or clotted specimen is not the patient's doing. With this on, a patient who
                  declines the re-draw is refunded as though nothing had been collected.
                </span>
              </label>
            </div>

            <div className="flex items-start gap-3">
              <input
                id="admin-override"
                type="checkbox"
                className="mt-0.5 h-3.5 w-3.5"
                checked={form.allowAdminOverride}
                onChange={(e) => setForm({ ...form, allowAdminOverride: e.target.checked })}
              />
              <label htmlFor="admin-override" className="cursor-pointer">
                <span className="block font-semibold">Let an Admin override the policy, with a reason</span>
                <span className="block text-[11px] text-muted-foreground">
                  For the case the rules do not cover. The reason is written onto the refund record, so an
                  override is always traceable to whoever made it.
                </span>
              </label>
            </div>

            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-900">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                A refund never hands back more than the patient actually paid. Anything cancelled but not yet
                paid for simply comes off what they owe.
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-base font-bold">What the patient is told</CardTitle>
        </CardHeader>
        <CardContent className="p-4 text-xs">
          <textarea
            className="min-h-28 w-full rounded-xl border border-input bg-background p-3 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
            value={form.policyNote}
            onChange={(e) => setForm({ ...form, policyNote: e.target.value })}
            placeholder="The policy in plain words, as the counter would read it out."
          />
          <div className="mt-2 flex items-start gap-2 text-[11px] text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>Shown on the cancellation screen whenever a test is being called off.</span>
          </div>
        </CardContent>
      </Card>

      {form.updatedBy?.name && (
        <p className="text-[11px] text-muted-foreground">
          Last changed by {form.updatedBy.name} ({form.updatedBy.role})
          {form.updatedAt ? ` on ${new Date(form.updatedAt).toLocaleString('en-IN')}` : ''}.
        </p>
      )}
    </div>
  );
};
