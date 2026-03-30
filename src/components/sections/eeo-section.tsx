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
import type { Profile } from '@/lib/schema';

const GENDER_OPTIONS = ['Male', 'Female', 'Non-binary', 'Decline to self-identify'];
const TRANSGENDER_OPTIONS = ['Yes', 'No', 'Decline to self-identify'];
const SEXUAL_ORIENTATION_OPTIONS = [
  'Heterosexual / Straight',
  'Gay',
  'Lesbian',
  'Bisexual',
  'Queer',
  'Asexual',
  'Pansexual',
  'Prefer not to say',
  'Not listed / Other',
];
const RACE_OPTIONS = [
  'American Indian or Alaska Native',
  'Asian',
  'Black or African American',
  'Hispanic or Latino',
  'Native Hawaiian or Other Pacific Islander',
  'White',
  'Two or More Races',
  'Decline to self-identify',
];
const VETERAN_OPTIONS = [
  'I am not a protected veteran',
  'I identify as a protected veteran',
  'Decline to self-identify',
];
const DISABILITY_OPTIONS = [
  'Yes, I have a disability',
  'No, I do not have a disability',
  'Decline to self-identify',
];

function LedgerSelect({ name, options }: { name: keyof Profile; options: string[] }) {
  const { control } = useFormContext<Profile>();
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <Select value={field.value as string} onValueChange={field.onChange}>
          <SelectTrigger className="w-auto h-auto border-0 border-b-0 px-0 py-0 text-sm text-right justify-end">
            <SelectValue placeholder="Select..." />
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
        <LedgerSelect name="gender" options={GENDER_OPTIONS} />
      </LedgerRow>
      <LedgerRow label="Transgender">
        <LedgerSelect name="transgender" options={TRANSGENDER_OPTIONS} />
      </LedgerRow>
      <LedgerRow label="Sexual Orientation">
        <LedgerSelect name="sexualOrientation" options={SEXUAL_ORIENTATION_OPTIONS} />
      </LedgerRow>
      <LedgerRow label="Race / Ethnicity">
        <LedgerSelect name="race" options={RACE_OPTIONS} />
      </LedgerRow>
      <LedgerRow label="Veteran Status">
        <LedgerSelect name="veteranStatus" options={VETERAN_OPTIONS} />
      </LedgerRow>
      <LedgerRow label="Disability">
        <LedgerSelect name="disabilityStatus" options={DISABILITY_OPTIONS} />
      </LedgerRow>
    </div>
  );
}
