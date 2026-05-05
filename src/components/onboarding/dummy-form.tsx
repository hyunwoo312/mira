import { useState } from 'react';
import { Check, Upload } from 'lucide-react';

// Mimics a Greenhouse / Ashby application form. The inputs use real
// `name`/`id` attributes (`first_name`, `email`, `school--0`, etc.) so
// Mira's scanner classifies them the same way it would on a live ATS.

interface DummyFormProps {
  onSubmit: () => void;
}

export function DummyForm({ onSubmit }: DummyFormProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <header className="px-8 py-6 border-b border-border bg-muted/30">
        <p className="text-[10px] uppercase tracking-[0.12em] font-medium text-muted-foreground/70">
          Demo Co. Careers
        </p>
        <h3 className="text-[22px] leading-tight tracking-tight text-foreground mt-1">
          <span className="font-light text-foreground/45">Apply for </span>
          <span className="font-medium">Software Engineer.</span>
        </h3>
        <p className="text-[12px] text-muted-foreground mt-2">
          San Francisco, CA · Full-time · Remote-friendly
        </p>
      </header>

      <form onSubmit={handleSubmit} className="px-8 py-7 flex flex-col gap-8">
        <FormSection title="Personal Information">
          <div className="grid grid-cols-2 gap-4">
            <Field label="First Name" required>
              <input id="first_name" name="first_name" type="text" className={INPUT_CLS} />
            </Field>
            <Field label="Last Name" required>
              <input id="last_name" name="last_name" type="text" className={INPUT_CLS} />
            </Field>
          </div>
          <Field label="Email" required>
            <input id="email" name="email" type="email" className={INPUT_CLS} />
          </Field>
          <Field label="Phone" required>
            <input id="phone" name="phone" type="tel" className={INPUT_CLS} />
          </Field>
          <Field label="Location (City, State)" required>
            <input
              id="candidate-location"
              name="location"
              type="text"
              className={INPUT_CLS}
              placeholder="e.g. San Francisco, CA"
            />
          </Field>
        </FormSection>

        <FormSection title="Profile & Documents">
          <Field label="LinkedIn Profile">
            <input
              id="question_linkedin"
              name="linkedin"
              type="url"
              className={INPUT_CLS}
              placeholder="https://linkedin.com/in/..."
            />
          </Field>
          <Field label="GitHub Profile">
            <input
              id="question_github"
              name="github"
              type="url"
              className={INPUT_CLS}
              placeholder="https://github.com/..."
            />
          </Field>
          <Field label="Website / Portfolio">
            <input
              id="question_portfolio"
              name="website"
              type="url"
              className={INPUT_CLS}
              placeholder="https://..."
            />
          </Field>
          <FileField label="Resume / CV" name="resume" id="resume" />
          <FileField label="Cover Letter" name="cover_letter" id="cover_letter" />
        </FormSection>

        <FormSection title="Education">
          <Field label="School" required>
            <input id="school--0" name="school" type="text" className={INPUT_CLS} />
          </Field>
          <Field label="Degree" required>
            <input id="degree--0" name="degree" type="text" className={INPUT_CLS} />
          </Field>
          <Field label="Discipline / Field of Study">
            <input id="discipline--0" name="discipline" type="text" className={INPUT_CLS} />
          </Field>
        </FormSection>

        <FormSection title="Work Authorization">
          <YesNoField
            label="Are you authorized to work in the United States?"
            name="work_auth"
            id="work_auth"
            required
          />
          <YesNoField
            label="Will you now or in the future require visa sponsorship?"
            name="sponsorship"
            id="sponsorship"
            required
          />
        </FormSection>

        <FormSection
          title="Voluntary Self-Identification"
          subtitle="Optional. Used by employers for EEO reporting."
        >
          <SelectField
            label="Race / Ethnicity"
            name="race"
            id="race"
            options={[
              'American Indian or Alaska Native',
              'Asian',
              'Black or African American',
              'Hispanic or Latino',
              'Native Hawaiian or Other Pacific Islander',
              'White',
              'Two or More Races',
              'Decline to self-identify',
            ]}
          />
          <SelectField
            label="Gender"
            name="gender"
            id="gender"
            options={['Male', 'Female', 'Non-binary', 'Decline to self-identify']}
          />
          <SelectField
            label="Veteran Status"
            name="veteran_status"
            id="veteran_status"
            options={[
              'I am not a protected veteran',
              'I identify as a protected veteran',
              "I don't wish to answer",
            ]}
          />
          <SelectField
            label="Disability Status"
            name="disability_status"
            id="disability_status"
            options={[
              'Yes, I have a disability, or have had one in the past',
              'No, I do not have a disability and have not had one in the past',
              'I do not want to answer',
            ]}
          />
        </FormSection>

        <div className="flex items-center justify-between pt-4 border-t border-border">
          <p className="text-[11px] text-muted-foreground/60 leading-relaxed max-w-[280px]">
            This is a demo form. Submitting it does nothing.
          </p>
          <button
            type="submit"
            className="px-6 py-2.5 rounded-md bg-foreground text-background text-[13px] font-medium hover:opacity-90 transition-opacity cursor-pointer"
          >
            Submit Application
          </button>
        </div>
      </form>
    </div>
  );
}

const INPUT_CLS =
  'w-full h-9 px-3 rounded-md border border-border bg-background text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-foreground/40 transition-colors';

function FormSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-0.5">
        <h4 className="text-[10px] uppercase tracking-[0.12em] font-medium text-muted-foreground">
          {title}
        </h4>
        {subtitle && <p className="text-[11px] text-muted-foreground/60">{subtitle}</p>}
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12px] font-medium text-foreground/80">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </span>
      {children}
    </label>
  );
}

function FileField({
  label,
  name,
  id,
  required,
}: {
  label: string;
  name: string;
  id: string;
  required?: boolean;
}) {
  const [filename, setFilename] = useState<string | null>(null);

  return (
    <Field label={label} required={required}>
      <label className="group flex items-center gap-2.5 h-9 px-3 rounded-md border border-dashed border-border bg-muted/30 text-[12px] text-muted-foreground hover:border-foreground/40 hover:text-foreground transition-colors cursor-pointer">
        {filename ? (
          <>
            <Check size={13} className="text-foreground/70" />
            <span className="text-foreground/80">{filename}</span>
          </>
        ) : (
          <>
            <Upload size={12} />
            <span>Choose a file</span>
          </>
        )}
        <input
          type="file"
          id={id}
          name={name}
          accept=".pdf,.doc,.docx"
          className="hidden"
          onChange={(e) => setFilename(e.target.files?.[0]?.name ?? null)}
        />
      </label>
    </Field>
  );
}

function YesNoField({
  label,
  name,
  id,
  required,
}: {
  label: string;
  name: string;
  id: string;
  required?: boolean;
}) {
  return (
    <Field label={label} required={required}>
      <select id={id} name={name} className={INPUT_CLS} defaultValue="">
        <option value="" disabled></option>
        <option value="Yes">Yes</option>
        <option value="No">No</option>
      </select>
    </Field>
  );
}

function SelectField({
  label,
  name,
  id,
  options,
}: {
  label: string;
  name: string;
  id: string;
  options: string[];
}) {
  return (
    <Field label={label}>
      <select id={id} name={name} className={INPUT_CLS} defaultValue="">
        <option value="" disabled></option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </Field>
  );
}
