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
import {
  VISA_TYPE_OPTIONS,
  SECURITY_CLEARANCE_OPTIONS,
  NOTICE_PERIOD_OPTIONS,
  WORK_ARRANGEMENT_OPTIONS,
  isValidIndex,
  type FieldOption,
} from '@/lib/field-options';
import type { Profile } from '@/lib/schema';

function IndexSelect({
  name,
  options,
  placeholder = 'Select...',
}: {
  name: string;
  options: FieldOption[];
  placeholder?: string;
}) {
  const { control } = useFormContext<Profile>();
  return (
    <Controller
      name={name as keyof Profile}
      control={control}
      render={({ field }) => {
        const value = field.value as number;
        const invalid = typeof value === 'number' && value >= 0 && !isValidIndex(options, value);
        return (
          <Select
            value={value >= 0 ? String(value) : '__none__'}
            onValueChange={(v) => field.onChange(v === '__none__' ? -1 : Number(v))}
          >
            <SelectTrigger
              className={cn(
                'w-auto h-auto border-0 border-b-0 px-0 py-0 text-sm text-right justify-end',
                invalid && 'text-destructive',
              )}
            >
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Select...</SelectItem>
              {options.map((opt, i) => (
                <SelectItem key={i} value={String(i)}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      }}
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
        <IndexSelect name="visaType" options={VISA_TYPE_OPTIONS} />
      </LedgerRow>
      <LedgerRow label="Security Clearance">
        <IndexSelect name="securityClearance" options={SECURITY_CLEARANCE_OPTIONS} />
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
        <IndexSelect name="noticePeriod" options={NOTICE_PERIOD_OPTIONS} />
      </LedgerRow>
      <LedgerToggle name="willingToRelocate" label="Willing to Relocate" />
      <LedgerToggle name="needsRelocationAssistance" label="Needs Relocation Assistance" />
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
              {WORK_ARRANGEMENT_OPTIONS.map((opt) => {
                const selected = field.value.includes(opt.label);
                return (
                  <button
                    key={opt.label}
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
                          ? field.value.filter((v: string) => v !== opt.label)
                          : [...field.value, opt.label],
                      )
                    }
                  >
                    {opt.label}
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
