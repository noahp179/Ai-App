import { Section, ToggleSetting } from '../settings/controls';
import { useSettings } from '../../lib/settings';
import { MarketplaceAccount } from './Account';

export function MarketplaceSettings() {
  const { settings, update } = useSettings();
  const m = settings.marketplace;
  return (
    <div className="stack-5">
      <Section title="Server and account" description="FlowCompanion includes a free starter set of prompts. Connecting to a marketplace server adds community listings, reviews and trials.">
        <MarketplaceAccount />
      </Section>
      <Section title="Listings and trials">
        <ToggleSetting label="Show paid listings" description="Paid listings can be tried for free when the creator offers a trial. FlowCompanion never charges you." value={m.showPaidListings} onSave={(v) => update({ marketplace: { showPaidListings: v } })} />
        <ToggleSetting label="Trial reminders" description="Notify me a day before a trial ends and when it has ended." value={m.trialExpiryReminders} onSave={(v) => update({ marketplace: { trialExpiryReminders: v } })} />
      </Section>
    </div>
  );
}
