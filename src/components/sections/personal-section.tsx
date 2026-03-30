import { useFormContext, Controller } from 'react-hook-form';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Combobox } from '@/components/ui/combobox';
import { DatePicker } from '@/components/ui/date-picker';
import { LedgerRow, LedgerInput } from '@/components/ui/ledger-row';
import { COUNTRIES } from '@/lib/countries';
import type { Profile } from '@/lib/schema';

const US_STATES: [string, string][] = [
  ['AL', 'Alabama'],
  ['AK', 'Alaska'],
  ['AZ', 'Arizona'],
  ['AR', 'Arkansas'],
  ['CA', 'California'],
  ['CO', 'Colorado'],
  ['CT', 'Connecticut'],
  ['DE', 'Delaware'],
  ['FL', 'Florida'],
  ['GA', 'Georgia'],
  ['HI', 'Hawaii'],
  ['ID', 'Idaho'],
  ['IL', 'Illinois'],
  ['IN', 'Indiana'],
  ['IA', 'Iowa'],
  ['KS', 'Kansas'],
  ['KY', 'Kentucky'],
  ['LA', 'Louisiana'],
  ['ME', 'Maine'],
  ['MD', 'Maryland'],
  ['MA', 'Massachusetts'],
  ['MI', 'Michigan'],
  ['MN', 'Minnesota'],
  ['MS', 'Mississippi'],
  ['MO', 'Missouri'],
  ['MT', 'Montana'],
  ['NE', 'Nebraska'],
  ['NV', 'Nevada'],
  ['NH', 'New Hampshire'],
  ['NJ', 'New Jersey'],
  ['NM', 'New Mexico'],
  ['NY', 'New York'],
  ['NC', 'North Carolina'],
  ['ND', 'North Dakota'],
  ['OH', 'Ohio'],
  ['OK', 'Oklahoma'],
  ['OR', 'Oregon'],
  ['PA', 'Pennsylvania'],
  ['RI', 'Rhode Island'],
  ['SC', 'South Carolina'],
  ['SD', 'South Dakota'],
  ['TN', 'Tennessee'],
  ['TX', 'Texas'],
  ['UT', 'Utah'],
  ['VT', 'Vermont'],
  ['VA', 'Virginia'],
  ['WA', 'Washington'],
  ['WV', 'West Virginia'],
  ['WI', 'Wisconsin'],
  ['WY', 'Wyoming'],
  ['DC', 'District of Columbia'],
];

function PersonalInput({
  name,
  placeholder,
  type = 'text',
}: {
  name: keyof Profile;
  placeholder: string;
  type?: string;
}) {
  const { register } = useFormContext<Profile>();
  return (
    <LedgerInput type={type} placeholder={placeholder} aria-label={name} {...register(name)} />
  );
}

export function PersonalSection() {
  const { control, watch } = useFormContext<Profile>();
  const firstName = watch('firstName');
  const lastName = watch('lastName');
  const email = watch('email');
  const isEmpty = !firstName && !lastName && !email;

  return (
    <div className="flex flex-col">
      <AnimatePresence>
        {isEmpty && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-[11px] text-muted-foreground/50 leading-relaxed pb-4"
          >
            Start by adding your name and email. These are the minimum fields needed to auto-fill
            applications.
          </motion.p>
        )}
      </AnimatePresence>
      <LedgerRow label="First Name">
        <PersonalInput name="firstName" placeholder="John" />
      </LedgerRow>
      <LedgerRow label="Last Name">
        <PersonalInput name="lastName" placeholder="Doe" />
      </LedgerRow>
      <LedgerRow label="Preferred Name">
        <PersonalInput name="preferredName" placeholder="Optional" />
      </LedgerRow>
      <LedgerRow label="Email">
        <PersonalInput name="email" placeholder="john@example.com" type="email" />
      </LedgerRow>
      <LedgerRow label="Phone">
        <PersonalInput name="phone" placeholder="+1 (555) 000-0000" type="tel" />
      </LedgerRow>
      <LedgerRow label="Address Line 1">
        <PersonalInput name="address1" placeholder="123 Main St" />
      </LedgerRow>
      <LedgerRow label="Address Line 2">
        <PersonalInput name="address2" placeholder="Apt 4B (optional)" />
      </LedgerRow>
      <LedgerRow label="City">
        <PersonalInput name="city" placeholder="San Francisco" />
      </LedgerRow>

      <div className="relative flex items-center py-3.5">
        <label className="text-[10px] uppercase tracking-[0.05em] font-medium text-muted-foreground shrink-0 w-1/3">
          State / Zip
        </label>
        <div className="flex-1 flex items-center gap-2 justify-end">
          <div className="w-1/2">
            <Controller
              name="state"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full h-auto border-0 border-b-0 px-0 py-0 text-sm text-right justify-end">
                    <SelectValue placeholder="State..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {US_STATES.map(([abbr, name]) => (
                      <SelectItem key={abbr} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <span className="text-muted-foreground/40 text-xs">/</span>
          <div className="w-20">
            <PersonalInput name="zipCode" placeholder="94102" />
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-px bg-border" />
      </div>

      <LedgerRow label="Country">
        <Controller
          name="country"
          control={control}
          render={({ field }) => (
            <Combobox
              value={field.value}
              onValueChange={field.onChange}
              options={COUNTRIES}
              placeholder="Select country..."
              searchPlaceholder="Search countries..."
              alignRight
              bare
            />
          )}
        />
      </LedgerRow>
      <LedgerRow label="Date of Birth">
        <Controller
          name="dateOfBirth"
          control={control}
          render={({ field }) => (
            <DatePicker
              value={field.value}
              onChange={field.onChange}
              placeholder="Select date..."
              alignRight
              bare
            />
          )}
        />
      </LedgerRow>
    </div>
  );
}
