import { useFormContext, Controller } from 'react-hook-form';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { MonthPicker } from '@/components/ui/month-picker';
import { LedgerRow, LedgerInput } from '@/components/ui/ledger-row';
import { cn } from '@/lib/utils';
import type { Profile } from '@/lib/schema';

const NOTICE_OPTIONS = ['Immediately', '2 weeks', '1 month', '2 months', '3+ months'];
const ARRANGEMENT_OPTIONS = ['Remote', 'Hybrid', 'On-site'];
const VISA_OPTIONS = [
  'US Citizen',
  'Green Card / Permanent Resident',
  'H-1B',
  'L-1',
  'O-1',
  'TN',
  'E-2',
  'OPT',
  'CPT',
  'F-1',
  'Other',
];
const CLEARANCE_OPTIONS = ['None', 'Confidential', 'Secret', 'Top Secret', 'TS/SCI'];

function LedgerSelect({
  name,
  options,
  placeholder = 'Select...',
}: {
  name: string;
  options: string[];
  placeholder?: string;
}) {
  const { control } = useFormContext<Profile>();
  return (
    <Controller
      name={name as keyof Profile}
      control={control}
      render={({ field }) => (
        <Select value={field.value as string} onValueChange={field.onChange}>
          <SelectTrigger className="w-auto h-auto border-0 border-b-0 px-0 py-0 text-sm text-right justify-end">
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {options.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    />
  );
}

function LedgerToggle({ name, label }: { name: keyof Profile; label: string }) {
  const { control } = useFormContext<Profile>();
  return (
    <LedgerRow label={label}>
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <Switch checked={field.value as boolean} onCheckedChange={field.onChange} />
        )}
      />
    </LedgerRow>
  );
}

export function PreferencesSection() {
  const { register, control } = useFormContext<Profile>();

  return (
    <div className="flex flex-col">
      <LedgerToggle name="workAuthorization" label="Work Authorization" />
      <LedgerToggle name="sponsorshipNeeded" label="Requires Sponsorship" />
      <LedgerRow label="Visa Type">
        <LedgerSelect name="visaType" options={VISA_OPTIONS} />
      </LedgerRow>
      <LedgerRow label="Security Clearance">
        <LedgerSelect name="securityClearance" options={CLEARANCE_OPTIONS} />
      </LedgerRow>
      <LedgerRow label="Earliest Start">
        <Controller
          name="earliestStartMonth"
          control={control}
          render={({ field: mf }) => (
            <Controller
              name="earliestStartYear"
              control={control}
              render={({ field: yf }) => (
                <MonthPicker
                  value={
                    mf.value != null && yf.value != null
                      ? { month: mf.value, year: yf.value }
                      : null
                  }
                  onChange={(v) => {
                    mf.onChange(v.month);
                    yf.onChange(v.year);
                  }}
                  placeholder="Select..."
                  alignRight
                  bare
                />
              )}
            />
          )}
        />
      </LedgerRow>
      <LedgerRow label="Notice Period">
        <LedgerSelect name="noticePeriod" options={NOTICE_OPTIONS} />
      </LedgerRow>
      <LedgerToggle name="willingToRelocate" label="Willing to Relocate" />
      <LedgerToggle name="willingToTravel" label="Willing to Travel" />
      <LedgerRow label="Target Salary">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">$</span>
          <LedgerInput
            placeholder="Min"
            aria-label="Min salary"
            className="w-16"
            {...register('salaryMin')}
          />
          <span className="text-muted-foreground">-</span>
          <LedgerInput
            placeholder="Max"
            aria-label="Max salary"
            className="w-16"
            {...register('salaryMax')}
          />
        </div>
      </LedgerRow>
      <LedgerRow label="Work Arrangement" column>
        <Controller
          name="workArrangement"
          control={control}
          render={({ field }) => (
            <div className="flex flex-wrap gap-2">
              {ARRANGEMENT_OPTIONS.map((opt) => {
                const selected = field.value.includes(opt);
                return (
                  <button
                    key={opt}
                    type="button"
                    aria-pressed={selected}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-150 cursor-pointer',
                      selected
                        ? 'bg-foreground text-background border-foreground'
                        : 'bg-transparent text-muted-foreground border-border hover:bg-accent hover:text-accent-foreground',
                    )}
                    onClick={() =>
                      field.onChange(
                        selected
                          ? field.value.filter((v: string) => v !== opt)
                          : [...field.value, opt],
                      )
                    }
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          )}
        />
      </LedgerRow>
      <LedgerToggle name="smsConsent" label="SMS Consent" />
    </div>
  );
}
