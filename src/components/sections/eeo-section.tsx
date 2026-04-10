import { useFormContext, Controller } from 'react-hook-form';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { LedgerRow } from '@/components/ui/ledger-row';
import { cn } from '@/lib/utils';
import {
  GENDER_OPTIONS,
  TRANSGENDER_OPTIONS,
  SEXUAL_ORIENTATION_OPTIONS,
  RACE_OPTIONS,
  VETERAN_STATUS_OPTIONS,
  DISABILITY_STATUS_OPTIONS,
  isValidIndex,
  type FieldOption,
} from '@/lib/field-options';
import type { Profile } from '@/lib/schema';

function IndexSelect({ name, options }: { name: keyof Profile; options: FieldOption[] }) {
  const { control } = useFormContext<Profile>();
  return (
    <Controller
      name={name}
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
              <SelectValue placeholder="Select..." />
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

export function EeoSection() {
  const { control } = useFormContext<Profile>();

  return (
    <div className="flex flex-col">
      <LedgerRow label="Skip When Optional">
        <Controller
          name="skipEeo"
          control={control}
          render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />}
        />
      </LedgerRow>
      <LedgerRow label="Gender">
        <IndexSelect name="gender" options={GENDER_OPTIONS} />
      </LedgerRow>
      <LedgerRow label="Transgender">
        <IndexSelect name="transgender" options={TRANSGENDER_OPTIONS} />
      </LedgerRow>
      <LedgerRow label="Sexual Orientation">
        <IndexSelect name="sexualOrientation" options={SEXUAL_ORIENTATION_OPTIONS} />
      </LedgerRow>
      <LedgerRow label="Race / Ethnicity">
        <IndexSelect name="race" options={RACE_OPTIONS} />
      </LedgerRow>
      <LedgerRow label="Veteran Status">
        <IndexSelect name="veteranStatus" options={VETERAN_STATUS_OPTIONS} />
      </LedgerRow>
      <LedgerRow label="Disability">
        <IndexSelect name="disabilityStatus" options={DISABILITY_STATUS_OPTIONS} />
      </LedgerRow>
    </div>
  );
}
